import { NextResponse, type NextRequest } from "next/server";
import { stripLocalePrefix } from "@/lib/locales";

/**
 * Workspace route protection, plus locale-prefix canonicalisation.
 *
 * Next 16 calls this file convention `proxy`; it still runs ahead of the
 * matching routes, before any page renders.
 *
 * Route protection is a coarse, cheap first pass: it redirects anonymous
 * traffic away from the workspaces before any page renders. It is explicitly
 * *not* the security boundary. Every admin page calls `requireStaff` /
 * `requireStaffPermission` and every portal page calls `requireClientSession`,
 * which resolve the session server-side and are what actually authorise a
 * request. Middleware only avoids rendering a page that would immediately
 * redirect anyway.
 *
 * It reads the cookie's presence only, never its contents, so it needs no
 * database access and runs on the edge.
 */

const STAFF_COOKIE = "rv_staff_session";
const CLIENT_COOKIE = "rv_client_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // `/en-GB/admin` is a workspace URL someone typed or arrived on from a locale
  // switch. The workspaces are English-only and have one canonical URL each, so
  // this collapses the prefix rather than serving a second copy of the workspace
  // under every language. Without it the URL is a 404, and it is reached by the
  // ordinary route of picking a market from the site footer.
  const canonical = stripLocalePrefix(pathname);
  if (canonical) {
    const url = request.nextUrl.clone();
    url.pathname = canonical;
    return NextResponse.redirect(url);
  }

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPortalRoute = pathname === "/portal" || pathname.startsWith("/portal/");

  if (!isAdminRoute && !isPortalRoute) return NextResponse.next();

  if (isAdminRoute) {
    if (!request.cookies.get(STAFF_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    // A client portal cookie is never sufficient for the admin workspace. The
    // page guard confirms the session really is a staff session; this just stops
    // the two workspaces being confused for one another.
    if (request.cookies.get(CLIENT_COOKIE)?.value && !request.cookies.get(STAFF_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal-sign-in";
      return NextResponse.redirect(url);
    }
  }

  if (isPortalRoute) {
    if (!request.cookies.get(CLIENT_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal-sign-in";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Every path with at least one segment, so the locale prefix on a workspace
   * URL is seen before anything renders. Written as one static string rather
   * than expanded from the locale list: Next has to be able to read the matcher
   * without running this module, and expanding it would mean a new language also
   * needed a route edit here. Non-matches are two string comparisons.
   */
  matcher: ["/:locale/:path*"],
};
