"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, tx } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { portalInviteSchema, staffInviteSchema, fieldErrors } from "@/lib/validation";
import {
  InvitationError,
  issuePortalInvitation,
  issueStaffInvitation,
  revokeInvitation,
} from "@/lib/auth/invitations";
import {
  portalInvitationEmail,
  staffInvitationEmail,
} from "@/lib/mail/invitation-templates";
import { fromAddress, sendMail, siteUrl } from "@/lib/mail/smtp";
import { recordEmail } from "@/lib/data/email";
import { ROLES } from "@/lib/auth/rbac";
import type { ActionResult } from "./leads";

/* -------------------------------------------------------------------------- */
/* Portal invitations                                                         */
/* -------------------------------------------------------------------------- */

export async function inviteToPortalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("clients.portal_invite")) {
    return { ok: false, error: "Your role cannot invite clients to the portal." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) return { ok: false, error: "Missing client reference." };

  const parsed = portalInviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role_title: formData.get("role_title") || "",
    expires_in_hours: formData.get("expires_in_hours") || 168,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();

  // Fetch the client name for the email template.
  const clientRow = await queryOne<{ name: string }>(
    "SELECT name FROM clients WHERE id = $1",
    [clientId],
  );
  if (!clientRow) return { ok: false, error: "Client not found." };

  try {
    const { invitation, token } = await issuePortalInvitation({
      clientId,
      email: parsed.data.email,
      name: parsed.data.name,
      roleTitle: parsed.data.role_title,
      expiresInHours: parsed.data.expires_in_hours,
      actor: { id: session.staffId, name: session.name, email: session.email },
      meta,
    });

    const email = portalInvitationEmail({
      kind: "PORTAL",
      to: parsed.data.email,
      name: parsed.data.name,
      clientName: clientRow.name,
      invitedBy: session.name,
      inviteUrl: `${siteUrl()}/invite?token=${encodeURIComponent(token)}`,
      expiresInHours: parsed.data.expires_in_hours,
    });

    const result = await sendMail({
      kind: "PORTAL_INVITATION",
      to: parsed.data.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      relatedType: "client",
      relatedId: clientId,
    });

    await recordEmail({
      direction: "OUTBOUND",
      clientId,
      fromAddress: fromAddress("business"),
      toAddresses: [parsed.data.email],
      subject: email.subject,
      bodyText: email.text,
      bodyHtml: email.html,
      status: result.delivery === "failed" ? "FAILED" : "SENT",
      errorMessage: result.error ?? null,
      // The invitation link is a credential. It is never exposed to a client
      // who already has portal access.
      clientVisible: false,
      createdBy: session.staffId,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/staff");

    return {
      ok: true,
      message:
        result.delivery === "dev"
          ? "Invitation created. SMTP is not configured, so the link is in the outbox rather than sent."
          : "Invitation sent.",
    };
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, error: error.message };
    }
    console.error("portal invitation failed:", error);
    return { ok: false, error: "Could not create the invitation. Try again." };
  }
}

/* -------------------------------------------------------------------------- */
/* Team invitations                                                           */
/* -------------------------------------------------------------------------- */

export async function inviteStaffAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.invite")) {
    return { ok: false, error: "Your role cannot invite team members." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = staffInviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    permissions: formData.getAll("permissions").map(String),
    expires_in_hours: formData.get("expires_in_hours") || 72,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const { invitation, token } = await issueStaffInvitation({
    email: data.email,
    name: data.name,
    role: data.role,
    permissions: data.permissions,
    expiresInHours: data.expires_in_hours,
    actor: { id: session.staffId, name: session.name, email: session.email },
    meta,
  });

  const email = staffInvitationEmail({
    kind: "STAFF",
    to: data.email,
    name: data.name,
    role: humanise(data.role),
    invitedBy: session.name,
    // The raw token exists only here. The database stores a SHA-256 digest.
    inviteUrl: `${siteUrl()}/invite?token=${encodeURIComponent(token)}`,
    expiresInHours: data.expires_in_hours,
  });

  const result = await sendMail({
    kind: "STAFF_INVITATION",
    to: data.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    relatedType: "invitation",
    relatedId: invitation.id,
  });

  await recordEmail({
    direction: "OUTBOUND",
    fromAddress: fromAddress("system"),
    toAddresses: [data.email],
    subject: email.subject,
    bodyText: email.text,
    bodyHtml: email.html,
    status: result.delivery === "failed" ? "FAILED" : "SENT",
    errorMessage: result.error ?? null,
    // The link is a credential, so it is never exposed to a client.
    clientVisible: false,
    createdBy: session.staffId,
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin/security");

  return {
    ok: true,
    message:
      result.delivery === "dev"
        ? `Invitation created for ${data.email}. SMTP is not configured, so the link is in the outbox.`
        : `Invitation sent to ${data.email}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Revoke invitation                                                          */
/* -------------------------------------------------------------------------- */

export async function revokeInvitationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.manage") && !session.permissions.has("clients.portal_invite")) {
    return { ok: false, error: "Your role cannot revoke invitations." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const id = String(formData.get("invitation_id") ?? "");
  if (!id) return { ok: false, error: "Missing invitation reference." };

  const meta = await requestMeta();
  const revoked = await revokeInvitation(id, { id: session.staffId, name: session.name }, meta);

  revalidatePath("/admin/staff");
  revalidatePath("/admin/clients");

  return revoked
    ? { ok: true, message: "Invitation withdrawn. The link no longer works." }
    : { ok: false, error: "That invitation is no longer pending." };
}
