/**
 * Service packages, sourced from the canonical content file so the site can
 * never drift from docs/business/services-and-pricing.md.
 *
 * Positioning is client-first: the copy leads with the visitor's situation and
 * what an engagement helps them solve, not with a list of deliverables. The
 * three packages sit underneath that framing rather than being the pitch.
 *
 * Pricing in content/services.json is DRAFT until approved.
 */
import servicesData from "../content/services.json";

export type ServicePackage = (typeof servicesData.packages)[number];
export type AddOn = (typeof servicesData.addOns)[number];

export const services = servicesData.packages as readonly ServicePackage[];
export const addOns = servicesData.addOns as readonly AddOn[];
export const servicesIntro = servicesData.intro;
export const addOnsIntro = servicesData.addOnsIntro;
export const servicesClosing = servicesData.closing;
export const paymentTerms = servicesData.payment;
export const servicesStatus = servicesData.meta.status;

export const featuredService = services.find((s) => s.featured) ?? services[0];

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@rhymvex.com";
export const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL ?? "";

/**
 * Always resolves to a bookable URL. Falls back to a pre-filled mailto when
 * NEXT_PUBLIC_CALENDAR_URL is not set, so the primary CTA is never hidden.
 */
export const BOOK_URL =
  CALENDAR_URL ||
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Book a call — Rhymvex")}`;

/**
 * Open enquiry. Asks what's going on rather than which package — the whole
 * point of the positioning is that the visitor doesn't have to know yet.
 */
function openEnquiry(subject: string, opener: readonly string[]) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(
    [
      `Hi Rhymvex,`,
      ``,
      ...opener,
      ``,
      `Here's what's getting in our way:`,
      ``,
      ``,
      `Sent from rhymvex.com`,
    ].join("\n"),
  )}`;
}

export const ENQUIRY_URL = openEnquiry("Tell us what we're trying to solve", [
  "Not sure which engagement this is yet. That's the point.",
]);

/**
 * The card's own CTA. Names the situation the visitor is looking at, then asks
 * for their words on what is blocking them. Nothing is pre-decided for them.
 */
export function buildSituationMailto(pkg: ServicePackage) {
  return openEnquiry(`${pkg.situation} — enquiry`, [
    `I think we're in the "${pkg.situation.toLowerCase()}" situation.`,
  ]);
}

/**
 * Builds the enquiry email for a defined scope. Rendered as a real `href` so the
 * link is inspectable, middle-clickable, and works as a link.
 *
 * The opening line is the visitor's situation rather than a package name, so
 * what arrives in the inbox reads as a conversation starter.
 */
export function buildScopeMailto(
  pkg: ServicePackage,
  chosenOutcomeIds: readonly string[],
  chosenAddOnIds: readonly string[],
) {
  const lines = [
    `Hi Rhymvex,`,
    ``,
    `I think we're in the "${pkg.situation.toLowerCase()}" situation.`,
    ``,
    `Here's what's getting in our way:`,
    ``,
    ``,
    `What I'd like help with:`,
    ...pkg.outcomes
      .filter((o) => o.core || chosenOutcomeIds.includes(o.id))
      .map((o) => `- ${o.label}`),
  ];

  const extras = addOns.filter((a) => chosenAddOnIds.includes(a.id));
  if (extras.length) {
    lines.push(``, `Possibly also useful:`, ...extras.map((a) => `- ${a.name}`));
  }

  lines.push(
    ``,
    `Timeline: ${pkg.duration}`,
    `Engagement: ${pkg.engagement}`,
    `Quoted as: ${pkg.priceNote.toLowerCase()}, against this scope`,
    ``,
    `Sent from rhymvex.com`,
  );

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `${pkg.situation} — enquiry`,
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
}
