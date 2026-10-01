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

/** The three package tempo marks in card order — the section's phrase. */
const PHRASE = services.map((pkg) => pkg.note);

/**
 * Philosophy before product. The three packages sit underneath the promise that
 * the visitor does not have to know which one they want yet, so the promise has
 * to land above the cards, not after them.
 */
function Approach() {
  return (
    <Reveal className="mb-12 grid gap-8 border-t border-rhymvex-white/10 pt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-16 sm:mb-16">
      <div className="max-w-2xl space-y-5 text-lead leading-relaxed text-rhymvex-white/65">
        {servicesIntro.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="rv-card p-6 sm:p-7">
        <p className="text-sm text-rhymvex-white/55">{servicesIntro.prompt}</p>
        {/* Opens the capture in place. Someone who has read this far has
            already decided something, and making them navigate to do it is a
            pointless tax. */}
        <LeadCaptureButton
          className="mt-3 flex items-center gap-2 font-display text-lg font-bold text-rhymvex-volt transition-colors hover:text-rhymvex-white"
        >
          {servicesIntro.promptAction}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </LeadCaptureButton>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
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
}: {
  pkg: (typeof services)[number];
  locale: LocaleCode;
}) {
  return (
    <article
      className={`group flex flex-col rounded-xl border p-6 sm:p-7 ${
        pkg.featured ? "border-rhymvex-volt/45 bg-rhymvex-slate/80" : "rv-card"
      }`}
    >
      {/* Index, recommendation and tempo mark share one row so every card's
          headline starts on the same line — the grid has to stay calm. */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xs text-rhymvex-white/25">{pkg.index}</p>
        <div className="flex items-center gap-2">
          {pkg.featured && (
            <span className="rounded-full border border-rhymvex-volt/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-rhymvex-volt">
              Recommended
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

      {/* The package names the engagement. The line under it names the
          problem, and that is the one doing the selling. */}
      <h3 className="mt-4 text-display-3">{pkg.name}</h3>
      <p className="rv-eyebrow mt-2">{pkg.situation}</p>

      {/* The situation, in one line, before any explanation */}
      <p className="mt-5 border-t border-rhymvex-white/10 pt-5 text-lg font-medium leading-snug text-rhymvex-white">
        {pkg.forWhen}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/60">
        {pkg.body}
      </p>

      {/* What this helps you solve — the substance of the offer. The count is
          inline rather than a flex sibling so it wraps with the label instead of
          orphaning onto its own line on narrow screens. */}
      <p className="rv-eyebrow mt-7 text-rhymvex-white/40">
        What we&rsquo;ll help you solve{" "}
        <span className="font-normal normal-case tracking-normal text-rhymvex-white/25">
          {pkg.outcomes.filter((o) => o.core).length} included
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
                className="mt-0.5 size-4 shrink-0 text-rhymvex-volt/45"
                aria-hidden="true"
              />
            )}
            <span
              className={
                item.core
                  ? "text-rhymvex-white/65"
                  : "text-rhymvex-white/40"
              }
            >
              {item.label}
              {!item.core && <span className="sr-only"> (optional)</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* Facts and actions pinned to the bottom so they align across
          cards of different lengths. */}
      <div className="mt-auto pt-7">
        <p className="rv-eyebrow text-rhymvex-white/40">Engagement</p>
        {/* Three-up from sm, stacked below it: at phone widths the cells get
            narrower than the longest term, and a wrapped micro-label is worse
            than a taller block. */}
        <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-rhymvex-white/10 bg-rhymvex-white/10 sm:grid-cols-3">
          {[
            { term: "Timeline", detail: pkg.duration },
            { term: "Type", detail: pkg.engagement },
            { term: "Terms", detail: pkg.priceNote },
          ].map((fact) => (
            <div
              key={fact.term}
              className="min-h-[3.5rem] bg-rhymvex-slate/70 px-3 py-2.5"
            >
              <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-rhymvex-white/35">
                {fact.term}
              </dt>
              <dd className="mt-1 text-[11px] leading-snug text-rhymvex-white/80">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>

        {/* Carries the card's situation into the capture, so the visitor has
            not chosen their package — only confirmed where they are. */}
        <LeadCaptureButton
          situation={pkg.situation}
          className={`rv-btn mt-5 w-full ${
            pkg.featured ? "rv-btn-primary" : "rv-btn-ghost"
          }`}
        >
          {pkg.cta}
        </LeadCaptureButton>

        {/* Better way to do the same thing, where JS is available */}
        <ScopeBuilder pkg={pkg} locale={locale} />
      </div>
    </article>
  );
}

/**
 * Cards lead with the client's situation, not price. Figures stay internal — the
 * enquiry is where a number gets agreed, in writing, against a defined scope.
 */
export function Services({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  return (
    <Section
      id="services"
      eyebrow="Services"
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
        /* Two large note pieces, each shaped to the space that is actually free.

           FlowingStaff (1.66:1, 23 paths) goes top-right at 5%: the dense fold
           lands in the margin Section leaves beside the max-w-3xl heading, and
           the thin leading sweep trails behind the heading — the same watermark
           treatment the Hero already uses on its clef. Its offset is in px, not
           percent: the section is ~2400px tall on desktop and ~5100px on mobile,
           so a percentage would throw it clear off the top on the smaller one.

           RisingStaff runs full-bleed across the card row at 4%, a step lighter
           because the cards sit on top of it. It reads in the gutters and around
           the card edges; rv-card is only 45% slate, so it shows faintly through
           the surfaces without touching the copy. The rising sweep is also the
           right gesture here — the packages are a progression. */
        <>
          <FlowingStaff className="pointer-events-none absolute -top-20 -right-[4%] w-[70%] max-w-none text-rhymvex-ember opacity-[0.09] lg:w-[56%]" />
          <RisingStaff className="pointer-events-none absolute left-[-14%] top-[24%] w-[128%] max-w-none text-rhymvex-ember opacity-[0.08]" />
        </>
      }
    >
      <Approach />

      <div className="grid gap-5 lg:grid-cols-3">
        {services.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} locale={locale} />
        ))}
      </div>

      {/* Additional support — recommended when it helps, not a menu */}
      <div className="mt-14 sm:mt-16">
        <TempoDivider notes={PHRASE} />

        {/* The phrase again, larger, in the margin the heading leaves free. */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h3 className="text-display-sub">{addOnsIntro.heading}</h3>
            <p className="mt-4 text-base leading-relaxed text-rhymvex-white/60">
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
              className="border-b border-rhymvex-white/5 pb-4"
            >
              <dt className="text-sm font-medium">{addOn.name}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-rhymvex-white/45">
                {addOn.note}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* The phrase again, reversed, as a closing cadence. */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
        <p className="max-w-2xl text-sm leading-relaxed text-rhymvex-white/45">
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
