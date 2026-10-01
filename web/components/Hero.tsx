import { ArrowRight } from "lucide-react";
import { RhythmGlyph } from "@/components/RhythmGlyph";
import { TokenCard } from "@/components/TokenCard";
import { LeadCaptureForm } from "@/components/lead/LeadCaptureForm";
import { enquiryUrl } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Hero.
 *
 * The primary action is a form, not a link. Someone who arrives with a problem
 * should be able to describe it without a second page, so the ask and the
 * answer share one screen. The full intake form is still linked for anyone who
 * would rather take it somewhere with room to think.
 */
export function Hero({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <section className="relative overflow-hidden px-6 pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pb-24">
      {/* Brand texture plus the clef-and-staff motif — "rhythm", made literal.
          Decorative only; sits behind the copy and never overlaps it. */}
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <RhythmGlyph
        className="pointer-events-none absolute -right-[18%] top-1/2 w-[125%] max-w-none -translate-y-1/2 text-rhymvex-ember opacity-[0.09] sm:-right-[10%] sm:w-[85%] lg:-right-[4%] lg:w-[62%]"
      />

      <div className="rv-container relative grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_clamp(17rem,25vw,22rem)] lg:gap-16">
        {/* Copy and capture */}
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
            className="rv-animate-rise mt-7"
            style={{ animationDelay: "0.32s" }}
          >
            <LeadCaptureForm variant="hero" />
          </div>

          <div
            className="rv-animate-rise mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5"
            style={{ animationDelay: "0.4s" }}
          >
            {/* Secondary routes, for anyone not ready to write anything down. */}
            <a href="#process" className="rv-btn rv-btn-ghost">
              {t("hero.seeHowWeWork")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href={enquiryUrl(locale)}
              className="text-xs text-rhymvex-white/40 underline underline-offset-4 transition-colors hover:text-rhymvex-volt"
            >
              {t("hero.orFullForm")}
            </a>
          </div>

          <p
            className="rv-animate-rise mt-9 text-sm text-rhymvex-white/35"
            style={{ animationDelay: "0.48s" }}
          >
            {t("footer.tagline")}
          </p>
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