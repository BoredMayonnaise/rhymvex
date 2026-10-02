/**
 * Locales.
 *
 * One URL segment carries the language. That is why this is keyed by BCP-47
 * language tag rather than market code: `ar` and `th-TH` are different languages
 * in different scripts, while `en-GB` and `en-US` are the same language.
 *
 * The pricing is not here. A currency is a preference the visitor makes and it is
 * remembered in a cookie, so English can be read in pounds or in yen. See
 * `lib/currency.ts`. What a locale still owns is the currency it falls back to
 * for a visitor who has not chosen, which is what keeps `/en-GB` priced in
 * pounds for a first-time visitor.
 *
 * The data lives in `content/locales.json`, mirrored into `web/content/` by
 * `scripts/sync-content.mjs`. Nothing here declares a price or a band label:
 * this module gives that file types and the lookups the app needs.
 *
 * Adding a language is one entry in the JSON plus one catalogue in
 * `content/messages/`. No component, route or stylesheet changes.
 *
 * Client-safe: no `node:` import, no database. The intake form is a client
 * component and imports from here.
 */
import localesData from "../content/locales.json";
import { isCurrency as isCurrencyCode } from "./currency";

/** BCP-47 tags, derived from the JSON so adding a language needs no edit here. */
export type LocaleCode = (typeof localesData.locales)[number]["code"];
export type Direction = "ltr" | "rtl";
export type Script = "latin" | "arabic" | "cjk" | "thai";

export type Locale = (typeof localesData.locales)[number];

export const LOCALES: Record<LocaleCode, Locale> = Object.fromEntries(
  localesData.locales.map((l) => [l.code, l]),
) as Record<LocaleCode, Locale>;

export const LOCALE_CODES = localesData.locales.map((l) => l.code) as LocaleCode[];

/**
 * The locale the un-prefixed `/` and `/intake` URLs render as.
 *
 * Those URLs predate locales and are linked to from places nobody controls, so
 * they keep working and keep meaning Europe. Europe is served at the root rather
 * than redirecting to `/en-IE`, which keeps one URL per locale instead of two.
 */
export const DEFAULT_LOCALE = localesData.default as LocaleCode;

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

export function getLocale(code?: string | null): Locale {
  return isLocale(code) ? LOCALES[code] : LOCALES[DEFAULT_LOCALE];
}

export function isRtl(code?: string | null): boolean {
  return getLocale(code).dir === "rtl";
}

/* --------------------------------------------------------------------------
   URLs

   The default locale keeps the bare paths. `/` and `/intake` are what those
   URLs have always meant, so they keep rendering Europe rather than bouncing.
   -------------------------------------------------------------------------- */

/** Prefix for a locale's paths, or "" for the default locale. */
export function localePrefix(locale?: string | null): string {
  const code = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return code === DEFAULT_LOCALE ? "" : `/${code}`;
}



/**
 * The home page for a locale.
 *
 * No trailing slash, because the app runs with Next's default
 * `trailingSlash: false`. `/ar/` still resolves via the single 308 Next issues
 * for the slash form, but emitting `/ar` means links we write never bounce.
 */
export function homeHref(locale?: string | null): string {
  return localePrefix(locale) || "/";
}

/* --------------------------------------------------------------------------
   hreflang

   Every locale is a real translation of the same two pages, so each page has to
   name its siblings. Without this a crawler only ever learns about the locale
   it happened to land on: the pages self-declare a canonical, which stops them
   being treated as duplicates, but nothing tells a search engine that `/ar` and
   `/th-TH` are the same content in another language, so it picks one and stops
   discovering the rest.
   -------------------------------------------------------------------------- */

/**
 * A locale code as an hreflang value.
 *
 * Normalised to the conventional form — lowercase language, uppercase region —
 * because the catalogue stores `en-IE` and `zh-CN` while hreflang is written
 * `en-ie` and `zh-cn`. Matching is case-insensitive, but emitting one canonical
 * spelling keeps the tag identical across the meta tags and the sitemap.
 */
export function hrefLangTag(locale: LocaleCode): string {
  const [language, region] = locale.split("-");
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase();
}

/**
 * Sibling URLs for one page across every locale, plus `x-default`.
 *
 * `x-default` points at the default locale's own URL, which is the un-prefixed
 * one. That is the page to serve a visitor whose language matches none of the
 * seven, so it is the right target for the annotation and not a separate
 * redirect page we would then have to maintain.
 *
 * Shared by the page metadata and the sitemap so the two can never disagree
 * about which URL stands for which locale.
 */
export function localeAlternates(
  siteUrl: string,
  path: (locale: LocaleCode) => string,
): Record<string, string> {
  const entries = LOCALE_CODES.map((code) => [
    hrefLangTag(code),
    `${siteUrl}${path(code)}`,
  ]);
  return {
    ...Object.fromEntries(entries),
    "x-default": `${siteUrl}${path(DEFAULT_LOCALE)}`,
  };
}

/** Sibling URLs for the home page. */
export function homeAlternates(siteUrl: string): Record<string, string> {
  return localeAlternates(siteUrl, homeHref);
}

/** Sibling URLs for the intake page. */
export function intakeAlternates(siteUrl: string): Record<string, string> {
  return localeAlternates(siteUrl, (locale) => intakeHref(locale));
}

/**
 * The intake page for a locale. `params` carry the service-page context the
 * form uses to preselect a situation, exactly as they do on the bare URL.
 */
export function intakeHref(
  locale?: string | null,
  params?: Record<string, string | undefined>,
): string {
  const base = `${localePrefix(locale)}/intake`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Paths that only exist at the un-prefixed URL.
 *
 * The workspaces and the sign-in pages are internal, English-only surfaces with
 * no translated copy and no per-market pricing, so they have exactly one URL each.
 * They still render the site footer, which is why the locale switcher has to know
 * they exist: prefixing them would build `/en-GB/admin`, which is a 404.
 *
 * Kept here rather than in the proxy so the client and the edge agree on one list.
 */
export const NON_LOCALIZED_ROOTS = [
  "admin",
  "portal",
  "login",
  "portal-sign-in",
  "invite",
] as const;

/** Strip a leading locale segment, leaving the workspace path on its canonical URL. */
export function stripLocalePrefix(pathname: string): string | null {
  const [first, ...rest] = pathname.split("/").filter(Boolean);
  if (!isLocale(first)) return null;
  const canonical = `/${rest.join("/")}`;
  return NON_LOCALIZED_ROOTS.some(
    (root) => canonical === `/${root}` || canonical.startsWith(`/${root}/`),
  )
    ? canonical
    : null;
}

/* --------------------------------------------------------------------------
   Money and dates
   -------------------------------------------------------------------------- */

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale.code, {
    style: "currency",
    currency: locale.currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatDate(value: Date | string, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale.code, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/* --------------------------------------------------------------------------
   Lead provenance

   The language and the currency a lead was priced in are recorded in the existing
   `leads.source` text column as `website-intake:<locale>:<currency>` rather than
   in columns of their own. That column already answers "where did this come
   from", and both answers belong to it, so a lead read later shows its currency
   without anyone having to guess which site produced it. The currency is
   recorded because the band a visitor picked is only meaningful next to the
   money it was offered in.

   `leads.ts` defaults the column to a bare `website-intake`, and leads recorded
   before locales existed keep that value, so anything reading `source` has to
   treat the suffix as optional. Leads recorded before the currency became a
   choice have a locale but no currency, so that suffix is optional too.
   -------------------------------------------------------------------------- */

export const LEAD_SOURCE_PREFIX = "website-intake";

/**
 * Where a submission came from, in the language it was written in and the money
 * it was offered in. Either part is dropped rather than faked when unknown, so a
 * pre-locale lead stays readable as a bare `website-intake`.
 */
export function leadSource(locale?: string | null, currency?: string | null): string {
  const parts = [isLocale(locale) ? locale : null, isCurrencyCode(currency) ? currency : null];
  const suffix = parts.filter(Boolean).join(":");
  return suffix ? `${LEAD_SOURCE_PREFIX}:${suffix}` : LEAD_SOURCE_PREFIX;
}

export type LeadProvenance = {
  locale: LocaleCode | null;
  currency: string | null;
};

/** Recover what a stored `source` says, tolerating every earlier shape. */
export function provenanceFromSource(source: string | null | undefined): LeadProvenance {
  const empty: LeadProvenance = { locale: null, currency: null };
  if (!source?.startsWith(`${LEAD_SOURCE_PREFIX}:`)) return empty;
  const [code, currency] = source.slice(LEAD_SOURCE_PREFIX.length + 1).split(":");
  return { locale: isLocale(code) ? code : null, currency: currency || null };
}

/** Recover the locale from a stored `source`, or null for a pre-locale lead. */
export function localeFromSource(source: string | null | undefined): LocaleCode | null {
  return provenanceFromSource(source).locale;
}
