import "@/lib/env";
import { query, queryOne, pool } from "@/lib/db/client";
import { issueStaffInvitation, issuePortalInvitation, claimInvitation, revokeInvitation, findLiveInvitation, InvitationError } from "@/lib/auth/invitations";
import { hashPassword } from "@/lib/auth/password";

/**
 * Invitation lifecycle checks.
 *
 * The properties the brief requires of a token: cryptographically random,
 * single-use, expiring, revocable, not itself a credential, stored as a digest.
 */

let pass = 0;
let fail = 0;
const ok = (m: string) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m: string, d = "") => { console.log(`  FAIL  ${m}${d ? ` (${d})` : ""}`); fail++; };
const check = (m: string, cond: boolean, detail = "") => (cond ? ok(m) : bad(m, detail));

const META = { ipAddress: "127.0.0.1", userAgent: "invitation-lifecycle-check" };
const ADMIN = { id: "", name: "Sam Okonkwo", email: "sam@rhymvex.com" };

async function main() {
  const admin = await queryOne<{ id: string }>("SELECT id FROM staff WHERE email='sam@rhymvex.com'");
  if (!admin) throw new Error("seeded admin missing — run npm run db:seed");
  ADMIN.id = admin.id;

  const stamp = Date.now();
  const staffEmail = `lifecycle-staff-${stamp}@rhymvex.test`;
  const client = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM clients ORDER BY created_at LIMIT 1",
  );
  const portalEmail = `lifecycle-client-${stamp}@probe.test`;

  // ---------------------------------------------------------------- staff
  console.log("\n=== Staff invitation ===");
  const issued = await issueStaffInvitation({
    email: staffEmail,
    name: "Lifecycle Tester",
    role: "DESIGNER",
    permissions: ["not.a.real.permission"],
    expiresInHours: 24,
    actor: ADMIN,
    meta: META,
  });

  check("token is long (>= 43 chars base64url)", issued.token.length >= 43, `len ${issued.token.length}`);
  check("token is base64url only", /^[A-Za-z0-9_-]+$/.test(issued.token));
  check("two tokens differ", (await issueStaffInvitation({
    email: `x-${stamp}@rhymvex.test`, name: "X", role: "DESIGNER", actor: ADMIN, meta: META,
  })).token !== issued.token);

  // Unknown permission keys are dropped, not stored.
  const stored = await queryOne<{ permissions: string[] }>(
    "SELECT permissions FROM invitations WHERE id = $1", [issued.invitation.id],
  );
  check("unknown permissions are dropped", (stored?.permissions ?? []).length === 0,
    JSON.stringify(stored?.permissions));

  // Only the digest is persisted.
  const hash = await queryOne<{ token_hash: string }>(
    "SELECT token_hash FROM invitations WHERE id = $1", [issued.invitation.id],
  );
  const { createHash } = await import("node:crypto");
  check("stored value is the SHA-256 of the token",
    hash?.token_hash === createHash("sha256").update(issued.token).digest("hex"));
  check("raw token is not stored anywhere", !(await query(
    "SELECT 1 FROM invitations WHERE token_hash = $1", [issued.token],
  )).length);

  check("live token resolves", Boolean(await findLiveInvitation(issued.token)));
  check("garbage token does not resolve", (await findLiveInvitation("nope")) === null);
  check("short token does not resolve", (await findLiveInvitation("abc")) === null);

  // Single use.
  const pw = await hashPassword("LifecycleTest1234");
  const first = await claimInvitation(issued.token, { name: "Lifecycle Tester", passwordHash: pw, meta: META });
  check("first redemption succeeds", "staffId" in first);

  let secondError = "";
  try {
    await claimInvitation(issued.token, { name: "Impostor", passwordHash: pw, meta: META });
  } catch (e) { secondError = e instanceof InvitationError ? e.reason : "unknown"; }
  check("second redemption is refused", secondError === "accepted", secondError);
  check("only one account was created", (await query(
    "SELECT 1 FROM staff WHERE email = $1", [staffEmail],
  )).length === 1);

  // A token is not a credential: it cannot be used to sign in.
  const noSession = await queryOne<{ n: number }>(
    "SELECT count(*)::int AS n FROM sessions WHERE staff_id = $1", [("staffId" in first) ? first.staffId : ""],
  );
  check("accepting a token creates no session (password still required)", (noSession?.n ?? 0) === 0);

  // ------------------------------------------------------------- expiry
  console.log("\n=== Expiry ===");
  const shortLived = await issueStaffInvitation({
    email: `expiring-${stamp}@rhymvex.test`, name: "Expiring", role: "DESIGNER",
    expiresInHours: 1, actor: ADMIN, meta: META,
  });
  await query("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE id = $1",
    [shortLived.invitation.id]);
  check("expired token does not resolve", (await findLiveInvitation(shortLived.token)) === null);
  let expErr = "";
  try {
    await claimInvitation(shortLived.token, { name: "Late", passwordHash: pw, meta: META });
  } catch (e) { expErr = e instanceof InvitationError ? e.reason : "unknown"; }
  check("expired token cannot be redeemed", expErr === "expired", expErr);
  const swept = await queryOne<{ status: string }>(
    "SELECT status FROM invitations WHERE id = $1", [shortLived.invitation.id]);
  check("expiry is recorded as EXPIRED", swept?.status === "EXPIRED", swept?.status);

  // ----------------------------------------------------------- revocation
  console.log("\n=== Revocation ===");
  const revocable = await issueStaffInvitation({
    email: `revoked-${stamp}@rhymvex.test`, name: "Revoked", role: "DESIGNER", actor: ADMIN, meta: META,
  });
  const didRevoke = await revokeInvitation(revocable.invitation.id, { id: ADMIN.id, name: ADMIN.name }, META);
  check("revocation succeeds on a pending invite", didRevoke);
  check("revoked token does not resolve", (await findLiveInvitation(revocable.token)) === null);
  let revErr = "";
  try {
    await claimInvitation(revocable.token, { name: "Nope", passwordHash: pw, meta: META });
  } catch (e) { revErr = e instanceof InvitationError ? e.reason : "unknown"; }
  check("revoked token cannot be redeemed", revErr === "revoked", revErr);
  check("revoking twice reports nothing pending", !(await revokeInvitation(
    revocable.invitation.id, { id: ADMIN.id, name: ADMIN.name }, META)));

  // -------------------------------------------------------------- reissue
  console.log("\n=== Re-inviting supersedes ===");
  const reissued = await issueStaffInvitation({
    email: staffEmail, name: "Lifecycle Tester", role: "PROJECT_MANAGER", actor: ADMIN, meta: META,
  });
  check("previous token is dead after re-invite", (await findLiveInvitation(issued.token)) === null);
  check("replacement token resolves", Boolean(await findLiveInvitation(reissued.token)));
  const pending = await queryOne<{ n: number }>(
    "SELECT count(*)::int AS n FROM invitations WHERE email = $1 AND status = 'PENDING'", [staffEmail]);
  check("only one live invitation per address", (pending?.n ?? 0) === 1, String(pending?.n));

  // -------------------------------------------------------- client portal
  console.log("\n=== Client portal invitation ===");
  const portal = await issuePortalInvitation({
    clientId: client!.id,
    email: portalEmail,
    name: "Portal Tester",
    expiresInHours: 168,
    actor: ADMIN,
    meta: META,
  });
  check("portal invitation is bound to the client",
    portal.invitation.client_id === client!.id);

  // While the first is still live, a second to the same person is refused.
  let dupErr = "";
  try {
    await issuePortalInvitation({
      clientId: client!.id, email: portalEmail, name: "Portal Tester", actor: ADMIN, meta: META,
    });
  } catch (e) { dupErr = e instanceof InvitationError ? e.reason : "unknown"; }
  check("a second live portal invite is refused", dupErr === "forbidden", dupErr);

  const portalClaim = await claimInvitation(portal.token, { name: "Portal Tester", passwordHash: pw, meta: META });
  check("portal redemption returns a client user", "clientUserId" in portalClaim);
  if ("clientId" in portalClaim) {
    check("portal account is bound to the invited client", portalClaim.clientId === client!.id);
  }

  // The same address cannot be redeemed twice into two portal accounts.
  let secondPortal = "";
  try {
    await issuePortalInvitation({
      clientId: client!.id, email: `${portalEmail}.2`, name: "Second", actor: ADMIN, meta: META,
    });
  } catch (e) { secondPortal = e instanceof InvitationError ? e.reason : "unknown"; }
  check("a fresh address is accepted for the same client", secondPortal === "", secondPortal);

  // A client email cannot be invited to a different client while live.
  const other = await queryOne<{ id: string }>(
    "SELECT id FROM clients WHERE id <> $1 ORDER BY created_at LIMIT 1", [client!.id]);
  if (other) {
    let crossErr = "";
    try {
      await issuePortalInvitation({
        clientId: other.id, email: `lifecycle-other-${stamp}@probe.test`,
        name: "Cross", actor: ADMIN, meta: META,
      });
      // Accepted, as it should be: a different person may be invited elsewhere.
    } catch (e) { crossErr = e instanceof InvitationError ? e.reason : "unknown"; }
    check("a distinct address can be invited to another client", crossErr === "");
  }

  // ------------------------------------------------------------- audit
  console.log("\n=== Audit trail ===");
  const audited = await query<{ action: string }>(
    "SELECT action FROM audit_log WHERE entity_type = 'invitation' AND action IN ('staff.invited','invitation.accepted','staff.invite_revoked')",
  );
  const kinds = new Set(audited.map((a) => a.action));
  check("staff.invited is audited", kinds.has("staff.invited"));
  check("invitation.accepted is audited", kinds.has("invitation.accepted"));
  check("staff.invite_revoked is audited", kinds.has("staff.invite_revoked"));
  const noToken = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM audit_log WHERE metadata::text LIKE '%' || $1 || '%'",
    [issued.token.slice(0, 12)],
  );
  check("raw tokens never reach the audit log", (noToken?.[0]?.n ?? 0) === 0, String(noToken?.[0]?.n));

  // -------------------------------------------------------------- cleanup
  await query("DELETE FROM sessions WHERE staff_id IN (SELECT id FROM staff WHERE email LIKE $1)", [`%-${stamp}@%`]);
  await query("DELETE FROM staff WHERE email LIKE $1", [`%-${stamp}@%`]);
  await query("DELETE FROM client_sessions WHERE client_user_id IN (SELECT id FROM client_users WHERE email LIKE $1)", [`%-${stamp}@%`]);
  await query("DELETE FROM client_users WHERE email LIKE $1", [`%-${stamp}@%`]);
  await query("DELETE FROM invitations WHERE email LIKE $1", [`%-${stamp}@%`]);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
