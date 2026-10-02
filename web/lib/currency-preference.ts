/**
 * The visitor's remembered currency.
 *
 * Server side only: `lib/currency.ts` stays client-safe and holds no cookie
 * logic, and this is the one place that reads `next/headers`.
 *
 * The currency belongs to the language. `/en-GB` is priced in pounds and
 * `/fil-PH` in pesos for everybody who arrives, which is what makes a link
 * mean the same thing to the person who sends it and the person who opens it.
 *
 * Reading the locale makes a route dynamic. Only the intake page does this, and
 * it is also the only page that shows money. The home pages stay statically
 * cached and read the locale default too, which is what a crawler sees.
 */
import { getCurrency, type Currency } from "./currency";
import { getLocale } from "./locales";

/**
 * The currency to render this request in.
 *
 * Derived from the language being read, and from nothing else.
 *
 * This used to consult a `rv_currency` cookie first. That was correct while a
 * switcher and the detection layer both wrote it, but when those were removed
 * nothing was left that could refresh it — so any cookie set during that period
 * became permanently stale and overrode the language's own currency. A visitor
 * in the Philippines carrying a leftover `rv_currency=SAR` was shown Saudi
 * riyals on /fil-PH, which is what prompted this change.
 *
 * A preference nothing can update is not a preference, it is a stale override.
 * The language is in the URL, so the currency follows from it and stays
 * shareable and indexable: /fil-PH is pesos for everybody, /en-GB is pounds.
 * `proxy.ts` expires the old cookie so browsers stop carrying it.
 */
export async function preferredCurrency(locale?: string | null): Promise<Currency> {
  return getCurrency(getLocale(locale).currency);
}

/** The currency the language defaults to, without consulting the cookie. */
export function localeCurrency(locale?: string | null): Currency {
  return getCurrency(getLocale(locale).currency);
}
