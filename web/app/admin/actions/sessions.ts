"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import type { ActionResult } from "./leads";

/**
 * End someone else's session.
 *
 * The case this exists for is a lost or stolen device: an admin needs to be able
 * to close a live sign-in without waiting out its TTL, and without having to
 * disable the account and lock the legitimate owner out too.
 *
 * The caller's own session cannot be revoked from this page — the revoke
 * button is not rendered for it, and the row is rejected below as well, so a
 * stray POST cannot sign the person making it out of their own workspace.
 */
export async function revokeSessionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("security.manage")) {
    return { ok: false, error: "Your role cannot revoke sessions." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const id = String(formData.get("session_id") ?? "");
  if (!id) return { ok: false, error: "Missing session reference." };

  const meta = await requestMeta();

  // Either table, one query — the id is the primary key in both, so a session
  // from the wrong workspace simply does not match. `s.id` has to be qualified:
  // bare `id` is ambiguous against the joined person in both branches.
  const target = await queryOne<{
    id: string;
    scope: string;
    person: string;
    email: string;
  }>(
    `SELECT s.id, 'team'::text AS scope, st.name AS person, st.email AS email
       FROM sessions s JOIN staff st ON st.id = s.staff_id WHERE s.id = $1
     UNION ALL
     SELECT s.id, 'client'::text AS scope, u.name AS person, u.email AS email
       FROM client_sessions s JOIN client_users u ON u.id = s.client_user_id WHERE s.id = $1`,
    [id],
  );

  if (!target) return { ok: true, message: "That session has already ended." };

  if (target.scope === "team") {
    const owner = await queryOne<{ staff_id: string }>(
      "SELECT staff_id FROM sessions WHERE id = $1",
      [id],
    );
    if (owner?.staff_id === session.staffId) {
      return { ok: false, error: "You cannot end your own session from here." };
    }
  }

  await query("DELETE FROM sessions WHERE id = $1", [id]);
  await query("DELETE FROM client_sessions WHERE id = $1", [id]);

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "session.revoked",
      entityType: "session",
      // `entity_id` is a uuid column and a session id is `uuid.mac` — not one.
      // It goes in the metadata instead; passing it here raised a Postgres type
      // error that surfaced as a 500 after the revoke had already landed.
      entityId: null,
      metadata: {
        sessionId: id,
        scope: target.scope,
        person: target.person,
        email: target.email,
      },
      ...meta,
    },
  );

  revalidatePath("/admin/security");
  return { ok: true, message: `Ended ${target.person}'s session.` };
}