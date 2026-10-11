"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { outboundEmailSchema, fieldErrors } from "@/lib/validation";
import { recordEmail } from "@/lib/data/email";
import { fromAddress, sendMail } from "@/lib/mail/smtp";
import { verifySmtpChannel, type EmailChannel } from "@/lib/mail/providers";
import { outboundEmailTemplate } from "@/lib/mail/outbound-template";
import type { ActionResult } from "./leads";

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
