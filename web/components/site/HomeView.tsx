import { Hero } from "@/components/Hero";
import { Positioning } from "@/components/Positioning";
import { Services } from "@/components/Services";
import { Process } from "@/components/Process";
import { SiteNav } from "@/components/SiteNav";
import { ContactCta } from "@/components/ContactCta";
import { Work } from "@/components/Work";
import { SmoothScroll } from "@/components/SmoothScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";

/**
 * The public home page.
 *
 * Shared by `/` and by every locale prefix (`/[locale]`).
 *
 * Revised structure (engineered around narrative clarity and visual rhythm):
 *   1. Hero: Core thesis, single primary action, token card proof.
 *   2. Positioning: The problem (disconnected identity) and why systems beat logos.
 *   3. Process: 4-step framework with clear deliverables at each phase.
 *   4. Services: 3 packages, situation-first, single primary CTA per card.
 *   5. Work: Honest studio systems (no fabricated metrics or demo clients).
 *   6. Contact: Asymmetric lead capture and direct consultation pathway.
 *   7. Footer: Brand sign-off and waveform motif.
 */
export function HomeView({ locale = DEFAULT_LOCALE }: { locale?: LocaleCode }) {
  return (
    <SmoothScroll>
      <SiteNav locale={locale} />

      <main id="main">
        {/* Thesis: Your brand is a system. Build it like one. */}
        <Hero locale={locale} />

        {/* Diagnosis: Disconnected identity and why systems solve it. */}
        <Positioning locale={locale} />

        {/* Framework: 4 clear phases, transparent pricing and deliverables. */}
        <Process locale={locale} />

        {/* Engagements: Brand audit, brand system, and retainer. */}
        <Services locale={locale} />

        {/* Proof: Studio systems and architecture built and operated by Rhymvex. */}
        <Work locale={locale} />

        {/* Intake: The definitive project intake form. */}
        <ContactCta locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </SmoothScroll>
  );
}
