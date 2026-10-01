import type { Metadata } from "next";
import { HomeView } from "@/components/site/HomeView";

export const metadata: Metadata = {
  title: "Rhymvex — Build with rhythm.",
  description:
    "Brand and product agency. We build the system behind your brand, then hand it over so your team can run it.",
};

/**
 * Statically cached, for the same reason as the locale home pages: authored
 * content with no request data in it, so the cached render is what every visitor
 * gets. Stated explicitly so a shared component gaining a request read fails the
 * build rather than silently making this page dynamic.
 */
export const dynamic = "force-static";

/**
 * The un-prefixed home page.
 *
 * Europe, which is what this URL has always meant. `/eu/` renders the same
 * page, so the bare root stays canonical for the default locale instead of
 * bouncing, and there is one URL per locale rather than two.
 */
export default function Home() {
  return <HomeView />;
}
