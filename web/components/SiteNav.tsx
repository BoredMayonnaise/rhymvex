"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, MessageSquareText, X } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { useLeadCapture } from "@/components/lead/LeadCaptureProvider";
import { useScrollProgress } from "@/lib/use-scroll-progress";
import { enquiryUrl } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Site header.
 *
 * Provides clear orientation, fast section jumping for desktop & mobile visitors,
 * and unambiguous pathways to get in touch.
 *
 * Motion, from the shared scroll-progress hook:
 *   - drops in on first paint,
 *   - condenses past 12px (tighter padding, solid surface, hairline),
 *   - a Volt line along its bottom edge tracks reading position,
 *   - mobile drawer glides open with tactile spring feedback.
 */
export function SiteNav({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { progressRef, condensed } = useScrollProgress();
  const { open: openLeadCapture } = useLeadCapture();
  const t = getTranslator(locale);

  return (
    <header className="rv-header sticky top-0 z-50">
      <div
        data-condensed={condensed}
        className="relative transition-[background-color,border-color] duration-300 data-[condensed=true]:border-b data-[condensed=true]:border-rhymvex-white/10 data-[condensed=true]:bg-rhymvex-black/85 data-[condensed=true]:backdrop-blur-md"
      >
        <nav
          aria-label="Main"
          className="rv-container flex items-center justify-between gap-4 py-3.5 transition-[padding] duration-300 data-[condensed=true]:py-2.5 sm:py-5"
        >
          <div className="flex items-center gap-8">
            <a
              href="#main"
              aria-label="Rhymvex — back to top"
              onClick={() => setMobileMenuOpen(false)}
              className="group/mark shrink-0"
            >
              <RvMark
                className="h-8 w-auto transition-transform duration-300 ease-out group-hover/mark:-rotate-6 active:scale-95 sm:h-9"
                label={null}
              />
            </a>

            {/* Desktop section anchors */}
            <div className="hidden items-center gap-6 md:flex">
              <a
                href="#process"
                className="text-xs font-semibold uppercase tracking-wider text-rhymvex-white/60 transition-colors hover:text-rhymvex-volt"
              >
                {t("nav.process")}
              </a>
              <a
                href="#services"
                className="text-xs font-semibold uppercase tracking-wider text-rhymvex-white/60 transition-colors hover:text-rhymvex-volt"
              >
                {t("nav.services")}
              </a>
              <a
                href="#work"
                className="text-xs font-semibold uppercase tracking-wider text-rhymvex-white/60 transition-colors hover:text-rhymvex-volt"
              >
                {t("nav.work")}
              </a>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Opens the modal capture (desktop) */}
            <button
              type="button"
              onClick={() => openLeadCapture()}
              aria-label={t("nav.tellUs")}
              className="hidden size-10 items-center justify-center rounded-lg border border-rhymvex-white/15 text-rhymvex-white/70 transition-colors duration-200 hover:border-rhymvex-volt hover:text-rhymvex-volt active:scale-95 sm:inline-flex"
            >
              <MessageSquareText className="size-4" aria-hidden="true" />
            </button>

            {/* Primary booking button */}
            <a
              href={enquiryUrl(locale)}
              className="rv-btn rv-btn-primary group/cta px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <span className="whitespace-nowrap">{t("nav.bookCall")}</span>
              <ArrowUpRight
                className="size-3.5 sm:size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </a>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex md:hidden size-9 items-center justify-center rounded-lg border border-rhymvex-white/15 bg-rhymvex-slate/40 text-rhymvex-white/80 transition-all duration-200 hover:text-rhymvex-volt active:scale-90"
            >
              {mobileMenuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile dropdown drawer with smooth animation */}
        {mobileMenuOpen && (
          <div className="rv-animate-dropdown border-b border-rhymvex-white/12 bg-rhymvex-black/95 px-5 pb-5 pt-2 backdrop-blur-xl md:hidden">
            <nav aria-label="Mobile sections" className="flex flex-col">
              <a
                href="#process"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-rhymvex-white/5 py-3.5 text-xs font-semibold uppercase tracking-wider text-rhymvex-white/80 transition-colors hover:text-rhymvex-volt active:text-rhymvex-volt"
              >
                <span>{t("nav.process")}</span>
                <span className="text-[11px] font-mono text-rhymvex-volt/70">04 phases →</span>
              </a>
              <a
                href="#services"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-rhymvex-white/5 py-3.5 text-xs font-semibold uppercase tracking-wider text-rhymvex-white/80 transition-colors hover:text-rhymvex-volt active:text-rhymvex-volt"
              >
                <span>{t("nav.services")}</span>
                <span className="text-[11px] font-mono text-rhymvex-volt/70">03 packages →</span>
              </a>
              <a
                href="#work"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-rhymvex-white/5 py-3.5 text-xs font-semibold uppercase tracking-wider text-rhymvex-white/80 transition-colors hover:text-rhymvex-volt active:text-rhymvex-volt"
              >
                <span>{t("nav.work")}</span>
                <span className="text-[11px] font-mono text-rhymvex-volt/70">Architecture →</span>
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between py-3.5 text-xs font-semibold uppercase tracking-wider text-rhymvex-white/80 transition-colors hover:text-rhymvex-volt active:text-rhymvex-volt"
              >
                <span>{t("home.contact.eyebrow")}</span>
                <span className="text-[11px] font-mono text-rhymvex-volt/70">Intake →</span>
              </a>
            </nav>

            <div className="mt-3 pt-3 border-t border-rhymvex-white/10 flex flex-col gap-2">
              <PwaInstallButton variant="nav-item" />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLeadCapture();
                }}
                className="rv-btn rv-btn-ghost w-full py-2.5 text-xs"
              >
                <MessageSquareText className="size-3.5" aria-hidden="true" />
                <span>{t("nav.tellUs")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Reading-progress line */}
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
