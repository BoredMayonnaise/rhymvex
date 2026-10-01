import { query } from "@/lib/db/client";
import { isRecordId } from "@/lib/db/ids";

/**
 * Lead-adjacent records.
 *
 * Kept out of `workspace.ts` because these are always read for one lead, and
 * filtered in SQL. Filtering after the fact in JavaScript would pull every
 * booking and proposal in the business into memory to show four of them.
 */

export type LeadBooking = {
  id: string;
  title: string;
  kind: string;
  status: string;
  scheduled_for: Date;
  duration_mins: number;
  location: string | null;
  host_name: string | null;
  agenda: string | null;
  outcome: string | null;
};

export type LeadProposal = {
  id: string;
  reference: string;
  title: string;
  status: string;
  model: string | null;
  investment: number | null;
  currency: string;
  sent_at: Date | null;
  created_at: Date;
  client_name: string | null;
};

export type LeadExtras = {
  bookings: LeadBooking[];
  proposals: LeadProposal[];
};

export async function getLeadDetailExtras(leadId: string): Promise<LeadExtras> {
  if (!isRecordId(leadId)) return { bookings: [], proposals: [] };
  const [bookings, proposals] = await Promise.all([
    query<LeadBooking>(
      `SELECT b.id, b.title, b.kind, b.status, b.scheduled_for, b.duration_mins,
              b.location, b.agenda, b.outcome, s.name AS host_name
         FROM bookings b
         LEFT JOIN staff s ON s.id = b.host_id
        WHERE b.lead_id = $1
        ORDER BY b.scheduled_for DESC`,
      [leadId],
    ),
    query<LeadProposal>(
      `SELECT p.id, p.reference, p.title, p.status, p.model, p.investment, p.currency,
              p.sent_at, p.created_at, c.name AS client_name
         FROM proposals p
         LEFT JOIN clients c ON c.id = p.client_id
        WHERE p.lead_id = $1
        ORDER BY p.created_at DESC`,
      [leadId],
    ),
  ]);

  return { bookings, proposals };
}

/** Clients a lead could be converted into proposals for, after conversion. */
export async function getClientOptions(leadId: string) {
  if (!isRecordId(leadId)) return [];
  return query<{ id: string; name: string }>(
    `SELECT c.id, c.name FROM clients c
      WHERE c.lead_id = $1 OR c.id IN (SELECT client_id FROM leads WHERE id = $1 AND client_id IS NOT NULL)
      ORDER BY c.name`,
    [leadId],
  );
}
