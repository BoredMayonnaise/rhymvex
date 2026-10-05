"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { useScrollProgress } from "@/lib/use-scroll-progress";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * The intake page header.
 *
 * The site header's treatment — full-colour mark at its site size, the drop-in
 * on first paint, the volt line along the bottom edge — carrying one control
 * instead of two. This page has no nav to speak of, so the bar does what the
 * site bar does when it is stripped back: orient you, then get you out.
 *
 * Two deliberate departures from `SiteNav`, both because this page differs:
 *
 *   - The surface does not condense. It is opaque and blurred from the first
 *     paint rather than turning so at 12px. The site bar sits over the home
 *     page's hero, so it can start transparent; this bar only ever sits over
 *     this page's own background, and a surface that fades in as you begin to
 *     scroll reads as a glitch rather than as depth. The hairline is permanent
 *     for the same reason.
 *   - The mark links home rather than to `#main`. There is no top to scroll
 *     back to here; the mark is an exit, the same as the label beside it.
 *
 * The wordmark is absent, as it is on every other bar on the site: the
 * full-colour monogram carries the brand on its own, and printing "Rhymvex"
 * beside it here was the one place the two were doubled up. That also leaves
 * the mark as the link's only content, so it needs the aria-label that the
 * adjacent text used to supply.
 */
export function IntakeHeader({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const { progressRef } = useScrollProgress();
  const t = getTranslator(locale);

  return (
    <header className="rv-header sticky top-0 z-50">
      <div className="relative border-b border-rhymvex-white/10 bg-rhymvex-black/85 backdrop-blur-md">
        <nav
          aria-label="Intake"
          className="rv-container flex items-center justify-between gap-3 py-4 sm:py-5"
        >
          <Link
            href="/"
            aria-label="Rhymvex — home"
            className="group/mark shrink-0"
          >
            <RvMark
              className="h-8 w-auto transition-transform duration-300 ease-out group-hover/mark:-rotate-6 sm:h-9"
              label={null}
            />
          </Link>

          {/* The only navigation this page has, so it is sized like a control
              rather than like fine print. It measured 89x16px, which fails the
              24px minimum target in WCAG 2.5.8, and it sat at text-xs and 50%
              white — quieter than the logo beside it, on the one page where
              somebody part-way through a form most wants a way out.

              The -my-2 grows the hit area into padding the bar already has, so
              the target reaches 36px without the bar growing to match. */}
          <Link
            href="/"
            className="-my-2 flex items-center gap-2 rounded px-2 py-2 text-sm text-rhymvex-white/70 transition-colors hover:text-rhymvex-volt"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("nav.backToSite")}
          </Link>
        </nav>

        {/* Reading-progress line. scaleX is set by the shared scroll listener;
            scale-x-0 covers the pre-hydration frame. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden"
        >
          <span
            ref={progressRef}
            className="block h-full w-full origin-left scale-x-0 bg-rhymvex-volt"
          />
        </span>
      </div>
    </header>
  );
}
