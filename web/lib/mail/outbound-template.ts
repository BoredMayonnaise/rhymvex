import { escapeHtml, siteUrl } from "./templates";
import { siteUrl as origin } from "./smtp";

/**
 * Staff-authored outbound email.
 *
 * Deliberately plain: the body is the staff member's own words, wrapped in the
 * brand shell. Anything more structured would start editing what someone wrote
 * before they send it, which is the wrong trade for a business relationship.
 */

const BRAND = {
  black: "#0B0F14",
  slate: "#151B24",
  white: "#F5F7FA",
  volt: "#6EE7FF",
  border: "rgba(245,247,250,0.12)",
  muted: "rgba(245,247,250,0.68)",
};

export function outboundEmailTemplate({ body }: { body: string; leadName?: string | null }) {
  const text = `${body.trim()}

—
${origin()}
${siteUrl()}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${BRAND.black};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.black};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.slate};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0;font:600 11px/1 Inter,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.volt};">Rhymvex</p>
    </td></tr>
    <tr><td style="padding:20px 32px 28px;font:400 15px/1.7 Inter,sans-serif;color:${BRAND.white};">
      ${escapeHtml(body.trim()).replace(/\n{2,}/g, "</p><p style='margin:0 0 15px'>").replace(/\n/g, "<br>")}
    </td></tr>
    <tr><td style="padding:0 32px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid ${BRAND.border};font:400 12px/1.6 Inter,sans-serif;color:rgba(245,247,250,0.4);">
        Rhymvex &middot; Build with rhythm. &middot; <a href="${origin()}" style="color:${BRAND.volt};text-decoration:none;">${origin()}</a>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { text, html };
}
