import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES, homeHref, intakeHref } from "@/lib/locales";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhymvex.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Every locale is listed, each with its own canonical URL. Prices differ per
  // locale, so these are genuinely different pages rather than the same page
  // under a different label, and each declares itself canonical so search
  // engines do not treat them as duplicates of one another.
  return Object.values(LOCALES).flatMap((locale) => [
    {
      url: `${SITE_URL}${homeHref(locale.code)}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: locale.code === DEFAULT_LOCALE ? 1 : 0.8,
    },
    {
      // The primary conversion path: this is where a visitor explains their
      // situation, so it belongs in the sitemap alongside the home page.
      url: `${SITE_URL}${intakeHref(locale.code)}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: locale.code === DEFAULT_LOCALE ? 0.9 : 0.7,
    },
  ]);
}
