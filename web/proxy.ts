import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  homeHref,
  stripLocalePrefix,
} from "@/lib/locales";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "@/lib/currency";
import {
  detectCountry,
  detectCurrency,
  detectLocale,
  countryFromLanguageHeader,
} from "@/lib/detect";

/**
 * Workspace route protection, locale-prefix canonicalisation, and first-visit
 * detection.
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
 *
 * Detection lives here rather than in a layout for one reason: reading
 * `Accept-Language` or a geo header in a layout would make every route dynamic,
 * including the home pages that are deliberately statically cached. Ahead of
 * rendering, the cost is a header read and the cached page is untouched.
 */

const STAFF_COOKIE = "rv_staff_session";
const CLIENT_COOKIE = "rv_client_session";

/**
 * Detection on a first visit.
 *
 * Only ever runs on the bare `/`, and only when the visitor has no stored
 * preference. Three things follow from that, and all three matter:
 *
 *   It cannot loop. `/{locale}` is a real route that this never redirects, so
 *   the most a visitor sees is one hop.
 *
 *   It cannot fight the visitor. Both switches write their cookie, so once
 *   somebody has chosen, detection is finished for them. Somebody who
 *   deliberately returns to the default stays there.
 *
 *   It cannot invent a preference. `detectLocale` returns null unless the header
 *   actually names a language we have, and null means carry on. A visitor
 *   sending `de-DE` is left on the default rather than being shown something
 *   wrong.
 *
 * The redirect is temporary (307) so a crawler is never asked to treat `/` and
 * `/{locale}` as the same stored resource, and the response carries
 * `Vary: Accept-Language` so a shared cache cannot serve one language's redirect
 * to another.
 */
function detect(request: NextRequest): NextResponse | null {
  const hasLocaleChoice = Boolean(request.cookies.get(LOCALE_COOKIE)?.value);
  const hasCurrencyChoice = Boolean(request.cookies.get(CURRENCY_COOKIE)?.value);

  const locale = hasLocaleChoice
    ? null
    : detectLocale(request.headers.get("accept-language"));
  const currency = hasCurrencyChoice
    ? null
    : detectCurrency(
        // Best first, then progressively weaker. The platform header is the most
        // accurate when it is there at all, but it only exists behind Vercel or
        // Cloudflare, so on a plain host it is absent and this chain would
        // otherwise never resolve to anything.
        detectCountry((name) => request.headers.get(name)) ??
          countryFromLanguageHeader(request.headers.get("accept-language")),
      );

  // Nothing to say and nothing to remember.
  if (!locale && !currency) return null;

  // A locale we do not serve is not a reason to move anybody.
  if (locale && locale !== DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = homeHref(locale);
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Vary", "Accept-Language");
    if (currency) {
      response.cookies.set(CURRENCY_COOKIE, currency, {
        path: "/",
        maxAge: CURRENCY_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    return response;
  }

  if (!currency) return null;

  // Only the default locale was detected, so there is nothing to redirect to.
  // Remember the currency and let the cached page render as-is.
  const response = NextResponse.next();
  response.headers.set("Vary", "Accept-Language");
  response.cookies.set(CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: CURRENCY_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Detection runs before anything else and only for the bare root, which is the
  // one URL that means "we have not decided which language yet".
  if (pathname === "/") {
    const detected = detect(request);
    if (detected) return detected;
    // No preference to record. Fall through, but still let the rest of this file
    // see the request.
  }

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
   * The bare root as well as every path with at least one segment: the root is
   * where detection runs, and the rest is where the locale prefix on a workspace
   * URL has to be seen before anything renders.
   *
   * Written as static strings rather than expanded from the locale list: Next has
   * to be able to read the matcher without running this module, and expanding it
   * would mean a new language also needed a route edit here. Non-matches are two
   * string comparisons.
   */
  matcher: ["/", "/:locale/:path*"],
};
