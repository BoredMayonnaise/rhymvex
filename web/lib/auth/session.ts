import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db/client";
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

const STAFF_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const STAFF_REMEMBERED_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const CLIENT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const CLIENT_REMEMBERED_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

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
 */
function signSessionId(id: string): string {
  const secret = requireEnv("SESSION_SECRET");
  const mac = createHash("sha256").update(`${id}.${secret}`).digest("base64url");
  return `${id}.${mac}`;
}

function unsignSessionId(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHash("sha256").update(`${id}.${requireEnv("SESSION_SECRET")}`).digest(
    "base64url",
  );
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
  const ttl = options?.remember ? STAFF_REMEMBERED_TTL_MS : STAFF_TTL_MS;
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
    staff_id: string;
    name: string;
    email: string;
    role: Role;
    title: string | null;
    active: boolean;
    extra_permissions: string[];
  }>(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
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

export function staffCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
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
  const ttl = options?.remember ? CLIENT_REMEMBERED_TTL_MS : CLIENT_TTL_MS;
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
    client_user_id: string;
    client_id: string;
    name: string;
    email: string;
    client_name: string;
    active: boolean;
    client_status: string;
  }>(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
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

export function clientCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
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

