"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { useLeadCapture } from "@/components/lead/LeadCaptureProvider";
import { enquiryUrl } from "@/lib/services";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Site header.
 *
 * The wordmark is gone — the full-colour monogram carries the brand on its
 * own — so the bar does two things only: orient you and get you to the CTA.
 *
 * Motion, from one rAF-throttled scroll listener:
 *   - drops in on first paint,
 *   - condenses past 12px (tighter padding, solid surface, hairline),
 *   - a Volt line along its bottom edge tracks reading position.
 * Hover states are colour swaps only.
 */
export function SiteNav({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const [condensed, setCondensed] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const { open: openLeadCapture } = useLeadCapture();
  const t = getTranslator(locale);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setCondensed(y > 12);

      const bar = progressRef.current;
      if (!bar) return;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <header className="rv-header sticky top-0 z-50">
      <div
        data-condensed={condensed}
        className="relative transition-[background-color,border-color] duration-300 data-[condensed=true]:border-b data-[condensed=true]:border-rhymvex-white/10 data-[condensed=true]:bg-rhymvex-black/85 data-[condensed=true]:backdrop-blur-md"
      >
        <nav
          aria-label="Main"
          className="rv-container flex items-center justify-between gap-3 py-4 transition-[padding] duration-300 data-[condensed=true]:py-2.5 sm:py-5"
        >
          <a
            href="#main"
            aria-label="Rhymvex — back to top"
            className="group/mark shrink-0"
          >
            <RvMark
              className="h-8 w-auto transition-transform duration-300 ease-out group-hover/mark:-rotate-6 sm:h-9"
              label={null}
            />
          </a>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Prices differ by locale, so which one is showing has to be
                visible and changeable from every page. */}
            <LocaleSwitcher />

            {/* Opens the modal capture. Not a mailto: that would drop the
                request outside the platform, with no lead record and no
                assignment. */}
            <button
              type="button"
              onClick={() => openLeadCapture()}
              aria-label={t("nav.tellUs")}
              className="hidden size-10 items-center justify-center rounded-lg border border-rhymvex-white/15 text-rhymvex-white/70 transition-colors duration-200 hover:border-rhymvex-volt hover:text-rhymvex-volt sm:inline-flex"
            >
              <MessageSquareText className="size-4" aria-hidden="true" />
            </button>

            <a
              href={enquiryUrl(locale)}
              className="rv-btn rv-btn-primary group/cta px-4 sm:px-5"
            >
              <span className="whitespace-nowrap">{t("nav.bookCall")}</span>
              <ArrowUpRight
                className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </nav>

        {/* Reading-progress line. scaleX is set by the scroll listener;
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
