"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { fakeVerifyDelay, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createClientSession, createStaffSession, staffCookieOptions, clientCookieOptions } from "@/lib/auth/session";
import { claimInvitation, findLiveInvitation, InvitationError } from "@/lib/auth/invitations";
import { fieldErrors, loginSchema, acceptInvitationSchema } from "@/lib/validation";
import { recordAudit, ANONYMOUS_ACTOR } from "@/lib/audit";
import { requestMeta, consumeSignInAttempt, consumeSignInFailure, SIGN_IN_THROTTLED_MESSAGE } from "@/lib/ratelimit";
import { sendMail, siteUrl } from "@/lib/mail/smtp";
import { invitationEmail } from "@/lib/mail/invitation-templates";
import { cookies } from "next/headers";

/**
 * Server actions for authentication.
 *
 * Each returns a discriminated result rather than redirecting on failure, so
 * the form can re-render with the reason intact. On success they set the cookie
 * and redirect, because a client component cannot set cookies itself.
 */

export type FormResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/* -------------------------------------------------------------------------- */
/* Staff sign-in                                                               */
/* -------------------------------------------------------------------------- */

function safeRedirectTarget(raw: unknown, prefix: string, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith(prefix) ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("\n") ||
    trimmed.includes("\r")
  ) {
    return fallback;
  }
  return trimmed;
}

export async function staffSignInAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check your details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();

  // Throttle before the hash is computed, not after: the cost of a guess is the
  // scrypt work, so the ceiling has to be the number of attempts, and it has to
  // be enforced ahead of the verify call rather than once a failure is known.
  const attempt = await consumeSignInAttempt("staff", meta.ipAddress);
  if (!attempt.allowed) {
    return { ok: false, error: SIGN_IN_THROTTLED_MESSAGE };
  }

  const staff = await queryOne<{
    id: string;
    name: string;
    email: string;
    role: string;
    password_hash: string | null;
    active: boolean;
  }>("SELECT id, name, email, role, password_hash, active FROM staff WHERE email = $1", [
    parsed.data.email,
  ]);

  // Same work and the same error whether or not the account exists, so the
  // response cannot be used to enumerate staff email addresses.
  const valid = staff
    ? await verifyPassword(parsed.data.password, staff.password_hash)
    : (await fakeVerifyDelay(), false);

  if (!staff || !valid || !staff.active) {
    // Account-keyed, so guessing one mailbox from many addresses still runs out.
    const failure = await consumeSignInFailure("staff", parsed.data.email);
    await recordAudit(ANONYMOUS_ACTOR, {
      action: "staff.login_failed",
      entityType: "staff",
      metadata: {
        email: parsed.data.email,
        reason: !staff ? "no-account" : "bad-credentials",
        throttled: !failure.allowed,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      ok: false,
      error: failure.allowed
        ? "That email and password combination didn't work."
        : SIGN_IN_THROTTLED_MESSAGE,
    };
  }

  const remember = formData.get("remember") === "true" || formData.get("remember") === "on";
  const { cookieValue, expiresAt } = await createStaffSession(staff.id, meta, { remember });
  (await cookies()).set("rv_staff_session", cookieValue, staffCookieOptions(expiresAt));

  await recordAudit(
    { type: "staff", id: staff.id, label: staff.name },
    {
      action: "staff.login",
      entityType: "staff",
      entityId: staff.id,
      metadata: { role: staff.role, remembered: remember },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  );

  await queryOne("UPDATE staff SET last_login_at = now() WHERE id = $1 RETURNING id", [staff.id]);

  const target = safeRedirectTarget(formData.get("next"), "/admin", "/admin");
  redirect(target);
}

/* -------------------------------------------------------------------------- */
/* Client portal sign-in                                                       */
/* -------------------------------------------------------------------------- */

export async function clientSignInAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check your details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();

  const attempt = await consumeSignInAttempt("client", meta.ipAddress);
  if (!attempt.allowed) {
    return { ok: false, error: SIGN_IN_THROTTLED_MESSAGE };
  }

  const user = await queryOne<{
    id: string;
    client_id: string;
    name: string;
    email: string;
    password_hash: string;
    active: boolean;
  }>(
    `SELECT u.id, u.client_id, u.name, u.email, u.password_hash, u.active
       FROM client_users u JOIN clients c ON c.id = u.client_id
      WHERE u.email = $1 AND c.status <> 'CHURNED'`,
    [parsed.data.email],
  );

  const valid = user
    ? await verifyPassword(parsed.data.password, user.password_hash)
    : (await fakeVerifyDelay(), false);

  if (!user || !valid || !user.active) {
    const failure = await consumeSignInFailure("client", parsed.data.email);
    return {
      ok: false,
      error: failure.allowed
        ? "That email and password combination didn't work."
        : SIGN_IN_THROTTLED_MESSAGE,
    };
  }

  const remember = formData.get("remember") === "true" || formData.get("remember") === "on";
  const { cookieValue, expiresAt } = await createClientSession(user.id, meta, { remember });
  (await cookies()).set("rv_client_session", cookieValue, clientCookieOptions(expiresAt));

  await recordAudit(
    { type: "client", id: user.id, label: user.name },
    {
      action: "portal.login",
      entityType: "client_user",
      entityId: user.id,
      metadata: { clientId: user.client_id, remembered: remember },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  );

  const target = safeRedirectTarget(formData.get("next"), "/portal", "/portal");
  redirect(target);
}

/* -------------------------------------------------------------------------- */
/* Invitation acceptance                                                       */
/* -------------------------------------------------------------------------- */

export type InvitationView = {
  kind: "STAFF" | "CLIENT_PORTAL";
  email: string;
  name: string | null;
  role: string | null;
  clientName: string | null;
  expiresAt: string;
};

/** Resolve a token into a displayable invitation, or an explanation of why not. */
export async function loadInvitation(token: string): Promise<
  { ok: true; invitation: InvitationView } | { ok: false; message: string }
> {
  const found = await findLiveInvitation(token);
  if (!found) {
    return {
      ok: false,
      message:
        "This invitation link is no longer valid. It may have expired, already been used, or been withdrawn. Ask the Rhymvex team to send a new one.",
    };
  }

  return {
    ok: true,
    invitation: {
      kind: found.kind,
      email: found.email,
      name: found.name,
      role: found.role,
      clientName: found.client_name,
      expiresAt: new Date(found.expires_at).toISOString(),
    },
  };
}

export async function acceptInvitationAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const token = String(formData.get("token") ?? "");
  const parsed = acceptInvitationSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details below.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const claimed = await claimInvitation(token, {
      name: parsed.data.name,
      passwordHash,
      meta,
    });

    if ("staffId" in claimed) {
      const { cookieValue, expiresAt } = await createStaffSession(claimed.staffId, meta);
      (await cookies()).set("rv_staff_session", cookieValue, staffCookieOptions(expiresAt));
      redirect("/admin");
    }

    const { cookieValue, expiresAt } = await createClientSession(claimed.clientUserId, meta);
    (await cookies()).set("rv_client_session", cookieValue, clientCookieOptions(expiresAt));

    // A client who has just accepted an invitation gets a portal invitation
    // email so the welcome is recorded against them like every other touchpoint.
    const email = invitationEmail({
      kind: "WELCOME",
      to: claimed.email,
      name: claimed.name,
      portalUrl: `${siteUrl()}/portal`,
    });
    await sendMail({
      kind: "PORTAL_INVITATION",
      to: claimed.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      relatedType: "client_user",
      relatedId: claimed.clientUserId,
    });

    redirect("/portal");
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, error: error.message };
    }
    // Next's redirect() throws internally; anything else reaching here is a bug.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    console.error("invitation acceptance failed:", error);
    return { ok: false, error: "Something went wrong. Try again, or contact the Rhymvex team." };
  }
}
