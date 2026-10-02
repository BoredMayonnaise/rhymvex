import type { MetadataRoute } from "next";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LOCALE,
  LOCALES,
  homeHref,
  intakeHref,
  homeAlternates,
  intakeAlternates,
} from "@/lib/locales";
import { SITE_ORIGIN } from "@/lib/services";

const SITE_URL = SITE_ORIGIN;

/**
 * Newest mtime across the content that actually renders a page.
 *
 * `lastModified` is a claim about content, not about deploys. Emitting
 * `new Date()` tells a crawler every URL changed on every crawl, which trains it
 * to stop trusting the field — the opposite of what the field is for. So this
 * reads the real inputs: the shared content files for the home page, and the
 * home page's own translations plus the content for the intake page.
 *
 * Falls back to the process start on a build where the files cannot be read,
 * which is still more honest than a timestamp that changes on every request.
 */
async function newestMtime(paths: string[]): Promise<Date> {
  const times = await Promise.all(
    paths.map(async (p) => {
      try {
        return (await stat(p)).mtime;
      } catch {
        return null;
      }
    }),
  );
  const found = times.filter((t): t is Date => t instanceof Date);
  return found.length ? new Date(Math.max(...found.map((d) => d.getTime()))) : new Date();
}

const CONTENT_DIR = path.join(process.cwd(), "..", "content");
const MESSAGES_DIR = path.join(CONTENT_DIR, "messages");

/** Content shared by every page: services, tokens, currencies, locales. */
const SHARED_CONTENT = [
  path.join(CONTENT_DIR, "services.json"),
  path.join(CONTENT_DIR, "currencies.json"),
  path.join(CONTENT_DIR, "locales.json"),
];

/** A locale's own copy deck. */
function messageFiles(): string[] {
  return Object.keys(LOCALES).map((code) => path.join(MESSAGES_DIR, `${code}.json`));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Every locale is listed, each with its own canonical URL. Prices differ per
  // locale, so these are genuinely different pages rather than the same page
  // under a different label, and each declares itself canonical so search
  // engines do not treat them as duplicates of one another.
  //
  // Each entry also carries the full set of siblings via hreflang, which is what
  // lets a crawler understand the set instead of treating seven home pages as
  // seven unrelated URLs competing for the same query.
  const homeLastModified = await newestMtime([...SHARED_CONTENT, ...messageFiles()]);
  const intakeLastModified = await newestMtime([
    ...SHARED_CONTENT,
    ...messageFiles(),
    path.join(process.cwd(), "components", "intake", "IntakeForm.tsx"),
    path.join(process.cwd(), "components", "intake", "IntakeView.tsx"),
  ]);

  return Object.values(LOCALES).flatMap((locale) => [
    {
      url: `${SITE_URL}${homeHref(locale.code)}`,
      lastModified: homeLastModified,
      changeFrequency: "monthly" as const,
      priority: locale.code === DEFAULT_LOCALE ? 1 : 0.8,
      alternates: { languages: homeAlternates(SITE_URL) },
    },
    {
      // The primary conversion path: this is where a visitor explains their
      // situation, so it belongs in the sitemap alongside the home page.
      url: `${SITE_URL}${intakeHref(locale.code)}`,
      lastModified: intakeLastModified,
      changeFrequency: "monthly" as const,
      priority: locale.code === DEFAULT_LOCALE ? 0.9 : 0.7,
      alternates: { languages: intakeAlternates(SITE_URL) },
    },
  ]);
}
