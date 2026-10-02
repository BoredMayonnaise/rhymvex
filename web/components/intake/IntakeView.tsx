import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IntakeForm } from "@/components/intake/IntakeForm";
import { RvMark } from "@/components/RvMark";
import { getOrgSettings, getResponseSlaMinutes } from "@/lib/data/org";
import { draftFromIds, services } from "@/lib/services";
import { SITUATIONS } from "@/lib/validation";
import { DEFAULT_LOCALE, getLocale, type LocaleCode } from "@/lib/locales";
import { preferredCurrency } from "@/lib/currency-preference";
import { getTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type IntakeSearchParams = {
  situation?: string;
  outcomes?: string;
  addons?: string;
  draft?: string;
};

/**
 * The three steps, resolved at render time from the message catalogue so they
 * read in the visitor's language rather than being baked into the page.
 */
const STEP_KEYS = [
  ["intake.step1Title", "intake.step1Body"],
  ["intake.step2Title", "intake.step2Body"],
  ["intake.step3Title", "intake.step3Body"],
] as const;

/**
 * The intake page body, shared by `/intake` and by every locale prefix.
 *
 * Two separate things are resolved here and they are not the same thing. The
 * locale decides the words. The currency decides the numbers in the budget
 * bands, and it comes from the visitor's remembered choice rather than from the
 * language, because someone reading this in English may well be budgeting in
 * yen. Everything else on the page is independent of both.
 *
 * Reading the currency is what makes this route dynamic, which it already was:
 * the response-time promise below is read from the database. The home pages
 * show no figures and stay statically cached.
 */
export default async function IntakeView({
  searchParams,
  locale = DEFAULT_LOCALE,
}: {
  searchParams: Promise<IntakeSearchParams>;
  locale?: LocaleCode;
}) {
  const t = getTranslator(locale);
  const params = await searchParams;
  const [slaMinutes, settings, currency] = await Promise.all([
    getResponseSlaMinutes(),
    getOrgSettings(),
    preferredCurrency(locale),
  ]);

  // Only an on-site calendar is offered. There is no mailto fallback: the
  // request is recorded in the platform, not handed to an email client.
  const calendarUrl = process.env.NEXT_PUBLIC_CALENDAR_URL?.trim() || "";

  // The situation arrives as one of the site's own service labels so the radio
  // can preselect. Anything unrecognised is dropped rather than echoed back.
  const knownSituation = SITUATIONS.find((s) => s === params.situation) ?? "";

  // A drafted scope from the scope builder. The ids are resolved to labels here,
  // server-side, so a hand-edited query string cannot inject arbitrary copy
  // into the message that becomes a lead record.
  const pkg = services.find((s) => s.situation === params.situation) ?? null;
  const initialMessage =
    params.draft && (params.outcomes || params.addons)
      ? (draftFromIds(pkg, params.outcomes ?? "", params.addons ?? "") ?? "")
      : "";

  return (
    <div className="min-h-screen bg-rhymvex-black">
      {/* Brand texture, the same 64px grid the rest of the site sits on. */}
      <div
        className="rv-grid pointer-events-none absolute inset-x-0 top-0 h-[36rem] opacity-30"
        aria-hidden="true"
      />

      <header className="relative border-b border-rhymvex-white/8">
        <div className="rv-container flex items-center justify-between py-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm text-rhymvex-white/55 transition-colors hover:text-rhymvex-white"
          >
            <RvMark label={null} className="size-6" />
            <span className="font-display font-semibold tracking-tight">Rhymvex</span>
          </Link>
          {/* The only navigation this page has, so it is sized like a control
              rather than like fine print. It measured 89x16px, which fails the
              24px minimum target in WCAG 2.5.8, and it sat at text-xs and 50%
              white — quieter than the logo beside it, on the one page where
              somebody part-way through a form most wants a way out.

              py-2 takes the hit area to 32px without growing the bar: the
              header's own py-5 is what sets its height, so this sits inside the
              space that padding already occupies. */}
          <Link
            href="/"
            className="-my-2 flex items-center gap-2 rounded px-2 py-2 text-sm text-rhymvex-white/70 transition-colors hover:text-rhymvex-volt"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("nav.backToSite")}
          </Link>
        </div>
      </header>

      {/* Three blocks, and the order they are read in differs by width. On a
          phone the form comes second, right under the headline: a visitor who
          has to scroll past the whole pitch before they can type is a visitor
          who does not type. On a wide screen the pitch sits alongside the form,
          where it can be read at the same time as it is filled in.

          The wrapper around the left-hand blocks is `contents` on small screens,
          which promotes its children to items of the flex column so each can be
          ordered independently. On wide screens it becomes a normal block again,
          so the pitch reads as one column rather than two loose fragments. */}
      <main id="main" className="relative">
        <div className="rv-container flex flex-col gap-9 py-10 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-x-20 lg:py-16">
          <div className="contents lg:col-start-1 lg:row-start-1 lg:block">
            <div className="order-1">
              <p className="rv-eyebrow">{t("intake.eyebrow")}</p>
              <h1 className="mt-5 text-display-2">
                {t("intake.heading1")}
                <br />
                <span className="text-rhymvex-volt">{t("intake.heading2")}</span>
              </h1>
              <span className="rv-rule mt-8 block h-px w-24" aria-hidden="true" />
              <p className="mt-7 max-w-md text-lead text-rhymvex-white/65">
                {t("intake.lede")}
              </p>
            </div>

            {/* What happens next, stated before the form rather than after it, so
                the visitor knows what they are agreeing to. */}
            <div className="order-3 mt-12">
              <ol className="m-0 flex list-none flex-col gap-6 border-t border-rhymvex-white/8 pt-8">
                {STEP_KEYS.map(([titleKey, bodyKey], index) => (
                  <li key={titleKey} className="flex gap-5">
                    {/* Volt number over a connector: the process card, inline. */}
                    <span className="flex w-4 shrink-0 flex-col items-center" aria-hidden="true">
                      <span className="font-display text-xs font-bold text-rhymvex-volt tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < STEP_KEYS.length - 1 ? (
                        <span className="mt-2 w-px flex-1 bg-rhymvex-white/10" />
                      ) : null}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-rhymvex-white">{t(titleKey)}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-rhymvex-white/50">
                        {t(bodyKey)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Only stated when a real SLA exists. See getResponseSlaMinutes. */}
              {slaMinutes ? (
                <p className="mt-8 border-l-2 border-rhymvex-volt ps-4 text-sm text-rhymvex-white/55">
                  A person replies within{" "}
                  {Number.isInteger(slaMinutes / 60)
                    ? `${slaMinutes / 60} hour${slaMinutes === 60 ? "" : "s"}`
                    : `${slaMinutes} minutes`}
                  .
                </p>
              ) : (
                <p className="mt-8 border-l-2 border-rhymvex-volt/40 ps-4 text-sm text-rhymvex-white/55">
                  {t("intake.noSla")}
                </p>
              )}

              <p className="mt-8 text-xs text-rhymvex-white/50">
                {t("intake.preferEmail")} {" "}
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="text-rhymvex-volt underline underline-offset-4"
                >
                  {settings.contact_email}
                </a>{" "}
                {t("intake.reachesTeam")}
              </p>
            </div>
          </div>

          {/* The form. A sibling of the column above rather than a child of it,
              so it is a grid item in its own right at every width. It sits
              directly on the page rather than in a panel, the way the hero
              form does, so the two capture surfaces read as the same object. */}
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1">
            <span className="rv-rule block h-px w-full" aria-hidden="true" />
            <IntakeForm
              initialSituation={knownSituation}
              initialMessage={initialMessage}
              calendarUrl={calendarUrl}
              region={getLocale(locale)}
              currency={currency}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
