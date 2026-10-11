import { getCurrency, type Currency } from "./currency";

/**
 * Geo-IP as a starting suggestion, never an instruction.
 *
 * The currency of a market is a reasonable first guess from where a request
 * appears to come from, and it is nothing more than that. A VPN, a roaming
 * phone or a diaspora visitor all report a country that is not where the money
 * is, so this returns a suggestion the visitor is asked to confirm and it
 * silently declines to guess whenever it is not confident.
 *
 * The alternative this replaces is the currency switcher that used to write a
 * cookie nothing could refresh, which left a visitor in the Philippines reading
 * prices in Saudi riyals. A suggestion costs a question and cannot go stale:
 * once it is confirmed it becomes the visitor's own choice, scoped to the
 * language they confirmed it in.
 *
 * Server only: this reads request headers and calls out over the network.
 */

/** Country code to the currency that market prices in. Deliberately short. */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  MT: "EUR",
  CY: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  HR: "EUR",
  GB: "GBP",
  PH: "PHP",
  SA: "SAR",
  AE: "AED",
  JP: "JPY",
  CN: "CNY",
  KR: "KRW",
  TH: "THB",
  MY: "MYR",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  IN: "INR",
  ZA: "ZAR",
  NG: "NGN",
};

/** How long one IP's answer is trusted for. A country rarely moves. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Cap the cache so a flood of unique addresses cannot exhaust memory. */
const CACHE_MAX = 5000;

const cache = new Map<string, { country: string | null; at: number }>();

/**
 * The caller's address, preferring the proxy's forwarded chain.
 *
 * The first entry in `x-forwarded-for` is the original client; every entry
 * after it is another hop. Behind no proxy this is empty and the socket address
 * is used, which on this deployment is the container's own port and worth very
 * little. Both are treated the same way.
 */
export function clientIp(headers: Headers, socketAddress?: string | null): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim() || null;
  return socketAddress ?? null;
}

/**
 * The country an address appears to be in, or null when nobody knows.
 *
 * Cached per address, because a suggestion shown once does not need to be
 * looked up again on every page view, and the lookup is a network round trip.
 *
 * Every failure path returns null rather than throwing. A suggestion is
 * optional: if the lookup is rate limited, slow or the provider changes shape,
 * the visitor keeps the currency the language defaults to, which is the
 * behaviour this feature is meant to improve on and never to replace.
 */
export async function countryForIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.country;

  try {
    const response = await fetch(`https://get.geojs.io/v1/ip/country.json`, {
      signal: AbortSignal.timeout(2500),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    const country =
      typeof body === "object" && body !== null && "country" in body
        ? (body as { country?: unknown }).country
        : null;
    const code = typeof country === "string" ? country.trim().toUpperCase() : null;
    if (!code || !/^[A-Z]{2}$/.test(code)) return null;

    if (cache.size >= CACHE_MAX) {
      // Drop the oldest rather than refuse to cache anything else, so a long
      // uptime does not turn into a permanently full map.
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(ip, { country: code, at: Date.now() });
    return code;
  } catch {
    return null;
  }
}

/**
 * The currency a country plausibly prices in, or null when we have no view.
 *
 * An unmapped country is the common case and the correct one: this catalogue
 * covers eighteen currencies, so a visitor in Brazil or Egypt is offered
 * nothing rather than a currency nobody has authored bands for.
 */
export function currencyForCountry(country: string | null): Currency | null {
  if (!country) return null;
  const code = COUNTRY_CURRENCY[country.toUpperCase()];
  return code ? getCurrency(code) : null;
}
