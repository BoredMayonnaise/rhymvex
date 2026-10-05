import { ArrowUp } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { RvWordmark } from "@/components/RvWordmark";
import { WaveformRhythm } from "@/components/WaveformRhythm";
import { enquiryUrl, CONTACT_EMAIL } from "@/lib/services";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Site footer.
 *
 * The brand sign-off: the mark, tagline, email, and legal rail over the script
 * wordmark as subtle background texture.
 */
export function SiteFooter({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  const year = new Date().getFullYear();
  const t = getTranslator(locale);

  return (
    <footer className="relative overflow-hidden border-t border-rhymvex-white/10">
      <div
        className="rv-grid pointer-events-none absolute inset-0 opacity-20"
        aria-hidden="true"
      />
      {/* Script wordmark, demoted to background texture */}
      <RvWordmark
        className="pointer-events-none absolute -bottom-[14%] -right-[12%] w-[78%] max-w-none text-rhymvex-white opacity-[0.035] sm:-right-[6%] sm:w-[52%] lg:-bottom-[26%] lg:w-[38%]"
        label={null}
      />

      {/* Signature motif closing the page — the waveform, in motion */}
      <div className="relative border-b border-rhymvex-white/10">
        <div className="rv-container py-6 sm:py-8">
          <WaveformRhythm className="mx-auto aspect-[1468/357] w-full max-w-lg opacity-50" />
        </div>
      </div>

      <div className="rv-container relative pb-10 pt-12 sm:pb-12 sm:pt-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-xl">
            <RvMark className="h-9 w-auto sm:h-11" />
            <p className="mt-7 font-display text-display-3 text-rhymvex-white font-bold">
              {t("footer.tagline")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-rhymvex-white/65">
              {t("footer.body")}
            </p>
          </div>

          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-rhymvex-white/55">
              {t("footer.newProjects")}
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 block break-words font-display text-lg text-rhymvex-volt transition-colors duration-200 hover:text-rhymvex-white sm:text-xl"
            >
              {CONTACT_EMAIL}
            </a>
            <a
              href={enquiryUrl(locale)}
              className="rv-btn rv-btn-ghost mt-6"
            >
              {t("nav.bookCall")}
            </a>
          </div>
        </div>

        {/* Legal rail */}
        <div className="mt-12 flex flex-col items-start gap-4 border-t border-rhymvex-white/10 pt-6 text-xs text-rhymvex-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Rhymvex. {t("footer.rights")}</p>
          <div className="flex flex-wrap items-center gap-5">
            <p className="hidden sm:block">{t("footer.systemsYouCanRun")}</p>
            <a
              href="#main"
              className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-rhymvex-volt"
            >
              {t("footer.backToTop")}
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
