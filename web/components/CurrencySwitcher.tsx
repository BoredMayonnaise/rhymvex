"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import {
  CURRENCIES,
  CURRENCY_CODES,
  currencyCompactLabel,
  currencyLabel,
  readRememberedCurrency,
  rememberCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { getTranslator } from "@/lib/i18n";
import { detectCurrencyFromTimezone } from "@/lib/currency-detect-client";

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
 * On arrival the currency is detected rather than asked for: `proxy.ts` reads the
 * platform's country header and writes this same cookie before the first render,
 * so somebody in Australia reading `/en-GB` is shown Australian dollars rather
 * than pounds without having to find this control. An explicit choice still wins,
 * because detection only ever runs when the cookie is absent.
 *
 * The server is the authority on what that cookie means: it reads the same value
 * and rebuilds the band labels from it, so what the visitor picks and what the
 * lead records cannot drift apart. An unrecognised cookie is ignored and the
 * language's own currency is used instead.
 *
 * Rendered only where money is actually shown. The intake page is the sole
 * consumer of the visitor's currency preference — the portal invoices and
 * contracts in whatever currency they were issued in, which this cannot and
 * should not change. A control that re-renders the page and alters nothing reads
 * as broken, so it is not offered where it has nothing to do.
 *
 * The server resolves the preference where it can, and the intake page does, so
 * there the control is right in the first paint. The shared layout cannot: it
 * wraps the workspaces and the cached home pages as well, and reading a cookie
 * there would make every route dynamic to colour in a footer dropdown. So this
 * falls back to the cookie in the browser, which renders after hydration and
 * only differs when the server had no way to know. The effect compares against
 * the value it was given, so a page that already resolved it is left alone.
 */

/**
 * Optgroup headings for the currency list.
 *
 * Presentation, so it lives here rather than in content/currencies.json: the
 * catalogue answers "what is this currency and what are its bands", and this
 * answers "where does it belong in a list a person is scanning". Eighteen flat
 * options is a list people have to read; grouped, it is one they can pick from.
 *
 * Anything not named here falls into "Other", so adding a currency to the
 * catalogue can never produce an option that is invisible or unlabelled.
 */
const REGIONS: readonly { label: string; codes: readonly CurrencyCode[] }[] = [
  { label: "Europe", codes: ["EUR", "GBP", "CHF"] },
  { label: "Americas", codes: ["USD", "CAD"] },
  { label: "Asia Pacific", codes: ["AUD", "JPY", "CNY", "KRW", "SGD", "MYR", "THB", "PHP", "INR"] },
  { label: "Middle East", codes: ["AED", "SAR"] },
  { label: "Africa", codes: ["ZAR", "NGN"] },
];

const REGION_OF = new Map<CurrencyCode, string>(
  REGIONS.flatMap((region) => region.codes.map((code) => [code, region.label] as const)),
);

/** Marker so the timezone fallback runs at most once per browser session. */
const TIMEZONE_TRIED = "rv_currency_tz_tried";

/** Catalogue order inside a region, so the list follows the content file. */
function groupedCurrencies() {
  const groups = REGIONS.map((region) => ({
    label: region.label,
    codes: CURRENCY_CODES.filter((code) => REGION_OF.get(code) === region.label),
  }));
  const placed = new Set(groups.flatMap((g) => g.codes));
  const rest = CURRENCY_CODES.filter((code) => !placed.has(code));
  if (rest.length) groups.push({ label: "Other", codes: rest });
  return groups.filter((group) => group.codes.length > 0);
}
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
  // True between the choice and the re-render that applies it. The select already
  // shows the new value immediately, so without this the page looks accepted and
  // then sits on the old figures for as long as the refresh takes.
  const [pending, setPending] = useState(false);
  const groups = groupedCurrencies();

  useEffect(() => {
    const remembered = readRememberedCurrency();
    if (remembered && remembered !== chosen) setChosen(remembered);
    // Deliberately once on mount: this reconciles the control with the cookie,
    // it does not track it. A change made here re-renders with a new server
    // value anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Timezone fallback, for the visitor the server could not place.
   *
   * `proxy.ts` reads the platform country header and falls back to the region in
   * `Accept-Language`. Both fail for one common browser: one configured for a
   * single language, which sends a bare `en` with no region at all. The timezone
   * is the only signal left, and it needs no permission and no network call.
   *
   * It writes the cookie and refreshes once, because the figures on this page
   * were rendered server-side from a cookie that did not exist yet — showing the
   * detected currency in the control while the page still showed the old figures
   * would be worse than the extra round trip. Guarded by sessionStorage so a
   * visitor who dismisses it is not dragged into the same refresh on every page,
   * and so it can never loop against itself.
   */
  useEffect(() => {
    if (readRememberedCurrency()) return;
    if (sessionStorage.getItem(TIMEZONE_TRIED)) return;
    sessionStorage.setItem(TIMEZONE_TRIED, "1");

    const detected = detectCurrencyFromTimezone();
    if (detected && detected !== currency) {
      rememberCurrency(detected);
      setChosen(detected);
      router.refresh();
    }
    // Once on mount only, for the same reason as the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className={`flex items-center gap-2 text-xs text-rhymvex-white/55 ${className}`}>
      <Coins className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("nav.currency")}</span>
      <select
        // Driven by what the server rendered, never submitted: changing the money
        // is a preference, not a form value, and the page is re-fetched with it.
        value={chosen}
        aria-busy={pending || undefined}
        aria-label={`${t("nav.currency")}: ${currencyLabel(CURRENCIES[chosen])}`}
        onChange={(event) => {
          const next = event.target.value as CurrencyCode;
          if (next === chosen) return;
          setChosen(next);
          setPending(true);
          rememberCurrency(next);
          // Re-fetch this route with the new cookie. Everything on the page that
          // depends on the money is server-rendered, so this is what repaints the
          // budget bands and the meta tag.
          router.refresh();
        }}
        // See LocaleSwitcher: `border-0 bg-transparent` are utilities and
        // override the component layer's focus border, so the ring is restated
        // as a focus-visible utility to survive the cascade.
        className="rv-select cursor-pointer border-0 bg-transparent py-1 pe-6 ps-0 text-xs text-rhymvex-white/75 hover:text-rhymvex-white focus-visible:text-rhymvex-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rhymvex-volt"
      >
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.codes.map((code) => (
              <option key={code} value={code}>
                {currencyCompactLabel(CURRENCIES[code])}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Says out loud what the page is about to do. The select's own new value
          is announced natively, but the consequence — every figure on the page
          changing currency — is not, and it is the consequence that matters. */}
      <span aria-live="polite" className="sr-only">
        {pending ? t("nav.currency") : ""}
      </span>
    </label>
  );
}
