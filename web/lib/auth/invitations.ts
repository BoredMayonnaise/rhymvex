import { randomBytes } from "node:crypto";
import { query, queryOne, tx } from "@/lib/db/client";
import { hashToken } from "@/lib/auth/session";
import { isPermission, isRole, type Permission, type Role } from "@/lib/auth/rbac";
import { recordAudit, type RequestMeta } from "@/lib/audit";

/**
 * Invitations.
 *
 * Staff and client-portal invitations share one lifecycle and one table, and
 * differ only by `kind`. The properties the brief calls for are enforced here
 * rather than left to callers:
 *
 *   random      32 bytes from the CSPRNG, base64url. ~256 bits of entropy.
 *   stored      only the SHA-256 digest. A database leak yields no usable token.
 *   single-use  `claimInvitation` marks ACCEPTED inside the same transaction
 *               that creates the account, so a token cannot be replayed even
 *               under concurrent requests.
 *   expiring    expires_at is checked on every read, not just on issue.
 *   revocable   status is set to REVOKED and the row is treated as dead.
 *   not auth    a token is not a session. It authorises exactly one transition,
 *               and a session is only ever created from a password the
 *               recipient chooses at acceptance time.
 */

export type InvitationKind = "STAFF" | "CLIENT_PORTAL";
export type InvitationState = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export type Invitation = {
  id: string;
  kind: InvitationKind;
  email: string;
  name: string | null;
  role: Role | null;
  permissions: string[];
  client_id: string | null;
  client_name: string | null;
  status: InvitationState;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  created_by_name: string | null;
  invited_by_email: string | null;
};

const INVITATION_COLUMNS = `
  i.id, i.kind, i.email, i.name, i.role, i.permissions, i.client_id,
  c.name AS client_name, i.status, i.expires_at, i.accepted_at, i.revoked_at,
  i.created_at, s.name AS created_by_name, s.email AS invited_by_email
`;

/**
 * Reject tokens that could plausibly have been guessed, so an exhaustive search
 * is not a viable attack. Rejection happens before any lookup.
 */
const TOKEN_MIN_LENGTH = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function isPlausibleToken(token: string): boolean {
  return token.length >= TOKEN_MIN_LENGTH && token.length <= 128 && TOKEN_PATTERN.test(token);
}

export class InvitationError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "invalid"
      | "expired"
      | "revoked"
      | "accepted"
      | "email_taken"
      | "forbidden",
  ) {
    super(message);
    this.name = "InvitationError";
  }
}

/**
 * Internal signal: this token is past its expiry.
 *
 * Carried out of the transaction rather than thrown as an InvitationError from
 * inside it, because the transaction is about to roll back. Marking the row
 * EXPIRED in the same transaction would be undone by that rollback, leaving the
 * record claiming PENDING for a token that is permanently dead.
 */
class ExpiredInvitation extends Error {
  constructor(readonly invitationId: string) {
    super("expired");
    this.name = "ExpiredInvitation";
  }
}

/* -------------------------------------------------------------------------- */
/* Issuing                                                                    */
/* -------------------------------------------------------------------------- */

export type IssueStaffInvitation = {
  email: string;
  name: string;
  role: Role;
  permissions?: string[];
  expiresInHours?: number;
  actor: { id: string; name: string; email: string };
  meta: RequestMeta;
};

export async function issueStaffInvitation(input: IssueStaffInvitation): Promise<{
  invitation: Invitation;
  token: string;
}> {
  // Unknown permission keys are dropped rather than stored, so a typo cannot
  // silently grant something nobody intended.
  const permissions = (input.permissions ?? []).filter(isPermission) as Permission[];

  const hours = clampHours(input.expiresInHours, 72);

  return tx(async (client) => {
    // Re-inviting supersedes the previous live invitation, so an address never
    // accumulates a trail of valid tokens.
    await client.query(
      `UPDATE invitations SET status = 'REVOKED', revoked_at = now()
        WHERE email = $1 AND kind = 'STAFF' AND status = 'PENDING'`,
      [input.email],
    );

    const token = generateToken();
    const expiresAt = new Date(Date.now() + hours * 3600_000);

    const { rows } = await client.query(
      `INSERT INTO invitations
         (kind, email, name, role, permissions, token_hash, expires_at, created_by, created_ip)
       VALUES ('STAFF', $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.email,
        input.name,
        input.role,
        permissions,
        hashToken(token),
        expiresAt,
        input.actor.id,
        input.meta.ipAddress ?? null,
      ],
    );

    const id = rows[0].id as string;

    await recordAudit(
      { type: "staff", id: input.actor.id, label: input.actor.name },
      {
        action: "staff.invited",
        entityType: "invitation",
        entityId: id,
        metadata: { email: input.email, role: input.role, permissions, expiresAt },
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
      },
      client,
    );

    const { rows: full } = await client.query(
      `SELECT ${INVITATION_COLUMNS} FROM invitations i
         LEFT JOIN clients c ON c.id = i.client_id
         LEFT JOIN staff s ON s.id = i.created_by
        WHERE i.id = $1`,
      [id],
    );

    return { invitation: full[0] as Invitation, token };
  });
}

export type IssuePortalInvitation = {
  clientId: string;
  email: string;
  name: string;
  roleTitle?: string;
  expiresInHours?: number;
  actor: { id: string; name: string; email: string };
  meta: RequestMeta;
};

export async function issuePortalInvitation(input: IssuePortalInvitation): Promise<{
  invitation: Invitation;
  token: string;
}> {
  const hours = clampHours(input.expiresInHours, 168);

  return tx(async (client) => {
    const { rows: clientRows } = await client.query(
      "SELECT id, name FROM clients WHERE id = $1",
      [input.clientId],
    );
    if (clientRows.length === 0) {
      throw new InvitationError("Client not found.", "invalid");
    }

    // A pending portal invitation already exists for this person at this
    // client, so re-sending is a no-op rather than a second valid token.
    const { rows: existing } = await client.query(
      `SELECT id FROM invitations
        WHERE email = $1 AND kind = 'CLIENT_PORTAL' AND client_id = $2 AND status = 'PENDING'
          AND expires_at > now()`,
      [input.email, input.clientId],
    );
    if (existing.length > 0) {
      throw new InvitationError(
        "There is already a pending invitation for this address.",
        "forbidden",
      );
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + hours * 3600_000);

    const { rows } = await client.query(
      `INSERT INTO invitations
         (kind, email, name, client_id, token_hash, expires_at, created_by, created_ip)
       VALUES ('CLIENT_PORTAL', $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.email,
        input.name,
        input.clientId,
        hashToken(token),
        expiresAt,
        input.actor.id,
        input.meta.ipAddress ?? null,
      ],
    );

    const id = rows[0].id as string;

    await recordAudit(
      { type: "staff", id: input.actor.id, label: input.actor.name },
      {
        action: "client.portal_invited",
        entityType: "invitation",
        entityId: id,
        metadata: {
          email: input.email,
          clientId: input.clientId,
          clientName: clientRows[0].name,
          expiresAt,
        },
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
      },
      client,
    );

    const { rows: full } = await client.query(
      `SELECT ${INVITATION_COLUMNS} FROM invitations i
         LEFT JOIN clients c ON c.id = i.client_id
         LEFT JOIN staff s ON s.id = i.created_by
        WHERE i.id = $1`,
      [id],
    );

    return { invitation: full[0] as Invitation, token };
  });
}

function clampHours(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(720, Math.floor(value)));
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Look up a token for display before acceptance.
 *
 * Returns null for anything not live, without distinguishing expired from
 * revoked from already used. A distinct message for each would tell an attacker
 * holding a stale token something useful.
 */
export async function findLiveInvitation(token: string): Promise<{
  id: string;
  kind: InvitationKind;
  email: string;
  name: string | null;
  role: Role | null;
  client_id: string | null;
  client_name: string | null;
  expires_at: Date;
} | null> {
  if (!isPlausibleToken(token)) return null;

  const row = await queryOne<{
    id: string;
    kind: InvitationKind;
    email: string;
    name: string | null;
    role: Role | null;
    client_id: string | null;
    client_name: string | null;
    expires_at: Date;
  }>(
    `SELECT i.id, i.kind, i.email, i.name, i.role, i.client_id,
            c.name AS client_name, i.expires_at
       FROM invitations i
       LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.token_hash = $1
        AND i.status = 'PENDING'
        AND i.expires_at > now()`,
    [hashToken(token)],
  );

  return row;
}

export async function listInvitations(kind?: InvitationKind): Promise<Invitation[]> {
  if (kind) {
    return query<Invitation>(
      `SELECT ${INVITATION_COLUMNS} FROM invitations i
         LEFT JOIN clients c ON c.id = i.client_id
         LEFT JOIN staff s ON s.id = i.created_by
        WHERE i.kind = $1
        ORDER BY i.created_at DESC`,
      [kind],
    );
  }
  return query<Invitation>(
    `SELECT ${INVITATION_COLUMNS} FROM invitations i
       LEFT JOIN clients c ON c.id = i.client_id
       LEFT JOIN staff s ON s.id = i.created_by
      ORDER BY i.created_at DESC`,
  );
}

export async function countPendingInvitations(kind: InvitationKind): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM invitations
      WHERE kind = $1 AND status = 'PENDING' AND expires_at > now()`,
    [kind],
  );
  return row?.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Revoking                                                                   */
/* -------------------------------------------------------------------------- */

export async function revokeInvitation(
  id: string,
  actor: { id: string; name: string },
  meta: RequestMeta,
): Promise<boolean> {
  return tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE invitations SET status = 'REVOKED', revoked_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING kind, email, client_id`,
      [id],
    );
    if (rows.length === 0) return false;

    const row = rows[0] as { kind: InvitationKind; email: string; client_id: string | null };
    await recordAudit(
      { type: "staff", id: actor.id, label: actor.name },
      {
        action: row.kind === "STAFF" ? "staff.invite_revoked" : "client.portal_invite_revoked",
        entityType: "invitation",
        entityId: id,
        metadata: { email: row.email, kind: row.kind },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      client,
    );
    return true;
  });
}

/**
 * Mark invitations past their expiry as EXPIRED.
 *
 * Status is not mutated on read, so a listing stays truthful without a write on
 * every page load; this is the sweep that reconciles the stored value. Expiry is
 * enforced by the `expires_at > now()` predicate in every read path regardless,
 * so a stale PENDING row is never treated as usable.
 */
export async function expireStaleInvitations(): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE invitations SET status = 'EXPIRED'
      WHERE status = 'PENDING' AND expires_at <= now()
      RETURNING id`,
  );
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Acceptance                                                                 */
/* -------------------------------------------------------------------------- */

export type AcceptResult =
  | { ok: true; staffId: string; email: string; name: string }
  | { ok: true; clientUserId: string; clientId: string; email: string; name: string };

/**
 * Consume a token and create the account it authorises.
 *
 * The status transition and the account insert are one transaction, and the
 * status update is conditional on the row still being PENDING. Two concurrent
 * redemptions of the same token therefore produce exactly one account: the
 * loser updates zero rows and is rejected.
 */
export async function claimInvitation(
  token: string,
  input: { name: string; passwordHash: string; meta: RequestMeta },
): Promise<AcceptResult> {
  if (!isPlausibleToken(token)) {
    throw new InvitationError("This invitation link is not valid.", "invalid");
  }

  try {
    return await runClaim(token, input);
  } catch (error) {
    // Reconcile the stored label outside the failed transaction. The read path
    // already refuses an expired token via `expires_at > now()`, so this is
    // about the record being truthful, not about access control.
    if (error instanceof ExpiredInvitation) {
      await query(
        `UPDATE invitations SET status = 'EXPIRED' WHERE id = $1 AND status = 'PENDING'`,
        [error.invitationId],
      );
      throw new InvitationError(
        "This invitation has expired. Ask the Rhymvex team for a new one.",
        "expired",
      );
    }
    throw error;
  }
}

async function runClaim(
  token: string,
  input: { name: string; passwordHash: string; meta: RequestMeta },
): Promise<AcceptResult> {
  return tx(async (client) => {
    // Lock the row for the duration of the transaction so a second request
    // waits here rather than racing ahead.
    const { rows } = await client.query(
      `SELECT id, kind, email, name, role, client_id, expires_at, status
         FROM invitations
        WHERE token_hash = $1
        FOR UPDATE`,
      [hashToken(token)],
    );

    if (rows.length === 0) {
      throw new InvitationError("This invitation link is not valid.", "invalid");
    }

    const invitation = rows[0] as {
      id: string;
      kind: InvitationKind;
      email: string;
      name: string | null;
      role: string | null;
      client_id: string | null;
      expires_at: Date;
      status: string;
    };

    if (invitation.status === "ACCEPTED") {
      throw new InvitationError(
        "This invitation has already been used. Try signing in instead.",
        "accepted",
      );
    }
    if (invitation.status === "REVOKED") {
      throw new InvitationError(
        "This invitation was withdrawn. Ask the Rhymvex team for a new one.",
        "revoked",
      );
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new ExpiredInvitation(invitation.id);
    }

    if (invitation.kind === "STAFF") {
      if (!invitation.role || !isRole(invitation.role)) {
        throw new InvitationError("This invitation is not usable.", "invalid");
      }

      const existing = await client.query(
        "SELECT 1 FROM staff WHERE email = $1",
        [invitation.email],
      );
      if (existing.rows.length > 0) {
        throw new InvitationError(
          "An account with this email already exists. Try signing in instead.",
          "email_taken",
        );
      }

      const { rows: staffRows } = await client.query(
        `INSERT INTO staff (email, name, role, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name`,
        [invitation.email, input.name, invitation.role, input.passwordHash],
      );
      const staff = staffRows[0] as { id: string; email: string; name: string };

      await client.query(
        `UPDATE invitations SET status = 'ACCEPTED', accepted_at = now() WHERE id = $1`,
        [invitation.id],
      );

      await recordAudit(
        { type: "staff", id: staff.id, label: staff.name },
        {
          action: "invitation.accepted",
          entityType: "invitation",
          entityId: invitation.id,
          metadata: { kind: "STAFF", email: staff.email, role: invitation.role },
          ipAddress: input.meta.ipAddress,
          userAgent: input.meta.userAgent,
        },
        client,
      );

      return { ok: true, staffId: staff.id, email: staff.email, name: staff.name };
    }

    // CLIENT_PORTAL
    if (!invitation.client_id) {
      throw new InvitationError("This invitation is not usable.", "invalid");
    }

    // A portal user email must be unique across the platform: one login, one
    // tenant, no ambiguity about which client a session belongs to.
    const existingUser = await client.query(
      "SELECT 1 FROM client_users WHERE email = $1",
      [invitation.email],
    );
    if (existingUser.rows.length > 0) {
      throw new InvitationError(
        "An account with this email already exists. Try signing in instead.",
        "email_taken",
      );
    }

    const { rows: userRows } = await client.query(
      `INSERT INTO client_users (client_id, email, name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, client_id, email, name`,
      [invitation.client_id, invitation.email, input.name, input.passwordHash],
    );
    const user = userRows[0] as {
      id: string;
      client_id: string;
      email: string;
      name: string;
    };

    await client.query(
      `UPDATE invitations SET status = 'ACCEPTED', accepted_at = now() WHERE id = $1`,
      [invitation.id],
    );

    await recordAudit(
      { type: "client", id: user.id, label: user.name },
      {
        action: "invitation.accepted",
        entityType: "invitation",
        entityId: invitation.id,
        metadata: {
          kind: "CLIENT_PORTAL",
          email: user.email,
          clientId: user.client_id,
        },
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
      },
      client,
    );

    return {
      ok: true,
      clientUserId: user.id,
      clientId: user.client_id,
      email: user.email,
      name: user.name,
    };
  });
}
