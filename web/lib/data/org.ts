import { query, queryOne } from "@/lib/db/client";
import { envInt } from "@/lib/env";

/** Organisation settings, including the SLA that drives client-facing promises. */

export type OrgSettings = {
  company_name: string;
  contact_email: string;
  notification_email: string;
  response_sla_minutes: number | null;
  timezone: string;
  currency: string;
};

const FALLBACK: OrgSettings = {
  company_name: "Rhymvex",
  contact_email: "support@rhymvex.space",
  notification_email: "support@rhymvex.space",
  response_sla_minutes: null,
  timezone: "Europe/Lisbon",
  currency: "EUR",
};

export async function getOrgSettings(): Promise<OrgSettings> {
  const row = await queryOne<OrgSettings>(
    "SELECT company_name, contact_email, notification_email, response_sla_minutes, timezone, currency FROM org_settings WHERE id = true",
  );
  return row ?? FALLBACK;
}

/**
 * The SLA the client is told about.
 *
 * Falls back to the RESPONSE_SLA_MINUTES env var so a deployment can set a
 * promise without a database write. Returns null when neither is configured,
 * which is what suppresses the timing sentence entirely.
 */
export async function getResponseSlaMinutes(): Promise<number | null> {
  const row = await queryOne<{ response_sla_minutes: number | null }>(
    "SELECT response_sla_minutes FROM org_settings WHERE id = true",
  );
  const fromDb = row?.response_sla_minutes ?? null;
  if (fromDb && fromDb > 0) return fromDb;
  const fromEnv = envInt("RESPONSE_SLA_MINUTES", 0);
  return fromEnv > 0 ? fromEnv : null;
}
