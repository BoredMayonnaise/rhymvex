import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { LeadCaptureProvider } from "@/components/lead/LeadCaptureProvider";
import { SITE_ORIGIN } from "@/lib/services";
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

const SITE_URL = SITE_ORIGIN;

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
    // `opengraph-image.png` is picked up automatically for og:image, but Twitter
    // does not read that. Without an explicit image the card silently degrades
    // from a large image to a bare text card, which is the most-shared surface
    // the brand has.
    images: ["/opengraph-image.png"],
  },
  // No blanket `alternates.canonical` here. This layout wraps every route
  // including the workspaces, so a canonical of "/" was being inherited by all
  // 31 admin and portal pages, telling a crawler the client portal is a
  // duplicate of the home page. Each public page states its own canonical and
  // its own hreflang set; pages with no canonical are self-canonical by default,
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rhymvex",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline script below adds "rv-js" to <html>
    // before React hydrates, so the client class list always differs by one.
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-rhymvex-black text-rhymvex-white antialiased">
        {/* Marks the document as JS-capable and captures early PWA install events before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.documentElement.classList.add("rv-js");
              window.addEventListener("beforeinstallprompt", function(e) {
                e.preventDefault();
                window.__rvDeferredInstallPrompt = e;
                window.dispatchEvent(new CustomEvent("rv-pwa-ready"));
              });
            `,
          }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-rhymvex-volt focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-rhymvex-black"
        >
          Skip to content
        </a>

        {/* Wraps the whole site so any CTA can open the modal lead capture,
            not just the ones on the home page. */}
        <LeadCaptureProvider>{children}</LeadCaptureProvider>
      </body>
    </html>
  );
}
