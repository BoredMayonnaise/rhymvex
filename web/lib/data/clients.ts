import { query, queryOne } from "@/lib/db/client";
import { isRecordId } from "@/lib/db/ids";

/**
 * Client relationship records.
 *
 * This is the full picture of a client: who they are, who works with them, what
 * is being delivered, what has been agreed, what has been billed, and what has
 * been shared. It is staff-facing, so it includes everything.
 *
 * Portal-facing reads are in `lib/data/portal.ts` and are scoped to one client
 * at the SQL level. Keeping the two apart is what makes the tenant boundary
 * auditable: there is no code path from a client session to these functions.
 */

export type ClientRecord = {
  id: string;
  reference: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  account_manager: string | null;
  // Joined from staff so the page can show a person rather than the uuid. The
  // raw id stays on the record because a form may still need to post it back.
  account_manager_name: string | null;
  lead_id: string | null;
  lead_reference: string | null;
  created_at: Date;
};

export async function getClient(id: string): Promise<ClientRecord | null> {
  if (!isRecordId(id)) return null;
  return queryOne<ClientRecord>(
    `SELECT c.id, c.reference, c.name, c.legal_name, c.industry, c.website, c.phone,
            c.address, c.notes, c.status, c.account_manager, c.lead_id, c.created_at,
            s.name AS account_manager_name, l.reference AS lead_reference
       FROM clients c
       LEFT JOIN staff s ON s.id = c.account_manager
       LEFT JOIN leads l ON l.id = c.lead_id
      WHERE c.id = $1`,
    [id],
  );
}

export async function listClientContacts(clientId: string) {
  return query<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role_title: string | null;
    is_primary: boolean;
  }>(
    `SELECT id, name, email, phone, role_title, is_primary
       FROM client_contacts WHERE client_id = $1
      ORDER BY is_primary DESC, name ASC`,
    [clientId],
  );
}

export async function listClientUsers(clientId: string) {
  return query<{
    id: string;
    name: string;
    email: string;
    role_title: string | null;
    active: boolean;
    last_login_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, name, email, role_title, active, last_login_at, created_at
       FROM client_users WHERE client_id = $1 ORDER BY created_at ASC`,
    [clientId],
  );
}

export async function listClientProjects(clientId: string) {
  return query<{
    id: string;
    name: string;
    status: string;
    progress: number;
    phase: string | null;
    next_step: string | null;
    next_step_due: Date | null;
    target_date: Date | null;
    lead_staff_name: string | null;
  }>(
    `SELECT p.id, p.name, p.status, p.progress, p.phase, p.next_step, p.next_step_due,
            p.target_date, s.name AS lead_staff_name
       FROM projects p LEFT JOIN staff s ON s.id = p.lead_staff_id
      WHERE p.client_id = $1
      ORDER BY p.created_at DESC`,
    [clientId],
  );
}

export async function listClientEngagements(clientId: string) {
  return query<{
    id: string;
    model: string;
    name: string;
    status: string;
    summary: string | null;
    start_date: Date | null;
    end_date: Date | null;
    billing_cycle: string | null;
    value_total: number | null;
  }>(
    `SELECT id, model, name, status, summary, start_date, end_date, billing_cycle, value_total
       FROM engagements WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId],
  );
}

export async function listClientProposals(clientId: string) {
  return query<{
    id: string;
    reference: string;
    title: string;
    status: string;
    model: string | null;
    investment: number | null;
    currency: string;
    sent_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, reference, title, status, model, investment, currency, sent_at, created_at
       FROM proposals WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId],
  );
}

export async function listClientContracts(clientId: string) {
  return query<{
    id: string;
    reference: string;
    title: string;
    status: string;
    value_total: number | null;
    currency: string;
    signed_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, reference, title, status, value_total, currency, signed_at, created_at
       FROM contracts WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId],
  );
}

export async function listClientBookings(clientId: string) {
  return query<{
    id: string;
    title: string;
    kind: string;
    status: string;
    scheduled_for: Date;
    duration_mins: number;
    host_name: string | null;
    location: string | null;
    outcome: string | null;
  }>(
    `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
            b.location, b.outcome, s.name AS host_name
       FROM bookings b LEFT JOIN staff s ON s.id = b.host_id
      WHERE b.client_id = $1 ORDER BY b.scheduled_for DESC`,
    [clientId],
  );
}

export async function listClientInvoices(clientId: string) {
  return query<{
    id: string;
    reference: string;
    description: string;
    amount: number;
    amount_paid: number;
    currency: string;
    status: string;
    issued_at: Date | null;
    due_at: Date | null;
    paid_at: Date | null;
  }>(
    `SELECT id, reference, description, amount, amount_paid, currency, status,
            issued_at, due_at, paid_at
       FROM invoices WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId],
  );
}

export async function listClientFiles(clientId: string) {
  return query<{
    id: string;
    name: string;
    description: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    client_visible: boolean;
    uploaded_at: Date;
    uploader_name: string | null;
    project_name: string | null;
  }>(
    `SELECT f.id, f.name, f.description, f.mime_type, f.size_bytes, f.client_visible,
            f.uploaded_at, s.name AS uploader_name, p.name AS project_name
       FROM files f
       LEFT JOIN staff s ON s.id = f.uploaded_by
       LEFT JOIN projects p ON p.id = f.project_id
      WHERE f.client_id = $1
      ORDER BY f.uploaded_at DESC`,
    [clientId],
  );
}

export async function listClientMessages(clientId: string) {
  return query<{
    id: string;
    subject: string | null;
    body: string;
    created_at: Date;
    from_staff: string | null;
    from_client: string | null;
  }>(
    `SELECT m.id, m.subject, m.body, m.created_at,
            s.name AS from_staff, u.name AS from_client
       FROM messages m
       LEFT JOIN staff s ON s.id = m.from_staff
       LEFT JOIN client_users u ON u.id = m.from_client_user
      WHERE m.client_id = $1
      ORDER BY m.created_at DESC`,
    [clientId],
  );
}

export async function listClientEmails(clientId: string, includeInternal = false) {
  return query<{
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    subject: string;
    from_address: string;
    to_addresses: string[];
    body_text: string;
    status: string;
    client_visible: boolean;
    sent_at: Date | null;
    created_at: Date;
    project_name: string | null;
  }>(
    `SELECT e.id, e.direction, e.subject, e.from_address, e.to_addresses, e.body_text,
            e.status, e.client_visible, e.sent_at, e.created_at, p.name AS project_name
       FROM email_messages e
       LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.client_id = $1
        ${includeInternal ? "" : "AND e.client_visible = true"}
      ORDER BY e.created_at DESC
      LIMIT 200`,
    [clientId],
  );
}

export async function listClientActivity(clientId: string) {
  return query<{
    id: string;
    kind: string;
    title: string;
    detail: string | null;
    occurred_at: Date;
    project_name: string | null;
  }>(
    `SELECT a.id, a.kind, a.title, a.detail, a.occurred_at, p.name AS project_name
       FROM client_activity a
       LEFT JOIN projects p ON p.id = a.project_id
      WHERE a.client_id = $1
      ORDER BY a.occurred_at DESC
      LIMIT 100`,
    [clientId],
  );
}

/** Record a client-safe activity entry. The portal reads only from this table. */
export async function addClientActivity(entry: {
  clientId: string;
  projectId?: string | null;
  kind: string;
  title: string;
  detail?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO client_activity (client_id, project_id, kind, title, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.clientId, entry.projectId ?? null, entry.kind, entry.title, entry.detail ?? null],
  );
}
