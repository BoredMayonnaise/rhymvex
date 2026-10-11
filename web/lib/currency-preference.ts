import { cookies } from "next/headers";
import { getCurrency, isCurrency, CURRENCY_COOKIE, CURRENCY_LOCALE_COOKIE, type Currency } from "./currency";
import { getLocale } from "./locales";

/**
 * The currency to render this request in, and the one to suggest.
 *
 * The currency belongs to the language. `/en-GB` is priced in pounds and
 * `/fil-PH` in pesos for everybody who arrives, which is what makes a link
 * mean the same thing to the person who sends it and the person who opens it.
 *
 * A visitor can override that, and the override is scoped to the language it
 * was made in. That scoping is the whole fix for the bug that removed the last
 * switcher: a preference nothing could refresh became permanently stale, and a
 * visitor in the Philippines holding a leftover `rv_currency=SAR` was shown
 * Saudi riyals. Writing the locale alongside the choice means a choice made in
 * Filipino cannot reach an English page, and a visitor who opens a link in
 * another language gets that language's own market.
 *
 * Server side only: `lib/currency.ts` stays client-safe and holds no cookie
 * logic, and this is the one place that reads `next/headers`.
 */

/** The currency this visitor has chosen for this language, if they chose one. */
async function chosenCurrency(locale: string): Promise<Currency | null> {
  const jar = await cookies();
  const chosenFor = jar.get(CURRENCY_LOCALE_COOKIE)?.value;
  // A choice made in another language is not this language's choice. Reading it
  // anyway is what turned a stale cookie into a wrong price.
  if (chosenFor !== locale) return null;
  const value = jar.get(CURRENCY_COOKIE)?.value;
  return isCurrency(value) ? getCurrency(value) : null;
}

/**
 * The currency to render this request in.
 *
 * Derived from the language being read, and from the visitor's own confirmed
 * choice in that language where there is one.
 *
 * Reading the locale makes a route dynamic. Only the intake page does this, and
 * it is also the only page that shows money. The home pages stay statically
 * cached and read the locale default too, which is what a crawler sees.
 */
export async function preferredCurrency(locale?: string | null): Promise<Currency> {
  const code = getLocale(locale).code;
  const chosen = await chosenCurrency(code);
  return chosen ?? getCurrency(getLocale(code).currency);
}

/**
 * The currency to suggest from where this request appears to be.
 *
 * Null whenever there is nothing useful to say: the visitor already chose for
 * this language, the suggestion matches what the language already defaults to,
 * or the address resolved to no country this catalogue prices in. The caller
 * renders a question only when this returns a real alternative, so the common
 * case is no question at all.
 */
export async function suggestedCurrency(
  locale: string | null | undefined,
  headers: Headers,
): Promise<Currency | null> {
  const code = getLocale(locale).code;

  const chosen = await chosenCurrency(code);
  if (chosen) return null;

  const { clientIp, countryForIp, currencyForCountry } = await import("./geo");
  const country = await countryForIp(clientIp(headers));
  const suggestion = currencyForCountry(country);
  if (!suggestion) return null;

  // Suggesting the currency the language already implies is not a suggestion,
  // it is noise. The visitor reads /fil-PH in pesos already.
  return suggestion.code === getLocale(code).currency ? null : suggestion;
}

/** The currency the language defaults to, without consulting the cookie. */
export function localeCurrency(locale?: string | null): Currency {
  return getCurrency(getLocale(locale).currency);
}
