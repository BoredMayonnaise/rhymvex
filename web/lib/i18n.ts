/**
 * Message lookup.
 *
 * Copy lives in `content/messages/<locale>.json`, mirrored into
 * `web/content/messages/` by `scripts/sync-content.mjs`. Keys are dotted paths
 * (`intake.heading1`) so a catalogue reads as the page it belongs to rather
 * than as a flat list of strings.
 *
 * The fallback rule is the important part. English is the complete reference
 * catalogue, and a key missing from another language resolves to the English
 * string rather than to a raw key, a blank, or a crash. That means a partly
 * translated locale degrades to readable English one string at a time, which is
 * what makes it safe to add a language before its copy is finished.
 *
 * Client-safe: no `node:` import, no database.
 */
import { DEFAULT_LOCALE, isLocale, type LocaleCode } from "./locales";

type Catalogue = { [key: string]: unknown };

// Bundled statically rather than imported dynamically: the set of locales is
// known at build time from content/locales.json, and a dynamic import per
// locale would put a network-shaped problem in front of a file we already have.
import EN_IE from "../content/messages/en-IE.json";
import EN_GB from "../content/messages/en-GB.json";
import EN_US from "../content/messages/en-US.json";
import FIL_PH from "../content/messages/fil-PH.json";
import AR from "../content/messages/ar.json";
import ZH_CN from "../content/messages/zh-CN.json";
import TH_TH from "../content/messages/th-TH.json";

// One import per locale, explicitly. Aliasing two of them to the same file
// would be less typing and would also hide a missing variant catalogue, so the
// English variants are real files that happen to hold identical copy today.
const CATALOGUES: Record<string, Catalogue> = {
  "en-IE": EN_IE as Catalogue,
  "en-GB": EN_GB as Catalogue,
  "en-US": EN_US as Catalogue,
  "fil-PH": FIL_PH as Catalogue,
  ar: AR as Catalogue,
  "zh-CN": ZH_CN as Catalogue,
  "th-TH": TH_TH as Catalogue,
};

/** Walk a dotted path. Returns undefined rather than throwing on a bad key. */
function lookup(catalogue: Catalogue | undefined, key: string): string | undefined {
  if (!catalogue) return undefined;
  let node: unknown = catalogue;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Substitute `{name}` placeholders. Unknown placeholders are left in place. */
export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export type Translator = {
  /** Look up a key in this locale, falling back to English. */
  (key: string, values?: Record<string, string | number>): string;
  locale: LocaleCode;
  direction: "ltr" | "rtl";
  /**
   * True when a key resolved to English rather than to this locale's own copy.
   * Used by the catalogue completeness check, not by components.
   */
  isFallback(key: string): boolean;
};

import { LOCALES } from "./locales";

/**
 * Build a translator for a locale.
 *
 * Never returns a function that can produce a raw key: an unresolvable key
 * returns the key itself, which is visible in review but never silently blank.
 */
export function getTranslator(locale?: string | null): Translator {
  const code = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const catalogue = CATALOGUES[code];
  const fallback = CATALOGUES[DEFAULT_LOCALE] as Catalogue;

  const t = ((key: string, values?: Record<string, string | number>) => {
    const own = lookup(catalogue, key);
    if (own !== undefined) return interpolate(own, values);
    const english = lookup(fallback, key);
    if (english !== undefined) return interpolate(english, values);
    return key;
  }) as Translator;

  t.locale = code;
  t.direction = (LOCALES[code]?.dir ?? "ltr") as "ltr" | "rtl";
  t.isFallback = (key: string) =>
    lookup(catalogue, key) === undefined && lookup(fallback, key) !== undefined;

  return t;
}

/**
 * Keys the English reference defines, as dotted paths.
 *
 * Used by `scripts/check-i18n.mjs` to report a partly translated locale, so a
 * language cannot be declared done while silently falling back on half the page.
 */
export function englishKeys(): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "$comment") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") out.push(path);
      else walk(value, path);
    }
  };
  walk(CATALOGUES[DEFAULT_LOCALE], "");
  return out.sort();
}
