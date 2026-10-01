import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/locales";
import { localeFontClass } from "@/components/LocaleFonts";

/**
 * Locale route group.
 *
 * Wraps every prefixed URL. An unrecognised prefix is a 404 rather than a
 * silent fallback to English: `/jp/` is a broken link, and quietly showing
 * someone the words and prices for the wrong locale is worse than saying the
 * page does not exist.
 *
 * Direction is set here rather than per component. Arabic is right-to-left, and
 * a layout that mirrors correctly is the difference between a translated site
 * and a translated site that is subtly broken. Components contribute logical
 * spacing (`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`) so mirroring happens
 * without a second set of styles.
 *
 * The font wrapper is `display: contents`, so it sets the CSS variable and the
 * text direction for the page without introducing a box.
 *
 * The default locale is served at the un-prefixed URL, so `/en-IE` is a valid
 * page with identical content rather than a redirect. One URL per locale.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div lang={locale} dir={LOCALES[locale].dir} className={`contents ${localeFontClass(locale)}`}>
      {children}
    </div>
  );
}
