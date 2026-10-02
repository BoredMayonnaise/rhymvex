import { CURRENCY_COOKIE, isCurrency, type CurrencyCode } from "./currency";
import { countryFromTimezone, detectCurrency } from "./detect";

/**
 * Last-resort currency detection, in the browser.
 *
 * `proxy.ts` resolves the currency server-side from the platform's country
 * header, falling back to the region in `Accept-Language`. That covers most
 * visitors without a single third-party call. It misses one common case: a
 * browser configured for a single language sends a bare `en` with no region, so
 * there is no country in the request at all.
 *
 * The timezone is what is left, and it needs no permission prompt and no network
 * round trip. It is only consulted when the cookie is absent, so it can never
 * override a real choice or a value the server already decided.
 *
 * Deliberately not called on every render. It writes the cookie, so running it
 * repeatedly would keep the cached home pages from being static, and it runs on
 * the one route that actually shows money.
 */
export function detectCurrencyFromTimezone(): CurrencyCode | null {
  if (typeof document === "undefined") return null;

  // Already decided, by the visitor or by the server.
  if (/(?:^|;\s*)rv_currency=/.test(document.cookie)) return null;

  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }

  const currency = detectCurrency(countryFromTimezone(timezone));
  if (!currency || !isCurrency(currency)) return null;

  document.cookie =
    `${CURRENCY_COOKIE}=${encodeURIComponent(currency)}; path=/; ` +
    `max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  return currency;
}
