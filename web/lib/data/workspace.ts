import { query, queryOne } from "@/lib/db/client";
import type { CurrencyTotal } from "@/lib/format";

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
  /** Open-lead pipe, grouped: a sum across currencies is not a number. */
  pipeline: CurrencyTotal[];
  openLeadCount: number;
  newLeadCount: number;
  activeProjectCount: number;
  /** Money collected, grouped by the invoice's own currency. */
  collected: CurrencyTotal[];
  /** Money owed, grouped by the invoice's own currency. */
  outstanding: CurrencyTotal[];
  /** Money owed and overdue, grouped by the invoice's own currency. */
  overdue: CurrencyTotal[];
  /** Draft invoices not yet issued, grouped by currency. */
  draft: CurrencyTotal[];
  /** Leads won this quarter, grouped by the lead's own currency. */
  won: CurrencyTotal[];
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
  currency: string | null;
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

export type StatusMixRow = { status: string; currency: string; count: number; value: number };

export async function getOverview(
  staffId: string,
  options: { light?: boolean } = {},
): Promise<Overview> {
  const [
    pipeline,
    leadCounts,
    projectCount,
    won,
    totals,
    bookings,
    newLeads,
    activity,
    focus,
    pulse,
    statusMix,
  ] = await Promise.all([
    query<CurrencyTotal>(
      `SELECT coalesce(currency, 'USD') AS currency,
              sum(estimated_value)::float AS total,
              count(*)::int AS count
         FROM leads
        WHERE status = ANY($1::lead_status[]) AND estimated_value IS NOT NULL
        GROUP BY currency
        ORDER BY total DESC`,
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
    query<CurrencyTotal>(
      `SELECT coalesce(currency, 'USD') AS currency,
              sum(estimated_value)::float AS total,
              count(*)::int AS count
         FROM leads
        WHERE status = 'WON'
          AND updated_at > date_trunc('quarter', now())
          AND estimated_value IS NOT NULL
        GROUP BY currency
        ORDER BY total DESC`,
    ),
    getAccountingTotals(),
    options.light
      ? Promise.resolve([] as BookingSummary[])
      : query<BookingSummary>(
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
      `SELECT id, name, company, situation, status, submitted_at, estimated_value, currency
         FROM leads WHERE status = 'RECEIVED'
         ORDER BY submitted_at ASC
         LIMIT 6`,
    ),
    options.light
      ? Promise.resolve([] as ActivityItem[])
      : query<ActivityItem>(
      `SELECT id, actor_label, actor_type, action, entity_type, entity_id, occurred_at
         FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 12`,
    ),
    getMyFocus(staffId),
    getDeliveryPulse(),
    query<StatusMixRow>(
      `SELECT status, coalesce(currency, 'USD') AS currency,
              count(*)::int AS count,
              coalesce(sum(estimated_value), 0)::float AS value
         FROM leads
        WHERE status = ANY($1::lead_status[])
        GROUP BY status, currency
        ORDER BY count DESC`,
      [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
    ),
  ]);

  return {
    pipeline,
    openLeadCount: leadCounts?.open ?? 0,
    newLeadCount: leadCounts?.fresh ?? 0,
    activeProjectCount: projectCount?.count ?? 0,
    collected: totals.collected,
    outstanding: totals.outstanding,
    overdue: totals.overdue,
    draft: totals.draft,
    won,
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
export async function listRecentActivity(limit = 12): Promise<ActivityItem[]> {
  return query<ActivityItem>(
    `SELECT id, actor_label, actor_type, action, entity_type, entity_id, occurred_at
       FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT $1`,
    [limit],
  );
}

export async function listUpcomingBookings(limit = 6): Promise<BookingSummary[]> {
  return query<BookingSummary>(
    `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
            s.name AS host_name, c.name AS client_name, l.name AS lead_name
       FROM bookings b
       LEFT JOIN staff s ON s.id = b.host_id
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN leads l ON l.id = b.lead_id
      WHERE b.scheduled_for >= now() - interval '1 day'
        AND b.status IN ('REQUESTED','CONFIRMED')
      ORDER BY b.scheduled_for ASC
      LIMIT $1`,
    [limit],
  );
}

export async function getMyFocus(staffId: string): Promise<FocusItem[]> {
  const items: FocusItem[] = [];

  const [leads, tasks, bookings, proposals] = await Promise.all([
    query<{ id: string; name: string; company: string | null; situation: string; submitted_at: Date }>(
      `SELECT id, name, company, situation, submitted_at FROM leads
        WHERE assigned_to = $1 AND status = ANY($2::lead_status[])
        ORDER BY submitted_at ASC LIMIT 4`,
      [staffId, ["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION"]],
    ),
    query<{ id: string; title: string; due_at: Date | null; priority: string }>(
      `SELECT id, title, due_at, priority FROM tasks
        WHERE assignee_id = $1 AND status IN ('OPEN','IN_PROGRESS','BLOCKED')
        ORDER BY due_at NULLS LAST, created_at ASC LIMIT 4`,
      [staffId],
    ),
    query<{ id: string; title: string; scheduled_for: Date; client_name: string | null }>(
      `SELECT b.id, b.title, b.scheduled_for, c.name AS client_name
         FROM bookings b LEFT JOIN clients c ON c.id = b.client_id
        WHERE b.host_id = $1 AND b.status = 'CONFIRMED' AND b.scheduled_for >= now()
        ORDER BY b.scheduled_for ASC LIMIT 3`,
      [staffId],
    ),
    query<{ id: string; title: string; client_name: string | null; status: string }>(
      `SELECT p.id, p.title, c.name AS client_name FROM proposals p
         LEFT JOIN clients c ON c.id = p.client_id
        WHERE p.status IN ('SENT','VIEWED')
        ORDER BY p.sent_at DESC NULLS LAST LIMIT 3`,
    ),
  ]);

  for (const lead of leads) {
    items.push({
      kind: "lead",
      title: lead.name,
      meta: lead.company ? `${lead.company} — ${lead.situation}` : lead.situation,
      href: `/admin/leads/${lead.id}`,
      when: lead.submitted_at,
    });
  }

  for (const task of tasks) {
    items.push({
      kind: "task",
      title: task.title,
      meta: task.priority === "URGENT" || task.priority === "HIGH" ? `${task.priority.toLowerCase()} priority` : "task",
      href: "/admin/tasks",
      when: task.due_at,
    });
  }

  for (const booking of bookings) {
    items.push({
      kind: "booking",
      title: booking.title,
      meta: booking.client_name ?? "call",
      href: "/admin/bookings",
      when: booking.scheduled_for,
    });
  }

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
  /** Money owed, grouped by the invoice's own currency. */
  outstanding: CurrencyTotal[];
  portal_users: number;
  created_at: Date;
};

export async function listClients(limit = 200, offset = 0): Promise<ClientSummary[]> {
  return query<ClientSummary>(
    `SELECT c.id, c.reference, c.name, c.industry, c.status, c.created_at,
            s.name AS account_manager,
            coalesce(pr.project_count, 0) AS project_count,
            coalesce(pu.portal_users, 0) AS portal_users,
            coalesce(inv.outstanding, '[]'::json) AS outstanding
       FROM clients c
       LEFT JOIN staff s ON s.id = c.account_manager
       LEFT JOIN (
         SELECT client_id, count(*)::int AS project_count FROM projects GROUP BY client_id
       ) pr ON pr.client_id = c.id
       LEFT JOIN (
         SELECT client_id, count(*)::int AS portal_users FROM client_users GROUP BY client_id
       ) pu ON pu.client_id = c.id
       LEFT JOIN (
         -- Two levels on purpose: json_agg cannot wrap sum directly, so the
         -- per-currency sums are computed first and then gathered into one array.
         SELECT agg.client_id,
                json_agg(json_build_object(
                  'currency', agg.currency,
                  'total', agg.total::float,
                  'count', 0
                )) AS outstanding
           FROM (
             SELECT client_id,
                    coalesce(currency, 'USD') AS currency,
                    sum(amount - amount_paid) AS total
               FROM invoices
              WHERE status IN ('SENT','VIEWED','OVERDUE')
              GROUP BY client_id, coalesce(currency, 'USD')
           ) agg
          GROUP BY agg.client_id
       ) inv ON inv.client_id = c.id
      ORDER BY c.name ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
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

export async function listProjects(limit = 200, offset = 0): Promise<ProjectSummary[]> {
  return query<ProjectSummary>(
    `SELECT p.id, p.name, p.status, p.progress, p.phase, p.next_step, p.target_date,
            p.client_id, c.name AS client_name, s.name AS lead_staff_name
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN staff s ON s.id = p.lead_staff_id
      ORDER BY
        CASE p.status WHEN 'ON_HOLD' THEN 0 WHEN 'IN_REVIEW' THEN 1 WHEN 'IN_PROGRESS' THEN 2
                      WHEN 'DISCOVERY' THEN 3 ELSE 4 END,
        p.target_date NULLS LAST
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

export type BookingRow = BookingSummary & {
  location: string | null;
  agenda: string | null;
  outcome: string | null;
  client_id: string | null;
  lead_id: string | null;
  project_id: string | null;
  project_name: string | null;
  client_contact_id: string | null;
};

const BOOKING_COLUMNS = `b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
       b.location, b.agenda, b.outcome, b.client_id, b.lead_id, b.project_id,
       b.client_contact_id,
       s.name AS host_name, c.name AS client_name, l.name AS lead_name,
       pr.name AS project_name`;

/**
 * What is still ahead: a booking is "open" when it is still to happen *and*
 * still live. Both tests matter — a confirmation for a date that has passed is
 * not something the page can usefully show under "Upcoming".
 *
 * Ordered ascending because the near ones are the ones you act on. A single
 * descending list capped at `limit` fills up with history and drops the far
 * future instead, which is the opposite of what this page is for.
 */
export async function listOpenBookings(limit = 200): Promise<BookingRow[]> {
  return query<BookingRow>(
    `SELECT ${BOOKING_COLUMNS}
       FROM bookings b
       LEFT JOIN staff s ON s.id = b.host_id
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN leads l ON l.id = b.lead_id
       LEFT JOIN projects pr ON pr.id = b.project_id
      WHERE b.scheduled_for >= now()
        AND b.status IN ('REQUESTED','CONFIRMED')
      ORDER BY b.scheduled_for ASC LIMIT $1`,
    [limit],
  );
}

/** The complement of {@link listOpenBookings}: history, and anything abandoned. */
export async function listClosedBookings(limit = 40): Promise<BookingRow[]> {
  return query<BookingRow>(
    `SELECT ${BOOKING_COLUMNS}
       FROM bookings b
       LEFT JOIN staff s ON s.id = b.host_id
       LEFT JOIN clients c ON c.id = b.client_id
       LEFT JOIN leads l ON l.id = b.lead_id
       LEFT JOIN projects pr ON pr.id = b.project_id
      WHERE NOT (b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED'))
      ORDER BY b.scheduled_for DESC LIMIT $1`,
    [limit],
  );
}

export type BookingCounts = {
  open: number;
  awaiting: number;
  missingLocation: number;
  closed: number;
  openMinutes: number;
};

/**
 * Headline numbers, counted across the whole table.
 *
 * Deliberately not derived from the list above it: a list capped for display is
 * not a tally, and every count it produced would quietly stop being true once
 * the page filled up.
 */
export async function getBookingCounts(): Promise<BookingCounts> {
  const row = await queryOne<BookingCounts>(
    `SELECT
       count(*) FILTER (
         WHERE b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED')
       )::int AS "open",
       count(*) FILTER (
         WHERE b.scheduled_for >= now() AND b.status = 'REQUESTED'
       )::int AS awaiting,
       count(*) FILTER (
         WHERE b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED')
           AND (b.location IS NULL OR btrim(b.location) = '')
       )::int AS "missingLocation",
       count(*) FILTER (
         WHERE NOT (b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED'))
       )::int AS closed,
       COALESCE(sum(b.duration_mins) FILTER (
         WHERE b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED')
       ), 0)::int AS "openMinutes"
     FROM bookings b`,
  );

  return (
    row ?? { open: 0, awaiting: 0, missingLocation: 0, closed: 0, openMinutes: 0 }
  );
}

export type HostLoad = {
  id: string | null;
  name: string;
  count: number;
  minutes: number;
};

/**
 * Scheduled call minutes per host across the next `days` days.
 *
 * Grouped by `host_id`, not by name: two people can share a name, and merging
 * their rows would hide the load on whichever of them is actually busier.
 * Bookings with no host collect under "Unassigned" rather than vanishing,
 * because an unhosted booking is a decision someone still has to make.
 */
export async function getHostLoad(days = 30): Promise<HostLoad[]> {
  return query<HostLoad>(
    `SELECT b.host_id AS id,
            COALESCE(s.name, 'Unassigned') AS name,
            count(*)::int AS count,
            COALESCE(sum(b.duration_mins), 0)::int AS minutes
       FROM bookings b
       LEFT JOIN staff s ON s.id = b.host_id
      WHERE b.scheduled_for >= now()
        AND b.scheduled_for < now() + make_interval(days => $1::int)
        AND b.status IN ('REQUESTED','CONFIRMED')
      GROUP BY b.host_id, s.name
      ORDER BY minutes DESC, count DESC, name ASC`,
    [days],
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

export async function listProposals(limit = 200, offset = 0): Promise<ProposalSummary[]> {
  return query<ProposalSummary>(
    `SELECT p.id, p.reference, p.title, p.status, p.model, p.investment, p.currency,
            p.sent_at, p.created_at, c.name AS client_name, l.name AS lead_name
       FROM proposals p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN leads l ON l.id = p.lead_id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

export type ContractSummary = {
  id: string;
  reference: string;
  title: string;
  status: string;
  value_total: number | null;
  currency: string;
  client_id: string;
  client_name: string;
  /** Which accepted proposal this contract came from, if any. */
  proposal_id: string | null;
  sent_at: Date | null;
  signed_at: Date | null;
  /** Who signed it, from the client's own signature capture. */
  signed_by_name: string | null;
  created_at: Date;
};

export async function listContracts(limit = 200, offset = 0): Promise<ContractSummary[]> {
  return query<ContractSummary>(
    `SELECT ct.id, ct.reference, ct.title, ct.status, ct.value_total, ct.currency,
            ct.client_id, ct.proposal_id, ct.sent_at, ct.signed_at, ct.signed_by_name,
            ct.created_at, c.name AS client_name
       FROM contracts ct JOIN clients c ON c.id = ct.client_id
      ORDER BY ct.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

export type ContractDetail = ContractSummary & {
  body: string | null;
  signature_ip: string | null;
  proposal_id: string | null;
  proposal_reference: string | null;
  project_id: string | null;
  project_name: string | null;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * One contract, with everything needed to review or act on it.
 *
 * Staff-facing: it includes the body and the signature record. The portal has
 * its own read in `lib/data/portal.ts` scoped to one client, and there is no
 * path from a client session to this function.
 */
export async function getContract(id: string): Promise<ContractDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<ContractDetail>(
    `SELECT ct.id, ct.reference, ct.title, ct.status, ct.value_total, ct.currency,
            ct.client_id, ct.body, ct.sent_at, ct.signed_at, ct.signed_by_name,
            ct.signature_ip, ct.proposal_id, ct.project_id, ct.created_at, ct.updated_at,
            c.name AS client_name,
            p.reference AS proposal_reference,
            pr.name AS project_name,
            s.name AS created_by_name
       FROM contracts ct
       JOIN clients c ON c.id = ct.client_id
       LEFT JOIN proposals p ON p.id = ct.proposal_id
       LEFT JOIN projects pr ON pr.id = ct.project_id
       LEFT JOIN staff s ON s.id = ct.created_by
      WHERE ct.id = $1`,
    [id],
  );
}

/** Contracts already drafted from a proposal, so the UI can refuse a duplicate. */
export async function contractForProposal(proposalId: string): Promise<{ id: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(proposalId)) return null;
  return queryOne<{ id: string }>("SELECT id FROM contracts WHERE proposal_id = $1", [
    proposalId,
  ]);
}

/**
 * Accepted proposals that still need a contract.
 *
 * This is the work queue for the contracts page: a client said yes and there is
 * no paperwork behind it, which is the one gap that matters on this page.
 */
export async function listAcceptedProposalsWithoutContract() {
  return query<{
    id: string;
    reference: string;
    title: string;
    investment: number | null;
    currency: string;
    client_id: string;
    client_name: string;
    decided_at: Date | null;
  }>(
    `SELECT p.id, p.reference, p.title, p.investment, p.currency, p.client_id,
            c.name AS client_name, p.sent_at AS decided_at
       FROM proposals p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN contracts ct ON ct.proposal_id = p.id
      WHERE p.status = 'ACCEPTED'
        AND ct.id IS NULL
        AND p.client_id IS NOT NULL
      ORDER BY p.sent_at DESC NULLS LAST
      LIMIT 20`,
  );
}

export type TaskSummary = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  due_at: Date | null;
  completed_at: Date | null;
  assignee_id: string | null;
  assignee_name: string | null;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  created_at: Date;
};

export type TaskListFilters = {
  /** Free text over title, detail and assignee name. */
  search?: string;
  /** Single status, or a set of them. Omit for every status. */
  status?: string[];
  assigneeId?: string;
  clientId?: string;
  projectId?: string;
  /** Only tasks nobody owns. */
  unassignedOnly?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * The team task list.
 *
 * Every relation a task can carry is joined here rather than fetched separately,
 * so a row can be rendered — and linked — without a second round trip. `lead`
 * is joined as well as `client`: a lot of internal work is raised against an
 * inbound lead that has not been converted into a client yet, and that is
 * exactly the case where the "related to" cell used to fall back to an em dash.
 */
export async function listTasks(filters: TaskListFilters = {}): Promise<TaskSummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const i = params.length;
    conditions.push(
      `(t.title ILIKE $${i} OR t.detail ILIKE $${i} OR s.name ILIKE $${i})`,
    );
  }
  if (filters.status?.length) {
    params.push(filters.status);
    conditions.push(`t.status = ANY($${params.length}::task_status[])`);
  }
  if (filters.assigneeId) {
    params.push(filters.assigneeId);
    conditions.push(`t.assignee_id = $${params.length}`);
  }
  if (filters.unassignedOnly) conditions.push("t.assignee_id IS NULL");
  if (filters.clientId) {
    params.push(filters.clientId);
    conditions.push(`t.client_id = $${params.length}`);
  }
  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`t.project_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(filters.limit ?? 200);
  params.push(filters.offset ?? 0);

  return query<TaskSummary>(
    `SELECT t.id, t.title, t.detail, t.status, t.priority, t.due_at, t.completed_at, t.created_at,
            t.assignee_id, t.client_id, t.project_id, t.lead_id,
            s.name AS assignee_name, c.name AS client_name, p.name AS project_name, l.name AS lead_name
       FROM tasks t
       LEFT JOIN staff s ON s.id = t.assignee_id
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN leads l ON l.id = t.lead_id
       ${where}
      ORDER BY
        CASE t.status WHEN 'BLOCKED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'OPEN' THEN 2 ELSE 3 END,
        t.due_at NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export type TaskOption = { id: string; label: string; sub?: string | null };

export type TaskProjectOption = TaskOption & { clientId: string | null };

/**
 * The pickers a task form needs: who can own it, and what it can hang off.
 *
 * Leads are included because internal work is often raised against an inbound
 * enquiry that has no client record yet. Projects carry their `clientId` so the
 * form can keep the client and project links from contradicting each other.
 */
export async function listTaskOptions(): Promise<{
  staff: TaskOption[];
  clients: TaskOption[];
  projects: TaskProjectOption[];
  leads: TaskOption[];
}> {
  const [staff, clients, projects, leads] = await Promise.all([
    query<TaskOption>(
      `SELECT id, name AS label FROM staff WHERE active ORDER BY name ASC`,
    ),
    query<TaskOption>(
      `SELECT id, name AS label, reference AS sub FROM clients ORDER BY name ASC`,
    ),
    query<TaskProjectOption>(
      `SELECT p.id, p.name AS label, c.name AS sub, p.client_id AS "clientId"
         FROM projects p JOIN clients c ON c.id = p.client_id
        ORDER BY p.name ASC`,
    ),
    query<TaskOption>(
      `SELECT id, name AS label, company AS sub FROM leads ORDER BY submitted_at DESC LIMIT 100`,
    ),
  ]);
  return { staff, clients, projects, leads };
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

export async function listInvoices(limit = 200, offset = 0): Promise<InvoiceSummary[]> {
  return query<InvoiceSummary>(
    `SELECT i.id, i.reference, i.description, i.amount, i.amount_paid, i.currency,
            i.status, i.issued_at, i.due_at, c.name AS client_name
       FROM invoices i JOIN clients c ON c.id = i.client_id
      ORDER BY i.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

export type AccountingTotals = {
  /** Grouped by the invoice's own currency: these are never converted. */
  collected: CurrencyTotal[];
  outstanding: CurrencyTotal[];
  overdue: CurrencyTotal[];
  draft: CurrencyTotal[];
  invoiceCount: number;
  paidCount: number;
};

export async function getAccountingTotals(): Promise<AccountingTotals> {
  const [rows, counts] = await Promise.all([
    query<{
      currency: string;
      collected: number | null;
      outstanding: number | null;
      overdue: number | null;
      draft: number | null;
    }>(
      `SELECT coalesce(currency, 'USD') AS currency,
              sum(amount_paid) FILTER (WHERE status IN ('PAID','PART_PAID'))::float AS collected,
              sum(amount - amount_paid) FILTER (WHERE status IN ('SENT','VIEWED'))::float AS outstanding,
              sum(amount - amount_paid) FILTER (WHERE status = 'OVERDUE')::float AS overdue,
              sum(amount) FILTER (WHERE status = 'DRAFT')::float AS draft
         FROM invoices
        GROUP BY currency
        ORDER BY currency`,
    ),
    queryOne<{ invoice_count: number; paid_count: number }>(
      `SELECT count(*)::int AS invoice_count,
              count(*) FILTER (WHERE status = 'PAID')::int AS paid_count
         FROM invoices`,
    ),
  ]);

  const pivot = (
    pick: (row: (typeof rows)[number]) => number | null,
  ): CurrencyTotal[] =>
    rows
      .filter((row) => pick(row) !== null)
      .map((row) => ({ currency: row.currency, total: pick(row) ?? 0, count: 0 }));

  return {
    collected: pivot((r) => r.collected),
    outstanding: pivot((r) => r.outstanding),
    overdue: pivot((r) => r.overdue),
    draft: pivot((r) => r.draft),
    invoiceCount: counts?.invoice_count ?? 0,
    paidCount: counts?.paid_count ?? 0,
  };
}

export type StaffSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  active: boolean;
  /** Per-user grants added on top of the role's own permissions. */
  extra_permissions: string[];
  last_login_at: Date | null;
  created_at: Date;
  open_leads: number;
  open_tasks: number;
  active_projects: number;
};

export async function listStaff(limit = 200, offset = 0): Promise<StaffSummary[]> {
  return query<StaffSummary>(
    `SELECT s.id, s.name, s.email, s.role, s.title, s.active, s.extra_permissions,
            s.last_login_at, s.created_at,
            coalesce(ol.open_leads, 0) AS open_leads,
            coalesce(ot.open_tasks, 0) AS open_tasks,
            coalesce(ap.active_projects, 0) AS active_projects
       FROM staff s
       LEFT JOIN (
         SELECT assigned_to AS staff_id, count(*)::int AS open_leads FROM leads
          WHERE status = ANY($1::lead_status[]) GROUP BY assigned_to
       ) ol ON ol.staff_id = s.id
       LEFT JOIN (
         SELECT assignee_id AS staff_id, count(*)::int AS open_tasks FROM tasks
          WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED') GROUP BY assignee_id
       ) ot ON ot.staff_id = s.id
       LEFT JOIN (
         SELECT lead_staff_id AS staff_id, count(*)::int AS active_projects FROM projects
          WHERE status IN ('PLANNING','DISCOVERY','IN_PROGRESS','IN_REVIEW') GROUP BY lead_staff_id
       ) ap ON ap.staff_id = s.id
      ORDER BY s.name ASC
      LIMIT $2 OFFSET $3`,
    // $1 is the status enum the open_leads subquery filters on, so the window
    // has to start at $2 here.
    [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"], limit, offset],
  );
}

export type LibrarySummary = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  body: string | null;
  tags: string[];
  client_name: string | null;
  updated_at: Date;
};

export async function listLibrary(
  options: { limit?: number; offset?: number; search?: string; kind?: string } = {},
): Promise<LibrarySummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.kind) {
    params.push(options.kind);
    conditions.push(`l.kind = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(
      `(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length}
        OR EXISTS (SELECT 1 FROM unnest(l.tags) AS tag WHERE tag ILIKE $${params.length}))`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(options.limit ?? 200, options.offset ?? 0);

  return query<LibrarySummary>(
    `SELECT l.id, l.title, l.kind, l.description, l.body, l.tags, l.updated_at, c.name AS client_name
       FROM library_items l LEFT JOIN clients c ON c.id = l.client_id
       ${where}
      ORDER BY l.kind ASC, l.title ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
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

export type ProjectDetail = ProjectSummary & {
  summary: string | null;
  start_date: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function getProject(id: string): Promise<ProjectDetail | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<ProjectDetail>(
    `SELECT p.id, p.name, p.status, p.progress, p.phase, p.next_step, p.target_date,
            p.client_id, c.name AS client_name, s.name AS lead_staff_name,
            p.summary, p.start_date, p.created_at, p.updated_at
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN staff s ON s.id = p.lead_staff_id
      WHERE p.id = $1`,
    [id],
  );
}

export async function listProjectMilestonesAdmin(projectId: string) {
  return query<{
    id: string;
    title: string;
    detail: string | null;
    sort_order: number;
    completed_at: Date | null;
    client_visible: boolean;
  }>(
    `SELECT id, title, detail, sort_order, completed_at, client_visible
       FROM project_milestones
      WHERE project_id = $1
      ORDER BY sort_order, created_at`,
    [projectId],
  );
}

export async function listProjectFiles(projectId: string) {
  return query<{
    id: string;
    name: string;
    size_bytes: number | null;
    client_visible: boolean;
    uploaded_at: Date;
    uploader_name: string | null;
  }>(
    `SELECT f.id, f.name, f.size_bytes, f.client_visible, f.uploaded_at, s.name AS uploader_name
       FROM files f LEFT JOIN staff s ON s.id = f.uploaded_by
      WHERE f.project_id = $1
      ORDER BY f.uploaded_at DESC`,
    [projectId],
  );
}
