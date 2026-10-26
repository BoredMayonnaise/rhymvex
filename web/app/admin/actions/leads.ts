"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne, tx } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { convert, reportingCurrency } from "@/lib/fx";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { uniqueReference } from "@/lib/db/reference";
import {
  bookingSchema,
  createClientFromLeadSchema,
  fieldErrors,
  leadNoteSchema,
  leadUpdateSchema,
  outboundEmailSchema,
  proposalSchema,
} from "@/lib/validation";
import type { LeadStatus } from "@/lib/data/leads";
import { recordEmail } from "@/lib/data/email";
import { addClientActivity } from "@/lib/data/clients";
import { fromAddress, sendMail } from "@/lib/mail/smtp";
import { outboundEmailTemplate } from "@/lib/mail/outbound-template";

/**
 * Lead actions.
 *
 * Every one re-checks the session and the permission server-side, and takes
 * the CSRF token from the form. A hidden button or a client-side check is not
 * authorisation, so nothing here trusts the caller about who they are.
 */

export type ActionResult =
  | {
      ok: true;
      message: string;
      /** Set by actions that create a record, so the UI can navigate to it. */
      contractId?: string | null;
      /** Set by status transitions, so the UI can re-render in the new state. */
      status?: string;
    }
  | { ok: false; error: string; fields?: Record<string, string> };

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateLeadStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("leads.write")) {
    return { ok: false, error: "Your role cannot change lead status." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const meta = await requestMeta();
  const parsed = leadUpdateSchema.safeParse({
    status: formData.get("status") ?? undefined,
    assigned_to: formData.get("assigned_to") || null,
    recommended_model: formData.get("recommended_model") || null,
    estimated_value: formData.get("estimated_value") || null,
    currency: formData.get("currency") || undefined,
    lost_reason: formData.get("lost_reason") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the values.", fields: fieldErrors(parsed.error) };
  }

  const actor = { type: "staff" as const, id: session.staffId, label: session.name };
  const data = parsed.data;

  const lead = await queryOne<{ id: string; status: LeadStatus; assigned_to: string | null; reference: string }>(
    "SELECT id, status, assigned_to, reference FROM leads WHERE id = $1",
    [leadId],
  );
  if (!lead) return { ok: false, error: "Lead not found." };

  await tx(async (client) => {
    await client.query(
      `UPDATE leads SET
         status = COALESCE($1, status),
         assigned_to = CASE WHEN $2::boolean THEN $3 ELSE assigned_to END,
         recommended_model = COALESCE($4, recommended_model),
         estimated_value = COALESCE($5, estimated_value),
         currency = COALESCE($6, currency),
         lost_reason = COALESCE($7, lost_reason),
         updated_at = now()
       WHERE id = $8`,
      [
        data.status ?? null,
        formData.has("assigned_to"),
        data.assigned_to ?? null,
        data.recommended_model ?? null,
        data.estimated_value ?? null,
        data.currency ?? null,
        data.lost_reason ?? null,
        leadId,
      ],
    );

    if (data.status && data.status !== lead.status) {
      await recordAudit(
        actor,
        {
          action: "lead.status_changed",
          entityType: "lead",
          entityId: leadId,
          metadata: { from: lead.status, to: data.status, reference: lead.reference },
          ...meta,
        },
        client,
      );
    }

    if (formData.has("assigned_to") && data.assigned_to !== lead.assigned_to) {
      await recordAudit(
        actor,
        {
          action: "lead.assigned",
          entityType: "lead",
          entityId: leadId,
          metadata: {
            from: lead.assigned_to,
            to: data.assigned_to,
            reference: lead.reference,
          },
          ...meta,
        },
        client,
      );
    }
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin");

  return { ok: true, message: "Lead updated." };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export async function addLeadNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("leads.write")) {
    return { ok: false, error: "Your role cannot add notes." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = leadNoteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { ok: false, error: "Write something first.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const lead = await queryOne<{ reference: string }>("SELECT reference FROM leads WHERE id = $1", [leadId]);
  if (!lead) return { ok: false, error: "Lead not found." };

  const note = await queryOne<{ id: string }>(
    `INSERT INTO lead_notes (lead_id, author_id, author_name, body)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [leadId, session.staffId, session.name, parsed.data.body],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "lead.note_added",
      entityType: "lead",
      entityId: leadId,
      // The note body is deliberately not stored in the audit metadata: the
      // audit trail records that a note happened, the note itself lives in
      // lead_notes and is never exposed to a client.
      metadata: { noteId: note?.id, reference: lead.reference },
      ...meta,
    },
  );

  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, message: "Note added." };
}

/* -------------------------------------------------------------------------- */
/* Conversion to a client                                                     */
/* -------------------------------------------------------------------------- */

const MODEL_LABELS: Record<string, string> = {
  BRAND_SPRINT: "Brand Sprint",
  BRAND_SYSTEM: "Brand System",
  RHYTHM_RETAINER: "Rhythm Retainer",
  CUSTOM: "Custom engagement",
};

/**
 * Turn a lead into a client.
 *
 * This is the only path from lead to client, and it is always a deliberate
 * human action. It does not happen automatically on submission.
 */
export async function convertLeadToClientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("clients.write")) {
    return { ok: false, error: "Your role cannot create clients." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = createClientFromLeadSchema.safeParse({
    name: formData.get("name"),
    legal_name: formData.get("legal_name") || "",
    industry: formData.get("industry") || "",
    account_manager: formData.get("account_manager") || null,
    engagement_model: formData.get("engagement_model") || undefined,
    engagement_name: formData.get("engagement_name") || "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const lead = await queryOne<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    phone: string | null;
    role_title: string | null;
    status: LeadStatus;
    client_id: string | null;
    reference: string;
  }>("SELECT id, name, email, company, phone, role_title, status, client_id, reference FROM leads WHERE id = $1", [leadId]);

  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.client_id) {
    return { ok: false, error: "This lead is already linked to a client." };
  }

  const clientId = await tx(async (client) => {
    const reference = await uniqueReference("clients", "CLI");
    const { rows } = await client.query(
      `INSERT INTO clients (reference, name, legal_name, industry, lead_id, account_manager, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE') RETURNING id`,
      [
        reference,
        data.name,
        data.legal_name || null,
        data.industry || null,
        leadId,
        data.account_manager ?? session.staffId,
      ],
    );
    const id = rows[0].id as string;

    // The submitting person becomes the primary contact, so the relationship
    // starts with the person who actually reached out.
    await client.query(
      `INSERT INTO client_contacts (client_id, name, email, phone, role_title, is_primary)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (client_id, email) DO NOTHING`,
      [id, lead.name, lead.email, lead.phone, lead.role_title],
    );

    await client.query(
      "UPDATE leads SET client_id = $1, status = 'WON', updated_at = now() WHERE id = $2",
      [id, leadId],
    );

    // Seed the engagement shape, if one was chosen. The engagement is what makes
    // this a client relationship rather than a contact record.
    if (data.engagement_model) {
      await client.query(
        `INSERT INTO engagements (client_id, lead_id, model, name, billing_cycle)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          leadId,
          data.engagement_model,
          data.engagement_name || MODEL_LABELS[data.engagement_model],
          data.engagement_model === "RHYTHM_RETAINER" ? "MONTHLY" : "ONE_OFF",
        ],
      );
    }

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: "client.created",
        entityType: "client",
        entityId: id,
        metadata: { name: data.name, fromLead: lead.reference, reference },
        ...meta,
      },
      client,
    );

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: "lead.client_created",
        entityType: "lead",
        entityId: leadId,
        metadata: { clientId: id, clientName: data.name },
        ...meta,
      },
      client,
    );

    return id;
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");

  redirect(`/admin/clients/${clientId}?created=1`);
}

/* -------------------------------------------------------------------------- */
/* Bookings (from lead)                                                       */
/* -------------------------------------------------------------------------- */

export async function createBookingForLeadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("bookings.write")) {
    return { ok: false, error: "Your role cannot create bookings." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = bookingSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    status: formData.get("status") || "CONFIRMED",
    scheduled_for: formData.get("scheduled_for"),
    duration_mins: formData.get("duration_mins") || 45,
    lead_id: leadId,
    client_id: formData.get("client_id") || null,
    host_id: formData.get("host_id") || null,
    location: formData.get("location") || "",
    agenda: formData.get("agenda") || "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the booking details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const booking = await queryOne<{ id: string }>(
    `INSERT INTO bookings (lead_id, client_id, project_id, title, kind, status, scheduled_for, duration_mins, host_id, location, agenda, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      data.lead_id, data.client_id, data.project_id, data.title, data.kind, data.status,
      data.scheduled_for, data.duration_mins, data.host_id || session.staffId,
      data.location, data.agenda, session.staffId,
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "booking.created",
      entityType: "booking",
      entityId: booking?.id,
      metadata: { leadId, title: data.title, when: data.scheduled_for },
      ...meta,
    },
  );

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true, message: "Booking created." };
}

/* -------------------------------------------------------------------------- */
/* Proposals (from lead)                                                      */
/* -------------------------------------------------------------------------- */

export async function createProposalForLeadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("proposals.write")) {
    return { ok: false, error: "Your role cannot create proposals." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = proposalSchema.safeParse({
    lead_id: leadId,
    client_id: formData.get("client_id") || null,
    title: formData.get("title"),
    summary: formData.get("summary") || "",
    model: formData.get("model") || undefined,
    scope: formData.get("scope") || "",
    deliverables: splitLines(formData.get("deliverables")),
    exclusions: splitLines(formData.get("exclusions")),
    timeline: formData.get("timeline") || "",
    investment: formData.get("investment") || null,
    currency: formData.get("currency") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the proposal details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;
  const reference = await uniqueReference("proposals", "PROP");

  // Snapshot the reporting-currency equivalent now, at today's rate, so the
  // proposal's contribution to a cross-currency total never changes afterwards.
  // A failure here leaves the reporting columns null, which excludes the
  // proposal from the converted total rather than guessing at a rate.
  const fx = await convert(
    data.investment,
    data.currency,
    await reportingCurrency(),
    new Date().toISOString().slice(0, 10),
  );

  const proposal = await queryOne<{ id: string }>(
    `INSERT INTO proposals (reference, client_id, lead_id, title, summary, model, scope, deliverables, exclusions, timeline, investment, currency, created_by,
                            reporting_currency, reporting_amount, fx_rate, fx_rate_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [
      reference, data.client_id, data.lead_id, data.title, data.summary, data.model,
      data.scope, data.deliverables, data.exclusions, data.timeline, data.investment,
      data.currency, session.staffId,
      fx?.currency ?? null, fx?.amount ?? null, fx?.rate ?? null, fx?.rateDate ?? null,
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "proposal.created",
      entityType: "proposal",
      entityId: proposal?.id,
      metadata: { leadId, title: data.title, reference },
      ...meta,
    },
  );

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/proposals");
  return { ok: true, message: "Proposal created." };
}

function splitLines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value.split("\n").map((s) => s.trim()).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Email (from lead)                                                          */
/* -------------------------------------------------------------------------- */

export async function sendLeadEmailAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead reference." };
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("email.send")) {
    return { ok: false, error: "Your role cannot send email." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = outboundEmailSchema.safeParse({
    to: String(formData.get("to") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    cc: String(formData.get("cc") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    subject: formData.get("subject"),
    body: formData.get("body"),
    lead_id: leadId,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the message.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;
  const rendered = outboundEmailTemplate({ body: data.body, leadName: null });

  const result = await sendMail({
    kind: "OUTBOUND",
    to: data.to.join(", "),
    subject: data.subject,
    text: rendered.text,
    html: rendered.html,
    relatedType: "lead",
    relatedId: leadId,
  });

  const emailId = await recordEmail({
    direction: "OUTBOUND",
    leadId,
    fromAddress: fromAddress("business"),
    toAddresses: data.to,
    ccAddresses: data.cc,
    subject: data.subject,
    bodyText: data.body,
    bodyHtml: rendered.html,
    status: result.delivery === "failed" ? "FAILED" : "SENT",
    errorMessage: result.error ?? null,
    clientVisible: true,
    createdBy: session.staffId,
  });

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "email.sent",
      entityType: "lead",
      entityId: leadId,
      metadata: { emailId, to: data.to, subject: data.subject, delivery: result.delivery },
      ...meta,
    },
  );

  revalidatePath(`/admin/leads/${leadId}`);
  return {
    ok: true,
    message:
      result.delivery === "dev"
        ? "Recorded. SMTP is not configured, so this is in the outbox rather than sent."
        : "Email sent.",
  };
}
