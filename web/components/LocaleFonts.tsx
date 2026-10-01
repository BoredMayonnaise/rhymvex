import { Inter, Space_Grotesk, Noto_Sans_Arabic, Noto_Sans_SC, Noto_Sans_Thai } from "next/font/google";
import type { LocaleCode, Script } from "@/lib/locales";

/**
 * Per-script fonts.
 *
 * Inter and Space Grotesk carry no Arabic, Chinese or Thai glyphs. Without this
 * those pages fall back to whatever the operating system picks, which looks
 * broken beside the English pages and cannot be fixed from a stylesheet, because
 * the family has to arrive as a webfont.
 *
 * Each script is declared once and applied to a wrapper that contains the page,
 * so `next/font`'s CSS variable inherits down to the copy. The stacks in
 * `globals.css` then resolve it with nested fallbacks: at most one Noto face is
 * ever loaded, because a Latin locale never loads one, and a Chinese locale
 * never loads Arabic.
 *
 * CJK is the expensive one. Noto Sans SC is several hundred KB, which is the
 * price of a real Chinese face instead of a system fallback, and it is paid only
 * by the visitors who asked for Chinese.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-noto-arabic", display: "swap" });
const notoSc = Noto_Sans_SC({ subsets: ["latin"], variable: "--font-noto-sc", display: "swap" });
const notoThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-noto-thai", display: "swap" });

const SCRIPT_CLASS: Record<Script, string> = {
  latin: `${inter.variable} ${spaceGrotesk.variable}`,
  arabic: notoArabic.variable,
  cjk: notoSc.variable,
  thai: notoThai.variable,
};

/**
 * Font classes for a locale.
 *
 * Applied to a wrapper around the page rather than to `<html>`, which lives in
 * the root layout above the locale segment and so cannot see which locale is
 * rendering. The wrapper is `display: contents`, so it adds no box of its own.
 */
export function localeFontClass(locale: LocaleCode): string {
  return SCRIPT_CLASS[scriptFor(locale)];
}

function scriptFor(locale: LocaleCode): Script {
  switch (locale) {
    case "ar":
      return "arabic";
    case "zh-CN":
      return "cjk";
    case "th-TH":
      return "thai";
    default:
      return "latin";
  }
}
