import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { LeadCaptureButton } from "@/components/lead/LeadCaptureButton";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

const STEPS = ["s1", "s2", "s3", "s4"] as const;
const DELIVERABLES = ["D1", "D2", "D3"] as const;

/**
 * Process: four steps, all visible at once.
 *
 * Previously a pinned 360–400vh stage that swapped one step card in at a time
 * as the visitor scrolled, so the steps could only be read in sequence and only
 * by scrolling through them. A process is something people compare across, so
 * it is now a plain ordered list: a row of four on large screens, a numbered
 * rail on small ones. Volt marks the numbers and the connector, nothing else.
 */
export function Process({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <Section
      id="process"
      eyebrow={t("home.process.eyebrow")}
      title={
        <>
          {t("home.process.heading1")}
          <br />
          <span className="text-rhymvex-volt">{t("home.process.heading2")}</span>
        </>
      }
      description={<p>{t("home.process.body")}</p>}
      overlay={
        <div
          className="rv-grid pointer-events-none absolute inset-0 opacity-25"
          aria-hidden="true"
        />
      }
    >

      <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-6">
        {/* Connector: vertical rail on small screens, horizontal line on large. */}
        <span
          aria-hidden="true"
          className="absolute bottom-6 start-5 top-6 w-px bg-gradient-to-b from-rhymvex-volt/60 to-rhymvex-volt/0 lg:bottom-auto lg:end-6 lg:start-6 lg:top-5 lg:h-px lg:w-auto lg:bg-gradient-to-r"
        />

        {STEPS.map((step, i) => (
          <Reveal
            as="li"
            key={step}
            delay={i * 90}
            className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 lg:block"
          >
            <span className="relative z-10 flex size-10 items-center justify-center rounded-full border border-rhymvex-volt/50 bg-rhymvex-black font-display text-sm font-bold text-rhymvex-volt shadow-[0_0_15px_rgba(111,230,254,0.18)]">
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="min-w-0 rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/30 p-4 sm:p-5 backdrop-blur-sm transition-all duration-200 active:scale-[0.99] active:border-rhymvex-volt/30 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:mt-6">
              <p className="sr-only">{t("home.process.step", { n: i + 1 })}</p>
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-rhymvex-white">
                {t(`home.process.${step}Title`)}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-rhymvex-white/70 sm:text-base lg:text-sm">
                {t(`home.process.${step}Body`)}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-rhymvex-white/55">
                {t("home.process.deliverables")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {DELIVERABLES.map((d) => (
                  <li
                    key={d}
                    className="rounded-md border border-rhymvex-white/10 bg-rhymvex-slate/60 px-2.5 py-1 text-xs text-rhymvex-white/80"
                  >
                    {t(`home.process.${step}${d}`)}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </ol>

      {/* Step 01 Intake Callout */}
      <Reveal
        delay={360}
        className="mt-12 sm:mt-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/30 p-6 sm:p-8 backdrop-blur-sm"
      >
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rhymvex-volt">
              Low-Risk Starting Point
            </p>
          </div>
          <h4 className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-rhymvex-white">
            Ready to start with Step 01?
          </h4>
          <p className="mt-1 text-xs sm:text-sm text-rhymvex-white/65 leading-relaxed">
            Every engagement starts with diagnosis. We audit what exists, interview stakeholders, and lock the scope before you commit to a full system build.
          </p>
        </div>
        <div className="flex shrink-0 w-full sm:w-auto gap-3">
          <LeadCaptureButton
            situation="You need clarity"
            className="rv-btn rv-btn-primary w-full sm:w-auto px-5 py-2.5 text-sm"
          >
            Start with Step 01
          </LeadCaptureButton>
          <a
            href="#services"
            className="rv-btn rv-btn-ghost group/pkg inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2.5 text-xs"
          >
            <span>Compare packages</span>
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover/pkg:translate-x-0.5 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
