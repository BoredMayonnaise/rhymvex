import { createLead, type Lead } from "@/lib/data/leads";
import { getOrgSettings, getResponseSlaMinutes } from "@/lib/data/org";
import { clientConfirmation, internalLeadNotification } from "@/lib/mail/templates";
import { internalNotificationAddress, sendMail, siteUrl } from "@/lib/mail/smtp";
import { recordEmail } from "@/lib/data/email";
import { normaliseBand, type IntakeInput } from "@/lib/validation";
import { leadSource } from "@/lib/locales";
import type { RequestMeta } from "@/lib/audit";

/**
 * The intake workflow, in the order the platform promises it:
 *
 *   validate → lead created → audit event → client confirmation →
 *   internal notification → success state
 *
 * The lead and its audit entry commit together. Email is sent afterwards, and
 * deliberately not inside the transaction: a mail server being down must not
 * lose a request from someone who trusted us with their situation. A failed
 * send is recorded and surfaced, never silently swallowed.
 */

export type IntakeResult = {
  ok: true;
  reference: string;
  /** Progress rows for the success screen. Mirrors what actually happened. */
  steps: IntakeStep[];
  emailDelivered: boolean;
};

export type IntakeStep = {
  key: "received" | "recorded" | "notified" | "consultation";
  label: string;
  done: boolean;
};

export async function submitIntake(
  input: IntakeInput,
  meta: RequestMeta,
): Promise<IntakeResult> {
  // The band is resolved to a currency-correct label here rather than trusting
  // whatever text arrived, so a lead can never carry a range whose numbers are
  // paired with a symbol from a different currency.
  const band = normaliseBand({
    currency: input.currency,
    budget_band_key: input.budget_band_key,
    budget_band: input.budget_band,
  });

  const lead = await createLead({
    name: input.name,
    email: input.email,
    company: input.company || null,
    role_title: input.role_title || null,
    phone: input.phone || null,
    website: input.website || null,
    situation: input.situation,
    message: input.message,
    budget_band: band.label || null,
    timeline: input.timeline || null,
    referral_source: input.referral_source || null,
    source: leadSource(input.region, band.currency.code),
    submissionIp: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const slaMinutes = await getResponseSlaMinutes();

  // 1. Confirmation to the client.
  const confirmation = clientConfirmation(
    {
      name: lead.name,
      email: lead.email,
      company: lead.company,
      situation: lead.situation,
      message: lead.message,
      reference: lead.reference,
      submittedAt: lead.submitted_at,
    },
    slaMinutes,
  );

  const clientResult = await sendMail({
    kind: "CLIENT_CONFIRMATION",
    to: lead.email,
    subject: confirmation.subject,
    text: confirmation.text,
    html: confirmation.html,
    relatedType: "lead",
    relatedId: lead.id,
  });

  // 2. Internal alert. The workspace link only ever goes to the configured
  //    internal address, never to the submitting visitor.
  const notification = internalLeadNotification({
    id: lead.id,
    reference: lead.reference,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    situation: lead.situation,
    message: lead.message,
    submittedAt: lead.submitted_at,
    source: lead.source,
    ip: meta.ipAddress ?? null,
  });

  const internalResult = await sendMail({
    kind: "INTERNAL_NOTIFICATION",
    to: internalNotificationAddress(),
    subject: notification.subject,
    text: notification.text,
    html: notification.html,
    relatedType: "lead",
    relatedId: lead.id,
  });

  // 3. Both messages enter the Business Email record for this lead, so the
  //    thread is visible in the workspace.
  await recordEmail({
    direction: "OUTBOUND",
    leadId: lead.id,
    fromAddress: process.env.SMTP_FROM?.trim() || "Rhymvex <hello@rhymvex.com>",
    toAddresses: [lead.email],
    subject: confirmation.subject,
    bodyText: confirmation.text,
    bodyHtml: confirmation.html,
    status: clientResult.delivery === "failed" ? "FAILED" : "SENT",
    errorMessage: clientResult.error ?? null,
    clientVisible: true,
  });

  await recordEmail({
    direction: "OUTBOUND",
    leadId: lead.id,
    fromAddress: process.env.SMTP_FROM?.trim() || "Rhymvex <hello@rhymvex.com>",
    toAddresses: [internalNotificationAddress()],
    subject: notification.subject,
    bodyText: notification.text,
    bodyHtml: notification.html,
    // Internal-only. client_visible false keeps this out of any client view.
    clientVisible: false,
    status: internalResult.delivery === "failed" ? "FAILED" : "SENT",
    errorMessage: internalResult.error ?? null,
  });

  const emailDelivered = clientResult.delivery !== "failed";

  return {
    ok: true,
    reference: lead.reference,
    emailDelivered,
    steps: [
      { key: "received", label: "Request received", done: true },
      { key: "recorded", label: "Information recorded", done: true },
      // "Team notified" is only claimed when the notification actually left
      // the building, or was written to the outbox in development.
      { key: "notified", label: "Rhymvex team notified", done: internalResult.delivery !== "failed" },
      { key: "consultation", label: "Human consultation", done: false },
    ],
  };
}

export { siteUrl };
export type { Lead };
