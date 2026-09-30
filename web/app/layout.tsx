import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ArrowUp } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import { RvWordmark } from "@/components/RvWordmark";
import { WaveformRhythm } from "@/components/WaveformRhythm";
import { BOOK_URL, CONTACT_EMAIL } from "@/lib/services";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhymvex.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Rhymvex — Build with rhythm.",
    template: "%s — Rhymvex",
  },
  description:
    "Brand and product agency. We build the system behind your brand, then hand it over so your team can run it.",
  applicationName: "Rhymvex",
  keywords: [
    "brand system",
    "brand agency",
    "design system",
    "design tokens",
    "brand strategy",
    "content production",
  ],
  authors: [{ name: "Rhymvex" }],
  creator: "Rhymvex",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Rhymvex",
    title: "Rhymvex — Build with rhythm.",
    description:
      "Brand and product agency. We build the system behind your brand, then hand it over so your team can run it.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Rhymvex — Build with rhythm.",
    description: "Brand and product agency. We build the system behind your brand, then hand it over.",
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();

  return (
    // suppressHydrationWarning: the inline script below adds "rv-js" to <html>
    // before React hydrates, so the client class list always differs by one.
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-rhymvex-black text-rhymvex-white antialiased">
        {/* Marks the document as JS-capable so scroll-reveal can start hidden.
            Runs before paint; without it content simply renders in place. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("rv-js")`,
          }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-rhymvex-volt focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-rhymvex-black"
        >
          Skip to content
        </a>

        {children}

        {/* ------------------------------------------------------------------
            Footer. No nav list — the closing section already carries the
            actions, and repeating them reads as filler. This is the brand
            sign-off: the logo, one line, one email, and a hairline legal
            rail, over the script wordmark as background texture.
            ------------------------------------------------------------------ */}
        <footer className="relative overflow-hidden border-t border-rhymvex-white/10">
          <div
            className="rv-grid pointer-events-none absolute inset-0 opacity-20"
            aria-hidden="true"
          />
          {/* Script wordmark, demoted to background */}
          <RvWordmark
            className="pointer-events-none absolute -bottom-[14%] -right-[12%] w-[78%] max-w-none text-rhymvex-white opacity-[0.05] sm:-right-[6%] sm:w-[52%] lg:-bottom-[26%] lg:w-[38%]"
            label={null}
          />

          {/* Signature motif closing the page — the waveform, in motion */}
          <div className="relative border-b border-rhymvex-white/10">
            <div className="rv-container py-6 sm:py-8">
              <WaveformRhythm className="mx-auto aspect-[1468/357] w-full max-w-lg opacity-60" />
            </div>
          </div>

          <div className="rv-container relative pb-10 pt-12 sm:pb-12 sm:pt-16">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
              <div className="max-w-xl">
                <RvMark className="h-9 w-auto sm:h-11" />
                <p className="mt-7 font-display text-display-3 text-rhymvex-white">
                  Build with rhythm.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-rhymvex-white/50">
                  Brand &amp; product agency. We build the system behind your
                  brand, then hand it over so your team can run it.
                </p>
              </div>

              <div className="shrink-0">
                <p className="text-xs text-rhymvex-white/40">New projects</p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-2 block break-words font-display text-lg text-rhymvex-volt transition-colors duration-200 hover:text-rhymvex-white sm:text-xl"
                >
                  {CONTACT_EMAIL}
                </a>
                <a
                  href={BOOK_URL}
                  className="rv-btn rv-btn-ghost mt-6"
                >
                  Book a call
                </a>
              </div>
            </div>

            {/* Legal rail */}
            <div className="mt-12 flex flex-col items-start gap-4 border-t border-rhymvex-white/10 pt-6 text-xs text-rhymvex-white/40 sm:flex-row sm:items-center sm:justify-between">
              <p>© {year} Rhymvex. All rights reserved.</p>
              <div className="flex items-center gap-5">
                <p className="hidden sm:block">Systems you can run.</p>
                <a
                  href="#main"
                  className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-rhymvex-volt"
                >
                  Back to top
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
