"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { uniqueReference } from "@/lib/db/reference";
import { contractSchema, fieldErrors } from "@/lib/validation";
import { addClientActivity } from "@/lib/data/clients";
import { fromAddress, sendMail, siteUrl } from "@/lib/mail/smtp";
import { contractSentEmail } from "@/lib/mail/templates";
import type { ActionResult } from "./leads";

/**
 * Draft a contract, usually from an accepted proposal.
 *
 * The proposal is the source of truth for the commercial terms, so the form is
 * prefilled from it rather than retyped. Only the drafting staff member can do
 * this; sending is a separate, separately-gated step.
 */
export async function createContractFromProposalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("contracts.write")) {
    return { ok: false, error: "Your role cannot draft contracts." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const proposalId = String(formData.get("proposal_id") ?? "");
  if (!isRecordId(proposalId)) return { ok: false, error: "Missing proposal reference." };

  const proposal = await queryOne<{
    id: string;
    reference: string;
    client_id: string | null;
    project_id: string | null;
    title: string;
    scope: string | null;
    deliverables: string[];
    exclusions: string[];
    investment: number | null;
    currency: string;
    status: string;
    client_name: string | null;
  }>(
    `SELECT p.id, p.reference, p.client_id, p.project_id, p.title, p.scope, p.deliverables,
            p.exclusions, p.investment, p.currency, p.status, c.name AS client_name
       FROM proposals p LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.id = $1`,
    [proposalId],
  );

  if (!proposal) return { ok: false, error: "Proposal not found." };
  // A contract is an agreement, so it cannot predate the acceptance that
  // authorised it.
  if (proposal.status !== "ACCEPTED") {
    return { ok: false, error: "Accept the proposal before drafting a contract from it." };
  }
  if (!proposal.client_id) {
    return { ok: false, error: "This proposal has no client yet. Create the client first." };
  }

  const parsed = contractSchema.safeParse({
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    project_id: proposal.project_id,
    title: formData.get("title") || proposal.title,
    body: formData.get("body") || "",
    value_total: formData.get("value_total") || proposal.investment || null,
    currency: formData.get("currency") || proposal.currency,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the contract details.", fields: fieldErrors(parsed.error) };
  }

  // One contract per proposal: a second draft would be a duplicate of the same
  // agreement, and the reference is unique so it would fail the insert anyway.
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM contracts WHERE proposal_id = $1",
    [proposal.id],
  );
  if (existing) return { ok: false, error: "A contract already exists for this proposal." };

  const data = parsed.data;
  const reference = await uniqueReference("contracts", "CON");
  const meta = await requestMeta();

  const contract = await queryOne<{ id: string }>(
    `INSERT INTO contracts (reference, client_id, proposal_id, project_id, title, body, value_total, currency, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      reference, data.client_id, proposal.id, data.project_id, data.title, data.body,
      data.value_total, data.currency, session.staffId,
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "contract.created",
      entityType: "contract",
      entityId: contract?.id,
      metadata: { reference, proposal: proposal.reference, title: data.title },
      ...meta,
    },
  );

  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/proposals/${proposal.id}`);
  revalidatePath(`/admin/clients/${data.client_id}`);

  // The id comes back so the caller can send the new draft straight to its
  // detail page rather than making them find it in a list again.
  return { ok: true, message: "Contract drafted.", contractId: contract?.id ?? null };
}

/**
 * Put a contract in front of the client.
 *
 * Gated on `contracts.send`, not the blanket `contracts.write`, mirroring the
 * proposal rule: drafting is routine, putting a commitment in front of someone
 * is not.
 */
export async function sendContractAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("contracts.write")) {
    return { ok: false, error: "Your role cannot change contracts." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }
  if (!session.permissions.has("contracts.send")) {
    return { ok: false, error: "Your role cannot send contracts." };
  }

  const contractId = String(formData.get("contract_id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!isRecordId(contractId) || !["SENT", "AWAITING_SIGNATURE"].includes(next)) {
    return { ok: false, error: "Invalid status change." };
  }

  const contract = await queryOne<{
    id: string;
    reference: string;
    title: string;
    body: string | null;
    value_total: number | null;
    currency: string;
    status: string;
    client_id: string;
    client_name: string;
    proposal_id: string | null;
    client_contact_id: string | null;
  }>(
    `SELECT ct.id, ct.reference, ct.title, ct.body, ct.value_total, ct.currency, ct.status,
            ct.client_id, ct.proposal_id, c.name AS client_name
       FROM contracts ct JOIN clients c ON c.id = ct.client_id
      WHERE ct.id = $1`,
    [contractId],
  );
  if (!contract) return { ok: false, error: "Contract not found." };
  if (!["DRAFT", "SENT"].includes(contract.status)) {
    return { ok: false, error: "Only a draft can be sent." };
  }

  const meta = await requestMeta();

  await query(
    `UPDATE contracts
        SET status = $1::contract_status,
            sent_at = COALESCE(sent_at, now()),
            updated_at = now()
      WHERE id = $2`,
    [next, contractId],
  );

  // The client is reached through the portal they were invited to, so the
  // notification goes to their portal address rather than hunting for a
  // contact record that may not exist.
  const recipients = await query<{ email: string; name: string }>(
    `SELECT email, name FROM client_users WHERE client_id = $1 AND active = true`,
    [contract.client_id],
  );

  if (recipients.length > 0) {
    const rendered = contractSentEmail({
      contractTitle: contract.title,
      reference: contract.reference,
      clientName: contract.client_name,
      valueTotal: contract.value_total,
      currency: contract.currency,
    });

    for (const recipient of recipients) {
      await sendMail({
        kind: "OUTBOUND",
        to: recipient.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        relatedType: "client",
        relatedId: contract.client_id,
      });
    }

    await addClientActivity({
      clientId: contract.client_id,
      kind: "contract",
      title: "Contract sent for signature",
      detail: contract.title,
    });
  }

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "contract.sent",
      entityType: "contract",
      entityId: contractId,
      metadata: { reference: contract.reference, to: recipients.length },
      ...meta,
    },
  );

  revalidatePath(`/admin/contracts/${contractId}`);
  revalidatePath("/admin/contracts");
  revalidatePath("/portal/contracts");

  return {
    ok: true,
    status: next,
    message:
      recipients.length > 0
        ? "Sent. The client can sign it in their portal."
        : "Sent. No portal user to notify yet — invite one from the client record.",
  };
}

/**
 * Revise the agreement text.
 *
 * Refused once the contract has been signed: a client agreed to specific
 * wording, and quietly editing it afterwards would make their signature mean
 * something other than what they signed. Changing a signed agreement means
 * drafting a new contract.
 */
export async function updateContractBodyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("contracts.write")) {
    return { ok: false, error: "Your role cannot change contracts." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const contractId = String(formData.get("contract_id") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 20000);
  if (!isRecordId(contractId)) return { ok: false, error: "Missing contract reference." };

  const contract = await queryOne<{ id: string; status: string; signed_at: Date | null }>(
    "SELECT id, status, signed_at FROM contracts WHERE id = $1",
    [contractId],
  );
  if (!contract) return { ok: false, error: "Contract not found." };
  if (contract.signed_at) {
    return { ok: false, error: "This contract is signed. Draft a new one instead." };
  }
  if (body.length === 0) {
    return { ok: false, error: "An agreement cannot be empty." };
  }

  await query("UPDATE contracts SET body = $2, updated_at = now() WHERE id = $1", [
    contractId,
    body,
  ]);

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "contract.updated",
      entityType: "contract",
      entityId: contractId,
      metadata: { characters: body.length },
      ...(await requestMeta()),
    },
  );

  revalidatePath(`/admin/contracts/${contractId}`);
  return { ok: true, message: "Agreement text saved." };
}

/** Staff-side transitions that do not involve the client. */
export async function updateContractStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("contracts.write")) {
    return { ok: false, error: "Your role cannot change contracts." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const contractId = String(formData.get("contract_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["ACTIVE", "COMPLETED", "TERMINATED"];
  if (!isRecordId(contractId) || !allowed.includes(status)) {
    return { ok: false, error: "Invalid status change." };
  }

  const contract = await queryOne<{ id: string; status: string; title: string }>(
    "SELECT id, status, title FROM contracts WHERE id = $1",
    [contractId],
  );
  if (!contract) return { ok: false, error: "Contract not found." };
  // Only a signed contract can be live. That is the whole point of it.
  if (status !== "TERMINATED" && contract.status !== "SIGNED") {
    return { ok: false, error: "Only a signed contract can be activated or completed." };
  }

  await query(
    "UPDATE contracts SET status = $1::contract_status, updated_at = now() WHERE id = $2",
    [status, contractId],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "contract.updated",
      entityType: "contract",
      entityId: contractId,
      metadata: { from: contract.status, to: status },
      ...(await requestMeta()),
    },
  );

  revalidatePath(`/admin/contracts/${contractId}`);
  revalidatePath("/admin/contracts");
  // The client's portal shows their contracts, so a status change here is
  // theirs too.
  revalidatePath("/portal/contracts");
  return { ok: true, status, message: `Marked ${humanise(status).toLowerCase()}.` };
}
