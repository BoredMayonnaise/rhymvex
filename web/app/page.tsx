import type { Metadata } from "next";
import { Layers, Repeat, Sparkles } from "lucide-react";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Section } from "@/components/Section";
import { OrnamentGlyph } from "@/components/OrnamentGlyph";
import { WaveformRhythm } from "@/components/WaveformRhythm";
import { Pillars } from "@/components/Pillars";
import { Services } from "@/components/Services";
import { Process } from "@/components/Process";
import { SiteNav } from "@/components/SiteNav";
import { ContactCta } from "@/components/ContactCta";

export const metadata: Metadata = {
  title: "Rhymvex — Build with rhythm.",
  description:
    "Brand and product agency. We build the system behind your brand, then hand it over so your team can run it.",
};

const STATS = [
  { value: "2 wks", label: "to your first brand win" },
  { value: "20+", label: "production templates in every system we ship" },
  { value: "∞", label: "repeatable at any volume" },
] as const;

const PROMISES = [
  {
    icon: Layers,
    title: "One system, many assets",
    body: "Tokens, templates and rules, so your team can produce without checking with us each time.",
  },
  {
    icon: Repeat,
    title: "Built to repeat",
    body: "Every asset is one of a set, so the tenth looks like the first.",
  },
  {
    icon: Sparkles,
    title: "Built to perform",
    body: "On-brand is the baseline. Every system is designed around a conversion goal.",
  },
] as const;

export default function Home() {
  return (
    <>
      <SiteNav />

      <main id="main">
        <Hero />

        {/* Waveform band — the rhythm motif, in motion. */}
        <div className="border-b border-rhymvex-white/10 bg-rhymvex-slate/30">
          <div className="rv-container py-5 sm:py-7">
            <WaveformRhythm className="mx-auto aspect-[1468/357] max-h-48 w-full sm:max-h-56" />
          </div>
        </div>

        {/* Key numbers — concrete timelines and output counts, not taxonomy */}
        <section
          aria-label="Key numbers"
          className="border-y border-rhymvex-white/10 bg-rhymvex-slate/30"
        >
          <dl className="rv-container divide-y divide-rhymvex-white/10 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="py-7 sm:px-8 sm:py-9 first:sm:pl-0">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block font-display text-3xl font-bold text-rhymvex-volt sm:text-4xl">
                    {stat.value}
                  </span>
                  <span className="mt-2 block max-w-[22ch] text-sm leading-relaxed text-rhymvex-white/55">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Positioning */}
        <Section
          id="positioning"
          eyebrow="The problem"
          title="Most agencies hand you a logo. We hand you a playbook."
          overlay={
            <OrnamentGlyph
              className="pointer-events-none absolute -right-[14%] top-1/2 h-[130%] max-h-none w-auto max-w-none -translate-y-1/2 text-rhymvex-white opacity-[0.045] sm:-right-[6%] lg:-right-2"
              aria-hidden="true"
            />
          }
        >
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-5 text-base leading-relaxed text-rhymvex-white/65">
              <p>
                Most brands don&rsquo;t fail on the logo. They fail because
                nothing connects. The pitch deck, the site, the ads and the
                founder&rsquo;s LinkedIn. Six versions of one company, none of
                them agreeing.
              </p>
              <p>
                That&rsquo;s not a design problem. It&rsquo;s a systems problem.
              </p>
              <p>
                Rhymvex builds the system first: the message, the rules, the
                tokens, the templates. Everything you make afterwards looks
                consistent, and it takes hours instead of weeks.
              </p>
            </div>

            <ul className="space-y-4">
              {PROMISES.map((item) => (
                <li key={item.title} className="rv-card p-5">
                  <div className="flex items-center gap-3">
                    <item.icon
                      className="size-4 shrink-0 text-rhymvex-volt"
                      aria-hidden="true"
                    />
                    <h3 className="text-display-3">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-rhymvex-white/60">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Marquee />

        <Pillars />

        <Services />

        <Process />

        <ContactCta />
      </main>
    </>
  );
}
