"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db/client";
import { getClientSession, csrfValid } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { fieldErrors, messageSchema } from "@/lib/validation";
import { addClientActivity } from "@/lib/data/clients";
import { validatePasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";
import { queryOne } from "@/lib/db/client";

/**
 * Client portal actions.
 *
 * The client id is always read from the session. No action here accepts a client
 * id, a project id belonging to someone else, or any other tenant identifier
 * from the form, which is what makes tenant isolation a property of the code
 * rather than a rule someone has to remember.
 */

export type PortalActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

export async function sendPortalMessageAction(
  _prev: PortalActionResult | null,
  formData: FormData,
): Promise<PortalActionResult> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = messageSchema.safeParse({
    subject: formData.get("subject") || "",
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check your message.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();

  await query(
    `INSERT INTO messages (client_id, subject, body, from_client_user)
     VALUES ($1, $2, $3, $4)`,
    [session.clientId, parsed.data.subject || null, parsed.data.body, session.clientUserId],
  );

  // The client-safe activity feed is separate from the audit trail, so a portal
  // user reads this and never the internal record.
  await addClientActivity({
    clientId: session.clientId,
    kind: "message",
    title: "Message sent",
    detail: parsed.data.subject || null,
  });

  await recordAudit(
    { type: "client", id: session.clientUserId, label: session.name },
    {
      action: "email.received",
      entityType: "client",
      entityId: session.clientId,
      metadata: { from: "portal", subject: parsed.data.subject || null },
      ...meta,
    },
  );

  revalidatePath("/portal/messages");
  revalidatePath("/portal");

  return { ok: true, message: "Sent." };
}

export async function updateProfileAction(
  _prev: PortalActionResult | null,
  formData: FormData,
): Promise<PortalActionResult> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const roleTitle = String(formData.get("role_title") ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: "Check the name.", fields: { name: "Enter your name." } };
  }

  await query(
    "UPDATE client_users SET name = $1, role_title = $2, updated_at = now() WHERE id = $3 AND client_id = $4",
    [name, roleTitle || null, session.clientUserId, session.clientId],
  );

  const meta = await requestMeta();
  await recordAudit(
    { type: "client", id: session.clientUserId, label: name },
    {
      action: "client.updated",
      entityType: "client_user",
      entityId: session.clientUserId,
      metadata: { fields: ["name", "role_title"] },
      ...meta,
    },
  );

  revalidatePath("/portal/profile");
  revalidatePath("/portal");

  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(
  _prev: PortalActionResult | null,
  formData: FormData,
): Promise<PortalActionResult> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const user = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM client_users WHERE id = $1 AND client_id = $2",
    [session.clientUserId, session.clientId],
  );

  if (!user || !(await verifyPassword(current, user.password_hash))) {
    return { ok: false, error: "Your current password isn't right.", fields: { current_password: "Incorrect." } };
  }
  if (next !== confirm) {
    return { ok: false, error: "The new passwords don't match.", fields: { confirm_password: "Doesn't match." } };
  }

  const strength = validatePasswordStrength(next);
  if (strength) {
    return { ok: false, error: strength, fields: { new_password: strength } };
  }

  const meta = await requestMeta();
  const revoked = await tx(async (client) => {
    await client.query(
      "UPDATE client_users SET password_hash = $1, updated_at = now() WHERE id = $2 AND client_id = $3",
      [await hashPassword(next), session.clientUserId, session.clientId],
    );

    // Every other session for this person dies with the old password.
    //
    // Without this, a cookie stolen before the change keeps working for the full
    // CLIENT_TTL_MS — seven days — which is exactly the window somebody is trying
    // to close by changing their password. Rotating on the credential is the
    // point of rotating on the credential.
    //
    // The current session is spared so the person who just changed their password
    // is not logged out of the tab they are using. Its CSRF token is untouched,
    // so the form they are holding stays valid.
    //
    // In the same transaction as the hash write: if the delete failed and the
    // update committed, the old sessions would outlive the change that was meant
    // to kill them, and nobody would notice.
    // Scoped by client_user_id alone. client_sessions has no client_id column —
    // the user id is already the tenant boundary, since a client_user belongs to
    // exactly one client — so filtering on client_id here would not compile.
    const killed = await client.query(
      "DELETE FROM client_sessions WHERE client_user_id = $1 AND id <> $2 RETURNING id",
      [session.clientUserId, session.id],
    );

    await recordAudit(
      { type: "client", id: session.clientUserId, label: session.name },
      {
        action: "settings.updated",
        entityType: "client_user",
        entityId: session.clientUserId,
        metadata: { changed: "password", sessionsRevoked: killed.rowCount ?? 0 },
        ...meta,
      },
      client,
    );

    return killed.rowCount ?? 0;
  });

  revalidatePath("/portal/settings");

  return {
    ok: true,
    message:
      revoked > 0
        ? `Password changed. Signed out of ${revoked} other ${
            revoked === 1 ? "device" : "devices"
          }.`
        : "Password changed.",
  };
}
