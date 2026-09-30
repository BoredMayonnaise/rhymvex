import { ArrowRight } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { BOOK_URL, ENQUIRY_URL } from "@/lib/services";

/**
 * Closing CTA. Asymmetric on purpose — headline anchored left, action under
 * it — so it does not read as a generic centred banner. Volt is reserved for
 * the action, per docs/DESIGN.md.
 */
export function ContactCta() {
  return (
    <section
      id="contact"
      className="relative scroll-mt-24 overflow-hidden border-t border-rhymvex-white/10 px-6 py-section"
    >
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <RvMark
        className="pointer-events-none absolute -bottom-10 -left-12 h-52 max-h-[50vw] w-auto max-w-none opacity-[0.05] sm:h-72"
        label={null}
      />

      <div className="rv-container relative grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
        <div className="min-w-0">
          <p className="rv-eyebrow mb-5">Start here</p>
          <h2 className="text-display-2">
            Tell us where the brand hurts.
            <br className="hidden sm:block" />{" "}
            <span className="text-rhymvex-volt">We&rsquo;ll map the fix.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lead text-rhymvex-white/65">
            Every engagement starts with a short call to understand the problem.
            Nothing gets quoted until we both know what&rsquo;s actually wrong.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <a href={ENQUIRY_URL} className="rv-btn rv-btn-primary w-full sm:w-auto lg:w-full">
            Tell us what you&rsquo;re trying to solve
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <a
            href={BOOK_URL}
            className="rv-btn rv-btn-ghost w-full sm:w-auto lg:w-full"
          >
            Talk through your situation
          </a>
          <p className="text-xs text-rhymvex-white/35">
            We reply within one business day.
          </p>
        </div>
      </div>
    </section>
  );
}
