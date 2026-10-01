/**
 * The visitor's remembered currency.
 *
 * Server side only: `lib/currency.ts` stays client-safe and holds no cookie
 * logic, and this is the one place that reads `next/headers`.
 *
 * The currency is a preference rather than a property of the URL, which is what
 * lets someone read the site in English and budget in yen. The fallback chain is
 * cookie, then the default currency for the language being read, then the site
 * default. That middle step is what keeps `/en-GB` priced in pounds for a
 * first-time visitor, exactly as it was before the currency became a choice.
 *
 * Reading a cookie makes a route dynamic. Only the intake page does this, which
 * is also the only page that shows money. The home pages stay statically cached
 * and read the locale default instead, which is what a crawler sees anyway.
 */
import { cookies } from "next/headers";
import { CURRENCIES, CURRENCY_COOKIE, getCurrency, isCurrency, type Currency } from "./currency";
import { getLocale } from "./locales";

/** The currency to render this request in. */
export async function preferredCurrency(locale?: string | null): Promise<Currency> {
  const stored = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (isCurrency(stored)) return CURRENCIES[stored];
  return getCurrency(getLocale(locale).currency);
}

/** The currency the language defaults to, without consulting the cookie. */
export function localeCurrency(locale?: string | null): Currency {
  return getCurrency(getLocale(locale).currency);
}
