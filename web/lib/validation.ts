import { z } from "zod";
import { isLocale } from "./locales";
import {
  BAND_KEYS,
  bandLabel,
  bandOptions,
  getCurrency,
  isCurrency,
  type BandKey,
  type Currency,
} from "./currency";

/**
 * Input validation.
 *
 * Every public and privileged payload is parsed here. Parsing produces a
 * trusted, narrowed value; handlers use that value rather than the raw body.
 * Zod strips unknown keys, so an unexpected field can never reach the database.
 *
 * This module is intentionally free of any `node:` import, because the intake
 * form is a client component that imports the option constants below. Reading
 * the environment or the filesystem here would drag server-only modules into
 * the browser bundle. The env-dependent spam guard lives in `lib/spam.ts`.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * Honeypot + minimum fill time.
 *
 * `website_confirm` is a field real people never see. `startedAt` is when the
 * form was rendered, so a request completing in under a second or two is a
 * script. Both are checked in `assertLikelyHuman`.
 */
export const intakeSchema = z.object({
  name: trimmed(120).min(1, "Tell us your name."),
  email: z.string().trim().toLowerCase().email("That email address doesn't look right."),
  company: trimmed(160).optional().default(""),
  role_title: trimmed(120).optional().default(""),
  phone: trimmed(40).optional().default(""),
  website: z.string().trim().max(300).optional().default(""),
  situation: trimmed(200).min(1, "Pick the situation that fits best."),
  message: trimmed(4000).min(20, "A few more words helps us prepare. 20 characters minimum."),
  // The locale the form was rendered for. Defaults to the root locale so a
  // submission from a bare `/intake` post is still accepted.
  region: z
    .string()
    .trim()
    .refine(isLocale, { message: "Unknown locale." })
    .optional()
    .default("en-IE"),
  // The currency the bands were offered in. Distinct from the region: the page
  // can be read in one language and priced in another. Unknown codes fall back
  // rather than being rejected, so a currency retired from the catalogue later
  // does not start failing submissions that were perfectly valid.
  currency: z
    .string()
    .trim()
    .refine(isCurrency, { message: "Unknown currency." })
    .optional()
    .default("EUR"),
  // Normalised band. Preferred over the label, because it is comparable across
  // markets. `budget_band` is still accepted on its own so an older client, or
  // a hand-rolled request, is not rejected over a field it was never given.
  budget_band_key: z
    .union([z.enum(BAND_KEYS), z.literal("")])
    .optional()
    .default(""),
  budget_band: trimmed(60).optional().default(""),
  timeline: trimmed(120).optional().default(""),
  referral_source: trimmed(160).optional().default(""),
  // Honeypot / timing, stripped before persistence.
  website_confirm: z.string().max(0).optional().default(""),
  startedAt: z.number().int().nonnegative().optional(),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/**
 * Reconcile the band a submission carries into a currency-correct label.
 *
 * The form posts the key and the currency, and only the pair is authoritative:
 *
 * - A key is authoritative. The label is rebuilt from the key and the currency,
 *   so a hand-edited request that pairs a real key with a foreign currency label
 *   ("band_3" + "€8,000 – €15,000" with currency `JPY`) is stored as what the
 *   visitor was actually offered rather than as what was asked for.
 * - A label on its own is dropped rather than guessed at. Assigning a band is the
 *   one thing on this form we cannot check, so an unrecognised label records no
 *   band at all, which the column allows.
 *
 * A visitor is free to name a currency other than the one they were shown; they
 * are answering for themselves, and the stored label carries its own symbol, so
 * the lead stays readable either way. The key is what is compared across leads,
 * and `band_1` means the same thing in every market.
 *
 * Returns `null` for the key when there is no usable answer.
 */
export function normaliseBand(input: {
  currency: string;
  budget_band_key: string;
  budget_band: string;
}): { key: BandKey | null; label: string; currency: Currency } {
  const currency = getCurrency(input.currency);

  if (input.budget_band_key) {
    const key = input.budget_band_key as BandKey;
    return { key, label: bandLabel(currency, key), currency };
  }

  return { key: null, label: "", currency };
}

/**
 * The enquiry situations, used both to validate and to render the option list.
 *
 * Framed as states, not packages, so a visitor is never asked to choose a
 * service before we understand the problem.
 *
 * The first three are the `situation` values on the service cards in
 * content/services.json, kept identical on purpose: a visitor who clicks a
 * card's CTA lands here with the matching option already selected, and the
 * two lists cannot drift apart silently. `scripts/sync-content.mjs` does not
 * generate this, so the duplication is deliberate and load-bearing.
 */
export const SITUATIONS = [
  "You need clarity",
  "You need a system that scales",
  "You need ongoing momentum",
  "Something specific",
] as const;

/**
 * The default currency's band labels, kept as a named export because they are
 * what the root `/intake` URL has always offered and what the seeded leads were
 * recorded against. Every other currency reads from `content/currencies.json`.
 */
export const BUDGET_BANDS = bandOptions(getCurrency()).map((band) => band.label);

export const TIMELINES = [
  "As soon as possible",
  "Within a month",
  "This quarter",
  "Just exploring",
] as const;

/* -------------------------------------------------------------------------- */
/* Credentials                                                                */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const acceptInvitationSchema = z
  .object({
    name: trimmed(120).min(1, "Tell us your name."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(200, "Password is too long."),
  })
  .refine(
    (v) => /[a-z]/.test(v.password) && /[A-Z]/.test(v.password) && /[0-9]/.test(v.password),
    { message: "Include a lowercase letter, an uppercase letter and a number.", path: ["password"] },
  );

/* -------------------------------------------------------------------------- */
/* Privileged writes                                                          */
/* -------------------------------------------------------------------------- */

const uuidLike = z.string().uuid();

export const leadUpdateSchema = z.object({
  status: z
    .enum([
      "RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL",
      "NEGOTIATION", "WON", "LOST", "DECLINED", "ARCHIVED",
    ])
    .optional(),
  assigned_to: uuidLike.nullable().optional(),
  recommended_model: z
    .enum(["BRAND_SPRINT", "BRAND_SYSTEM", "RHYTHM_RETAINER", "CUSTOM"])
    .nullable()
    .optional(),
  estimated_value: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  lost_reason: trimmed(500).nullable().optional(),
});

export const leadNoteSchema = z.object({
  body: trimmed(4000).min(1, "Write something first."),
});

export const createClientFromLeadSchema = z.object({
  name: trimmed(160).min(1, "Give the client a name."),
  legal_name: trimmed(200).optional().default(""),
  industry: trimmed(120).optional().default(""),
  account_manager: uuidLike.nullable().optional(),
  // Seed the first engagement from the agreed shape of the work.
  engagement_model: z
    .enum(["BRAND_SPRINT", "BRAND_SYSTEM", "RHYTHM_RETAINER", "CUSTOM"])
    .optional(),
  engagement_name: trimmed(160).optional().default(""),
});

export const clientUpdateSchema = z.object({
  name: trimmed(160).min(1).optional(),
  legal_name: trimmed(200).nullable().optional(),
  industry: trimmed(120).nullable().optional(),
  website: trimmed(300).nullable().optional(),
  phone: trimmed(40).nullable().optional(),
  address: trimmed(300).nullable().optional(),
  notes: trimmed(4000).nullable().optional(),
  status: z.enum(["PROSPECT", "ACTIVE", "DORMANT", "CHURNED"]).optional(),
  account_manager: uuidLike.nullable().optional(),
});

export const staffInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: trimmed(120).min(1, "Enter their name."),
  role: z.enum(["ADMIN", "OPERATIONS", "ACCOUNT_MANAGER", "PROJECT_MANAGER", "DESIGNER", "FINANCE"]),
  permissions: z.array(z.string()).max(40).default([]),
  expires_in_hours: z.coerce.number().int().min(1).max(720).default(72),
});

export const portalInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: trimmed(120).min(1, "Enter their name."),
  role_title: trimmed(120).optional().default(""),
  expires_in_hours: z.coerce.number().int().min(1).max(720).default(168),
});

export const bookingSchema = z.object({
  title: trimmed(160).min(1, "Give the booking a title."),
  kind: z.enum(["DISCOVERY", "CONSULTATION", "REVIEW", "WORKSHOP", "CHECK_IN", "OTHER"]),
  status: z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  scheduled_for: z.string().datetime({ offset: true }).or(z.string().min(10)),
  duration_mins: z.coerce.number().int().min(15).max(480).default(45),
  client_id: uuidLike.nullable().optional(),
  lead_id: uuidLike.nullable().optional(),
  project_id: uuidLike.nullable().optional(),
  host_id: uuidLike.nullable().optional(),
  location: trimmed(200).optional().default(""),
  agenda: trimmed(4000).optional().default(""),
  outcome: trimmed(4000).optional().default(""),
});

export const proposalSchema = z.object({
  client_id: uuidLike.nullable().optional(),
  lead_id: uuidLike.nullable().optional(),
  title: trimmed(200).min(1, "Give the proposal a title."),
  summary: trimmed(4000).optional().default(""),
  model: z.enum(["BRAND_SPRINT", "BRAND_SYSTEM", "RHYTHM_RETAINER", "CUSTOM"]).optional(),
  scope: trimmed(8000).optional().default(""),
  deliverables: z.array(trimmed(300)).max(40).default([]),
  exclusions: z.array(trimmed(300)).max(40).default([]),
  timeline: trimmed(200).optional().default(""),
  investment: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  currency: trimmed(8).default("EUR"),
});

export const contractSchema = z.object({
  client_id: uuidLike.min(1, "Choose a client."),
  title: trimmed(200).min(1, "Give the contract a title."),
  body: trimmed(20000).optional().default(""),
  value_total: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  proposal_id: uuidLike.nullable().optional(),
  project_id: uuidLike.nullable().optional(),
  currency: trimmed(8).default("EUR"),
});

export const projectSchema = z.object({
  client_id: uuidLike.min(1, "Choose a client."),
  name: trimmed(160).min(1, "Name the project."),
  summary: trimmed(4000).optional().default(""),
  status: z
    .enum(["PLANNING", "DISCOVERY", "IN_PROGRESS", "IN_REVIEW", "DELIVERED", "ON_HOLD", "CANCELLED"])
    .default("PLANNING"),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  phase: trimmed(120).optional().default(""),
  next_step: trimmed(300).optional().default(""),
  next_step_due: z.string().optional().nullable(),
  target_date: z.string().optional().nullable(),
  lead_staff_id: uuidLike.nullable().optional(),
  engagement_id: uuidLike.nullable().optional(),
});

export const invoiceSchema = z.object({
  client_id: uuidLike.min(1, "Choose a client."),
  description: trimmed(300).min(1, "Describe what is being invoiced."),
  amount: z.coerce.number().min(0).max(10_000_000),
  amount_paid: z.coerce.number().min(0).max(10_000_000).default(0),
  issued_at: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  project_id: uuidLike.nullable().optional(),
  engagement_id: uuidLike.nullable().optional(),
  payment_reference: trimmed(120).optional().default(""),
  currency: trimmed(8).default("EUR"),
});

export const taskSchema = z.object({
  title: trimmed(200).min(1, "Give the task a title."),
  detail: trimmed(4000).optional().default(""),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).default("OPEN"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  assignee_id: uuidLike.nullable().optional(),
  client_id: uuidLike.nullable().optional(),
  project_id: uuidLike.nullable().optional(),
  lead_id: uuidLike.nullable().optional(),
  due_at: z.string().optional().nullable(),
});

export const libraryItemSchema = z.object({
  title: trimmed(200).min(1, "Give the item a title."),
  kind: z.enum(["DOCUMENT", "TEMPLATE", "FRAMEWORK", "BRAND_ASSET", "REFERENCE"]).default("DOCUMENT"),
  description: trimmed(2000).optional().default(""),
  body: trimmed(20000).optional().default(""),
  tags: z.array(trimmed(40)).max(20).default([]),
  client_id: uuidLike.nullable().optional(),
});

export const outboundEmailSchema = z.object({
  to: z.array(z.string().trim().toLowerCase().email("Check the recipient address.")).min(1, "Add a recipient.").max(20),
  cc: z.array(z.string().trim().toLowerCase().email()).max(20).default([]),
  subject: trimmed(300).min(1, "Add a subject."),
  body: trimmed(40000).min(1, "Write a message."),
  lead_id: uuidLike.nullable().optional(),
  client_id: uuidLike.nullable().optional(),
  project_id: uuidLike.nullable().optional(),
  proposal_id: uuidLike.nullable().optional(),
});

export const messageSchema = z.object({
  subject: trimmed(200).optional().default(""),
  body: trimmed(20000).min(1, "Write a message."),
  project_id: uuidLike.nullable().optional(),
});

export const settingsSchema = z.object({
  company_name: trimmed(120).min(1),
  contact_email: z.string().trim().toLowerCase().email(),
  notification_email: z.string().trim().toLowerCase().email(),
  response_sla_minutes: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  timezone: trimmed(80).min(1),
  currency: trimmed(8).min(1),
});

export const milestoneSchema = z.object({
  title: trimmed(200).min(1, "Give the step a title."),
  detail: trimmed(1000).optional().default(""),
  client_visible: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  completed_at: z.string().optional().nullable(),
});

/** Flatten a Zod error into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
