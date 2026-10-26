"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { settingsSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./leads";

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("settings.write")) {
    return { ok: false, error: "Your role cannot change settings." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const rawSla = String(formData.get("response_sla_minutes") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    company_name: formData.get("company_name"),
    contact_email: formData.get("contact_email"),
    notification_email: formData.get("notification_email"),
    // Empty means "no promise", which is a real and deliberate setting.
    response_sla_minutes: rawSla === "" ? null : Number(rawSla),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    reporting_currency: formData.get("reporting_currency") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the settings.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  // Read what is in force first so the trail can say what actually moved.
  // The addresses matter most here: `notification_email` is where internal
  // alerts and the workspace sign-in link go, and an audit entry that omits it
  // cannot answer "who redirected our mail, and when".
  const before = await queryOne<{
    company_name: string;
    contact_email: string;
    notification_email: string;
    currency: string;
  }>(
    `SELECT company_name, contact_email, notification_email, currency
       FROM org_settings WHERE id = true`,
  );

  const nextCurrency = data.currency.toUpperCase();
  const currencyMoved = Boolean(before && before.currency !== nextCurrency);

  await query(
    `INSERT INTO org_settings
       (id, company_name, contact_email, notification_email, response_sla_minutes, timezone, currency, reporting_currency, updated_at)
     VALUES (true, $1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       contact_email = EXCLUDED.contact_email,
       notification_email = EXCLUDED.notification_email,
       response_sla_minutes = EXCLUDED.response_sla_minutes,
       timezone = EXCLUDED.timezone,
       currency = EXCLUDED.currency,
       reporting_currency = EXCLUDED.reporting_currency,
       updated_at = now()`,
    [
      data.company_name,
      data.contact_email,
      data.notification_email,
      // 0 is normalised to null so "no promise" has exactly one representation.
      data.response_sla_minutes ? data.response_sla_minutes : null,
      data.timezone,
      data.currency.toUpperCase(),
      data.reporting_currency,
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "settings.updated",
      entityType: "org_settings",
      entityId: null,
      metadata: {
        response_sla_minutes: data.response_sla_minutes || null,
        currency: data.currency.toUpperCase(),
        // Only the fields that actually moved, so the entry reads as a diff
        // rather than a wall of the whole settings row on every save.
        ...addressChanges(before, data),
        ...currencyChange(before?.currency ?? null, nextCurrency),
      },
      ...meta,
    },
  );

  revalidatePath("/admin/settings");
  revalidatePath("/intake");
  revalidatePath("/admin");

  // Currency is the one field whose effect is not visible where it was
  // changed, so it is called out separately rather than folded into a generic
  // "saved" that reads as though nothing consequential happened.
  if (currencyMoved && before) {
    return {
      ok: true,
      message: `Saved. Currency is now ${before.currency} → ${nextCurrency}. Existing amounts were not converted — totals that carry no currency of their own are now shown in ${nextCurrency}.`,
    };
  }

  return {
    ok: true,
    message: data.response_sla_minutes
      ? `Saved. Clients will now be told a person replies within ${data.response_sla_minutes} minutes.`
      : "Saved. No response-time promise is made to clients.",
  };
}

/**
 * Whether the currency display default actually moved.
 *
 * Read from the same `before` snapshot as the address diff, so the warning and
 * the audit entry can never disagree about what changed.
 */
function currencyChange(
  from: string | null,
  to: string,
): { currencyFrom?: string; currencyTo?: string } {
  if (!from || from === to) return {};
  return { currencyFrom: from, currencyTo: to };
}

/**
 * Which of the contact addresses actually moved.
 *
 * Returned as a flat `field: {from, to}` map rather than the new values alone,
 * because "what did it used to say" is the half an incident review actually
 * needs.
 */
function addressChanges(
  before: { company_name: string; contact_email: string; notification_email: string } | null,
  next: { company_name: string; contact_email: string; notification_email: string },
): Record<string, { from: string; to: string }> {
  if (!before) return {};
  const fields = ["company_name", "contact_email", "notification_email"] as const;
  const changed: Record<string, { from: string; to: string }> = {};
  for (const field of fields) {
    if (before[field] !== next[field]) {
      changed[field] = { from: before[field], to: next[field] };
    }
  }
  return changed;
}
