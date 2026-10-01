import type { Metadata } from "next";
import IntakeView from "@/components/intake/IntakeView";
import { preferredCurrency } from "@/lib/currency-preference";

/**
 * Root intake metadata. Europe, as it has always been, and the currency follows
 * the visitor rather than the URL, which is why this is generated: the page can
 * be read in English and priced in yen.
 */
export async function generateMetadata(): Promise<Metadata> {
  const currency = await preferredCurrency();
  return {
    title: "Tell us what you're trying to solve",
    description:
      "Tell us the situation and we'll understand it before recommending anything. No package required, no sales call to get a sales call.",
    robots: { index: true, follow: true },
    other: { "price:currency": currency.code } as Record<string, string>,
  };
}

export const dynamic = "force-dynamic";

/** The un-prefixed intake page. Europe, as it has always been. */
export default function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ situation?: string; outcomes?: string; addons?: string; draft?: string }>;
}) {
  return <IntakeView searchParams={searchParams} />;
}
