import { query, queryOne } from "@/lib/db/client";

/**
 * Workspace queries.
 *
 * Admin-side aggregates. Everything the overview and section pages need, kept
 * out of the page components so the rendering stays presentational.
 *
 * Client-portal reads deliberately do not live here: they are in
 * `lib/data/portal.ts` and are scoped to a session's client id at the query
 * level, so a portal query cannot accidentally omit its tenant filter.
 */

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export type Overview = {
  pipelineValue: number;
  openLeadCount: number;
  newLeadCount: number;
  activeProjectCount: number;
  collectedRevenue: number;
  outstandingRevenue: number;
  wonThisQuarter: number;
  upcomingBookings: BookingSummary[];
  newLeads: NewLeadSummary[];
  recentActivity: ActivityItem[];
  myFocus: FocusItem[];
  deliveryPulse: DeliveryPulse;
  statusMix: StatusMixRow[];
};

export type BookingSummary = {
  id: string;
  title: string;
  kind: string;
  status: string;
  scheduled_for: Date;
  duration_mins: number;
  host_name: string | null;
  client_name: string | null;
  lead_name: string | null;
};

export type NewLeadSummary = {
  id: string;
  name: string;
  company: string | null;
  situation: string;
  status: string;
  submitted_at: Date;
  estimated_value: number | null;
};

export type ActivityItem = {
  id: string;
  actor_label: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  occurred_at: Date;
};

export type FocusItem = {
  kind: "lead" | "task" | "booking" | "proposal";
  title: string;
  meta: string;
  href: string;
  when: Date | null;
};

export type DeliveryPulse = {
  active: number;
  inReview: number;
  blocked: number;
  deliveredThisMonth: number;
  /** Load per active project manager, for spotting who is over capacity. */
  byOwner: Array<{ name: string; active: number }>;
};

export type StatusMixRow = { status: string; count: number; value: number };

export async function getOverview(staffId: string): Promise<Overview> {
  const [
    pipeline,
    leadCounts,
    projectCount,
    revenue,
    bookings,
    newLeads,
    activity,
    focus,
    pulse,
    statusMix,
  ] = await Promise.all([
    queryOne<{ total: number | null; count: number }>(
      `SELECT sum(estimated_value)::float AS total, count(*)::int AS count
         FROM leads WHERE status = ANY($1::lead_status[]) AND estimated_value IS NOT NULL`,
      [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
    ),
    queryOne<{ open: number; fresh: number }>(
      `SELECT
         count(*) FILTER (WHERE status = ANY($1::lead_status[]))::int AS open,
         count(*) FILTER (WHERE status = 'RECEIVED')::int AS fresh
       FROM leads`,
      [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
    ),
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM projects WHERE status IN ('PLANNING','DISCOVERY','IN_PROGRESS','IN_REVIEW')`,
    ),
    queryOne<{ collected: number | null; outstanding: number | null; won: number | null }>(
      `SELECT
         coalesce(sum(amount_paid) FILTER (WHERE status IN ('PAID','PART_PAID')), 0)::float AS collected,
         coalesce(sum(amount - amount_paid) FILTER (WHERE status IN ('SENT','VIEWED','OVERDUE')), 0)::float AS outstanding,
         coalesce((SELECT sum(estimated_value) FROM leads WHERE status = 'WON'
                     AND updated_at > date_trunc('quarter', now())), 0)::float AS won
       FROM invoices`,
    ),
    query<BookingSummary>(
      `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
              s.name AS host_name, c.name AS client_name, l.name AS lead_name
         FROM bookings b
         LEFT JOIN staff s ON s.id = b.host_id
         LEFT JOIN clients c ON c.id = b.client_id
         LEFT JOIN leads l ON l.id = b.lead_id
        WHERE b.scheduled_for >= now() - interval '1 day'
          AND b.status IN ('REQUESTED','CONFIRMED')
        ORDER BY b.scheduled_for ASC
        LIMIT 6`,
    ),
    query<NewLeadSummary>(
      `SELECT id, name, company, situation, status, submitted_at, estimated_value
         FROM leads WHERE status = 'RECEIVED'
        ORDER BY submitted_at ASC
        LIMIT 6`,
    ),
    query<ActivityItem>(
      `SELECT id, actor_label, actor_type, action, entity_type, entity_id, occurred_at
         FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 12`,
    ),
    getMyFocus(staffId),
    getDeliveryPulse(),
    query<StatusMixRow>(
      `SELECT status, count(*)::int AS count,
              coalesce(sum(estimated_value), 0)::float AS value
         FROM leads
        WHERE status = ANY($1::lead_status[])
        GROUP BY status ORDER BY count DESC`,
      [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
    ),
  ]);

  return {
    pipelineValue: pipeline?.total ?? 0,
    openLeadCount: leadCounts?.open ?? 0,
    newLeadCount: leadCounts?.fresh ?? 0,
    activeProjectCount: projectCount?.count ?? 0,
    collectedRevenue: revenue?.collected ?? 0,
    outstandingRevenue: revenue?.outstanding ?? 0,
    wonThisQuarter: revenue?.won ?? 0,
    upcomingBookings: bookings,
    newLeads,
    recentActivity: activity,
    myFocus: focus,
    deliveryPulse: pulse,
    statusMix,
  };
}

/**
 * What this person should do today: their unassigned work first, then anything
 * overdue. Deliberately small, because a list of forty items is not a focus.
 */
export async function getMyFocus(staffId: string): Promise<FocusItem[]> {
  const items: FocusItem[] = [];

  const leads = await query<{ id: string; name: string; company: string | null; situation: string; submitted_at: Date }>(
    `SELECT id, name, company, situation, submitted_at FROM leads
      WHERE assigned_to = $1 AND status = ANY($2::lead_status[])
      ORDER BY submitted_at ASC LIMIT 4`,
    [staffId, ["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION"]],
  );
  for (const lead of leads) {
    items.push({
      kind: "lead",
      title: lead.name,
      meta: lead.company ? `${lead.company} — ${lead.situation}` : lead.situation,
      href: `/admin/leads/${lead.id}`,
      when: lead.submitted_at,
    });
  }

  const tasks = await query<{ id: string; title: string; due_at: Date | null; priority: string }>(
    `SELECT id, title, due_at, priority FROM tasks
      WHERE assignee_id = $1 AND status IN ('OPEN','IN_PROGRESS','BLOCKED')
      ORDER BY due_at NULLS LAST, created_at ASC LIMIT 4`,
    [staffId],
  );
  for (const task of tasks) {
    items.push({
      kind: "task",
      title: task.title,
      meta: task.priority === "URGENT" || task.priority === "HIGH" ? `${task.priority.toLowerCase()} priority` : "task",
      href: "/admin/tasks",
      when: task.due_at,
    });
  }

  const bookings = await query<{ id: string; title: string; scheduled_for: Date; client_name: string | null }>(
    `SELECT b.id, b.title, b.scheduled_for, c.name AS client_name
       FROM bookings b LEFT JOIN clients c ON c.id = b.client_id
      WHERE b.host_id = $1 AND b.status = 'CONFIRMED' AND b.scheduled_for >= now()
      ORDER BY b.scheduled_for ASC LIMIT 3`,
    [staffId],
  );
  for (const booking of bookings) {
    items.push({
      kind: "booking",
      title: booking.title,
      meta: booking.client_name ?? "call",
      href: "/admin/bookings",
      when: booking.scheduled_for,
    });
  }

  const proposals = await query<{ id: string; title: string; client_name: string | null; status: string }>(
    `SELECT p.id, p.title, c.name AS client_name FROM proposals p
       LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.status IN ('SENT','VIEWED')
      ORDER BY p.sent_at DESC NULLS LAST LIMIT 3`,
  );
  for (const proposal of proposals) {
    items.push({
      kind: "proposal",
      title: proposal.title,
      meta: proposal.client_name ?? "awaiting a decision",
      href: `/admin/proposals/${proposal.id}`,
      when: null,
    });
  }

  return items.slice(0, 8);
}

export async function getDeliveryPulse(): Promise<DeliveryPulse> {
  const [totals, byOwner, delivered] = await Promise.all([
    queryOne<{ active: number; in_review: number; blocked: number }>(
      `SELECT
         count(*) FILTER (WHERE status IN ('PLANNING','DISCOVERY','IN_PROGRESS'))::int AS active,
         count(*) FILTER (WHERE status = 'IN_REVIEW')::int AS in_review,
         count(*) FILTER (WHERE status = 'ON_HOLD')::int AS blocked
       FROM projects`,
    ),
    query<{ name: string; active: number }>(
      `SELECT s.name, count(p.id)::int AS active
         FROM staff s
         JOIN projects p ON p.lead_staff_id = s.id
        WHERE p.status IN ('PLANNING','DISCOVERY','IN_PROGRESS','IN_REVIEW')
        GROUP BY s.name ORDER BY active DESC LIMIT 6`,
    ),
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM projects
        WHERE status = 'DELIVERED' AND updated_at > date_trunc('month', now())`,
    ),
  ]);

  return {
    active: totals?.active ?? 0,
    inReview: totals?.in_review ?? 0,
    blocked: totals?.blocked ?? 0,
    deliveredThisMonth: delivered?.count ?? 0,
    byOwner,
  };
}

/* -------------------------------------------------------------------------- */
/* Section lists                                                              */
/* -------------------------------------------------------------------------- */

export type ClientSummary = {
  id: string;
  reference: string;
  name: string;
  industry: string | null;
  status: string;
  account_manager: string | null;
  project_count: number;
  outstanding: number;
  portal_users: number;
  created_at: Date;
};

export async function listClients(): Promise<ClientSummary[]> {
  return query<ClientSummary>(
    `SELECT c.id, c.reference, c.name, c.industry, c.status, c.created_at,
            s.name AS account_manager,
            (SELECT count(*)::int FROM projects p WHERE p.client_id = c.id) AS project_count,
            (SELECT count(*)::int FROM client_users u WHERE u.client_id = c.id) AS portal_users,
            coalesce((SELECT sum(i.amount - i.amount_paid) FROM invoices i
                       WHERE i.client_id = c.id AND i.status IN ('SENT','VIEWED','OVERDUE')), 0)::float AS outstanding
       FROM clients c
       LEFT JOIN staff s ON s.id = c.account_manager
      ORDER BY c.name ASC`,
  );
}

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  progress: number;
  phase: string | null;
  next_step: string | null;
  target_date: Date | null;
  client_id: string;
  client_name: string;
  lead_staff_name: string | null;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  return query<ProjectSummary>(
    `SELECT p.id, p.name, p.status, p.progress, p.phase, p.next_step, p.target_date,
            p.client_id, c.name AS client_name, s.name AS lead_staff_name
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN staff s ON s.id = p.lead_staff_id
      ORDER BY
        CASE p.status WHEN 'ON_HOLD' THEN 0 WHEN 'IN_REVIEW' THEN 1 WHEN 'IN_PROGRESS' THEN 2
                      WHEN 'DISCOVERY' THEN 3 ELSE 4 END,
        p.target_date NULLS LAST`,
  );
}

export async function listBookings(limit = 100): Promise<BookingSummary[]> {
  return query<BookingSummary>(
    `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
            s.name AS host_name, c.name AS client_name, l.name AS lead_name
       FROM bookings b
       LEFT JOIN staff s ON s.id = b.host_id
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN leads l ON l.id = b.lead_id
      ORDER BY b.scheduled_for DESC LIMIT $1`,
    [limit],
  );
}

export type ProposalSummary = {
  id: string;
  reference: string;
  title: string;
  status: string;
  model: string | null;
  investment: number | null;
  currency: string;
  client_name: string | null;
  lead_name: string | null;
  sent_at: Date | null;
  created_at: Date;
};

export async function listProposals(): Promise<ProposalSummary[]> {
  return query<ProposalSummary>(
    `SELECT p.id, p.reference, p.title, p.status, p.model, p.investment, p.currency,
            p.sent_at, p.created_at, c.name AS client_name, l.name AS lead_name
       FROM proposals p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN leads l ON l.id = p.lead_id
      ORDER BY p.created_at DESC`,
  );
}

export type ContractSummary = {
  id: string;
  reference: string;
  title: string;
  status: string;
  value_total: number | null;
  currency: string;
  client_name: string;
  signed_at: Date | null;
  created_at: Date;
};

export async function listContracts(): Promise<ContractSummary[]> {
  return query<ContractSummary>(
    `SELECT ct.id, ct.reference, ct.title, ct.status, ct.value_total, ct.currency,
            ct.signed_at, ct.created_at, c.name AS client_name
       FROM contracts ct JOIN clients c ON c.id = ct.client_id
      ORDER BY ct.created_at DESC`,
  );
}

export type TaskSummary = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  due_at: Date | null;
  assignee_name: string | null;
  client_name: string | null;
  project_name: string | null;
  created_at: Date;
};

export async function listTasks(): Promise<TaskSummary[]> {
  return query<TaskSummary>(
    `SELECT t.id, t.title, t.detail, t.status, t.priority, t.due_at, t.created_at,
            s.name AS assignee_name, c.name AS client_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN staff s ON s.id = t.assignee_id
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN projects p ON p.id = t.project_id
      ORDER BY
        CASE t.status WHEN 'BLOCKED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'OPEN' THEN 2 ELSE 3 END,
        t.due_at NULLS LAST`,
  );
}

export type InvoiceSummary = {
  id: string;
  reference: string;
  client_name: string;
  description: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  issued_at: Date | null;
  due_at: Date | null;
};

export async function listInvoices(): Promise<InvoiceSummary[]> {
  return query<InvoiceSummary>(
    `SELECT i.id, i.reference, i.description, i.amount, i.amount_paid, i.currency,
            i.status, i.issued_at, i.due_at, c.name AS client_name
       FROM invoices i JOIN clients c ON c.id = i.client_id
      ORDER BY i.created_at DESC`,
  );
}

export type AccountingTotals = {
  collected: number;
  outstanding: number;
  overdue: number;
  draft: number;
  invoiceCount: number;
  paidCount: number;
};

export async function getAccountingTotals(): Promise<AccountingTotals> {
  const row = await queryOne<{
    collected: number;
    outstanding: number;
    overdue: number;
    draft: number;
    invoice_count: number;
    paid_count: number;
  }>(
    `SELECT
       coalesce(sum(amount_paid) FILTER (WHERE status IN ('PAID','PART_PAID')), 0)::float AS collected,
       coalesce(sum(amount - amount_paid) FILTER (WHERE status IN ('SENT','VIEWED')), 0)::float AS outstanding,
       coalesce(sum(amount - amount_paid) FILTER (WHERE status = 'OVERDUE'), 0)::float AS overdue,
       coalesce(sum(amount) FILTER (WHERE status = 'DRAFT'), 0)::float AS draft,
       count(*)::int AS invoice_count,
       count(*) FILTER (WHERE status = 'PAID')::int AS paid_count
     FROM invoices`,
  );
  return {
    collected: row?.collected ?? 0,
    outstanding: row?.outstanding ?? 0,
    overdue: row?.overdue ?? 0,
    draft: row?.draft ?? 0,
    invoiceCount: row?.invoice_count ?? 0,
    paidCount: row?.paid_count ?? 0,
  };
}

export type StaffSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  open_leads: number;
  open_tasks: number;
  active_projects: number;
};

export async function listStaff(): Promise<StaffSummary[]> {
  return query<StaffSummary>(
    `SELECT s.id, s.name, s.email, s.role, s.title, s.active, s.last_login_at, s.created_at,
            (SELECT count(*)::int FROM leads l WHERE l.assigned_to = s.id
               AND l.status = ANY($1::lead_status[])) AS open_leads,
            (SELECT count(*)::int FROM tasks t WHERE t.assignee_id = s.id
               AND t.status IN ('OPEN','IN_PROGRESS','BLOCKED')) AS open_tasks,
            (SELECT count(*)::int FROM projects p WHERE p.lead_staff_id = s.id
               AND p.status IN ('PLANNING','DISCOVERY','IN_PROGRESS','IN_REVIEW')) AS active_projects
       FROM staff s
      ORDER BY s.name ASC`,
    [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
  );
}

export type LibrarySummary = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  tags: string[];
  client_name: string | null;
  updated_at: Date;
};

export async function listLibrary(): Promise<LibrarySummary[]> {
  return query<LibrarySummary>(
    `SELECT l.id, l.title, l.kind, l.description, l.tags, l.updated_at, c.name AS client_name
       FROM library_items l LEFT JOIN clients c ON c.id = l.client_id
      ORDER BY l.kind ASC, l.title ASC`,
  );
}

/* -------------------------------------------------------------------------- */
/* Business email                                                             */
/* -------------------------------------------------------------------------- */

export type EmailInboxRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  subject: string;
  from_address: string;
  to_addresses: string[];
  body_text: string;
  status: string;
  client_visible: boolean;
  error_message: string | null;
  created_at: Date;
  lead_id: string | null;
  client_id: string | null;
  lead_name: string | null;
  lead_company: string | null;
  client_name: string | null;
  project_name: string | null;
  proposal_title: string | null;
};

const INBOX_COLUMNS = `
  e.id, e.direction, e.subject, e.from_address, e.to_addresses, e.body_text,
  e.status, e.client_visible, e.error_message, e.created_at, e.lead_id, e.client_id,
  l.name AS lead_name, l.company AS lead_company,
  c.name AS client_name, p.name AS project_name, pr.title AS proposal_title
`;

/**
 * Business email inbox.
 *
 * Each message is resolved to the entity it belongs to, so "the conversation
 * about this project" is a query rather than a guess. `includeInternal` exposes
 * the internal alerts that are deliberately invisible to clients.
 */
export async function listInbox(options: {
  search?: string;
  direction?: "INBOUND" | "OUTBOUND";
  includeInternal?: boolean;
  limit?: number;
} = {}): Promise<EmailInboxRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!options.includeInternal) conditions.push("e.client_visible = true");
  if (options.direction) {
    params.push(options.direction);
    conditions.push(`e.direction = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(
      `(e.subject ILIKE $${params.length} OR e.body_text ILIKE $${params.length}
        OR e.from_address ILIKE $${params.length} OR array_to_string(e.to_addresses, ',') ILIKE $${params.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(options.limit ?? 150);

  return query<EmailInboxRow>(
    `SELECT ${INBOX_COLUMNS}
       FROM email_messages e
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN clients c ON c.id = e.client_id
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN proposals pr ON pr.id = e.proposal_id
       ${where}
      ORDER BY e.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

export type EmailEntityLink = {
  entity: "lead" | "client" | "project" | "proposal" | "none";
  id: string | null;
  label: string | null;
};

/** What a message is about, for the "related to" column. */
export async function emailEntityLink(email: {
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  proposal_id: string | null;
  lead_name: string | null;
  lead_company: string | null;
  client_name: string | null;
  project_name: string | null;
  proposal_title: string | null;
}): Promise<EmailEntityLink> {
  if (email.project_id) {
    return { entity: "project", id: email.project_id, label: email.project_name };
  }
  if (email.proposal_id) {
    return { entity: "proposal", id: null, label: email.proposal_title };
  }
  if (email.client_id) {
    return { entity: "client", id: email.client_id, label: email.client_name };
  }
  if (email.lead_id) {
    return {
      entity: "lead",
      id: email.lead_id,
      label: email.lead_company
        ? `${email.lead_name} · ${email.lead_company}`
        : email.lead_name,
    };
  }
  return { entity: "none", id: null, label: null };
}
