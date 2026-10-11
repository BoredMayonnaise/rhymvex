"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { fakeVerifyDelay, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createClientSession,
  createStaffSession,
  staffCookieOptions,
  clientCookieOptions,
  pruneExpiredSessions,
} from "@/lib/auth/session";
import { claimInvitation, findLiveInvitation, InvitationError } from "@/lib/auth/invitations";
import { fieldErrors, loginSchema, acceptInvitationSchema } from "@/lib/validation";
import { recordAudit, ANONYMOUS_ACTOR } from "@/lib/audit";
import { requestMeta, consumeSignInAttempt, consumeSignInFailure, SIGN_IN_THROTTLED_MESSAGE } from "@/lib/ratelimit";
import { sendMail, siteUrl } from "@/lib/mail/smtp";
import { invitationEmail } from "@/lib/mail/invitation-templates";
import {
  resolveWorkspace,
  signInTarget,
  CLIENT_HOME,
  STAFF_HOME,
  type WorkspaceScope,
} from "@/lib/auth/workspace";
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
/* Sign-in                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Shown for every rejected sign-in, whether the address exists in neither table,
 * exists in one with the wrong password, or exists but is deactivated.
 *
 * One string for all of them. Splitting the cases would turn the sign-in form
 * into a way to discover who has an account here, and that question is not
 * something an anonymous visitor should be able to ask.
 */
const SIGN_IN_FAILED_MESSAGE = "That email and password combination didn't work.";

type StaffAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string | null;
  active: boolean;
};

type ClientAccount = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  password_hash: string;
  active: boolean;
};

function loadStaffAccount(email: string): Promise<StaffAccount | null> {
  return queryOne<StaffAccount>(
    "SELECT id, name, email, role, password_hash, active FROM staff WHERE email = $1",
    [email],
  );
}

function loadClientAccount(email: string): Promise<ClientAccount | null> {
  return queryOne<ClientAccount>(
    `SELECT u.id, u.client_id, u.name, u.email, u.password_hash, u.active
       FROM client_users u JOIN clients c ON c.id = u.client_id
      WHERE u.email = $1 AND c.status <> 'CHURNED'`,
    [email],
  );
}

/**
 * Try one workspace, always spending the same scrypt work.
 *
 * `fakeVerifyDelay` on a miss is what stops the response time from reporting
 * whether an address is registered: a real hash is computed either way, so a
 * guessed address costs the server exactly what a known one does.
 */
async function verifyAccount(
  password: string,
  account: { password_hash: string | null } | null,
): Promise<boolean> {
  if (!account?.password_hash) {
    await fakeVerifyDelay();
    return false;
  }
  return verifyPassword(password, account.password_hash);
}

/**
 * Why a sign-in was refused, for the audit trail only.
 *
 * Safe to record because it never reaches the person signing in: every refusal
 * returns the same `SIGN_IN_FAILED_MESSAGE`. What it buys an admin is the
 * difference between one person mistyping a password and a spray walking a list
 * of addresses — the first looks like `bad-credentials` against an account that
 * exists, the second is a run of `no-account` entries, which is invisible if
 * every failure is filed as the same thing.
 */
type FailureReason = "no-account" | "bad-credentials" | "deactivated";

type AuthOutcome =
  | { ok: true; workspace: WorkspaceScope; account: StaffAccount | ClientAccount }
  | {
      ok: false;
      /** Every workspace the address actually resolved to an account in. */
      matched: WorkspaceScope[];
      reason: FailureReason;
    };

/**
 * Find which workspace accepts these credentials, probing the given scopes in
 * order and stopping at the first that does.
 *
 * Staff is probed before the portal, so an address present in both tables
 * resolves to the workspace that can do more. That is a deliberate default, not
 * an accident of ordering, and it is why the form keeps an explicit way to ask
 * for the portal instead.
 *
 * An inactive account is treated as no match rather than a refusal, so the probe
 * continues to the next scope. That is what lets someone deactivated on staff
 * still reach a client portal they are legitimately active on — two tables, two
 * unrelated lifecycles.
 *
 * Note that `active` is checked *after* the hash, never before it. Testing it
 * first would short-circuit the scrypt work for a deactivated account and make
 * that case measurably faster than a wrong password, which would leak the
 * existence of deactivated accounts. Uniform cost comes from the verify being
 * unconditional on every scope; only a genuine success exits early, and success
 * is not a secret.
 *
 * The failure reason is accumulated rather than decided per scope, because the
 * most specific thing that happened across the whole probe is the useful one: an
 * address that exists in staff with a wrong password but matches nothing in the
 * portal is `bad-credentials`, not `no-account`.
 */
async function authenticate(
  scopes: readonly WorkspaceScope[],
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const matched: WorkspaceScope[] = [];
  let sawAccount = false;
  let passwordMatched = false;

  for (const scope of scopes) {
    const account =
      scope === "staff" ? await loadStaffAccount(email) : await loadClientAccount(email);
    const valid = await verifyAccount(password, account);

    if (account) {
      matched.push(scope);
      sawAccount = true;
    }
    if (valid) passwordMatched = true;

    if (valid && account?.active) {
      return { ok: true, workspace: scope, account };
    }
  }

  // The password was right somewhere but no account was usable, which can only
  // mean the account was deactivated. Otherwise it comes down to whether any
  // account existed at all.
  const reason: FailureReason = passwordMatched
    ? "deactivated"
    : sawAccount
      ? "bad-credentials"
      : "no-account";

  return { ok: false, matched, reason };
}

export async function signInAction(
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

  const email = parsed.data.email;
  const hint = resolveWorkspace(formData.get("workspace"));
  const scopes: WorkspaceScope[] = hint === "auto" ? ["staff", "client"] : [hint];
  const meta = await requestMeta();

  // Throttled before any hash is computed, not after: the cost of a guess is the
  // scrypt work, so the ceiling has to be the number of attempts, and it has to
  // be enforced ahead of the verify calls rather than once a failure is known.
  //
  // Auto-detection charges both buckets. Probing two tables is two guesses'
  // worth of hashing, and the IP bucket exists precisely to cap how much hashing
  // one address can ask for — letting it double would hand an attacker the
  // doubled budget on the endpoint that is easiest to reach.
  for (const scope of scopes) {
    const attempt = await consumeSignInAttempt(scope, meta.ipAddress);
    if (!attempt.allowed) {
      return { ok: false, error: SIGN_IN_THROTTLED_MESSAGE };
    }
  }

  const result = await authenticate(scopes, email, parsed.data.password);

  if (!result.ok) {
    // Account-keyed as well as IP-keyed, so guessing one mailbox from many
    // addresses still runs out. Throttled on any scope, since the person has
    // failed against the whole set they were allowed to try.
    let throttled = false;
    for (const scope of scopes) {
      const failure = await consumeSignInFailure(scope, email);
      if (!failure.allowed) throttled = true;
    }

    await recordAudit(ANONYMOUS_ACTOR, {
      // Filed against the workspace the address actually belongs to, so the
      // security page's staff and client columns stay meaningful now that one
      // form serves both. An address in neither table has no true owner, so it
      // is filed against the first scope probed — staff is always first, and an
      // unknown address is a guess at the workspace rather than a fact about
      // either one.
      action:
        result.matched.length === 1 && result.matched[0] === "client"
          ? "portal.login_failed"
          : "staff.login_failed",
      entityType: "staff",
      metadata: { email, hint, reason: result.reason, throttled },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ok: false, error: throttled ? SIGN_IN_THROTTLED_MESSAGE : SIGN_IN_FAILED_MESSAGE };
  }

  const remember = formData.get("remember") === "true" || formData.get("remember") === "on";

  if (result.workspace === "staff") {
    const staff = result.account as StaffAccount;
    const { cookieValue, expiresAt } = await createStaffSession(staff.id, meta, { remember });
    (await cookies()).set("rv_staff_session", cookieValue, await staffCookieOptions(expiresAt));

    await recordAudit(
      { type: "staff", id: staff.id, label: staff.name },
      {
        action: "staff.login",
        entityType: "staff",
        entityId: staff.id,
        metadata: { role: staff.role, remembered: remember, resolvedBy: hint },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    );

    await queryOne("UPDATE staff SET last_login_at = now() WHERE id = $1 RETURNING id", [
      staff.id,
    ]);

    // A sign-in is a rare enough event to be a good place to clear out the rows
    // that expired. Nobody ever presents their own expired cookie, so nothing
    // else would remove them.
    await pruneExpiredSessions();

    redirect(signInTarget("staff", formData.get("next")));
  }

  const user = result.account as ClientAccount;
  const { cookieValue, expiresAt } = await createClientSession(user.id, meta, { remember });
  (await cookies()).set("rv_client_session", cookieValue, await clientCookieOptions(expiresAt));

  await recordAudit(
    { type: "client", id: user.id, label: user.name },
    {
      action: "portal.login",
      entityType: "client_user",
      entityId: user.id,
      metadata: { clientId: user.client_id, remembered: remember, resolvedBy: hint },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  );

  await pruneExpiredSessions();

  redirect(signInTarget("client", formData.get("next")));
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
      (await cookies()).set("rv_staff_session", cookieValue, await staffCookieOptions(expiresAt));
      redirect(STAFF_HOME);
    }

    const { cookieValue, expiresAt } = await createClientSession(claimed.clientUserId, meta);
    (await cookies()).set("rv_client_session", cookieValue, await clientCookieOptions(expiresAt));

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

    redirect(CLIENT_HOME);
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
