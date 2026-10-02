import type { Metadata } from "next";
import { HomeView } from "@/components/site/HomeView";
import { localeCurrency } from "@/lib/currency-preference";
import { getTranslator } from "@/lib/i18n";
import { homeHref, homeAlternates } from "@/lib/locales";
import { SITE_ORIGIN } from "@/lib/services";

/**
 * Statically cached, deliberately.
 *
 * The home page is authored content and JSON, with no request data in it, so it
 * is served from the cache and renders identically on every visit. Stated rather
 * than left to the default so that a later edit which introduces a request read
 * into a shared component fails the build instead of quietly making every locale
 * page dynamic — which is how the same page starts differing between visits.
 *
 * The intake page is the opposite and stays `force-dynamic`: it reads the live
 * response-time promise out of the database.
 */
export const dynamic = "force-static";

/**
 * Home page for a locale.
 *
 * Metadata and the rendered page both come from the same locale definition and
 * the same catalogue, so a locale can never advertise one currency or one
 * language while the page underneath says something else.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getTranslator(locale);
  return {
    title: `Rhymvex — ${t("footer.tagline")}`,
    description: t("footer.body"),
    // `homeHref` rather than a raw `/${locale}`, because the default locale is
    // served at the un-prefixed URL. Building the tag by hand pointed /en-IE's
    // canonical at /en-IE while / pointed at /, so the two URLs for the same
    // page both claimed to be canonical. One locale, one URL.
    alternates: {
      canonical: homeHref(locale),
      languages: homeAlternates(SITE_ORIGIN),
    },
    openGraph: {
      title: `Rhymvex — ${t("footer.tagline")}`,
      description: t("footer.body"),
      locale,
    },
    // The language default, not the cookie: this page is statically cached and a
    // crawler arrives with no cookie. No figure is rendered here either way.
    other: { "price:currency": localeCurrency(locale).code } as Record<string, string>,
  };
}

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomeView locale={locale} />;
}
