import { LeadCaptureForm } from "@/components/lead/LeadCaptureForm";
import { RvMark } from "@/components/RvMark";
import { enquiryUrl } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";

/**
 * Closing section.
 *
 * Asymmetric on purpose — headline anchored left, capture under it — so it does
 * not read as a generic centred banner. Volt is reserved for the action, per
 * docs/DESIGN.md.
 *
 * A form rather than a button, because a visitor who has read this far and
 * scrolled to the end has already decided something. Asking them to click
 * through to another page at that point is a small, pointless tax.
 */
export function ContactCta({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
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
        className="pointer-events-none absolute -bottom-10 -start-12 h-52 max-h-[50vw] w-auto max-w-none opacity-[0.05] sm:h-72"
        label={null}
      />

      <div className="rv-container relative grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="rv-eyebrow mb-5">Start here</p>
          <h2 className="text-display-2">
            Tell us where the brand hurts.
            <br className="hidden sm:block" />{" "}
            <span className="text-rhymvex-volt">We&rsquo;ll map the fix.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lead text-rhymvex-white/65">
            Every engagement starts with understanding the problem.
            Nothing gets quoted until we both know what&rsquo;s actually wrong.
          </p>

          {/* Booking stays available as the other way in. */}
          <a href={enquiryUrl(locale)} className="rv-btn rv-btn-ghost mt-8">
            Talk through your situation
          </a>
        </div>

        <div className="rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/35 p-6 sm:p-7">
          <LeadCaptureForm variant="panel" />
        </div>
      </div>
    </section>
  );
}