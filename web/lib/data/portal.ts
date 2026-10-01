import { query, queryOne } from "@/lib/db/client";
import type { ClientSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";

/**
 * Client portal data access.
 *
 * Every function here takes the session and takes the client id from it, never
 * from a route parameter. That is the tenant boundary: a portal query cannot be
 * written against "whatever id was in the URL", so swapping an id in the address
 * bar cannot reach another client's records. Staff reads live in
 * `lib/data/clients.ts` and are not reachable from a client session.
 *
 * The same principle applies to filtering within a tenant: files, emails and
 * activity are filtered to what is client-safe, not merely to what belongs to
 * this client.
 */

export type PortalProject = {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  progress: number;
  phase: string | null;
  next_step: string | null;
  next_step_due: Date | null;
  target_date: Date | null;
  start_date: Date | null;
};

export type PortalMilestone = {
  id: string;
  project_id: string;
  title: string;
  detail: string | null;
  sort_order: number;
  completed_at: Date | null;
};

export async function listPortalProjects(session: ClientSession): Promise<PortalProject[]> {
  return query<PortalProject>(
    `SELECT id, name, summary, status, progress, phase, next_step, next_step_due,
            target_date, start_date
       FROM projects
      WHERE client_id = $1
      ORDER BY
        CASE status WHEN 'IN_REVIEW' THEN 0 WHEN 'IN_PROGRESS' THEN 1
                    WHEN 'DISCOVERY' THEN 2 WHEN 'PLANNING' THEN 3 ELSE 4 END,
        created_at DESC`,
    [session.clientId],
  );
}

/**
 * Fetch one project, scoped to the session's client.
 *
 * Returns null when the id does not belong to this client, which the page turns
 * into a 404. An id belonging to someone else is indistinguishable from one
 * that does not exist, so the portal cannot be used to probe for valid ids.
 */
export async function getPortalProject(
  session: ClientSession,
  projectId: string,
): Promise<PortalProject | null> {
  if (!isRecordId(projectId)) return null;
  return queryOne<PortalProject>(
    `SELECT id, name, summary, status, progress, phase, next_step, next_step_due,
            target_date, start_date
       FROM projects WHERE id = $1 AND client_id = $2`,
    [projectId, session.clientId],
  );
}

export async function listProjectMilestones(
  session: ClientSession,
  projectId: string,
): Promise<PortalMilestone[]> {
  if (!isRecordId(projectId)) return [];
  return query<PortalMilestone>(
    `SELECT m.id, m.project_id, m.title, m.detail, m.sort_order, m.completed_at
       FROM project_milestones m
       JOIN projects p ON p.id = m.project_id
      WHERE m.project_id = $1
        AND p.client_id = $2
        AND m.client_visible = true
      ORDER BY m.sort_order, m.created_at`,
    [projectId, session.clientId],
  );
}

export type PortalOverview = {
  projects: PortalProject[];
  primary: PortalProject | null;
  nextBooking: {
    id: string;
    title: string;
    kind: string;
    scheduled_for: Date;
    duration_mins: number;
    host_name: string | null;
    location: string | null;
  } | null;
  recentActivity: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string | null;
    occurred_at: Date;
    project_name: string | null;
  }>;
  outstanding: number;
  unpaidInvoices: number;
  openProposals: number;
  unsignedContracts: number;
  unreadMessages: number;
};

export async function getPortalOverview(session: ClientSession): Promise<PortalOverview> {
  const projects = await listPortalProjects(session);

  const [booking, activity, money, proposals, contracts, unread] = await Promise.all([
    queryOne<{
      id: string;
      title: string;
      kind: string;
      scheduled_for: Date;
      duration_mins: number;
      host_name: string | null;
      location: string | null;
    }>(
      `SELECT b.id, b.title, b.kind, b.scheduled_for, b.duration_mins, b.location,
              s.name AS host_name
         FROM bookings b LEFT JOIN staff s ON s.id = b.host_id
        WHERE b.client_id = $1 AND b.status = 'CONFIRMED' AND b.scheduled_for >= now()
        ORDER BY b.scheduled_for ASC LIMIT 1`,
      [session.clientId],
    ),
    query<{
      id: string;
      kind: string;
      title: string;
      detail: string | null;
      occurred_at: Date;
      project_name: string | null;
    }>(
      `SELECT a.id, a.kind, a.title, a.detail, a.occurred_at, p.name AS project_name
         FROM client_activity a LEFT JOIN projects p ON p.id = a.project_id
        WHERE a.client_id = $1
        ORDER BY a.occurred_at DESC LIMIT 8`,
      [session.clientId],
    ),
    queryOne<{ outstanding: number; unpaid: number }>(
      `SELECT coalesce(sum(amount - amount_paid) FILTER (WHERE status IN ('SENT','VIEWED','OVERDUE')), 0)::float AS outstanding,
              count(*) FILTER (WHERE status IN ('SENT','VIEWED','OVERDUE'))::int AS unpaid
         FROM invoices WHERE client_id = $1`,
      [session.clientId],
    ),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM proposals WHERE client_id = $1 AND status IN ('SENT','VIEWED')",
      [session.clientId],
    ),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM contracts WHERE client_id = $1 AND status IN ('SENT','AWAITING_SIGNATURE')",
      [session.clientId],
    ),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM messages WHERE client_id = $1 AND from_staff IS NOT NULL AND read_at IS NULL",
      [session.clientId],
    ),
  ]);

  return {
    projects,
    // The project a client cares about is the one still moving, not the newest.
    primary:
      projects.find((p) => ["IN_REVIEW", "IN_PROGRESS", "DISCOVERY", "PLANNING"].includes(p.status)) ??
      projects[0] ??
      null,
    nextBooking: booking,
    recentActivity: activity,
    outstanding: money?.outstanding ?? 0,
    unpaidInvoices: money?.unpaid ?? 0,
    openProposals: proposals?.count ?? 0,
    unsignedContracts: contracts?.count ?? 0,
    unreadMessages: unread?.count ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Client-safe collections                                                    */
/* -------------------------------------------------------------------------- */

export async function listPortalProposals(session: ClientSession) {
  return query<{
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    model: string | null;
    scope: string | null;
    deliverables: string[];
    exclusions: string[];
    timeline: string | null;
    investment: number | null;
    currency: string;
    status: string;
    sent_at: Date | null;
  }>(
    `SELECT id, reference, title, summary, model, scope, deliverables, exclusions,
            timeline, investment, currency, status, sent_at
       FROM proposals
      WHERE client_id = $1 AND status <> 'DRAFT'
      ORDER BY sent_at DESC NULLS LAST, created_at DESC`,
    [session.clientId],
  );
}

export async function getPortalProposal(session: ClientSession, proposalId: string) {
  return queryOne<{
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    model: string | null;
    scope: string | null;
    deliverables: string[];
    exclusions: string[];
    timeline: string | null;
    investment: number | null;
    currency: string;
    status: string;
    sent_at: Date | null;
  }>(
    `SELECT id, reference, title, summary, model, scope, deliverables, exclusions,
            timeline, investment, currency, status, sent_at
       FROM proposals WHERE id = $1 AND client_id = $2 AND status <> 'DRAFT'`,
    [proposalId, session.clientId],
  );
}

export async function listPortalContracts(session: ClientSession) {
  return query<{
    id: string;
    reference: string;
    title: string;
    body: string | null;
    status: string;
    value_total: number | null;
    currency: string;
    sent_at: Date | null;
    signed_at: Date | null;
  }>(
    `SELECT id, reference, title, body, status, value_total, currency, sent_at, signed_at
       FROM contracts WHERE client_id = $1 AND status <> 'DRAFT'
      ORDER BY sent_at DESC NULLS LAST, created_at DESC`,
    [session.clientId],
  );
}

export async function listPortalBookings(session: ClientSession) {
  return query<{
    id: string;
    title: string;
    kind: string;
    status: string;
    scheduled_for: Date;
    duration_mins: number;
    location: string | null;
    host_name: string | null;
    agenda: string | null;
  }>(
    `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
            b.location, b.agenda, s.name AS host_name
       FROM bookings b LEFT JOIN staff s ON s.id = b.host_id
      WHERE b.client_id = $1
      ORDER BY b.scheduled_for DESC`,
    [session.clientId],
  );
}

export async function listPortalInvoices(session: ClientSession) {
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
       FROM invoices WHERE client_id = $1 AND status <> 'DRAFT'
      ORDER BY created_at DESC`,
    [session.clientId],
  );
}

/** Only files explicitly marked client_visible. Internal files never appear. */
export async function listPortalFiles(session: ClientSession) {
  return query<{
    id: string;
    name: string;
    description: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    uploaded_at: Date;
    project_name: string | null;
  }>(
    `SELECT f.id, f.name, f.description, f.mime_type, f.size_bytes, f.uploaded_at,
            p.name AS project_name
       FROM files f LEFT JOIN projects p ON p.id = f.project_id
      WHERE f.client_id = $1 AND f.client_visible = true
      ORDER BY f.uploaded_at DESC`,
    [session.clientId],
  );
}

/** Only client-safe email. Internal alerts are excluded by the filter. */
export async function listPortalEmails(session: ClientSession) {
  return query<{
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    subject: string;
    from_address: string;
    to_addresses: string[];
    body_text: string;
    sent_at: Date | null;
    created_at: Date;
    project_name: string | null;
  }>(
    `SELECT e.id, e.direction, e.subject, e.from_address, e.to_addresses, e.body_text,
            e.sent_at, e.created_at, p.name AS project_name
       FROM email_messages e LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.client_id = $1 AND e.client_visible = true
      ORDER BY e.created_at DESC LIMIT 100`,
    [session.clientId],
  );
}

export async function listPortalMessages(session: ClientSession) {
  return query<{
    id: string;
    subject: string | null;
    body: string;
    created_at: Date;
    read_at: Date | null;
    from_staff: string | null;
    from_client: string | null;
  }>(
    `SELECT m.id, m.subject, m.body, m.created_at, m.read_at,
            s.name AS from_staff, u.name AS from_client
       FROM messages m
       LEFT JOIN staff s ON s.id = m.from_staff
       LEFT JOIN client_users u ON u.id = m.from_client_user
      WHERE m.client_id = $1
      ORDER BY m.created_at DESC LIMIT 100`,
    [session.clientId],
  );
}

/** Mark a thread read for the requesting user only, scoped to their client. */
export async function markMessagesRead(
  session: ClientSession,
  messageIds: readonly string[],
): Promise<number> {
  // Anything that is not a uuid is dropped rather than passed to Postgres,
  // where it would raise an invalid-input-syntax error instead of matching none.
  const ids = messageIds.filter(isRecordId);
  if (ids.length === 0) return 0;
  const rows = await query<{ id: string }>(
    `UPDATE messages SET read_at = now()
      WHERE client_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL
      RETURNING id`,
    [session.clientId, ids],
  );
  return rows.length;
}

export async function getPortalProfile(session: ClientSession) {
  return queryOne<{
    id: string;
    name: string;
    email: string;
    role_title: string | null;
    last_login_at: Date | null;
    created_at: Date;
    client_name: string;
    client_status: string;
  }>(
    `SELECT u.id, u.name, u.email, u.role_title, u.last_login_at, u.created_at,
            c.name AS client_name, c.status AS client_status
       FROM client_users u JOIN clients c ON c.id = u.client_id
      WHERE u.id = $1 AND u.client_id = $2`,
    [session.clientUserId, session.clientId],
  );
}
