import { siteUrl } from "./smtp";
import { escapeHtml } from "./templates";

/**
 * Invitation and welcome emails.
 *
 * The invitation link is a single-use, expiring token. It is the only thing in
 * the email, so forwarding it grants nothing permanent: the first person to
 * accept creates the account, and after that the token is dead.
 */

const BRAND = {
  black: "#0B0F14",
  slate: "#151B24",
  white: "#F5F7FA",
  volt: "#6EE7FF",
  border: "rgba(245,247,250,0.12)",
  muted: "rgba(245,247,250,0.62)",
};

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
      <p style="margin:0;font:600 11px/1 -apple-system,Inter,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.volt};">Rhymvex</p>
      <h1 style="margin:12px 0 0;font:700 22px/1.25 'Space Grotesk',Inter,sans-serif;color:${BRAND.white};letter-spacing:-0.02em;">${escapeHtml(title)}</h1>
    </td></tr>
    <tr><td style="padding:20px 32px 32px;font:400 15px/1.65 -apple-system,Inter,sans-serif;color:${BRAND.muted};">${body}</td></tr>
    <tr><td style="padding:0 32px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.border};font:400 12px/1.6 -apple-system,Inter,sans-serif;color:rgba(245,247,250,0.4);">Rhymvex &middot; Build with rhythm.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:${BRAND.volt};color:${BRAND.black};text-decoration:none;font:600 14px/1 Inter,sans-serif;padding:13px 20px;border-radius:8px;">${escapeHtml(label)}</a>
  </p>`;
}

function expiryNote(hours: number): string {
  const window =
    hours >= 48
      ? `${Math.round(hours / 24)} days`
      : hours % 24 === 0
        ? `${hours / 24} day${hours === 24 ? "" : "s"}`
        : `${hours} hours`;
  return `This link works once and expires in ${window}. If it has expired, ask us to send another.`;
}

export type StaffInviteEmail = {
  kind: "STAFF";
  to: string;
  name: string;
  role: string;
  invitedBy: string;
  inviteUrl: string;
  expiresInHours: number;
};

export function staffInvitationEmail(input: StaffInviteEmail) {
  const subject = "You're invited to the Rhymvex workspace";

  const text = `Hi ${input.name.split(" ")[0]},

${input.invitedBy} has invited you to join the Rhymvex workspace as ${input.role}.

Accept your invitation:
${input.inviteUrl}

${expiryNote(input.expiresInHours)}

The link creates your account and asks you to set a password. It can't be used twice, and it doesn't give anyone access before you set that password.

—
Rhymvex`;

  const body = `
    <p style="margin:0 0 16px;color:${BRAND.white};">Hi ${escapeHtml(input.name.split(" ")[0])},</p>
    <p style="margin:0 0 16px;">${escapeHtml(input.invitedBy)} has invited you to join the Rhymvex workspace.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:10px;margin:0 0 4px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 6px;font:600 10px/1 Inter,sans-serif;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,247,250,0.4);">Role</p>
        <p style="margin:0;font:600 15px/1.4 Inter,sans-serif;color:${BRAND.volt};">${escapeHtml(input.role)}</p>
      </td></tr>
    </table>
    ${button(input.inviteUrl, "Accept invitation")}
    <p style="margin:0 0 8px;font-size:13px;">${escapeHtml(expiryNote(input.expiresInHours))}</p>
    <p style="margin:0;font-size:13px;">The link asks you to set your own password. Until you do, nobody can sign in as you.</p>
    <p style="margin:20px 0 0;font-size:13px;color:rgba(245,247,250,0.4);">
      If you weren't expecting this, ignore this email. Nothing has been created yet.
    </p>`;

  return { subject, text, html: shell("Join the Rhymvex workspace", "You've been invited.", body) };
}

export type PortalInviteEmail = {
  kind: "PORTAL";
  to: string;
  name: string;
  clientName: string | null;
  invitedBy: string;
  inviteUrl: string;
  expiresInHours: number;
};

export function portalInvitationEmail(input: PortalInviteEmail) {
  const subject = "Your Rhymvex client portal is ready";

  const text = `Hi ${input.name.split(" ")[0]},

${input.invitedBy} has set up portal access for you${input.clientName ? ` at ${input.clientName}` : ""}.

Once you're in, you'll see the current state of your project, what's happening next, proposals and contracts you've received, invoices, and anything we've shared with you.

Set your password and get in:
${input.inviteUrl}

${expiryNote(input.expiresInHours)}

—
Rhymvex`;

  const body = `
    <p style="margin:0 0 16px;color:${BRAND.white};">Hi ${escapeHtml(input.name.split(" ")[0])},</p>
    <p style="margin:0 0 16px;">${escapeHtml(input.invitedBy)} has set up portal access for you${input.clientName ? ` at <span style="color:${BRAND.white};">${escapeHtml(input.clientName)}</span>` : ""}.</p>
    <p style="margin:0 0 4px;">Once you&apos;re in you&apos;ll be able to see:</p>
    <ul style="margin:0 0 20px;padding-left:20px;">
      <li style="margin:0 0 6px;">Where your project is right now, and what happens next</li>
      <li style="margin:0 0 6px;">Proposals and contracts, with anything that needs your signature</li>
      <li style="margin:0 0 6px;">Invoices and their payment status</li>
      <li style="margin:0 0 6px;">Files we&apos;ve shared, and messages from your team</li>
    </ul>
    ${button(input.inviteUrl, "Set your password and get in")}
    <p style="margin:0 0 8px;font-size:13px;">${escapeHtml(expiryNote(input.expiresInHours))}</p>
    <p style="margin:0;font-size:13px;color:rgba(245,247,250,0.4);">
      If this wasn't expected, ignore it and nothing happens.
    </p>`;

  return { subject, text, html: shell("Your client portal is ready", "Set your password to get in.", body) };
}

export type WelcomeEmail = {
  kind: "WELCOME";
  to: string;
  name: string;
  portalUrl: string;
};

export function invitationEmail(input: WelcomeEmail) {
  const subject = "You're in — your Rhymvex portal";

  const text = `Hi ${input.name.split(" ")[0]},

Your account is set up. Everything about your engagement lives here now.

Open your portal:
${input.portalUrl}

If anything looks wrong or missing, reply to this email and it reaches the person who invited you.

—
Rhymvex`;

  const body = `
    <p style="margin:0 0 16px;color:${BRAND.white};">Hi ${escapeHtml(input.name.split(" ")[0])},</p>
    <p style="margin:0 0 16px;">Your account is set up. Everything about your engagement lives in one place now.</p>
    ${button(input.portalUrl, "Open your portal")}
    <p style="margin:0;font-size:13px;color:rgba(245,247,250,0.4);">
      If anything looks wrong or missing, reply to this email and it reaches the person who invited you.
    </p>`;

  return { subject, text, html: shell("You're in", "Your portal is ready.", body) };
}

export { siteUrl };
