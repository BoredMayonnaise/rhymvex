import type { OrgSettings } from "@/lib/data/org";

/**
 * What each organisation setting actually does.
 *
 * The settings form has always presented six fields as though they were peers,
 * and three of them are not: `company_name` and `timezone` are read by nothing
 * at all, and `notification_email` does not route a single message because the
 * environment variable wins. An admin who changed one got a green confirmation
 * and an audit entry recording the change, and no other observable effect.
 *
 * So the page now states the effect rather than implying it. Where a setting is
 * shadowed by an environment variable, that is detected at render time from the
 * live environment rather than written down here — the two can genuinely
 * disagree, and the page should not be the thing that is wrong.
 *
 * `status`:
 *   live     — read somewhere, and does what you would expect
 *   partial  — read, but only on some surfaces
 *   unsafe   — read, and what it does is quietly wrong; changing it corrupts
 *              figures that are already stored
 *   inert    — read by nothing; changing it changes no behaviour
 */

export type EffectStatus = "live" | "partial" | "unsafe" | "inert";

export type SettingEffect = {
  status: EffectStatus;
  /** Where the value actually turns up. Written for whoever reads the page. */
  applies: string;
  /** What to do about it, if there is anything. */
  caveat?: string;
};

export type EffectMap = Record<keyof OrgSettings, SettingEffect>;

export const EFFECT_LABEL: Record<EffectStatus, string> = {
  live: "In effect",
  partial: "Partly in effect",
  unsafe: "Do not change",
  inert: "Not in effect",
};

/** The value the brand is actually hardcoded to, for the drift check below. */
const BRAND = "Rhymvex";

export function describeSettings(settings: OrgSettings): EffectMap {
  const publicContact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const internalAlerts = process.env.INTERNAL_NOTIFICATION_EMAIL?.trim();

  const contactDiverges = publicContact
    ? publicContact.toLowerCase() !== settings.contact_email.toLowerCase()
    : false;

  const brandChanged = settings.company_name.trim() !== BRAND;

  return {
    response_sla_minutes: {
      status: "live",
      applies:
        "The intake form, and the confirmation email the prospect receives. With it empty, both say a person will be in touch without saying when.",
    },

    currency: {
      status: "live",
      applies:
        "Formats amounts that carry no currency of their own — the lead pipeline, the dashboard, and reports. It does not convert them.",
      caveat:
        "Amounts are never converted. Invoices, proposals and contracts keep their own currency and are unaffected. This should match the currency your existing figures are actually in.",
    },

    reporting_currency: {
      status: "live",
      applies:
        "The converted totals on the accounting page. Empty means no conversion happens at all and every total stays grouped in its own currency.",
      caveat:
        "Conversion uses the rate published on the day each document was raised, and that rate is stored against the document. A total therefore does not move when the market does. Run `npm run fx:backfill` after setting this to convert documents that predate it.",
    },

    contact_email: {
      status: "partial",
      applies: "The contact address on the intake form, and nowhere else.",
      caveat: contactDiverges
        ? `The site footer and the sign-in page show ${publicContact}, read from NEXT_PUBLIC_CONTACT_EMAIL at build time. The two addresses are different, and a change here will not change them.`
        : "The site footer and the sign-in page read NEXT_PUBLIC_CONTACT_EMAIL instead, and are fixed at build time.",
    },

    notification_email: {
      status: "inert",
      applies: "Nothing. Internal alerts are addressed from the environment, not from this row.",
      caveat: internalAlerts
        ? `New-lead alerts and system alerts are going to ${internalAlerts} (INTERNAL_NOTIFICATION_EMAIL), which takes precedence over whatever is set here.`
        : "Internal alerts are going to the fallback in INTERNAL_NOTIFICATION_EMAIL / NEXT_PUBLIC_CONTACT_EMAIL. Set one of those to change where they land.",
    },

    company_name: {
      status: "inert",
      applies:
        "Nothing. Email subjects and footers, invitation copy, page titles and every SEO tag use a brand name fixed in the codebase.",
      caveat: brandChanged
        ? `You have changed this to “${settings.company_name}”, and nothing displays it. Revert it, or ask for the brand to be wired through — until then the only trace is the audit trail.`
        : undefined,
    },

    timezone: {
      status: "inert",
      applies:
        "Nothing. Every date and time in the product is formatted in UTC and labelled as such.",
      caveat:
        "Set the host's timezone to change what people see; this value is stored and never read.",
    },
  };
}

/** Fields that save a value and change no behaviour. */
export function inertFields(effects: EffectMap): Array<keyof OrgSettings> {
  return (Object.keys(effects) as Array<keyof OrgSettings>).filter(
    (key) => effects[key].status === "inert",
  );
}