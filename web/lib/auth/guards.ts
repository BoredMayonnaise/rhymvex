import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { can, getClientSession, getStaffSession, type ClientSession, type StaffSession } from "./session";
import type { Permission } from "./rbac";

/**
 * Authorisation guards.
 *
 * These are the security boundary. Navigation is hidden for convenience, but a
 * page or route handler that forgets to call one of these is the bug this file
 * exists to prevent, so every protected surface calls one.
 */

/**
 * A refusal is a normal outcome, not a crash.
 *
 * Being signed in and still refused is a decision the platform made on purpose,
 * so it gets its own page explaining the boundary. Throwing instead produces
 * Next's generic error screen, which says nothing about the role boundary and
 * reads as a fault rather than a policy.
 *
 * Redirected rather than rendered inline so the guard can keep returning a
 * `StaffSession`, and so the explanation is one cached page instead of a
 * component tree built inside a guard. Next also strips custom error properties
 * in production builds, so an `error.tsx` boundary could not reliably tell an
 * `AuthError` apart from a genuine crash — an explicit redirect can.
 */
function notAuthorized(session: StaffSession, permission: Permission): never {
  const purpose = PERMISSION_PURPOSE[permission];
  const params = new URLSearchParams({
    permission,
    role: session.role,
    purpose: purpose ?? `use ${permission}`,
  });
  redirect(`/admin/denied?${params.toString()}`);
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** What each permission governs, phrased for the person reading it. */
const PERMISSION_PURPOSE: Partial<Record<Permission, string>> = {
  "leads.read": "see incoming requests and the pipeline",
  "leads.write": "move leads through the pipeline",
  "leads.assign": "assign leads to a team member",
  "clients.read": "see client records",
  "clients.write": "change client records",
  "clients.portal_invite": "invite clients to the portal",
  "bookings.read": "see bookings",
  "bookings.write": "schedule bookings",
  "proposals.read": "see proposals",
  "proposals.write": "write proposals",
  "proposals.send": "send proposals",
  "contracts.read": "see contracts",
  "contracts.write": "change contracts",
  "projects.read": "see projects",
  "projects.write": "update projects",
  "tasks.read": "see team tasks",
  "tasks.write": "change team tasks",
  "accounting.read": "see invoices and revenue",
  "accounting.write": "change invoices",
  "email.read": "see business email",
  "email.send": "send email",
  "library.read": "see the library",
  "library.write": "add to the library",
  "reports.read": "see reports",
  "staff.read": "see staff and access",
  "staff.invite": "invite team members",
  "staff.manage": "manage team access",
  "security.read": "see the security overview",
  "settings.read": "see settings",
  "settings.write": "change settings",
  "audit.read": "read the audit trail",
};

/** Staff-only page guard. Redirects an anonymous visitor to sign-in. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Staff page guard with a permission requirement.
 *
 * A signed-in staff member without the permission is refused. The refusal is
 * rendered as a page in the workspace's own design, not thrown: an uncaught
 * error in a server component becomes Next's generic crash screen, which tells
 * the person nothing about *why* they were stopped and reads like a broken
 * product rather than a deliberate boundary.
 *
 * The check is still the boundary. Nothing is loaded before it runs, and
 * rendering a refusal instead of throwing does not weaken it.
 */
export async function requireStaffPermission(permission: Permission): Promise<StaffSession> {
  const session = await requireStaff();
  if (!can(session, permission)) {
    return notAuthorized(session, permission);
  }
  return session;
}

/** Client portal page guard. */
export async function requireClientSession(): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) redirect("/portal/sign-in");
  return session;
}

/**
 * Route-handler variant of the staff guard. Returns the session or a 401
 * response the handler should return.
 */
export async function apiRequireStaff(): Promise<
  { session: StaffSession; error: null } | { session: null; error: NextResponse }
> {
  const session = await getStaffSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function apiRequirePermission(
  permission: Permission,
): Promise<{ session: StaffSession; error: null } | { session: null; error: NextResponse }> {
  const result = await apiRequireStaff();
  if (result.error || !result.session) return result;
  if (!can(result.session, permission)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: `Your role (${result.session.role}) is not allowed to ${permission}.` },
        { status: 403 },
      ),
    };
  }
  return result;
}

export async function apiRequireClient(): Promise<
  { session: ClientSession; error: null } | { session: null; error: NextResponse }
> {
  const session = await getClientSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Tenant isolation.
 *
 * The session's clientId is the only accepted source of a client scope. An id
 * in a route parameter is treated as a hint to look up *within* that scope: if
 * the row is not owned by the session's client, this returns null and the caller
 * responds 404. Swapping an id in a URL therefore cannot reach another tenant.
 */
export function scopeToClient<T extends { client_id: string }>(
  session: ClientSession,
  row: T | null,
): T | null {
  if (!row) return null;
  return row.client_id === session.clientId ? row : null;
}
