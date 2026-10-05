import { ArrowRight, Check, Plus } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { RisingStaff } from "@/components/RisingStaff";
import { FlowingStaff } from "@/components/FlowingStaff";
import { ScopeBuilder } from "@/components/ScopeBuilder";
import { LeadCaptureButton } from "@/components/lead/LeadCaptureButton";
import { Section } from "@/components/Section";
import { TempoDivider, TempoMark, TempoPhrase } from "@/components/TempoMarks";
import {
  addOns,
  addOnsIntro,
  services,
  servicesClosing,
  servicesIntro,
} from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator, type Translator } from "@/lib/i18n";

/** The three package tempo marks in card order — the section's phrase. */
const PHRASE = services.map((pkg) => pkg.note);

/**
 * Philosophy before product. The three packages sit underneath the promise that
 * the visitor does not have to know which one they want yet, so the promise has
 * to land above the cards, not after them.
 */
function Approach({ t }: { t: Translator }) {
  return (
    <Reveal className="mb-12 grid gap-8 border-t border-rhymvex-white/10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-16 sm:mb-16">
      <div className="max-w-2xl space-y-5 text-lead leading-relaxed text-rhymvex-white/70">
        {servicesIntro.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="rv-card p-6 sm:p-7">
        <p className="text-sm text-rhymvex-white/60">{servicesIntro.prompt}</p>
        <LeadCaptureButton
          className="mt-3 flex items-center gap-2 font-display text-lg font-bold text-rhymvex-volt transition-colors hover:text-rhymvex-white"
        >
          {servicesIntro.promptAction}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </LeadCaptureButton>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LeadCaptureButton className="rv-btn rv-btn-primary sm:flex-1">
            {servicesIntro.primaryCta}
          </LeadCaptureButton>
          <a href={servicesIntro.secondaryHref} className="rv-btn rv-btn-ghost sm:flex-1">
            {servicesIntro.secondaryCta}
          </a>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * Each card is the visitor's situation first, then what an engagement helps
 * them solve, then the facts. Deliverables stay in the written scope; the card
 * has to answer "do they understand where I am", not "what do I get".
 */
function PackageCard({
  pkg,
  locale,
  t,
}: {
  pkg: (typeof services)[number];
  locale: LocaleCode;
  t: Translator;
}) {
  const coreCount = pkg.outcomes.filter((o) => o.core).length;

  return (
    <article
      className={`group flex flex-col rounded-xl border p-6 sm:p-7 ${
        pkg.featured ? "border-rhymvex-volt/45 bg-rhymvex-slate/80 shadow-[0_0_30px_rgba(111,230,254,0.08)]" : "rv-card"
      }`}
    >
      {/* Index, recommendation and tempo mark share one row */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xs font-semibold text-rhymvex-white/55">{pkg.index}</p>
        <div className="flex items-center gap-2">
          {pkg.featured && (
            <span className="rounded-full border border-rhymvex-volt/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-rhymvex-volt">
              {t("home.services.recommended")}
            </span>
          )}
          {/* Tempo mark — each package carries its own note */}
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-rhymvex-white/10 text-rhymvex-volt/70 transition-colors duration-300 group-hover:border-rhymvex-volt/35"
            aria-hidden="true"
          >
            <TempoMark note={pkg.note} className="size-4" />
          </span>
        </div>
      </div>

      {/* Package title and situation */}
      <h3 className="mt-4 text-display-3">{pkg.name}</h3>
      <p className="rv-eyebrow mt-2">{pkg.situation}</p>

      {/* The situation in one line */}
      <p className="mt-5 border-t border-rhymvex-white/10 pt-5 text-lg font-medium leading-snug text-rhymvex-white">
        {pkg.forWhen}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/70">
        {pkg.body}
      </p>

      {/* What this helps you solve */}
      <p className="rv-eyebrow mt-7 text-rhymvex-white/60">
        {t("home.services.solve")}{" "}
        <span className="font-normal normal-case tracking-normal text-rhymvex-white/50">
          {t("home.services.included", { n: coreCount })}
        </span>
      </p>
      <ul className="mt-4 space-y-2.5">
        {pkg.outcomes.map((item) => (
          <li key={item.id} className="flex gap-2.5 text-sm">
            {item.core ? (
              <Check
                className="mt-0.5 size-4 shrink-0 text-rhymvex-volt"
                aria-hidden="true"
              />
            ) : (
              <Plus
                className="mt-0.5 size-4 shrink-0 text-rhymvex-volt/70"
                aria-hidden="true"
              />
            )}
            <span
              className={
                item.core
                  ? "text-rhymvex-white/75"
                  : "text-rhymvex-white/55"
              }
            >
              {item.label}
              {!item.core && (
                <span className="text-xs text-rhymvex-white/40">
                  {" "}
                  {t("home.services.optional")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Facts and single primary action */}
      <div className="mt-auto pt-7">
        <p className="rv-eyebrow text-rhymvex-white/55">{t("home.services.engagement")}</p>
        <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-rhymvex-white/10 bg-rhymvex-white/10 sm:grid-cols-3">
          {[
            { term: t("home.services.timeline"), detail: pkg.duration },
            { term: t("home.services.type"), detail: pkg.engagement },
            { term: t("home.services.terms"), detail: pkg.priceNote },
          ].map((fact) => (
            <div
              key={fact.term}
              className="min-h-[3.5rem] bg-rhymvex-slate/85 px-3 py-2.5"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-rhymvex-white/50">
                {fact.term}
              </dt>
              <dd className="mt-1 text-xs leading-snug text-rhymvex-white/85">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>

        {/* Primary CTA */}
        <LeadCaptureButton
          situation={pkg.situation}
          className={`rv-btn mt-6 w-full ${
            pkg.featured ? "rv-btn-primary" : "rv-btn-ghost"
          }`}
        >
          {pkg.cta}
        </LeadCaptureButton>

        {/* Scope builder interactive modal */}
        <ScopeBuilder pkg={pkg} locale={locale} />
      </div>
    </article>
  );
}

/**
 * Cards lead with the client's situation, not price.
 */
export function Services({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <Section
      id="services"
      eyebrow={t("home.services.eyebrow")}
      title={
        <>
          {servicesIntro.heading}
          <br />
          <span className="text-rhymvex-volt">
            {servicesIntro.headingAccent}
          </span>
        </>
      }
      overlay={
        <>
          <FlowingStaff className="pointer-events-none absolute -top-20 -right-[4%] w-[70%] max-w-none text-rhymvex-white opacity-[0.03] lg:w-[56%]" />
          <RisingStaff className="pointer-events-none absolute left-[-14%] top-[24%] w-[128%] max-w-none text-rhymvex-white opacity-[0.025]" />
        </>
      }
    >
      <Approach t={t} />

      <div className="grid gap-6 lg:grid-cols-3">
        {services.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} locale={locale} t={t} />
        ))}
      </div>

      {/* Additional support */}
      <div className="mt-14 sm:mt-16">
        <TempoDivider notes={PHRASE} />

        <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h3 className="text-display-sub">{addOnsIntro.heading}</h3>
            <p className="mt-4 text-base leading-relaxed text-rhymvex-white/70">
              {addOnsIntro.body}
            </p>
          </div>
          <TempoPhrase
            notes={PHRASE}
            className="hidden shrink-0 gap-5 text-rhymvex-white/15 lg:flex"
            markClassName="size-6"
          />
        </div>
        <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {addOns.map((addOn) => (
            <div
              key={addOn.id}
              className="border-b border-rhymvex-white/10 pb-4"
            >
              <dt className="text-sm font-medium text-rhymvex-white">{addOn.name}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-rhymvex-white/60">
                {addOn.note}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Closing cadence */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
        <p className="max-w-2xl text-sm leading-relaxed text-rhymvex-white/60">
          {servicesClosing}
        </p>
        <TempoPhrase
          notes={[...PHRASE].reverse()}
          className="hidden shrink-0 gap-4 text-rhymvex-white/12 lg:flex"
          markClassName="size-5"
        />
      </div>
    </Section>
  );
}
