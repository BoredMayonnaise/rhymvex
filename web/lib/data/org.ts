import { cache } from "react";
import { queryOne } from "@/lib/db/client";
import { envInt } from "@/lib/env";

/** Organisation settings, including the SLA that drives client-facing promises. */

export type OrgSettings = {
  company_name: string;
  contact_email: string;
  notification_email: string;
  response_sla_minutes: number | null;
  timezone: string;
  currency: string;
  /**
   * The currency cross-currency totals are converted into. Null means conversion
   * is switched off and every total stays grouped in its own currency, which is
   * the safe default: nothing is converted unless somebody asks for it.
   */
  reporting_currency: string | null;
};

const FALLBACK: OrgSettings = {
  company_name: "Rhymvex",
  contact_email: "support@rhymvex.space",
  notification_email: "support@rhymvex.space",
  response_sla_minutes: null,
  timezone: "Europe/Lisbon",
  currency: "USD",
  reporting_currency: null,
};

// Wrapped in React's per-request cache: every page reads org settings, and
// without this each one triggers its own query for the same row.
export const getOrgSettings = cache(async (): Promise<OrgSettings> => {
  const row = await queryOne<OrgSettings>(
    "SELECT company_name, contact_email, notification_email, response_sla_minutes, timezone, currency, reporting_currency FROM org_settings WHERE id = true",
  );
  return row ?? FALLBACK;
});

/**
 * The SLA the client is told about.
 *
 * Falls back to the RESPONSE_SLA_MINUTES env var so a deployment can set a
 * promise without a database write. Returns null when neither is configured,
 * which is what suppresses the timing sentence entirely.
 */
export async function getResponseSlaMinutes(): Promise<number | null> {
  const settings = await getOrgSettings();
  if (settings.response_sla_minutes && settings.response_sla_minutes > 0) {
    return settings.response_sla_minutes;
  }
  const fromEnv = envInt("RESPONSE_SLA_MINUTES", 0);
  return fromEnv > 0 ? fromEnv : null;
}
