import { query, queryOne, tx } from "@/lib/db/client";
import { isRecordId } from "@/lib/db/ids";
import { uniqueReference } from "@/lib/db/reference";

/**
 * Lead data access.
 *
 * Leads are prospects created by the public intake. They are deliberately not
 * clients: conversion is a human decision, made through `convertLeadToClient`.
 */

export type LeadStatus =
  | "RECEIVED" | "REVIEWING" | "QUALIFIED" | "CONSULTATION" | "PROPOSAL"
  | "NEGOTIATION" | "WON" | "LOST" | "DECLINED" | "ARCHIVED";

export const LEAD_STATUSES: LeadStatus[] = [
  "RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL",
  "NEGOTIATION", "WON", "LOST", "DECLINED", "ARCHIVED",
];

/** Statuses that count as still-open work. Used for pipeline value. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION",
];

export const CLOSED_LEAD_STATUSES: LeadStatus[] = ["WON", "LOST", "DECLINED", "ARCHIVED"];

/**
 * Status that need attention rather than deliberate management. These are what
 * the admin overview surfaces under NEW LEADS.
 */
export const NEW_LEAD_STATUSES: LeadStatus[] = ["RECEIVED"];

export type Lead = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role_title: string | null;
  website: string | null;
  situation: string;
  message: string;
  budget_band: string | null;
  timeline: string | null;
  referral_source: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  assigned_name: string | null;
  client_id: string | null;
  recommended_model: string | null;
  estimated_value: number | null;
  score: number | null;
  source: string;
  submitted_at: Date;
  updated_at: Date;
  last_contacted_at: Date | null;
  lost_reason: string | null;
};

const LEAD_COLUMNS = `
  l.id, l.reference, l.name, l.email, l.phone, l.company, l.role_title, l.website,
  l.situation, l.message, l.budget_band, l.timeline, l.referral_source,
  l.status, l.assigned_to, s.name AS assigned_name, l.client_id,
  l.recommended_model, l.estimated_value, l.score, l.source,
  l.submitted_at, l.updated_at, l.last_contacted_at, l.lost_reason
`;

export type NewLead = {
  name: string;
  email: string;
  company?: string | null;
  role_title?: string | null;
  phone?: string | null;
  website?: string | null;
  situation: string;
  message: string;
  budget_band?: string | null;
  timeline?: string | null;
  referral_source?: string | null;
  source?: string;
  submissionIp?: string | null;
  userAgent?: string | null;
};

/**
 * Create a lead and its "received" audit entry in one transaction, so a lead
 * can never exist without the record of how it arrived.
 */
export async function createLead(input: NewLead): Promise<Lead> {
  return tx(async (client) => {
    const reference = await uniqueReference("leads", "LEAD");

    const { rows } = await client.query(
      `INSERT INTO leads
         (reference, name, email, phone, company, role_title, website,
          situation, message, budget_band, timeline, referral_source,
          status, source, submission_ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'RECEIVED',$13,$14,$15)
       RETURNING id`,
      [
        reference,
        input.name,
        input.email,
        input.phone || null,
        input.company || null,
        input.role_title || null,
        input.website || null,
        input.situation,
        input.message,
        input.budget_band || null,
        input.timeline || null,
        input.referral_source || null,
        input.source || "website-intake",
        input.submissionIp ?? null,
        input.userAgent ?? null,
      ],
    );

    const id = rows[0].id as string;

    await client.query(
      `INSERT INTO audit_log
         (actor_type, actor_label, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ('anonymous', $1, 'lead.received', 'lead', $2, $3::jsonb, $4, $5)`,
      [
        input.name,
        id,
        JSON.stringify({
          reference,
          email: input.email,
          company: input.company || null,
          situation: input.situation,
          source: input.source || "website-intake",
        }),
        input.submissionIp ?? null,
        input.userAgent ?? null,
      ],
    );

    const { rows: full } = await client.query(
      `SELECT ${LEAD_COLUMNS} FROM leads l LEFT JOIN staff s ON s.id = l.assigned_to WHERE l.id = $1`,
      [id],
    );
    return full[0] as Lead;
  });
}

export async function getLead(id: string): Promise<Lead | null> {
  if (!isRecordId(id)) return null;
  return queryOne<Lead>(
    `SELECT ${LEAD_COLUMNS} FROM leads l LEFT JOIN staff s ON s.id = l.assigned_to WHERE l.id = $1`,
    [id],
  );
}

export type LeadListOptions = {
  status?: LeadStatus[];
  assignedTo?: string | null;
  unassignedOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listLeads(options: LeadListOptions = {}): Promise<Lead[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status?.length) {
    params.push(options.status);
    conditions.push(`l.status = ANY($${params.length}::lead_status[])`);
  }
  if (options.assignedTo) {
    params.push(options.assignedTo);
    conditions.push(`l.assigned_to = $${params.length}`);
  }
  if (options.unassignedOnly) {
    conditions.push("l.assigned_to IS NULL");
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(
      `(l.name ILIKE $${params.length} OR l.company ILIKE $${params.length} OR l.email ILIKE $${params.length} OR l.reference ILIKE $${params.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(options.limit ?? 100);
  params.push(options.offset ?? 0);

  return query<Lead>(
    `SELECT ${LEAD_COLUMNS}
       FROM leads l
       LEFT JOIN staff s ON s.id = l.assigned_to
       ${where}
      ORDER BY l.submitted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function countLeads(options: LeadListOptions = {}): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status?.length) {
    params.push(options.status);
    conditions.push(`l.status = ANY($${params.length}::lead_status[])`);
  }
  if (options.assignedTo) {
    params.push(options.assignedTo);
    conditions.push(`l.assigned_to = $${params.length}`);
  }
  if (options.unassignedOnly) conditions.push("l.assigned_to IS NULL");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM leads l ${where}`,
    params,
  );
  return row?.count ?? 0;
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  await query("UPDATE leads SET status = $1, updated_at = now() WHERE id = $2", [status, id]);
}

export async function assignLead(id: string, staffId: string | null): Promise<void> {
  await query("UPDATE leads SET assigned_to = $1, updated_at = now() WHERE id = $2", [staffId, id]);
}

export async function addLeadNote(
  leadId: string,
  body: string,
  author: { id: string | null; name: string },
): Promise<{ id: string; created_at: Date }> {
  const row = await queryOne<{ id: string; created_at: Date }>(
    `INSERT INTO lead_notes (lead_id, author_id, author_name, body)
     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
    [leadId, author.id, author.name, body],
  );
  return row ?? { id: "", created_at: new Date() };
}

export type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: Date;
};

export async function listLeadNotes(leadId: string): Promise<LeadNote[]> {
  if (!isRecordId(leadId)) return [];
  return query<LeadNote>(
    "SELECT id, lead_id, author_id, author_name, body, created_at FROM lead_notes WHERE lead_id = $1 ORDER BY created_at DESC",
    [leadId],
  );
}

/** Pipeline value: open leads with an estimate, plus anything awaiting decision. */
export async function pipelineValue(): Promise<{ total: number; count: number }> {
  const row = await queryOne<{ total: number | null; count: number }>(
    `SELECT sum(estimated_value)::float AS total, count(*)::int AS count
       FROM leads
      WHERE status = ANY($1::lead_status[]) AND estimated_value IS NOT NULL`,
    [OPEN_LEAD_STATUSES],
  );
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}
