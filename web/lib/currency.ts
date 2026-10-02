/**
 * Currencies.
 *
 * A currency is a preference of the visitor's, not a property of the language.
 * English with yen is a real visitor, and so is Japanese with pounds, so the URL
 * segment carries the language alone and the currency is remembered in a cookie.
 * `lib/locales.ts` owns which words a page is written in; this owns which money
 * the numbers are in, and the two are resolved independently.
 *
 * The data lives in `content/currencies.json`, mirrored into `web/content/` by
 * `scripts/sync-content.mjs`. Nothing here declares a price, a symbol or a band
 * label: this module gives that file types and the lookups the app needs.
 *
 * The budget bands are authored per currency rather than converted from a base,
 * because an agency prices what a market will bear and there is no honest
 * exchange rate between two currencies for a retainer. The consequence is that
 * adding a currency is one entry in the JSON, and that a rate can never be a
 * stale number on the page.
 *
 * Client-safe: no `node:` import, no database, no `next/headers`. The intake
 * form is a client component and needs the band labels; the server reads the
 * cookie through `lib/currency-preference.ts` instead.
 */
import currenciesData from "../content/currencies.json";

/** ISO 4217 codes, derived from the JSON so adding a currency needs no edit here. */
export type CurrencyCode = (typeof currenciesData.currencies)[number]["code"];

export type Currency = (typeof currenciesData.currencies)[number];

/**
 * Which band a visitor picked, as the select renders them.
 *
 * There is no `unsure` here: that choice is language, not money, and its label
 * comes from the message catalogue so it reads in the visitor's own script.
 */
export type BandKey = keyof (typeof currenciesData.currencies)[number]["budgetBands"];

export const BAND_KEYS = ["band_1", "band_2", "band_3", "band_4"] as const satisfies
  readonly BandKey[];

export const CURRENCIES: Record<CurrencyCode, Currency> = Object.fromEntries(
  currenciesData.currencies.map((c) => [c.code, c]),
) as Record<CurrencyCode, Currency>;

export const CURRENCY_CODES = currenciesData.currencies.map((c) => c.code) as CurrencyCode[];

/** The currency used when the visitor has never chosen one. */
export const DEFAULT_CURRENCY = currenciesData.default as CurrencyCode;

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function getCurrency(code?: string | null): Currency {
  return isCurrency(code) ? CURRENCIES[code] : CURRENCIES[DEFAULT_CURRENCY];
}

/** The four bands for a currency, as a select renders them. */
export function bandOptions(currency: Currency): { key: BandKey; label: string }[] {
  return BAND_KEYS.map((key) => ({ key, label: currency.budgetBands[key] }));
}

/**
 * The label for one band, rebuilt from the currency and the key alone.
 *
 * Server side, on every submission. A visitor posts a band key, and the text is
 * regenerated from the currency they were actually shown. That is what stops a
 * hand-edited request from writing "€8,000 – €15,000" against a page that was
 * priced in yen.
 */
export function bandLabel(currency: Currency, key: BandKey): string {
  return currency.budgetBands[key];
}

/** How a currency is named in a switcher, e.g. `Japan (¥)`. */
export function currencyLabel(currency: Currency): string {
  return `${currency.label} (${currency.symbol})`;
}

/**
 * The short form, for the switcher.
 *
 * A `<select>` is as wide as its widest option, so "United Kingdom (£)" made the
 * control a 190px block sitting in the intake header next to a logo. The symbol
 * is what a person scans for and the code is what is unambiguous, so the country
 * name is what goes: six characters instead of nineteen, and the option list
 * becomes scannable at a glance.
 *
 * The full name is still what the option means, so it stays in `aria-label` on
 * the control rather than in the option text, where a screen reader would read
 * out "United Kingdom" before every single one.
 */
export function currencyCompactLabel(currency: Currency): string {
  // CHF, AED and SAR have no distinct symbol, so the catalogue stores the code
  // as the symbol. Printing both would render "CHF CHF".
  return currency.symbol === currency.code
    ? currency.code
    : `${currency.symbol} ${currency.code}`;
}

/* --------------------------------------------------------------------------
   Remembering the choice

   A cookie, not a query parameter, so the money follows the visitor from a
   shared link, through the back button, and into next week's session. It is not
   httpOnly because the switcher writes it from the browser and the server reads
   it; it carries no secret and authorises nothing.
   -------------------------------------------------------------------------- */

export const CURRENCY_COOKIE = "rv_currency";

/** A year, so a returning visitor is not asked again next month. */
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Write the preference from the browser. A no-op during server rendering. */
export function rememberCurrency(code: CurrencyCode): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${CURRENCY_COOKIE}=${encodeURIComponent(code)}; path=/; ` +
    `max-age=${CURRENCY_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * The remembered preference, read from the browser. Null when unset or unknown.
 *
 * Used only where the server could not resolve it, which is the shared layout:
 * reading the cookie there would make every route dynamic, including the home
 * pages that show no money and are deliberately cached. See `CurrencySwitcher`.
 */
export function readRememberedCurrency(): CurrencyCode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]*)`),
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return isCurrency(value) ? value : null;
}
