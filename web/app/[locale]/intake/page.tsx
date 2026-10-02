import type { Metadata } from "next";
import IntakeView from "@/components/intake/IntakeView";
import { preferredCurrency } from "@/lib/currency-preference";
import { getTranslator } from "@/lib/i18n";
import { intakeHref, intakeAlternates } from "@/lib/locales";
import { SITE_ORIGIN } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * Intake page for a locale.
 *
 * The budget bands come from the currency the visitor chose and every word comes
 * from the locale's catalogue. The two are independent, so the page can be read
 * in one language and priced in another, and neither can contradict the other:
 * the bands are the currency's own labels and the words are the language's own
 * catalogue.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getTranslator(locale);
  const currency = await preferredCurrency(locale);
  return {
    title: t("intake.title"),
    description: t("intake.description"),
    robots: { index: true, follow: true },
    // Canonical via `intakeHref` so the default locale resolves to `/intake`
    // rather than `/en-IE/intake`, matching the un-prefixed page and the
    // sitemap. See the note on the locale home page.
    alternates: {
      canonical: intakeHref(locale),
      languages: intakeAlternates(SITE_ORIGIN),
    },
    openGraph: {
      title: t("intake.title"),
      description: t("intake.description"),
      locale,
    },
    // Stated for the crawlers that read it: the page is priced in this market.
    other: { "price:currency": currency.code } as Record<string, string>,
  };
}

export default async function LocaleIntake({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ situation?: string; outcomes?: string; addons?: string; draft?: string }>;
}) {
  const { locale } = await params;
  return <IntakeView searchParams={searchParams} locale={locale} />;
}
