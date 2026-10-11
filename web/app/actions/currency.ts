"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  CURRENCY_COOKIE,
  CURRENCY_LOCALE_COOKIE,
  isCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { getLocale } from "@/lib/locales";

/**
 * Recording the visitor's answer to a currency suggestion.
 *
 * Both actions write the language alongside the currency. That is what makes
 * the choice survive on the page it was made on and stay invisible everywhere
 * else, which is the fix for the retired cookie: a value with nothing to
 * refresh it overrode the language's own currency indefinitely.
 *
 * A year is used because the answer to "what currency do you think in" does not
 * change often, and a visitor who is asked the same question on every visit
 * learns to dismiss the question rather than answer it.
 */

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setChoice(currency: CurrencyCode, locale: string): Promise<void> {
  const jar = await cookies();
  for (const [name, value] of [
    [CURRENCY_COOKIE, currency],
    [CURRENCY_LOCALE_COOKIE, locale],
  ] as const) {
    jar.set(name, value, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
      httpOnly: false,
    });
  }
}

/**
 * Accept the suggested currency for this language.
 *
 * `code` is validated against the catalogue rather than trusted: the argument
 * arrives from a client component, and an unknown code would reach `Intl` and
 * throw a RangeError on a page that shows money.
 */
export async function confirmCurrencyAction(code: string, locale: string): Promise<void> {
  if (!isCurrency(code)) return;
  await setChoice(code, getLocale(locale).code);
  revalidatePath("/intake");
}

/**
 * Decline the suggestion, and be asked again only when the offer changes.
 *
 * Recorded as an explicit choice of the language's own currency rather than as
 * a flag saying "never ask", so a different country on a later visit is still
 * allowed to make its case and a visitor is never silenced permanently by a
 * single dismissal.
 */
export async function declineCurrencyAction(locale: string): Promise<void> {
  const resolved = getLocale(locale);
  await setChoice(resolved.currency as CurrencyCode, resolved.code);
  revalidatePath("/intake");
}
