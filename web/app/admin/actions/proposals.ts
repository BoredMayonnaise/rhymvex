"use server";

import { revalidatePath } from "next/cache";
import { queryOne, tx } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import type { ActionResult } from "./leads";

/**
 * Move a proposal through its states.
 *
 * `status` is cast in every use below: the column is an enum and the same
 * parameter is also compared against text literals, which makes Postgres deduce
 * two different types for it and refuse the statement.
 */
export async function updateProposalStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("proposals.write")) {
    return { ok: false, error: "Your role cannot change proposals." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const proposalId = String(formData.get("proposal_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "WITHDRAWN"];
  if (!proposalId || !allowed.includes(status)) {
    return { ok: false, error: "Invalid status change." };
  }

  // Sending is the commercial gate, and it is separate from editing on purpose:
  // OPERATIONS can move a proposal through DRAFT/WITHDRAWN but only an account
  // manager can put pricing and scope in front of a client. The UI already
  // disables the transition on `canSend`, which is a usability affordance and not
  // a boundary, so the target status has to be checked here against the real
  // permission rather than against the blanket `proposals.write` above.
  if (status === "SENT" && !session.permissions.has("proposals.send")) {
    return { ok: false, error: "Your role cannot send proposals." };
  }

  const meta = await requestMeta();

  const proposal = await queryOne<{
    id: string;
    reference: string;
    title: string;
    status: string;
    client_id: string | null;
    lead_id: string | null;
  }>("SELECT id, reference, title, status, client_id, lead_id FROM proposals WHERE id = $1", [proposalId]);

  if (!proposal) return { ok: false, error: "Proposal not found." };

  await tx(async (client) => {
    await client.query(
      `UPDATE proposals SET
         status = $1::proposal_status,
         sent_at = CASE WHEN $1::proposal_status = 'SENT' AND sent_at IS NULL THEN now() ELSE sent_at END,
         decided_at = CASE WHEN $1::proposal_status IN ('ACCEPTED','DECLINED') THEN now() ELSE decided_at END,
         updated_at = now()
       WHERE id = $2`,
      [status, proposalId],
    );

    // Accepting a proposal advances the lead, so the pipeline reflects reality
    // without anyone re-entering the status in two places.
    if (status === "ACCEPTED" && proposal.lead_id) {
      await client.query(
        "UPDATE leads SET status = 'NEGOTIATION', updated_at = now() WHERE id = $1 AND status IN ('PROPOSAL','CONSULTATION','QUALIFIED','REVIEWING')",
        [proposal.lead_id],
      );
    }

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: status === "SENT" ? "proposal.sent" : "proposal.updated",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { from: proposal.status, to: status, reference: proposal.reference },
        ...meta,
      },
      client,
    );
  });

  revalidatePath(`/admin/proposals/${proposalId}`);
  revalidatePath("/admin/proposals");
  revalidatePath("/admin");
  // Accepting is visible to the client, and so is an accepted proposal
  // becoming the basis of a contract.
  revalidatePath("/portal/proposals");
  revalidatePath("/portal/contracts");

  return { ok: true, status, message: `Proposal marked ${humanise(status).toLowerCase()}.` };
}
