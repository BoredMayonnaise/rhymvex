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
const RETIRED_CURRENCY_COOKIE = "rv_currency";

/**
 * Expires the retired `rv_currency` cookie.
 *
 * The currency switcher and the detection layer that used to write this are
 * gone, so nothing can refresh it any more. Left alone, a cookie set during that
 * period overrides the language's own currency forever: a visitor in the
 * Philippines holding a leftover `rv_currency=SAR` saw Saudi riyals on /fil-PH.
 *
 * Dropped here rather than left to expire on its own so the fix reaches people
 * who already have it, instead of only people who happen to clear their cookies.
 * The currency now comes from the language in the URL, which means the right
 * prices do not depend on this cookie being absent — clearing it only removes a
 * stale value that is no longer read.
 */
function expireRetiredCurrencyCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.cookies.get(RETIRED_CURRENCY_COOKIE)?.value) {
    response.cookies.set(RETIRED_CURRENCY_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

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

  if (!isAdminRoute && !isPortalRoute) {
    return expireRetiredCurrencyCookie(request, NextResponse.next());
  }

  if (isAdminRoute) {
    if (!request.cookies.get(STAFF_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    // A client portal cookie is never sufficient for the admin workspace, but
    // there is nothing to check here: this point is only reached once a staff
    // cookie exists, so the `!STAFF_COOKIE` half of a "portal cookie without a
    // staff cookie" test can never be true. The separation is real and is
    // enforced by the page guard, which only ever reads `rv_staff_session`.
  }

  if (isPortalRoute) {
    if (!request.cookies.get(CLIENT_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal-sign-in";
      return NextResponse.redirect(url);
    }
  }

  return expireRetiredCurrencyCookie(request, NextResponse.next());
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
