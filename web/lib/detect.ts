/**
 * Visitor detection: language and currency, from what the request already
 * carries.
 *
 * Edge-safe by design. This is imported by `proxy.ts`, so it must stay free of
 * `node:` built-ins, database access and `next/headers`. It takes plain strings
 * and returns plain strings; reading the actual headers is the caller's job.
 *
 * Two deliberate rules run through all of it:
 *
 *   Detection happens once. Both helpers are only consulted when the visitor has
 *   no stored preference, so an explicit choice always outranks a guess. Nothing
 *   here is allowed to override somebody who has already decided.
 *
 *   A guess that is not confident returns null rather than a default. `null`
 *   means "carry on with what you already do", which for the locale is the
 *   default locale and for the currency is the language's own. Inventing a
 *   confident-looking answer from a weak signal is how people end up priced in
 *   the wrong currency with no idea why.
 */
import { DEFAULT_LOCALE, LOCALE_CODES, getLocale, type LocaleCode } from "./locales";
import { isCurrency, type CurrencyCode } from "./currency";

/* -------------------------------------------------------------------------- */
/* Language                                                                    */
/* -------------------------------------------------------------------------- */

/** One entry of an Accept-Language header, with its quality value. */
type LanguagePreference = { tag: string; q: number };

/**
 * Parse an Accept-Language header into preferences, best first.
 *
 * Tolerant on purpose. Real headers are malformed in the wild: missing `q`,
 * `q=2`, an empty list, a bare comma. None of those should throw, because this
 * runs before a page renders and a crash here is a 500 for every visitor.
 */
export function parseAcceptLanguage(header: string | null | undefined): LanguagePreference[] {
  if (!header) return [];

  return header
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag.trim().toLowerCase();
      if (!tag || tag === "*") return null;

      // Default q is 1. Anything unparseable is treated as 1 rather than dropped,
      // so `en-GB,fr` still ranks English first.
      let q = 1;
      for (const p of params) {
        const match = p.trim().match(/^q\s*=\s*([0-9.]+)$/i);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      return { tag, q };
    })
    .filter((p): p is LanguagePreference => p !== null && p.q > 0)
    .sort((a, b) => b.q - a.q);
}

/**
 * The locale an Accept-Language header points at, or null if we cannot tell.
 *
 * Matching runs in three passes, strongest first:
 *
 *   1. Exact tag, case-insensitively — `ar`, `zh-cn`, `fil-ph`.
 *   2. A language we have several regional variants of, where the header names
 *      only the language. This deliberately resolves to the DEFAULT locale when
 *      the default speaks that language, because `Accept-Language: en` is not a
 *      request to be shown British English; it is a request not to be shown a
 *      language the reader does not speak. Redirecting every `en` visitor to
 *      `/en-GB` would be wrong for most of them.
 *   3. Nothing. Null.
 *
 * Pass 2 is why this never picks an arbitrary regional variant: `en` becomes
 * en-IE, `zh` becomes zh-CN because there is only one, and anything genuinely
 * ambiguous returns null and keeps the default.
 */
export function detectLocale(header: string | null | undefined): LocaleCode | null {
  const preferences = parseAcceptLanguage(header);
  if (preferences.length === 0) return null;

  const normalised = new Map(LOCALE_CODES.map((c) => [c.toLowerCase(), c]));

  // Pass 1: an exact tag, best quality first.
  for (const { tag } of preferences) {
    const exact = normalised.get(tag);
    if (exact) return exact;
  }

  // Pass 2: language-only, where a match is unambiguous.
  for (const { tag } of preferences) {
    const language = tag.split("-")[0];
    if (!language) continue;

    const candidates = LOCALE_CODES.filter(
      (c) => c.toLowerCase().split("-")[0] === language,
    );
    if (candidates.length === 0) continue;

    const defaultIsThisLanguage =
      DEFAULT_LOCALE.toLowerCase().split("-")[0] === language;
    if (defaultIsThisLanguage) return DEFAULT_LOCALE;
    if (candidates.length === 1) return candidates[0];
    // Several variants and none is the default: the header is not specific
    // enough to choose between them.
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Currency                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * ISO 3166-1 alpha-2 country to the currency we price in for that country.
 *
 * Only countries whose currency is in content/currencies.json appear. That is
 * deliberate rather than incomplete: every currency in the catalogue carries its
 * own four budget bands, so pricing a visitor in a currency we have no bands for
 * would either invent figures or render nothing. A country that is missing here
 * is not an error, it just means the language's own currency is the right answer
 * and detection stays out of the way.
 */
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  // Eurozone. The member list, so a visitor is not defaulted away from EUR.
  IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", PT: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", LV: "EUR", LT: "EUR", EE: "EUR", CY: "EUR",
  MT: "EUR", HR: "EUR",

  GB: "GBP",
  US: "USD",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF", LI: "CHF",
  SG: "SGD",
  AE: "AED",
  SA: "SAR",
  IN: "INR",
  CN: "CNY",
  KR: "KRW",
  TH: "THB",
  MY: "MYR",
  PH: "PHP",
  ZA: "ZAR",
  NG: "NGN",
};

/**
 * Header names a CDN or platform sets with the visitor's country.
 *
 * In priority order, most specific first. These are the headers Vercel, Fly and
 * Cloudflare set; a self-hosted deployment sets none of them, which is why every
 * one is optional and a miss is the normal case rather than a failure.
 */
const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "fly-client-ip-country",
  "x-country-code",
  "x-geo-country",
] as const;

/** Pull a country code out of a header bag, or null if the platform did not set one. */
export function detectCountry(get: (name: string) => string | null): string | null {
  for (const header of COUNTRY_HEADERS) {
    const value = get(header)?.trim().toUpperCase();
    // Guard the shape rather than trusting it: these are attacker-controllable
    // on a deployment that does not strip them, and the value only ever reaches a
    // map lookup, but an unbounded string should not get that far.
    if (value && /^[A-Z]{2}$/.test(value)) return value;
  }
  return null;
}

/**
 * The currency to show a visitor in, given where they appear to be.
 *
 * Country first, because someone in Australia reading `/en-GB` wants Australian
 * dollars rather than pounds — the whole reason currency is a preference and
 * not a property of the URL.
 *
 * Returns null when the country is unknown, is one we have no currency for, or
 * maps to a code that is not in the catalogue. Callers then fall back to the
 * language's own currency, which is what the site already did.
 */
export function detectCurrency(country: string | null | undefined): CurrencyCode | null {
  if (!country) return null;
  const code = COUNTRY_CURRENCY[country.trim().toUpperCase()];
  return isCurrency(code) ? code : null;
}

/**
 * The country implied by an Accept-Language header, or null.
 *
 * This is the signal that works everywhere. Browsers send a region subtag
 * whenever they know one — `en-AU`, `en-GB`, `zh-CN`, `pt-BR` — and it is on
 * every request, from every client, with no CDN and no third-party call. The
 * platform geo headers are strictly better when they exist, but they only exist
 * behind Vercel or Cloudflare, so on a plain host they are simply absent and
 * detection has to fall back to something that is not.
 *
 * Only a two-letter region is considered, and only when we have a currency for
 * it. `en-AU` resolves to AUD; `en-001` (the "world English" tag some browsers
 * send) does not resolve to anything, because it names no country and guessing
 * one would be worse than not answering.
 */
export function countryFromLanguageHeader(
  header: string | null | undefined,
): string | null {
  for (const { tag } of parseAcceptLanguage(header)) {
    const parts = tag.split("-");
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts[i];
      // Only a plausible ISO 3166-1 alpha-2 code, and only one we price in.
      if (/^[a-z]{2}$/.test(candidate) && detectCurrency(candidate)) {
        return candidate.toUpperCase();
      }
    }
  }
  return null;
}

/**
 * A country from a browser timezone.
 *
 * The last-resort signal, and the only one that is client-side. `en-AU` covers
 * most Australian browsers, but a browser configured for a single language often
 * sends a bare `en`, and then the timezone is all that is left. It needs no
 * permission prompt, makes no network call, and identifies a timezone to roughly
 * country precision, which is exactly the precision a currency needs.
 *
 * Every zone is named explicitly and nothing is inferred from the area prefix.
 * An earlier version mapped `Europe/*` to GB and `America/*` to US, which
 * cheerfully priced somebody in Berlin in pounds and somebody in Lagos in rand.
 * A wrong currency is worse than no detection, so an unlisted zone returns null
 * and the language's own currency stands.
 *
 * The list covers the principal zone of each country we price in, plus the
 * multi-zone countries. It is not exhaustive over every IANA identifier — a
 * visitor in a zone not named here simply gets the locale default, which is the
 * safe answer.
 */
const ZONE_COUNTRY: Record<string, string> = {
  // Pound. Named first because Europe/* is not a shortcut for anything.
  "Europe/London": "GB",

  // Eurozone. Listed rather than assumed, because the non-euro members below
  // would otherwise be swept in with them.
  "Europe/Amsterdam": "NL", "Europe/Athens": "GR", "Europe/Belgrade": "RS",
  "Europe/Berlin": "DE", "Europe/Brussels": "BE", "Europe/Bucharest": "RO",
  "Europe/Budapest": "HU", "Europe/Copenhagen": "DK", "Europe/Dublin": "IE",
  "Europe/Helsinki": "FI", "Europe/Kyiv": "UA", "Europe/Kiev": "UA",
  "Europe/Lisbon": "PT", "Europe/Ljubljana": "SI", "Europe/Luxembourg": "LU",
  "Europe/Madrid": "ES", "Europe/Malta": "MT", "Europe/Minsk": "BY",
  "Europe/Monaco": "MC", "Europe/Paris": "FR", "Europe/Prague": "CZ",
  "Europe/Riga": "LV", "Europe/Rome": "IT", "Europe/San_Marino": "SM",
  "Europe/Sarajevo": "BA", "Europe/Skopje": "MK", "Europe/Sofia": "BG",
  "Europe/Tallinn": "EE", "Europe/Tirana": "AL", "Europe/Vaduz": "LI",
  "Europe/Valletta": "MT", "Europe/Vienna": "AT", "Europe/Vilnius": "LT",
  "Europe/Warsaw": "PL", "Europe/Zagreb": "HR", "Europe/Andorra": "AD",
  "Atlantic/Canary": "ES", "Atlantic/Faroe": "DK", "Atlantic/Jan_Mayen": "NO",

  // Switzerland. CHF, not EUR.
  "Europe/Zurich": "CH", "Europe/Bern": "CH", "Europe/Geneva": "CH",
  "Europe/Basel": "CH",

  // Europe/Oslo and Europe/Stockholm are deliberately absent. Neither Norway nor
  // Sweden is in the catalogue, so a visitor there gets null and the language's
  // own currency, which is the right answer. Naming them here with no value would
  // only be a way of writing the same thing badly.

  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Anchorage": "US",
  "America/Phoenix": "US", "America/Detroit": "US", "America/Indiana": "US",
  "America/Boise": "US", "America/Juneau": "US", "America/Adak": "US",
  "Pacific/Honolulu": "US",

  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Winnipeg": "CA",
  "America/Edmonton": "CA", "America/Halifax": "CA",
  "America/St_Johns": "CA", "America/Regina": "CA", "America/Whitehorse": "CA",

  "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN", "Asia/Chongqing": "CN", "Asia/Harbin": "CN",
  "Asia/Urumqi": "CN",
  "Asia/Seoul": "KR",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY",
  "Asia/Bangkok": "TH", "Asia/Manila": "PH",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE", "Asia/Muscat": "AE", "Asia/Riyadh": "SA",
  "Asia/Jerusalem": "IL", "Asia/Beirut": "LB",

  "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU", "Australia/Perth": "AU",
  "Australia/Adelaide": "AU", "Australia/Darwin": "AU",
  "Australia/Hobart": "AU", "Australia/Canberra": "AU",
  "Australia/ACT": "AU", "Australia/NSW": "AU",
  "Australia/Queensland": "AU", "Australia/South": "AU",
  "Australia/Victoria": "AU", "Australia/West": "AU",
  "Australia/Lord_Howe": "AU",

  "Africa/Johannesburg": "ZA", "Africa/Cape_Town": "ZA",
  "Africa/Lagos": "NG", "Africa/Port_Harcourt": "NG",
  "Africa/Luanda": "AO", "Africa/Kinshasa": "CD",
};

/** The country a timezone implies, or null when we will not guess. */
export function countryFromTimezone(timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  const zone = timezone.trim();
  if (!zone) return null;
  const country = ZONE_COUNTRY[zone];
  return typeof country === "string" ? country : null;
}

/**
 * The currency a language defaults to, as a code.
 *
 * Exported so the caller can seed the cookie from the same source of truth the
 * renderer uses, rather than duplicating the fallback chain.
 */
export function localeDefaultCurrency(locale?: LocaleCode | null): CurrencyCode {
  return getLocale(locale).currency as CurrencyCode;
}
