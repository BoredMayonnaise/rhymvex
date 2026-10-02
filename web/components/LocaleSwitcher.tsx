"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  currencySymbol,
  hrefForLocale,
  isLocalizedPath,
  localeFromPathname,
  rememberLocale,
  type LocaleCode,
} from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Locale switcher.
 *
 * Reads the current locale off the pathname rather than being told it, so it is
 * correct on every page without each page having to thread the locale into it.
 * That matters here because this component lives in the site header and the
 * footer, which are shared by the un-prefixed pages and by every locale at once.
 *
 * Changing locale keeps the visitor on the same page. Someone reading /ar/ and
 * switching to Thai expects to still be on that page, in Thai.
 *
 * The one exception is a path that does not exist per locale. The workspaces and
 * the sign-in pages are English-only with no per-market pricing, so they have one
 * URL each; switching market from there lands on that market's home page rather
 * than on a prefixed workspace URL that would 404. `hrefForLocale` owns that
 * decision, so the client and the redirect in `proxy.ts` cannot disagree.
 *
 * Navigation goes through the router rather than `window.location`, so the
 * cached locale page is reused instead of being re-fetched from scratch, and
 * browser Back returns to the previous market without a full reload in between.
 *
 * Each option is labelled in its own language and script, which is the one place
 * a visitor can recognise a language they cannot read from the shape of the
 * page. The currency is shown because that is often the reason to switch.
 */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const localized = isLocalizedPath(pathname);
  // Off a localized path the switcher offers the markets but has no page to mark
  // as current, so it shows the default rather than claiming a market the
  // visitor is not on.
  const current = localized ? localeFromPathname(pathname) : DEFAULT_LOCALE;
  const t = getTranslator(current);
  // Drives the confirmation line under the control. Kept as state rather than
  // derived from the URL so the message survives the navigation it describes.
  const [announced, setAnnounced] = useState<string | null>(null);

  return (
    <label className={`flex items-center gap-2 text-xs text-rhymvex-white/55 ${className}`}>
      <Globe className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("nav.markets")}</span>
      <select
        // A locale change is a navigation, not a form value, so the select is
        // driven by the URL and never submitted.
        value={current}
        onChange={(event) => {
          const next = event.target.value as LocaleCode;
          if (next === current) return;
          // Recorded before navigating. The URL change is what switches the page;
          // this is what tells `proxy.ts` the visitor has decided, so detection
          // does not undo the choice the moment they return to `/`.
          rememberLocale(next);
          setAnnounced(
            `${LOCALES[next].language} · ${LOCALES[next].label}`,
          );
          router.push(hrefForLocale(pathname, next));
        }}
        // `border-0 bg-transparent` are utilities, so they win over the
        // `.rv-select:focus` border and fill and leave nothing to see. The
        // focus ring is therefore restated here as a focus-visible utility,
        // which lands in @layer utilities and is not defeated by the component
        // layer. Without it these are the only two controls on every page and
        // neither shows where the keyboard is.
        className="rv-select cursor-pointer border-0 bg-transparent py-1 pe-6 ps-0 text-xs text-rhymvex-white/75 hover:text-rhymvex-white focus-visible:text-rhymvex-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rhymvex-volt"
      >
        {LOCALE_CODES.map((code) => (
          <option key={code} value={code}>
            {code === DEFAULT_LOCALE
              ? `Europe (${currencySymbol(LOCALES[code])})`
              : `${LOCALES[code].language} · ${LOCALES[code].label} (${currencySymbol(LOCALES[code])})`}
          </option>
        ))}
      </select>

      {/* The confirmation a sighted visitor gets from the page visibly changing
          language, restated for anyone who does not get that cue. `aria-live`
          on a region that is always in the DOM and only has its text swapped,
          because a live region mounted together with its content does not
          announce. */}
      <span aria-live="polite" className="sr-only">
        {announced ?? ""}
      </span>
    </label>
  );
}
