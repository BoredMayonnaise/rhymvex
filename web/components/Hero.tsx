import { ArrowRight } from "lucide-react";
import { RhythmGlyph } from "@/components/RhythmGlyph";
import { TokenCard } from "@/components/TokenCard";
import { ENQUIRY_URL } from "@/lib/services";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-16 sm:pb-24 sm:pt-24 lg:pb-28">
      {/* Brand texture plus the clef-and-staff motif — "rhythm", made literal.
          Decorative only; sits behind the copy and never overlaps it. */}
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <RhythmGlyph
        className="pointer-events-none absolute -right-[18%] top-1/2 w-[125%] max-w-none -translate-y-1/2 text-rhymvex-white opacity-[0.05] sm:-right-[10%] sm:w-[85%] lg:-right-[4%] lg:w-[62%]"
      />

      <div className="rv-container relative grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_clamp(17rem,25vw,22rem)] lg:gap-16">
        {/* Copy */}
        <div className="min-w-0">
          <h1
            className="rv-animate-rise text-display-1"
            style={{ animationDelay: "0.05s" }}
          >
            Your brand is a system.
            <br />
            <span className="text-rhymvex-volt">Build it like one.</span>
          </h1>

          <span
            className="rv-rule rv-animate-rise mt-8 block h-px w-24"
            style={{ animationDelay: "0.2s" }}
            aria-hidden="true"
          />

          <p
            className="rv-animate-rise mt-8 max-w-xl text-lead text-rhymvex-white/70"
            style={{ animationDelay: "0.24s" }}
          >
            Your team should be able to ship on-brand without us in the room.
            That&rsquo;s what the system is for.
          </p>

          <div
            className="rv-animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
            style={{ animationDelay: "0.32s" }}
          >
            {/* Consultative first: the visitor describes the problem before
                anyone asks them to pick a package. */}
            <a href={ENQUIRY_URL} className="rv-btn rv-btn-primary">
              Tell us what you&rsquo;re trying to solve
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a href="#process" className="rv-btn rv-btn-ghost">
              See how we work
            </a>
          </div>

          <p
            className="rv-animate-rise mt-10 text-sm text-rhymvex-white/35"
            style={{ animationDelay: "0.4s" }}
          >
            Build with rhythm.
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
