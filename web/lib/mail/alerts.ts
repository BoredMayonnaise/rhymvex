/**
 * Automated System Alerts & Error Detection.
 *
 * Dispatches operational alerts (e.g. SMTP delivery failures, database anomalies,
 * unhandled background exceptions) through the Internal System Channel (Gmail SMTP)
 * directly to the configured INTERNAL_NOTIFICATION_EMAIL.
 */

import { sendMail, internalNotificationAddress, siteUrl } from "./smtp";
import { escapeHtml } from "./templates";

export interface SystemAlertPayload {
  title: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

export async function sendSystemAlert(payload: SystemAlertPayload): Promise<void> {
  const severity = payload.severity || "WARNING";
  const recipient = internalNotificationAddress();
  const timestamp = new Date().toISOString();

  const errorMessage = payload.error
    ? payload.error instanceof Error
      ? payload.error.stack || payload.error.message
      : String(payload.error)
    : null;

  const subject = `[RHYMVEX ${severity}] ${payload.title}`;

  const contextLines = payload.context
    ? Object.entries(payload.context)
        .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join("\n")
    : "";

  const text = [
    `Rhymvex System Alert [${severity}]`,
    `==================================`,
    `Title:     ${payload.title}`,
    `Timestamp: ${timestamp}`,
    `Recipient: ${recipient}`,
    "",
    "Summary:",
    payload.message,
    "",
    errorMessage ? `Error Trace:\n${errorMessage}\n` : "",
    contextLines ? `Context:\n${contextLines}\n` : "",
    `Workspace Admin: ${siteUrl()}/admin/security`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#151B24;border:1px solid rgba(245,247,250,0.15);border-radius:12px;padding:24px;color:#F5F7FA;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;background:${
          severity === "CRITICAL" ? "#EF4444" : severity === "WARNING" ? "#F59E0B" : "#6EE7FF"
        };color:#0B0F14;">
          ${severity}
        </span>
        <span style="font-size:12px;color:rgba(245,247,250,0.5);">${timestamp}</span>
      </div>
      <h2 style="margin:0 0 12px;color:#F5F7FA;font-size:18px;">${escapeHtml(payload.title)}</h2>
      <p style="margin:0 0 16px;color:rgba(245,247,250,0.85);font-size:14px;line-height:1.6;">
        ${escapeHtml(payload.message)}
      </p>
      ${
        errorMessage
          ? `<pre style="background:#0B0F14;border:1px solid rgba(245,247,250,0.1);border-radius:8px;padding:12px;font-size:12px;color:#FF6B6B;overflow-x:auto;white-space:pre-wrap;line-height:1.5;">${escapeHtml(errorMessage)}</pre>`
          : ""
      }
      <p style="margin:16px 0 0;font-size:12px;color:rgba(245,247,250,0.4);">
        Automated alert from Rhymvex System Channel (Gmail SMTP) &middot; <a href="${siteUrl()}/admin/security" style="color:#6EE7FF;text-decoration:none;">View in Admin</a>
      </p>
    </div>
  `;

  // Dispatched via the system channel (Gmail). Never throws.
  try {
    await sendMail({
      kind: "INTERNAL_NOTIFICATION",
      channel: "system",
      to: recipient,
      subject,
      text,
      html,
      relatedType: "system_alert",
    });
  } catch (err) {
    console.error("Failed to dispatch system alert email:", err);
  }
}
