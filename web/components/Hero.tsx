import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RhythmGlyph } from "@/components/RhythmGlyph";
import { TokenCard } from "@/components/TokenCard";
import { LeadCaptureButton } from "@/components/lead/LeadCaptureButton";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Hero.
 *
 * One primary action. The hero used to carry the full four-field capture form
 * as well as a "See how we work" button, a "full enquiry form" link and the nav's
 * own CTA, so the first screen asked five different things at once. The form now
 * lives in one place, the closing section, and the same capture is one click
 * away from here through the modal (`LeadCaptureButton`). Nobody loses the
 * no-second-page path; they just are not handed a form before they know who
 * we are.
 *
 * The TokenCard stays on the right on large screens: it is the actual design
 * system, so it is the proof for the headline next to it.
 */
export function Hero({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-20 lg:flex lg:min-h-[calc(100svh-5.5rem)] lg:items-center lg:py-16">
      {/* Brand texture plus the clef-and-staff motif. Decorative only. White,
          not Ember: Ember is reserved for urgency (docs/DESIGN.md). */}
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <RhythmGlyph className="pointer-events-none absolute -end-[18%] top-1/2 w-[125%] max-w-none -translate-y-1/2 text-rhymvex-white opacity-[0.035] sm:-end-[10%] sm:w-[85%] lg:-end-[4%] lg:w-[62%]" />

      <div className="rv-container relative grid w-full items-center gap-14 lg:grid-cols-[minmax(0,1fr)_clamp(17rem,25vw,22rem)] lg:gap-16">
        <div className="min-w-0">
          <h1
            className="rv-animate-rise text-display-1"
            style={{ animationDelay: "0.05s" }}
          >
            {t("hero.line1")}
            <br />
            <span className="text-rhymvex-volt">{t("hero.line2")}</span>
          </h1>

          <span
            className="rv-rule rv-animate-rise mt-8 block h-px w-24"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          />

          <p
            className="rv-animate-rise mt-7 max-w-xl text-lead text-rhymvex-white/70"
            style={{ animationDelay: "0.24s" }}
          >
            {t("hero.body")}
          </p>

          <div
            className="rv-animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.32s" }}
          >
            <LeadCaptureButton className="rv-btn rv-btn-primary group/cta px-6 py-3.5 text-base">
              {t("hero.primaryCta")}
              <ArrowUpRight
                className="size-4 transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </LeadCaptureButton>
            <a href="#process" className="rv-btn rv-btn-ghost px-6 py-3.5 text-base">
              {t("hero.seeHowWeWork")}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </a>
          </div>

          <p
            className="rv-animate-rise mt-6 max-w-md text-sm leading-relaxed text-rhymvex-white/55"
            style={{ animationDelay: "0.4s" }}
          >
            {t("hero.note")}
          </p>

          {/* Mobile Architecture Matrix: tangible proof on touch screens */}
          <div
            className="rv-animate-rise mt-8 block lg:hidden"
            style={{ animationDelay: "0.44s" }}
          >
            <div className="rounded-xl border border-rhymvex-white/10 bg-rhymvex-slate/50 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rhymvex-white/50">
                  Studio Architecture · Integrated Stack
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-rhymvex-volt font-medium">
                  <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" />
                  Production system
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="rounded-lg border border-rhymvex-white/8 bg-rhymvex-black/40 px-2.5 py-2 text-rhymvex-white/85">
                  <span className="text-rhymvex-volt font-semibold mr-1.5">01</span>Digital Products
                </div>
                <div className="rounded-lg border border-rhymvex-white/8 bg-rhymvex-black/40 px-2.5 py-2 text-rhymvex-white/85">
                  <span className="text-rhymvex-volt font-semibold mr-1.5">02</span>Client Portals
                </div>
                <div className="rounded-lg border border-rhymvex-white/8 bg-rhymvex-black/40 px-2.5 py-2 text-rhymvex-white/85">
                  <span className="text-rhymvex-volt font-semibold mr-1.5">03</span>Design Tokens
                </div>
                <div className="rounded-lg border border-rhymvex-white/8 bg-rhymvex-black/40 px-2.5 py-2 text-rhymvex-white/85">
                  <span className="text-rhymvex-volt font-semibold mr-1.5">04</span>Brand Systems
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The design system itself, not a picture of one */}
        <div
          className="rv-animate-rise hidden lg:block"
          style={{ animationDelay: "0.28s" }}
        >
          <TokenCard />
        </div>
      </div>
    </section>
  );
}