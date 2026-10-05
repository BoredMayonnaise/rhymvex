"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne, tx } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/rbac";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
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
  portalInviteSchema,
  proposalSchema,
  settingsSchema,
  staffInviteSchema,
} from "@/lib/validation";
import type { LeadStatus } from "@/lib/data/leads";
import { recordEmail } from "@/lib/data/email";
import {
  InvitationError,
  issuePortalInvitation,
  issueStaffInvitation,
  revokeInvitation,
} from "@/lib/auth/invitations";
import {
  portalInvitationEmail,
  staffInvitationEmail,
} from "@/lib/mail/invitation-templates";
import { fromAddress, sendMail, siteUrl } from "@/lib/mail/smtp";
import { verifySmtpConnection, verifySmtpChannel, type EmailChannel } from "@/lib/mail/providers";
import { outboundEmailTemplate } from "@/lib/mail/outbound-template";

/**
 * Lead actions.
 *
 * Every one re-checks the session and the permission server-side, and takes
 * the CSRF token from the form. A hidden button or a client-side check is not
 * authorisation, so nothing here trusts the caller about who they are.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string; fields?: Record<string, string> };

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
         lost_reason = COALESCE($6, lost_reason),
         updated_at = now()
       WHERE id = $7`,
      [
        data.status ?? null,
        formData.has("assigned_to"),
        data.assigned_to ?? null,
        data.recommended_model ?? null,
        data.estimated_value ?? null,
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
/* Bookings, proposals, email                                                 */
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
  return { ok: true, message: "Booking created." };
}

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
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the proposal details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;
  const reference = await uniqueReference("proposals", "PROP");

  const proposal = await queryOne<{ id: string }>(
    `INSERT INTO proposals (reference, client_id, lead_id, title, summary, model, scope, deliverables, exclusions, timeline, investment, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      reference, data.client_id, data.lead_id, data.title, data.summary, data.model,
      data.scope, data.deliverables, data.exclusions, data.timeline, data.investment,
      session.staffId,
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

export type SmtpTestActionResult = {
  ok: boolean;
  message: string;
  channel?: EmailChannel;
  latencyMs?: number;
  provider?: string;
  host?: string;
  port?: number;
  user?: string;
  hint?: string;
};

export async function testSmtpConnectionAction(
  _prev: SmtpTestActionResult | null,
  formData: FormData,
): Promise<SmtpTestActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, message: "Not signed in." };
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, message: "Your session expired. Reload the page and try again." };
  }

  const rawChannel = formData.get("channel");
  const channel: EmailChannel = rawChannel === "system" ? "system" : "business";

  const result = await verifySmtpChannel(channel);
  if (result.ok) {
    return {
      ok: true,
      message: `Connection successful (${result.latencyMs}ms). TLS handshake & authentication verified.`,
      channel,
      latencyMs: result.latencyMs,
      provider: result.provider,
      host: result.host,
      port: result.port,
      user: result.user,
    };
  }

  return {
    ok: false,
    message: result.error || "Connection test failed.",
    channel,
    latencyMs: result.latencyMs,
    provider: result.provider,
    host: result.host,
    port: result.port,
    user: result.user,
    hint: result.hint,
  };
}

/* -------------------------------------------------------------------------- */
/* Invitations                                                                */
/* -------------------------------------------------------------------------- */

export async function inviteToPortalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("clients.portal_invite")) {
    return { ok: false, error: "Your role cannot invite clients to the portal." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) return { ok: false, error: "Missing client reference." };

  const parsed = portalInviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role_title: formData.get("role_title") || "",
    expires_in_hours: formData.get("expires_in_hours") || 168,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();

  try {
    const { invitation, token } = await issuePortalInvitation({
      clientId,
      email: parsed.data.email,
      name: parsed.data.name,
      roleTitle: parsed.data.role_title,
      expiresInHours: parsed.data.expires_in_hours,
      actor: { id: session.staffId, name: session.name, email: session.email },
      meta,
    });

    // The raw token exists only here, in this email. The database holds a
    // SHA-256 digest, so a database compromise cannot mint a portal account.
    const email = portalInvitationEmail({
      kind: "PORTAL",
      to: parsed.data.email,
      name: parsed.data.name,
      clientName: invitation.client_name,
      invitedBy: session.name,
      inviteUrl: `${siteUrl()}/invite?token=${encodeURIComponent(token)}`,
      expiresInHours: parsed.data.expires_in_hours,
    });

    const result = await sendMail({
      kind: "PORTAL_INVITATION",
      to: parsed.data.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      relatedType: "invitation",
      relatedId: invitation.id,
    });

    await recordEmail({
      direction: "OUTBOUND",
      clientId,
      fromAddress: fromAddress("business"),
      toAddresses: [parsed.data.email],
      subject: email.subject,
      bodyText: email.text,
      bodyHtml: email.html,
      status: result.delivery === "failed" ? "FAILED" : "SENT",
      errorMessage: result.error ?? null,
      // The invitation link is a credential. It is never exposed to a client
      // who already has portal access.
      clientVisible: false,
      createdBy: session.staffId,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/staff");

    return {
      ok: true,
      message:
        result.delivery === "dev"
          ? "Invitation created. SMTP is not configured, so the link is in the outbox rather than sent."
          : "Invitation sent.",
    };
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, error: error.message };
    }
    console.error("portal invitation failed:", error);
    return { ok: false, error: "Could not create the invitation. Try again." };
  }
}

/* -------------------------------------------------------------------------- */
/* Team access                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Change a team member's role, or disable their account.
 *
 * Two lockouts are guarded against, and both are the kind that end with nobody
 * able to reach the workspace:
 *
 *   You cannot change your own role or disable yourself. An admin who promotes
 *   themselves to DESIGNER has just removed their own route back.
 *
 *   You cannot remove the last active ADMIN. Demoting or disabling the only
 *   administrator leaves a workspace whose remaining members cannot grant the
 *   permission back to anybody.
 *
 * Sessions are only cleared on deactivation. A role change does not need them:
 * `getStaffSession` reads `role` and `extra_permissions` from staff on every
 * request and recomputes the permission set, so the new permissions apply on the
 * next request without anyone being signed out. Disabling does clear them,
 * because the account is gone and a row that can only ever fail its lookup is
 * just litter.
 */
export async function updateStaffAccessAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.manage")) {
    return { ok: false, error: "Your role cannot change team access." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const staffId = String(formData.get("staff_id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  const nextActive = String(formData.get("active") ?? "") === "true";

  if (!isRecordId(staffId)) {
    return { ok: false, error: "Unknown team member." };
  }
  if (!(ROLES as readonly string[]).includes(nextRole)) {
    return { ok: false, error: "Unknown role." };
  }

  if (staffId === session.staffId) {
    return {
      ok: false,
      error: "You cannot change your own role or disable your own account.",
    };
  }

  const target = await queryOne<{
    id: string;
    name: string;
    role: string;
    active: boolean;
  }>("SELECT id, name, role, active FROM staff WHERE id = $1", [staffId]);

  if (!target) return { ok: false, error: "That team member no longer exists." };

  // Losing admin is only allowed while another one remains.
  const losesAdmin = target.role === "ADMIN" && (nextRole !== "ADMIN" || !nextActive);
  if (losesAdmin) {
    const others = await queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM staff WHERE role = 'ADMIN' AND active AND id <> $1",
      [staffId],
    );
    if ((others?.count ?? 0) === 0) {
      return {
        ok: false,
        error: "That is the last active admin. Promote somebody else first.",
      };
    }
  }

  const roleChanged = target.role !== nextRole;
  const activeChanged = target.active !== nextActive;
  if (!roleChanged && !activeChanged) {
    return { ok: true, message: "Nothing to change." };
  }

  const meta = await requestMeta();

  await tx(async (client) => {
    await client.query(
      "UPDATE staff SET role = $1, active = $2 WHERE id = $3",
      [nextRole, nextActive, staffId],
    );

    if (activeChanged && !nextActive) {
      await client.query("DELETE FROM sessions WHERE staff_id = $1", [staffId]);
    }

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: "staff.access_changed",
        entityType: "staff",
        entityId: staffId,
        metadata: {
          member: target.name,
          fromRole: target.role,
          toRole: nextRole,
          fromActive: target.active,
          toActive: nextActive,
        },
        ...meta,
      },
      client,
    );
  });

  revalidatePath("/admin/staff");

  return {
    ok: true,
    message: activeChanged && !nextActive
      ? `${target.name} can no longer sign in.`
      : `${target.name} is now ${humanise(nextRole)}.`,
  };
}

export async function revokeInvitationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.manage") && !session.permissions.has("clients.portal_invite")) {
    return { ok: false, error: "Your role cannot revoke invitations." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const id = String(formData.get("invitation_id") ?? "");
  if (!id) return { ok: false, error: "Missing invitation reference." };

  const meta = await requestMeta();
  const revoked = await revokeInvitation(id, { id: session.staffId, name: session.name }, meta);

  revalidatePath("/admin/staff");
  revalidatePath("/admin/clients");

  return revoked
    ? { ok: true, message: "Invitation withdrawn. The link no longer works." }
    : { ok: false, error: "That invitation is no longer pending." };
}

/* -------------------------------------------------------------------------- */
/* Business email composition                                                 */
/* -------------------------------------------------------------------------- */

export async function sendBusinessEmailAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
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
    lead_id: formData.get("lead_id") || null,
    client_id: formData.get("client_id") || null,
    project_id: formData.get("project_id") || null,
    proposal_id: formData.get("proposal_id") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the message.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;
  const rendered = outboundEmailTemplate({ body: data.body });

  const result = await sendMail({
    kind: "OUTBOUND",
    to: data.to.join(", "),
    subject: data.subject,
    text: rendered.text,
    html: rendered.html,
    relatedType: data.client_id ? "client" : data.lead_id ? "lead" : null,
    relatedId: data.client_id ?? data.lead_id ?? null,
  });

  const emailId = await recordEmail({
    direction: "OUTBOUND",
    leadId: data.lead_id,
    clientId: data.client_id,
    projectId: data.project_id,
    proposalId: data.proposal_id,
    fromAddress: process.env.SMTP_FROM?.trim() || "Rhymvex <support@rhymvex.space>",
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

  // Attached to whichever business record it was composed against, so the
  // conversation is reachable from the lead, client, project and proposal.
  const auditEntity =
    data.lead_id
      ? { type: "lead", id: data.lead_id as string }
      : data.client_id
        ? { type: "client", id: data.client_id as string }
        : data.project_id
          ? { type: "project", id: data.project_id as string }
          : { type: "email", id: emailId };

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "email.sent",
      entityType: auditEntity.type,
      entityId: auditEntity.id,
      metadata: { emailId, to: data.to, subject: data.subject, delivery: result.delivery },
      ...meta,
    },
  );

  revalidatePath("/admin/email");
  if (data.lead_id) revalidatePath(`/admin/leads/${data.lead_id}`);
  if (data.client_id) revalidatePath(`/admin/clients/${data.client_id}`);

  return {
    ok: true,
    message:
      result.delivery === "dev"
        ? "Recorded. SMTP is not configured, so this is in the outbox rather than sent."
        : "Email sent.",
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("settings.write")) {
    return { ok: false, error: "Your role cannot change settings." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const rawSla = String(formData.get("response_sla_minutes") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    company_name: formData.get("company_name"),
    contact_email: formData.get("contact_email"),
    notification_email: formData.get("notification_email"),
    // Empty means "no promise", which is a real and deliberate setting.
    response_sla_minutes: rawSla === "" ? null : Number(rawSla),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the settings.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  await query(
    `INSERT INTO org_settings
       (id, company_name, contact_email, notification_email, response_sla_minutes, timezone, currency, updated_at)
     VALUES (true, $1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       contact_email = EXCLUDED.contact_email,
       notification_email = EXCLUDED.notification_email,
       response_sla_minutes = EXCLUDED.response_sla_minutes,
       timezone = EXCLUDED.timezone,
       currency = EXCLUDED.currency,
       updated_at = now()`,
    [
      data.company_name,
      data.contact_email,
      data.notification_email,
      // 0 is normalised to null so "no promise" has exactly one representation.
      data.response_sla_minutes ? data.response_sla_minutes : null,
      data.timezone,
      data.currency.toUpperCase(),
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "settings.updated",
      entityType: "org_settings",
      entityId: null,
      metadata: {
        response_sla_minutes: data.response_sla_minutes || null,
        currency: data.currency.toUpperCase(),
      },
      ...meta,
    },
  );

  revalidatePath("/admin/settings");
  revalidatePath("/intake");
  revalidatePath("/admin");

  return {
    ok: true,
    message: data.response_sla_minutes
      ? `Saved. Clients will now be told a person replies within ${data.response_sla_minutes} minutes.`
      : "Saved. No response-time promise is made to clients.",
  };
}

/* -------------------------------------------------------------------------- */
/* Team invitations                                                           */
/* -------------------------------------------------------------------------- */

export async function inviteStaffAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.invite")) {
    return { ok: false, error: "Your role cannot invite team members." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = staffInviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    permissions: formData.getAll("permissions").map(String),
    expires_in_hours: formData.get("expires_in_hours") || 72,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the details.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const { invitation, token } = await issueStaffInvitation({
    email: data.email,
    name: data.name,
    role: data.role,
    permissions: data.permissions,
    expiresInHours: data.expires_in_hours,
    actor: { id: session.staffId, name: session.name, email: session.email },
    meta,
  });

  const email = staffInvitationEmail({
    kind: "STAFF",
    to: data.email,
    name: data.name,
    role: humanise(data.role),
    invitedBy: session.name,
    // The raw token exists only here. The database stores a SHA-256 digest.
    inviteUrl: `${siteUrl()}/invite?token=${encodeURIComponent(token)}`,
    expiresInHours: data.expires_in_hours,
  });

  const result = await sendMail({
    kind: "STAFF_INVITATION",
    to: data.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    relatedType: "invitation",
    relatedId: invitation.id,
  });

  await recordEmail({
    direction: "OUTBOUND",
    fromAddress: fromAddress("system"),
    toAddresses: [data.email],
    subject: email.subject,
    bodyText: email.text,
    bodyHtml: email.html,
    status: result.delivery === "failed" ? "FAILED" : "SENT",
    errorMessage: result.error ?? null,
    // The link is a credential, so it is never exposed to a client.
    clientVisible: false,
    createdBy: session.staffId,
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin/security");

  return {
    ok: true,
    message:
      result.delivery === "dev"
        ? `Invitation created for ${data.email}. SMTP is not configured, so the link is in the outbox.`
        : `Invitation sent to ${data.email}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Proposals                                                                  */
/* -------------------------------------------------------------------------- */

export async function updateProposalStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("proposals.write")) {
    return { ok: false, error: "Your role cannot change proposals." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const proposalId = String(formData.get("proposal_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "WITHDRAWN"];
  if (!proposalId || !allowed.includes(status)) {
    return { ok: false, error: "Invalid status change." };
  }

  // Sending is the commercial gate, and it is separate from editing on purpose:
  // OPERATIONS can move a proposal through DRAFT/WITHDRAWN but only an account
  // manager can put pricing and scope in front of a client. The UI already
  // disables the transition on `canSend`, which is a usability affordance and not
  // a boundary, so the target status has to be checked here against the real
  // permission rather than against the blanket `proposals.write` above.
  if (status === "SENT" && !session.permissions.has("proposals.send")) {
    return { ok: false, error: "Your role cannot send proposals." };
  }

  const meta = await requestMeta();

  const proposal = await queryOne<{
    id: string;
    reference: string;
    title: string;
    status: string;
    client_id: string | null;
    lead_id: string | null;
  }>("SELECT id, reference, title, status, client_id, lead_id FROM proposals WHERE id = $1", [proposalId]);

  if (!proposal) return { ok: false, error: "Proposal not found." };

  await tx(async (client) => {
    await client.query(
      `UPDATE proposals SET
         status = $1,
         sent_at = CASE WHEN $1 = 'SENT' AND sent_at IS NULL THEN now() ELSE sent_at END,
         decided_at = CASE WHEN $1 IN ('ACCEPTED','DECLINED') THEN now() ELSE decided_at END,
         updated_at = now()
       WHERE id = $2`,
      [status, proposalId],
    );

    // Accepting a proposal advances the lead, so the pipeline reflects reality
    // without anyone re-entering the status in two places.
    if (status === "ACCEPTED" && proposal.lead_id) {
      await client.query(
        "UPDATE leads SET status = 'NEGOTIATION', updated_at = now() WHERE id = $1 AND status IN ('PROPOSAL','CONSULTATION','QUALIFIED','REVIEWING')",
        [proposal.lead_id],
      );
    }

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: status === "SENT" ? "proposal.sent" : "proposal.updated",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { from: proposal.status, to: status, reference: proposal.reference },
        ...meta,
      },
      client,
    );
  });

  revalidatePath(`/admin/proposals/${proposalId}`);
  revalidatePath("/admin/proposals");
  revalidatePath("/admin");

  return { ok: true, message: `Proposal marked ${humanise(status).toLowerCase()}.` };
}
