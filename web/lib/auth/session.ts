import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db/client";
import { getSecuritySettings } from "@/lib/security-settings";
import { requireEnv } from "@/lib/env";
import {
  effectivePermissions,
  type Permission,
  type Role,
} from "@/lib/auth/rbac";

/**
 * Session handling for both workspaces.
 *
 * Staff sessions and client portal sessions are stored in separate tables and
 * carry different cookies, so a portal cookie can never be presented to an
 * admin route and be accepted.
 */

const STAFF_COOKIE = "rv_staff_session";
const CLIENT_COOKIE = "rv_client_session";

/* Session lifetimes used to be frozen constants here. They are policy now, read
   through the short memo in security-settings, so an admin can shorten them
   without a deploy. The numbers below are the defaults that memo falls back to,
   and the only copy of them in the codebase. */
const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;



export type StaffSession = {
  id: string;
  staffId: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  permissions: Set<Permission>;
  csrfToken: string;
};

export type ClientSession = {
  id: string;
  clientUserId: string;
  clientId: string;
  name: string;
  email: string;
  clientName: string;
  csrfToken: string;
};

export function can(session: StaffSession | null, permission: Permission): boolean {
  return session?.permissions.has(permission) ?? false;
}

/** How stale `last_seen_at` may get before a request bothers to refresh it. */
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Stamp a session as in use.
 *
 * Runs on the hot path, so it only writes once the stored stamp has aged past
 * the interval — otherwise every request would be a write to the one table an
 * admin reads when asking "is this account still being used?".
 */
async function heartbeat(table: "sessions" | "client_sessions", id: string, lastSeenAt: Date) {
  if (Date.now() - new Date(lastSeenAt).getTime() < HEARTBEAT_INTERVAL_MS) return;
  await query(`UPDATE ${table} SET last_seen_at = now() WHERE id = $1`, [id]);
}

/**
 * Delete rows that have already expired.
 *
 * Sessions are otherwise only removed when the cookie that owns them is
 * presented, so a browser that closed without signing out leaves its row
 * behind indefinitely. Called when someone signs in and when an admin opens the
 * security page — both rare enough that a cron job is not worth the
 * infrastructure, and between them they keep the table honest.
 */
export async function pruneExpiredSessions(): Promise<void> {
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  await query("DELETE FROM client_sessions WHERE expires_at <= now()");
}

/* -------------------------------------------------------------------------- */
/* Token helpers                                                              */
/* -------------------------------------------------------------------------- */

/** URL-safe, cryptographically random session id. */
function newSessionId(): string {
  return `${randomUUID()}.${randomBytes(24).toString("base64url")}`;
}

function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Signed session cookie value. The database stores the id; the signature means
 * a tampered cookie is rejected before any database lookup happens.
 *
 * HMAC, not a bare hash of `secret + id`. `sha256(secret ‖ message)` is a
 * keyed-hash-by-prefix and is structurally subject to length extension; HMAC is
 * the construction that is actually designed to take a secret. Note this
 * invalidates cookies issued before the switch, so deploying it signs every
 * current session out once — which is the correct time to do it, and no worse
 * than a deploy already is.
 */
function signSessionId(id: string): string {
  return `${id}.${sessionMac(id)}`;
}

function sessionMac(id: string): string {
  return createHmac("sha256", requireEnv("SESSION_SECRET")).update(id).digest("base64url");
}

function unsignSessionId(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sessionMac(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

/** Digest used to store invitation tokens. The raw token is never persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Staff sessions                                                             */
/* -------------------------------------------------------------------------- */

export async function createStaffSession(
  staffId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null },
  options?: { remember?: boolean },
): Promise<{ cookieValue: string; csrfToken: string; expiresAt: Date }> {
  const id = newSessionId();
  const csrfToken = newCsrfToken();
  const policy = await getSecuritySettings();
  const ttl = options?.remember
    ? policy.staffRememberedDays * DAY_MS
    : policy.staffSessionHours * HOUR_MS;
  const expiresAt = new Date(Date.now() + ttl);

  await query(
    `INSERT INTO sessions (id, staff_id, user_agent, ip_address, csrf_token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, staffId, meta.userAgent ?? null, meta.ipAddress ?? null, csrfToken, expiresAt],
  );

  return { cookieValue: signSessionId(id), csrfToken, expiresAt };
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const raw = store.get(STAFF_COOKIE)?.value;
  if (!raw) return null;

  const id = unsignSessionId(raw);
  if (!id) return null;

  const row = await queryOne<{
    session_id: string;
    csrf_token: string;
    expires_at: Date;
    last_seen_at: Date;
    staff_id: string;
    name: string;
    email: string;
    role: Role;
    title: string | null;
    active: boolean;
    extra_permissions: string[];
  }>(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at, s.last_seen_at,
            st.id AS staff_id, st.name, st.email, st.role, st.title,
            st.active, st.extra_permissions
       FROM sessions s
       JOIN staff st ON st.id = s.staff_id
      WHERE s.id = $1`,
    [id],
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE id = $1", [id]);
    return null;
  }
  // A deactivated account loses access immediately, without waiting for expiry.
  if (!row.active) return null;

  await heartbeat("sessions", id, row.last_seen_at);

  return {
    id: row.session_id,
    staffId: row.staff_id,
    name: row.name,
    email: row.email,
    role: row.role,
    title: row.title,
    permissions: effectivePermissions(row.role, row.extra_permissions ?? []),
    csrfToken: row.csrf_token,
  };
}

export async function destroyStaffSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(STAFF_COOKIE)?.value;
  if (raw) {
    const id = unsignSessionId(raw);
    if (id) await query("DELETE FROM sessions WHERE id = $1", [id]);
  }
  store.delete(STAFF_COOKIE);
}

export async function staffCookieOptions(expiresAt: Date) {
  const { cookieSamesite } = await getSecuritySettings();
  return {
    httpOnly: true,
    sameSite: cookieSamesite,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export { STAFF_COOKIE };

/* -------------------------------------------------------------------------- */
/* Client portal sessions                                                     */
/* -------------------------------------------------------------------------- */

export async function createClientSession(
  clientUserId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null },
  options?: { remember?: boolean },
): Promise<{ cookieValue: string; csrfToken: string; expiresAt: Date }> {
  const id = newSessionId();
  const csrfToken = newCsrfToken();
  const policy = await getSecuritySettings();
  const ttl = options?.remember
    ? policy.clientRememberedDays * DAY_MS
    : policy.clientSessionDays * DAY_MS;
  const expiresAt = new Date(Date.now() + ttl);

  await query(
    `INSERT INTO client_sessions (id, client_user_id, user_agent, ip_address, csrf_token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, clientUserId, meta.userAgent ?? null, meta.ipAddress ?? null, csrfToken, expiresAt],
  );

  return { cookieValue: signSessionId(id), csrfToken, expiresAt };
}

export async function getClientSession(): Promise<ClientSession | null> {
  const store = await cookies();
  const raw = store.get(CLIENT_COOKIE)?.value;
  if (!raw) return null;

  const id = unsignSessionId(raw);
  if (!id) return null;

  const row = await queryOne<{
    session_id: string;
    csrf_token: string;
    expires_at: Date;
    last_seen_at: Date;
    client_user_id: string;
    client_id: string;
    name: string;
    email: string;
    client_name: string;
    active: boolean;
    client_status: string;
  }>(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at, s.last_seen_at,
            u.id AS client_user_id, u.client_id, u.name, u.email, u.active,
            c.name AS client_name, c.status AS client_status
       FROM client_sessions s
       JOIN client_users u ON u.id = s.client_user_id
       JOIN clients c ON c.id = u.client_id
      WHERE s.id = $1`,
    [id],
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM client_sessions WHERE id = $1", [id]);
    return null;
  }
  // A deactivated account loses access immediately. A churned client keeps their
  // record and their history, but portal access is closed.
  if (!row.active || row.client_status === "CHURNED") return null;

  await heartbeat("client_sessions", id, row.last_seen_at);

  return {
    id: row.session_id,
    clientUserId: row.client_user_id,
    clientId: row.client_id,
    name: row.name,
    email: row.email,
    clientName: row.client_name,
    csrfToken: row.csrf_token,
  };
}

export async function destroyClientSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(CLIENT_COOKIE)?.value;
  if (raw) {
    const id = unsignSessionId(raw);
    if (id) await query("DELETE FROM client_sessions WHERE id = $1", [id]);
  }
  store.delete(CLIENT_COOKIE);
}

export async function clientCookieOptions(expiresAt: Date) {
  const { cookieSamesite } = await getSecuritySettings();
  return {
    httpOnly: true,
    sameSite: cookieSamesite,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export { CLIENT_COOKIE };

/* -------------------------------------------------------------------------- */
/* CSRF                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Double-submit CSRF check.
 *
 * Session-bound: the expected value comes from the database row for the current
 * session, not from a cookie, so an attacker cannot forge it by setting a cookie
 * on the victim's browser.
 */
export function csrfValid(session: { csrfToken: string } | null, submitted: unknown): boolean {
  if (!session || typeof submitted !== "string" || submitted.length === 0) return false;
  const a = Buffer.from(session.csrfToken);
  const b = Buffer.from(submitted);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

