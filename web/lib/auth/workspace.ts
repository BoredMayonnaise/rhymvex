/**
 * Where a sign-in lands, and which workspace it belongs to.
 *
 * The platform has two disjoint identity tables — `staff` and `client_users` —
 * with no shared user record and no field on either that says "this person is a
 * client". Which workspace an address belongs to is therefore only knowable by
 * asking both tables. That used to be a question put to the person signing in:
 * two forms, and the wrong one just failed. `Workspace` makes the platform answer
 * it instead, while keeping a way for a person to override the answer.
 *
 * The override is not decoration. An address can legitimately appear in both
 * tables — someone who is a Rhymvex account manager and also a contact at a
 * client company, on their own portal account. Auto-detection resolves those to
 * staff, because the workspace is the more privileged surface and so the one
 * worth resolving to deliberately. A person who wants the other one picks it
 * explicitly instead of signing out and back in.
 */

export const WORKSPACES = ["auto", "staff", "client"] as const;

export type Workspace = (typeof WORKSPACES)[number];

/** The two concrete workspaces. `auto` is a probe order, never a destination. */
export type WorkspaceScope = Exclude<Workspace, "auto">;

export const STAFF_HOME = "/admin";
export const CLIENT_HOME = "/portal";

/**
 * The sign-in route. One page serves both workspaces; `/portal-sign-in` survives
 * only as a redirect onto it, because links to it exist in old emails and in
 * `proxy.ts`.
 */
export const SIGN_IN_PATH = "/login";

/** Untrusted input is a hint, not a decision: anything unrecognised is `auto`. */
export function resolveWorkspace(raw: unknown): Workspace {
  return typeof raw === "string" && (WORKSPACES as readonly string[]).includes(raw)
    ? (raw as Workspace)
    : "auto";
}

/**
 * Constrain a caller-supplied destination to one workspace.
 *
 * This is the boundary between "wherever the visitor was going" and "a URL the
 * server chose". `next` arrives in a query string, so it is attacker-controlled
 * on a login form — an open redirect on a sign-in page is a credible phishing
 * primitive, because the person has just typed their password and trusts the
 * page they are on. The prefix is not sufficient on its own: a value like
 * `//evil.example` also starts with the prefix and would leave the origin, so
 * scheme-relative and backslash forms are rejected explicitly, along with the
 * CR/LF that would let a value break out of a header it is later written into.
 */
export function safeRedirectTarget(raw: unknown, prefix: string, fallback: string): string {
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

export function workspaceHome(workspace: WorkspaceScope): string {
  return workspace === "staff" ? STAFF_HOME : CLIENT_HOME;
}

/**
 * The workspace a destination path belongs to, or null if it names neither.
 *
 * Matched on a segment boundary, so `/admin-tools` is not read as the staff
 * workspace. This is what lets a deep link carry the workspace hint with it: a
 * visitor bounced off `/portal/invoices` arrives at sign-in already scoped to the
 * portal, and a staff member who followed the same link is not silently steered
 * somewhere they did not ask for.
 */
export function workspaceForPath(path: unknown): WorkspaceScope | null {
  if (typeof path !== "string") return null;
  const trimmed = path.trim();
  if (trimmed.startsWith("//") || trimmed.includes("\\")) return null;

  const matches = (home: string) => trimmed === home || trimmed.startsWith(`${home}/`);
  if (matches(STAFF_HOME)) return "staff";
  if (matches(CLIENT_HOME)) return "client";
  return null;
}

/**
 * The destination after a successful sign-in: a `next` that belongs to the
 * workspace just authenticated into, otherwise that workspace's home.
 *
 * The same answer serves both callers. The server action applies it once a
 * password is accepted, and the sign-in page applies it to a session that
 * already exists — a signed-in visitor who navigates back to `/login` gets the
 * same landing as one who just authenticated, rather than a second rule that
 * has to be kept in step with the first.
 *
 * A `next` pointing at the *other* workspace is discarded rather than honoured,
 * because following it would bounce a freshly signed-in person straight into a
 * guard that refuses them — an error screen caused entirely by the link they
 * arrived on. Landing on their own home instead keeps the deep link when it was
 * reachable and drops it quietly when it was not.
 */
export function signInTarget(workspace: WorkspaceScope, next: unknown): string {
  const home = workspaceHome(workspace);
  if (workspaceForPath(next) !== workspace) return home;
  return safeRedirectTarget(next, home, home);
}