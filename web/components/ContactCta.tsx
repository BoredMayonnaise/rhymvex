import { ArrowUpRight } from "lucide-react";
import { LeadCaptureForm } from "@/components/lead/LeadCaptureForm";
import { RvMark } from "@/components/RvMark";
import { enquiryUrl } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Closing section: the one full inline form on the page.
 *
 * Asymmetric on purpose — headline anchored left, capture form under it.
 * Volt is reserved for the primary submit action.
 *
 * A full form here is natural: a visitor who has read through the whole narrative
 * (problem, process, services, studio proof) is ready to take action without
 * being forced onto a second page.
 */
export function ContactCta({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const t = getTranslator(locale);

  return (
    <section
      id="contact"
      className="relative scroll-mt-20 overflow-hidden border-t border-rhymvex-white/10 py-section"
    >
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <RvMark
        className="pointer-events-none absolute -bottom-10 -start-12 h-52 max-h-[50vw] w-auto max-w-none opacity-[0.04] sm:h-72"
        label={null}
      />

      <div className="rv-container relative grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="rv-eyebrow mb-5">{t("home.contact.eyebrow")}</p>
          <h2 className="text-display-2">
            {t("home.contact.heading1")}
            <br className="hidden sm:block" />{" "}
            <span className="text-rhymvex-volt">{t("home.contact.heading2")}</span>
          </h2>
          <p className="mt-6 max-w-lg text-lead text-rhymvex-white/70">
            {t("home.contact.body")}
          </p>

          <div className="mt-8 border-t border-rhymvex-white/10 pt-6">
            <p className="text-xs text-rhymvex-white/55">{t("home.contact.orBook")}</p>
            <a
              href={enquiryUrl(locale)}
              className="rv-btn rv-btn-ghost group/call mt-3 inline-flex items-center gap-2"
            >
              <span>{t("nav.bookCall")}</span>
              <ArrowUpRight
                className="size-4 transition-transform duration-200 group-hover/call:translate-x-0.5 group-hover/call:-translate-y-0.5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/40 p-6 sm:p-8 backdrop-blur-sm">
          <LeadCaptureForm variant="panel" />
        </div>
      </div>
    </section>
  );
}