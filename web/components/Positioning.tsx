import { ArrowUpRight, Layers, Repeat, Target } from "lucide-react";
import { LoopVideo } from "@/components/LoopVideo";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { LeadCaptureButton } from "@/components/lead/LeadCaptureButton";
import { enquiryUrl } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

const CHANNELS = [
  { key: "channelDeck", num: "01", desc: "Outdated messaging and promises that product no longer delivers." },
  { key: "channelSite", num: "02", desc: "Custom marketing pages disconnected from core software components." },
  { key: "channelAds", num: "03", desc: "Ad-hoc UI patterns rebuilt from scratch on every sprint release." },
  { key: "channelSocial", num: "04", desc: "Manual client workflows trapped across unintegrated third-party tools." },
] as const;

const PROMISES = [
  { icon: Layers, key: "p1", tag: "01 / INTEGRATION" },
  { icon: Repeat, key: "p2", tag: "02 / FULL-STACK" },
  { icon: Target, key: "p3", tag: "03 / PERFORMANCE" },
] as const;

/**
 * Positioning: the diagnosis, the drift matrix, and the architectural fix.
 *
 * Replaces the previous cramped layout with a two-phase structural narrative:
 * 1. The Diagnosis: The 4-surface drift breakdown alongside the continuous system reel.
 * 2. The Solution: Three foundational engineering guarantees with clear metrics.
 */
export function Positioning({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <Section
      id="problem"
      eyebrow={t("home.problem.eyebrow")}
      title={
        <>
          {t("home.problem.heading1")}
          <br />
          <span className="text-rhymvex-volt">{t("home.problem.heading2")}</span>
        </>
      }
      description={<p>{t("home.problem.body")}</p>}
    >
      {/* Grid: Drift Matrix vs Video Reel */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-stretch lg:gap-10">
        {/* The Drift Matrix */}
        <Reveal className="flex flex-col justify-between rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/40 p-6 sm:p-8 backdrop-blur-sm">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-rhymvex-white/10 pb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rhymvex-white/60">
                {t("home.problem.channelsLabel")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-rhymvex-volt">
                <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" />
                Root cause
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {CHANNELS.map(({ key, num, desc }) => (
                <div
                  key={key}
                  className="rounded-xl border border-rhymvex-white/8 bg-rhymvex-black/40 p-3.5 transition-colors duration-200 hover:border-rhymvex-volt/30 hover:bg-rhymvex-black/70"
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-rhymvex-white">{t(`home.problem.${key}`)}</span>
                    <span className="text-[10px] font-mono text-rhymvex-volt/70">Drift {num}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-rhymvex-white/55 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-rhymvex-white/8 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-rhymvex-white/50">
            <span>{t("home.problem.channelsCaption")}</span>
            <span className="font-mono text-rhymvex-volt/80">Result: Tool sprawl & friction</span>
          </div>
        </Reveal>

        {/* The video, framed with studio HUD Telemetry */}
        <Reveal
          delay={120}
          className="relative min-h-72 overflow-hidden rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate sm:min-h-80 flex flex-col justify-between"
        >
          <LoopVideo
            mp4Src="/brand/Crystalline_shards_and_ribbons_d…_20261004124439.mp4"
            posterSrc="/media/brand-reel-poster.jpg"
            className="absolute inset-0 object-[center_65%]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rhymvex-black/85 via-rhymvex-black/25 to-rhymvex-black/60"
          />

          {/* Top HUD Telemetry */}
          <div className="relative z-10 flex items-center justify-between p-4 text-[10px] font-mono uppercase tracking-wider text-rhymvex-white/60 backdrop-blur-[2px]">
            <span>System Pulse</span>
            <span className="text-rhymvex-volt">Continuous Flow</span>
          </div>

          {/* Bottom HUD caption */}
          <div className="relative z-10 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rhymvex-volt">
              The Antidote
            </p>
            <h4 className="mt-1 text-lg sm:text-xl font-bold text-rhymvex-white">
              One unified architecture.
            </h4>
            <p className="mt-1.5 text-xs sm:text-sm text-rhymvex-white/70 leading-relaxed">
              Every digital asset, platform interface, and production token connects to a single source of truth.
            </p>
          </div>
        </Reveal>
      </div>

      {/* The Fix: Solution Statement & The Three Architectural Pillars */}
      <div className="mt-14 sm:mt-20">
        <Reveal className="max-w-2xl mb-8">
          <h3 className="text-display-sub">{t("home.problem.fixHeading")}</h3>
          <p className="mt-3 text-base leading-relaxed text-rhymvex-white/70">
            {t("home.problem.fixBody")}
          </p>
        </Reveal>

        <ul className="grid gap-5 md:grid-cols-3">
          {PROMISES.map(({ icon: Icon, key, tag }, i) => (
            <Reveal as="li" key={key} delay={i * 90} className="rv-card group flex flex-col p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-rhymvex-volt/10 text-rhymvex-volt transition-colors duration-200 group-hover:bg-rhymvex-volt/20">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rhymvex-white/40">
                  {tag}
                </span>
              </div>
              <h4 className="mt-5 text-display-3 font-semibold text-rhymvex-white">
                {t(`home.problem.${key}Title`)}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-rhymvex-white/65">
                {t(`home.problem.${key}Body`)}
              </p>
            </Reveal>
          ))}
        </ul>

        {/* System Drift Diagnostic Callout */}
        <Reveal
          delay={240}
          className="mt-10 sm:mt-14 rounded-2xl border border-rhymvex-volt/25 bg-gradient-to-br from-rhymvex-slate/70 via-rhymvex-slate/40 to-rhymvex-black/70 p-6 sm:p-8 backdrop-blur-sm shadow-[0_0_35px_rgba(111,230,254,0.06)]"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-rhymvex-volt">
                <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" />
                System Diagnosis
              </span>
              <h4 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-rhymvex-white">
                Experiencing tool sprawl or product drift?
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-rhymvex-white/70">
                Book a 30-minute architecture walkthrough. We will audit your current stack, pinpoint where components drift, and outline a unified roadmap.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 gap-3">
              <LeadCaptureButton
                situation="You need clarity"
                className="rv-btn rv-btn-primary whitespace-nowrap px-5 py-2.5 text-sm"
              >
                Request System Audit
              </LeadCaptureButton>
              <a
                href={enquiryUrl(locale)}
                className="rv-btn rv-btn-ghost group/audit inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs py-2 px-4"
              >
                <span>Book consultation call</span>
                <ArrowUpRight
                  className="size-3.5 transition-transform duration-200 group-hover/audit:translate-x-0.5 group-hover/audit:-translate-y-0.5 rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}