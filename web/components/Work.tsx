import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { LeadCaptureButton } from "@/components/lead/LeadCaptureButton";
import { enquiryUrl } from "@/lib/services";
import { work, type WorkEntry } from "@/lib/work";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator, type Translator } from "@/lib/i18n";

const DELIVERABLES = ["D1", "D2", "D3"] as const;

/**
 * The brand system's one real claim, drawn: a single token file, and the three
 * places it ends up (scripts/sync-content.mjs and scripts/build_assets.py).
 * File names are left untranslated on purpose: they are file names.
 */
function TokenPipeline() {
  const swatches = ["bg-rhymvex-volt", "bg-rhymvex-white", "bg-rhymvex-slate", "bg-rhymvex-black", "bg-rhymvex-ember"];
  const outputs = ["web/app/tokens.css", "brand/templates/*.png", "public/brand/*"];

  return (
    <div
      aria-hidden="true"
      className="rv-grid flex h-full min-h-64 flex-col justify-center gap-5 p-6 sm:p-8"
    >
      <div className="rounded-xl border border-rhymvex-volt/40 bg-rhymvex-black/80 p-4">
        <p className="text-xs text-rhymvex-white/60">brand/tokens/tokens.json</p>
        <div className="mt-3 flex gap-1.5">
          {swatches.map((s) => (
            <span
              key={s}
              className={`h-6 flex-1 rounded ring-1 ring-inset ring-rhymvex-white/15 ${s}`}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto h-6 w-px bg-gradient-to-b from-rhymvex-volt to-rhymvex-volt/20" />

      <ul className="grid gap-2 sm:grid-cols-3">
        {outputs.map((o) => (
          <li
            key={o}
            className="truncate rounded-lg border border-rhymvex-white/10 bg-rhymvex-slate/80 px-3 py-2.5 text-center text-xs text-rhymvex-white/75"
          >
            {o}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkCard({ entry, t, index }: { entry: WorkEntry; t: Translator; index: number }) {
  const title = t(`home.work.${entry.key}Title`);

  return (
    <Reveal
      as="article"
      delay={index * 90}
      className="rv-card grid overflow-hidden lg:grid-cols-2"
    >
      <div
        className={`relative min-h-56 overflow-hidden border-b border-rhymvex-white/10 bg-rhymvex-black/60 lg:border-b-0 ${
          index % 2 ? "lg:order-2 lg:border-s" : "lg:border-e"
        }`}
      >
        {entry.image ? (
          <Image
            src={entry.image}
            alt={t("home.work.imageAlt", { name: title })}
            fill
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="pointer-events-none object-cover object-left-top"
          />
        ) : (
          <TokenPipeline />
        )}
      </div>

      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <p className="rv-eyebrow">{t("home.work.label")}</p>
        <h3 className="mt-3 text-display-sub">{title}</h3>
        <p className="mt-4 text-base leading-relaxed text-rhymvex-white/70">
          {t(`home.work.${entry.key}Body`)}
        </p>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-rhymvex-white/55 lg:mt-auto lg:pt-8">
          {t("home.work.builtWith")}
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {DELIVERABLES.map((d) => (
            <li
              key={d}
              className="rounded-md border border-rhymvex-white/10 bg-rhymvex-white/5 px-2.5 py-1 text-xs text-rhymvex-white/80"
            >
              {t(`home.work.${entry.key}${d}`)}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

/**
 * Studio.
 *
 * There are no client case studies yet, and the heading says that first. What
 * the section shows instead is the studio's own systems, each with either a
 * real screenshot or a diagram of what it actually does. See lib/work.ts for
 * why the previous version of this section was removed.
 */
export function Work({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <Section
      id="work"
      eyebrow={t("home.work.eyebrow")}
      title={
        <>
          {t("home.work.heading1")}
          <br />
          <span className="text-rhymvex-volt">{t("home.work.heading2")}</span>
        </>
      }
      description={<p>{t("home.work.body")}</p>}
    >
      <div className="grid gap-6 sm:gap-8">
        {work.map((entry, i) => (
          <WorkCard key={entry.slug} entry={entry} t={t} index={i} />
        ))}
      </div>

      {/* Custom Architecture Lead Catch */}
      <Reveal
        delay={270}
        className="mt-12 sm:mt-16 rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/30 p-6 sm:p-8 backdrop-blur-sm text-center max-w-2xl mx-auto"
      >
        <span className="text-[11px] font-mono uppercase tracking-widest text-rhymvex-volt">
          Custom Platforms & Software
        </span>
        <h4 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-rhymvex-white">
          Want a custom system built like this for your product?
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-rhymvex-white/70">
          From client portals to automated design token engines, we engineer production systems tailored to your business operations.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <LeadCaptureButton
            situation="You need a system that scales"
            className="rv-btn rv-btn-primary w-full sm:w-auto px-5 py-2.5 text-sm"
          >
            Discuss Your Architecture
          </LeadCaptureButton>
          <a
            href={enquiryUrl(locale)}
            className="rv-btn rv-btn-ghost group/call inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-5 py-2.5 text-sm"
          >
            <span>Book a call</span>
            <ArrowUpRight
              className="size-3.5 transition-transform duration-200 group-hover/call:translate-x-0.5 group-hover/call:-translate-y-0.5 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
