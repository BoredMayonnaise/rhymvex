/**
 * Roles and permissions.
 *
 * Authorisation is resolved here on the server. The client renders links based
 * on `can()` for usability, but no UI check is a security boundary: every
 * protected action re-checks through `requirePermission` / `requireStaff`.
 */

export const ROLES = [
  "ADMIN",
  "OPERATIONS",
  "ACCOUNT_MANAGER",
  "PROJECT_MANAGER",
  "DESIGNER",
  "FINANCE",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "leads.read",
  "leads.write",
  "leads.assign",
  "clients.read",
  "clients.write",
  "clients.portal_invite",
  "bookings.read",
  "bookings.write",
  "proposals.read",
  "proposals.write",
  "proposals.send",
  "contracts.read",
  "contracts.write",
  "contracts.send",
  "projects.read",
  "projects.write",
  "tasks.read",
  "tasks.write",
  "accounting.read",
  "accounting.write",
  "email.read",
  "email.send",
  "library.read",
  "library.write",
  "reports.read",
  "staff.read",
  "staff.invite",
  "staff.manage",
  "security.read",
  "settings.read",
  "settings.write",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Default grant per role. An ADMIN holds everything; the rest get the slice of
 * the business they actually run.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,

  // Runs the day-to-day. Broad read, can move work forward, but does not
  // control money, staff, or system settings.
  OPERATIONS: [
    "leads.read", "leads.write", "leads.assign",
    "clients.read", "clients.write",
    "bookings.read", "bookings.write",
    "proposals.read", "proposals.write",
    "contracts.read",
    "projects.read", "projects.write",
    "tasks.read", "tasks.write",
    "email.read", "email.send",
    "library.read", "library.write",
    "reports.read",
  ],

  // Owns the client relationship and the commercial conversation.
  ACCOUNT_MANAGER: [
    "leads.read", "leads.write", "leads.assign",
    "clients.read", "clients.write", "clients.portal_invite",
    "bookings.read", "bookings.write",
    "proposals.read", "proposals.write", "proposals.send",
    "contracts.read", "contracts.write", "contracts.send",
    "projects.read",
    "tasks.read", "tasks.write",
    "email.read", "email.send",
    "library.read", "library.write",
    "reports.read",
  ],

  // Owns delivery. No commercial or financial authority.
  PROJECT_MANAGER: [
    "clients.read",
    "projects.read", "projects.write",
    "tasks.read", "tasks.write",
    "bookings.read", "bookings.write",
    "email.read", "email.send",
    "library.read", "library.write",
    "reports.read",
  ],

  // Delivers the work. Can read the project, not run the business.
  DESIGNER: [
    "clients.read",
    "projects.read", "projects.write",
    "tasks.read", "tasks.write",
    "bookings.read",
    "email.read",
    "library.read", "library.write",
  ],

  // Owns the money. No access to staff or system configuration.
  FINANCE: [
    "clients.read",
    "proposals.read",
    "contracts.read", "contracts.write",
    "accounting.read", "accounting.write",
    "reports.read",
    "email.read", "email.send",
    "tasks.read", "tasks.write",
  ],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function describeRole(role: Role): string {
  const map: Record<Role, string> = {
    ADMIN: "Full access. Staff, security, settings and money.",
    OPERATIONS: "Runs delivery and the day-to-day pipeline.",
    ACCOUNT_MANAGER: "Owns client relationships and proposals.",
    PROJECT_MANAGER: "Owns project delivery and team tasks.",
    DESIGNER: "Delivers design work on assigned projects.",
    FINANCE: "Owns contracts, invoicing and reporting.",
  };
  return map[role];
}

/** Effective permissions = role grant ∪ per-user extras. */
export function effectivePermissions(
  role: Role,
  extra: readonly string[] = [],
): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const value of extra) {
    if (isPermission(value)) set.add(value);
  }
  return set;
}
