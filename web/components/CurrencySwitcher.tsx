"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import {
  CURRENCIES,
  CURRENCY_CODES,
  currencyLabel,
  readRememberedCurrency,
  rememberCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { getTranslator } from "@/lib/i18n";

/**
 * Currency switcher.
 *
 * Separate from the language switcher on purpose. English can be read in pounds
 * or in yen, and that is not a thing a URL segment should have to carry: the
 * language stays in the path where it is shareable and indexable, and the money
 * is a preference of the visitor's that follows them around the site.
 *
 * The choice is a cookie rather than a query parameter so it survives arriving
 * from a shared link, using the back button, and coming back next week. It is
 * written before the page re-renders, so the first paint after a change already
 * shows the new figures and nothing flashes through the old ones.
 *
 * The server is the authority on what that cookie means: it reads the same value
 * and rebuilds the band labels from it, so what the visitor picks and what the
 * lead records cannot drift apart. An unrecognised cookie is ignored and the
 * language's own currency is used instead.
 *
 * Rendered in the footer rail rather than the header. Two switches in the header
 * would crowd the CTA out on a phone, and this is the one people change rarely
 * and deliberately, not the one they arrive wanting.
 *
 * The server resolves the preference where it can, and the intake page does, so
 * there the control is right in the first paint. The shared layout cannot: it
 * wraps the workspaces and the cached home pages as well, and reading a cookie
 * there would make every route dynamic to colour in a footer dropdown. So this
 * falls back to the cookie in the browser, which renders after hydration and
 * only differs when the server had no way to know. The effect compares against
 * the value it was given, so a page that already resolved it is left alone.
 */
export function CurrencySwitcher({
  currency,
  locale,
  className = "",
}: {
  /** The currency this page was rendered in, so the control starts correct. */
  currency: CurrencyCode;
  /** The language being read, so the control's own label is in that language. */
  locale?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const t = getTranslator(locale);
  const [chosen, setChosen] = useState<CurrencyCode>(currency);

  useEffect(() => {
    const remembered = readRememberedCurrency();
    if (remembered && remembered !== chosen) setChosen(remembered);
    // Deliberately once on mount: this reconciles the control with the cookie,
    // it does not track it. A change made here re-renders with a new server
    // value anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className={`flex items-center gap-2 text-xs text-rhymvex-white/45 ${className}`}>
      <Coins className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("nav.currency")}</span>
      <select
        // Driven by what the server rendered, never submitted: changing the money
        // is a preference, not a form value, and the page is re-fetched with it.
        value={chosen}
        onChange={(event) => {
          const next = event.target.value as CurrencyCode;
          if (next === chosen) return;
          setChosen(next);
          rememberCurrency(next);
          // Re-fetch this route with the new cookie. Everything on the page that
          // depends on the money is server-rendered, so this is what repaints the
          // budget bands and the meta tag.
          router.refresh();
        }}
        className="rv-select cursor-pointer border-0 bg-transparent py-1 pe-6 ps-0 text-xs text-rhymvex-white/70 hover:text-rhymvex-white focus:text-rhymvex-white"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {currencyLabel(CURRENCIES[code])}
          </option>
        ))}
      </select>
    </label>
  );
}
