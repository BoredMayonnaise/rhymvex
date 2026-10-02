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
import { intakeHref } from "./locales";

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
 * The public origin, for absolute URLs the site has to state rather than link:
 * canonicals, hreflang, the sitemap.
 *
 * Defaults to the real domain rather than localhost, because these strings are
 * read by crawlers and a canonical pointing at a dev machine is worse than no
 * canonical. Trailing slashes are stripped so callers can append a path without
 * producing a double slash. Note this is distinct from `siteUrl()` in
 * lib/mail/smtp, which deliberately defaults to localhost: a link in an email
 * should point at wherever the app is actually running.
 */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rhymvex.com"
).replace(/\/+$/, "");

/**
 * The primary contact path.
 *
 * Requests go to the in-site intake form, which records a lead in the platform
 * and sends confirmation through the backend. A mailto is deliberately not the
 * fallback: it drops the request into an inbox with no lead record, no
 * assignment, and no audit trail, which is the workflow this platform replaces.
 *
 * The locale is part of the path, because the form it opens is priced in that
 * locale. `ENQUIRY_URL` stays as the default locale for callers that have no
 * locale to hand, which is what the un-prefixed pages use.
 */
export const ENQUIRY_URL = intakeHref();

/** On-site calendar if one is configured, otherwise the intake form. */
export const BOOK_URL = CALENDAR_URL || intakeHref();

/** The primary contact path for a locale. */
export function enquiryUrl(region?: string | null): string {
  return CALENDAR_URL || intakeHref(region);
}

/** Intake link for a situation in a locale, used by the service cards. */
export function buildSituationIntake(pkg: ServicePackage, region?: string | null): string {
  return intakeHref(region, { situation: pkg.situation });
}

/**
 * Intake link for a drafted scope, used by the scope builder.
 *
 * The visitor's chosen outcomes and add-ons arrive as ids, are resolved to
 * labels server-side, and prefill the message field as editable text. Nothing
 * is locked in: they can change it, and it lands as their words, not ours.
 */
export function buildScopeIntake(
  _pkg: ServicePackage,
  chosenOutcomeIds: readonly string[],
  chosenAddOnIds: readonly string[],
  region?: string | null,
): string {
  const params: Record<string, string | undefined> = {
    situation: _pkg.situation,
    outcomes: chosenOutcomeIds.length ? chosenOutcomeIds.join(",") : undefined,
    addons: chosenAddOnIds.length ? chosenAddOnIds.join(",") : undefined,
  };
  // Only mark the message as a draft when there is something to draft from.
  if (chosenOutcomeIds.length || chosenAddOnIds.length) params.draft = "1";
  return intakeHref(region, params);
}

/**
 * Resolve a drafted scope back into message text. Runs server-side so the ids
 * never reach the client, and so a tampered query string cannot inject copy
 * into the lead record.
 */
export function draftFromIds(
  pkg: ServicePackage | null,
  outcomeIds: string,
  addonIds: string,
): string | null {
  const wantedOutcomes = new Set(
    outcomeIds.split(",").map((s) => s.trim()).filter(Boolean),
  );
  const wantedAddOns = new Set(
    addonIds.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (wantedOutcomes.size === 0 && wantedAddOns.size === 0) return null;

  const lines: string[] = [];
  if (pkg) {
    lines.push(`We're in the "${pkg.situation.toLowerCase()}" situation.`);
  }

  if (wantedOutcomes.size > 0 && pkg) {
    const chosen = pkg.outcomes.filter(
      (o) => o.core || wantedOutcomes.has(o.id),
    );
    if (chosen.length) {
      lines.push("", "What we'd like help with:");
      for (const outcome of chosen) lines.push(`- ${outcome.label}`);
    }
  }

  const extras = addOns.filter((a) => wantedAddOns.has(a.id));
  if (extras.length) {
    lines.push("", "Possibly also useful:");
    for (const addOn of extras) lines.push(`- ${addOn.name}`);
  }

  if (pkg) {
    lines.push("", `Likely shape: ${pkg.duration}, ${pkg.engagement.toLowerCase()}.`);
  }

  lines.push("", "What's getting in our way:");
  return lines.join("\n");
}
