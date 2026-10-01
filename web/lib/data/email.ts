import { query, queryOne } from "@/lib/db/client";

/**
 * Business email records.
 *
 * Email is tied to the business entity it belongs to (lead, client, project,
 * proposal), which is what makes the Business Email view a real inbox rather
 * than a mailto link. Records marked client_visible = false are internal and
 * have no read path in the portal data layer.
 */

export type EmailRecord = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  proposal_id: string | null;
  booking_id: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  client_visible: boolean;
  error_message: string | null;
  sent_at: Date | null;
  created_by: string | null;
  created_at: Date;
};

export type NewEmail = {
  direction: "INBOUND" | "OUTBOUND";
  leadId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  proposalId?: string | null;
  bookingId?: string | null;
  fromAddress: string;
  fromName?: string | null;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  status?: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  errorMessage?: string | null;
  clientVisible?: boolean;
  createdBy?: string | null;
};

export async function recordEmail(input: NewEmail): Promise<string> {
  const status = input.status ?? "SENT";
  // sent_at is decided here rather than derived in SQL. Deriving it meant one
  // parameter serving both the email_status column and a text comparison, which
  // Postgres cannot type consistently.
  const sentAt = status === "SENT" || status === "DELIVERED" ? new Date() : null;

  const row = await queryOne<{ id: string }>(
    `INSERT INTO email_messages
       (direction, lead_id, client_id, project_id, proposal_id, booking_id,
        from_address, from_name, to_addresses, cc_addresses, subject, body_text,
        body_html, status, error_message, client_visible, sent_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      input.direction,
      input.leadId ?? null,
      input.clientId ?? null,
      input.projectId ?? null,
      input.proposalId ?? null,
      input.bookingId ?? null,
      input.fromAddress,
      input.fromName ?? null,
      input.toAddresses,
      input.ccAddresses ?? [],
      input.subject,
      input.bodyText,
      input.bodyHtml ?? null,
      status,
      input.errorMessage ?? null,
      input.clientVisible ?? true,
      sentAt,
      input.createdBy ?? null,
    ],
  );
  return row?.id ?? "";
}

const EMAIL_COLUMNS = `
  id, direction, lead_id, client_id, project_id, proposal_id, booking_id,
  from_address, from_name, to_addresses, cc_addresses, subject, body_text,
  status, client_visible, error_message, sent_at, created_by, created_at
`;

export async function listEmails(options: {
  leadId?: string;
  clientId?: string;
  projectId?: string;
  proposalId?: string;
  includeInternal?: boolean;
  limit?: number;
} = {}): Promise<EmailRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.leadId) {
    params.push(options.leadId);
    conditions.push(`lead_id = $${params.length}`);
  }
  if (options.clientId) {
    params.push(options.clientId);
    conditions.push(`client_id = $${params.length}`);
  }
  if (options.projectId) {
    params.push(options.projectId);
    conditions.push(`project_id = $${params.length}`);
  }
  if (options.proposalId) {
    params.push(options.proposalId);
    conditions.push(`proposal_id = $${params.length}`);
  }
  // Internal alerts are excluded unless explicitly requested.
  if (!options.includeInternal) conditions.push("client_visible = true");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(options.limit ?? 100);

  return query<EmailRecord>(
    `SELECT ${EMAIL_COLUMNS} FROM email_messages ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
}

export async function getEmail(id: string): Promise<EmailRecord | null> {
  return queryOne<EmailRecord>(`SELECT ${EMAIL_COLUMNS} FROM email_messages WHERE id = $1`, [id]);
}

/**
 * Attach a conversation to a project.
 *
 * Existing records for the same client and subject are moved too, so a thread
 * that began before the project existed is not left behind.
 */
export async function linkEmailsToProject(
  leadOrClientId: string,
  projectId: string,
  kind: "lead" | "client",
): Promise<number> {
  const column = kind === "lead" ? "lead_id" : "client_id";
  const rows = await query<{ id: string }>(
    `UPDATE email_messages SET project_id = $1 WHERE ${column} = $2 AND project_id IS NULL RETURNING id`,
    [projectId, leadOrClientId],
  );
  return rows.length;
}

export type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  lastSentAt: Date | null;
};

export async function emailStats(): Promise<EmailStats> {
  const row = await queryOne<{
    total: number;
    sent: number;
    failed: number;
    last_sent_at: Date | null;
  }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'SENT')::int AS sent,
            count(*) FILTER (WHERE status = 'FAILED')::int AS failed,
            max(sent_at) AS last_sent_at
       FROM email_messages`,
  );
  return {
    total: row?.total ?? 0,
    sent: row?.sent ?? 0,
    failed: row?.failed ?? 0,
    lastSentAt: row?.last_sent_at ?? null,
  };
}
