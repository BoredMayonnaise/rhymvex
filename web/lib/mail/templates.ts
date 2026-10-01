/**
 * Transactional email templates.
 *
 * Voice follows the brand guidelines in docs/AGENTS.md: clear, confident,
 * structured, never corporate. The client confirmation reassures without
 * promising a timing we cannot keep, because the timing copy is driven by
 * org_settings.response_sla_minutes rather than hard-coded.
 */

import { siteUrl, fromAddress, internalNotificationAddress } from "./smtp";

const BRAND = {
  black: "#0B0F14",
  slate: "#151B24",
  white: "#F5F7FA",
  volt: "#6EE7FF",
  border: "rgba(245,247,250,0.12)",
  muted: "rgba(245,247,250,0.62)",
};

/** Minimal dark shell. Inline styles, so it renders in clients with no CSS. */
function shell(title: string, preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.black};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.black};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.slate};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0;font:600 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.volt};">
        Rhymvex
      </p>
      <h1 style="margin:12px 0 0;font:700 22px/1.25 'Space Grotesk',Inter,-apple-system,sans-serif;color:${BRAND.white};letter-spacing:-0.02em;">
        ${escapeHtml(title)}
      </h1>
    </td></tr>
    <tr><td style="padding:20px 32px 32px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:${BRAND.muted};">
      ${body}
    </td></tr>
    <tr><td style="padding:0 32px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.border};font:400 12px/1.6 -apple-system,BlinkMacSystemFont,Inter,sans-serif;color:rgba(245,247,250,0.4);">
        Rhymvex &middot; Build with rhythm.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Signed-off footer block, shared by both templates. */
function signOff(): string {
  return `<p style="margin:24px 0 0;">
    Rhymvex<br>
    <span style="color:rgba(245,247,250,0.45);">Build with rhythm.</span>
  </p>`;
}

/**
 * Timing sentence.
 *
 * Only promises a timeframe when the organisation has actually configured an
 * SLA. Otherwise it says nothing about when, which is the honest version.
 */
function timingSentence(slaMinutes: number | null): string {
  if (!slaMinutes || slaMinutes <= 0) {
    return `A real person will review your request and reach out to understand your business before recommending what happens next.`;
  }
  const hours = slaMinutes / 60;
  const window =
    Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${slaMinutes} minutes`;
  return `A real person will review your request within ${window} and reach out to understand your business before recommending what happens next.`;
}

export type IntakeLead = {
  name: string;
  email: string;
  company?: string | null;
  situation: string;
  message: string;
  reference: string;
  submittedAt: Date;
};

/* -------------------------------------------------------------------------- */
/* Client confirmation                                                        */
/* -------------------------------------------------------------------------- */

export function clientConfirmation(lead: IntakeLead, slaMinutes: number | null) {
  const subject = "We received your request — Rhymvex";

  const text = `Hi ${lead.name.split(" ")[0]},

We've got it.

Your message has been received by the Rhymvex team. We've captured your details and what you're trying to solve.

${timingSentence(slaMinutes)}

You don't need to do anything else right now. If you want to add context, just reply to this email and it lands with the same person reviewing your request.

What you told us
---------------
${lead.company ? `Company:    ${lead.company}\n` : ""}Situation:   ${lead.situation}
Reference:  ${lead.reference}
Received:   ${lead.submittedAt.toISOString()}

—
Rhymvex
Build with rhythm.
${siteUrl()}`;

  const body = `
    <p style="margin:0 0 16px;color:${BRAND.white};">Hi ${escapeHtml(lead.name.split(" ")[0])},</p>
    <p style="margin:0 0 16px;font:700 18px/1.3 'Space Grotesk',Inter,sans-serif;color:${BRAND.volt};">We've got it.</p>
    <p style="margin:0 0 16px;">Your message has been received by the Rhymvex team. We've captured your details and what you're trying to solve.</p>
    <p style="margin:0 0 16px;">${escapeHtml(timingSentence(slaMinutes))}</p>
    <p style="margin:0 0 16px;">You don't need to do anything else right now. If you want to add context, just reply to this email and it lands with the same person reviewing your request.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;border:1px solid ${BRAND.border};border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 10px;font:600 10px/1 -apple-system,Inter,sans-serif;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,247,250,0.4);">What you told us</p>
        ${lead.company ? `<p style="margin:0 0 6px;font:400 14px/1.6 Inter,sans-serif;color:${BRAND.white};"><span style="color:rgba(245,247,250,0.45);">Company</span> &nbsp;${escapeHtml(lead.company)}</p>` : ""}
        <p style="margin:0 0 6px;font:400 14px/1.6 Inter,sans-serif;color:${BRAND.white};"><span style="color:rgba(245,247,250,0.45);">Situation</span> &nbsp;${escapeHtml(lead.situation)}</p>
        <p style="margin:0;font:400 14px/1.6 Inter,sans-serif;color:${BRAND.white};"><span style="color:rgba(245,247,250,0.45);">Reference</span> &nbsp;${escapeHtml(lead.reference)}</p>
      </td></tr>
    </table>
    ${signOff()}`;

  return { subject, text, html: shell("We received your request", "We've got it.", body) };
}

/* -------------------------------------------------------------------------- */
/* Internal new-lead notification                                             */
/* -------------------------------------------------------------------------- */

export function internalLeadNotification(lead: IntakeLead & { id: string; ip: string | null; source: string }) {
  const subject = `New Rhymvex lead — ${lead.company || lead.name}`;
  // Internal link. Only ever delivered to the configured internal address.
  const openUrl = `${siteUrl()}/admin/leads/${lead.id}`;

  const text = `New lead from the website.

Name:      ${lead.name}
Company:   ${lead.company || "—"}
Email:     ${lead.email}
Situation: ${lead.situation}

Message
-------
${lead.message}

Submitted: ${lead.submittedAt.toISOString()}
Lead ID:    ${lead.id}
Reference:  ${lead.reference}
Source:     ${lead.source}
IP:         ${lead.ip || "unknown"}

Open in the workspace:
${openUrl}

Next step: review the request, then assign it to whoever should respond.
You don't need to reply to this email — it's an internal alert.`;

  const row = (label: string, value: string) =>
    `<p style="margin:0 0 8px;font:400 14px/1.6 Inter,sans-serif;color:${BRAND.white};"><span style="display:inline-block;min-width:96px;color:rgba(245,247,250,0.45);">${label}</span>${escapeHtml(value)}</p>`;

  const body = `
    <p style="margin:0 0 18px;">A new request came in through the website intake. Nobody is assigned yet.</p>
    <div style="border:1px solid ${BRAND.border};border-radius:10px;padding:16px 18px;margin:0 0 20px;">
      ${row("Name", lead.name)}
      ${row("Company", lead.company || "—")}
      ${row("Email", lead.email)}
      ${row("Situation", lead.situation)}
    </div>
    <p style="margin:0 0 8px;font:600 10px/1 Inter,sans-serif;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,247,250,0.4);">Message</p>
    <div style="border-left:2px solid ${BRAND.volt};padding:2px 0 2px 14px;margin:0 0 20px;font-style:italic;">
      ${escapeHtml(lead.message).replace(/\n/g, "<br>")}
    </div>
    <div style="border:1px solid ${BRAND.border};border-radius:10px;padding:14px 18px;margin:0 0 22px;">
      ${row("Received", lead.submittedAt.toISOString())}
      ${row("Lead ID", lead.id)}
      ${row("Reference", lead.reference)}
      ${row("Source", lead.source)}
    </div>
    <p style="margin:0 0 20px;">
      <a href="${openUrl}" style="display:inline-block;background:${BRAND.volt};color:${BRAND.black};text-decoration:none;font:600 14px/1 Inter,sans-serif;padding:12px 18px;border-radius:8px;">Review lead</a>
    </p>
    <p style="margin:0;font-size:12px;color:rgba(245,247,250,0.4);">Internal alert. This link is only valid for signed-in Rhymvex staff.</p>`;

  return { subject, text, html: shell("New lead", lead.name, body) };
}

export { fromAddress, internalNotificationAddress, siteUrl };
