import { envInt } from "@/lib/env";
import { query } from "@/lib/db/client";

/**
 * SMTP transport.
 *
 * When SMTP_HOST is unset the transport is not created. `sendMail` then writes
 * the fully rendered message to `email_outbox` and logs a summary to the console
 * instead of sending, so the whole intake → confirmation → notification workflow
 * is observable and testable locally before real credentials exist.
 *
 * Secrets are read from the environment only. Nothing here is ever written to
 * source control, and the password is never logged.
 */

export type OutboundEmail = {
  kind:
    | "CLIENT_CONFIRMATION"
    | "INTERNAL_NOTIFICATION"
    | "STAFF_INVITATION"
    | "PORTAL_INVITATION"
    | "OUTBOUND";
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** What this message is about, so the outbox is navigable from a record. */
  relatedType?: string | null;
  relatedId?: string | null;
};

export type SendResult = {
  delivery: "sent" | "dev" | "failed";
  error?: string;
};

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function fromAddress(): string {
  return process.env.SMTP_FROM?.trim() || "Rhymvex <hello@rhymvex.com>";
}

export function internalNotificationAddress(): string {
  return (
    process.env.INTERNAL_NOTIFICATION_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
    "hello@rhymvex.com"
  );
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

// Nodemailer is only imported when actually sending, so the app does not require
// a live transport to start in development.
let transportPromise: Promise<import("nodemailer").Transporter> | null = null;

async function getTransport() {
  if (!transportPromise) {
    transportPromise = (async () => {
      const { default: nodemailer } = await import("nodemailer");
      const port = envInt("SMTP_PORT", 587);
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Implicit TLS on 465, STARTTLS otherwise.
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
        // Keep the timeout short: intake should not hang on a bad mail server.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    })();
  }
  return transportPromise;
}

async function persistToOutbox(email: OutboundEmail, result: SendResult): Promise<void> {
  await query(
    `INSERT INTO email_outbox
       (kind, to_address, subject, body_text, body_html, related_type, related_id, delivery, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      email.kind,
      email.to,
      email.subject,
      email.text,
      email.html ?? null,
      email.relatedType ?? null,
      email.relatedId ?? null,
      result.delivery,
      result.error ?? null,
    ],
  );
}

function logToConsole(email: OutboundEmail, result: SendResult): void {
  if (process.env.NODE_ENV === "test") return;
  const lines = [
    "",
    "  ┌─ email " + result.delivery + " ─────────────────────────────",
    `  │ ${email.kind}`,
    `  │ to:      ${email.to}`,
    `  │ subject: ${email.subject}`,
  ];
  for (const line of email.text.split("\n").slice(0, 12)) {
    lines.push(`  │ ${line}`);
  }
  lines.push("  └─────────────────────────────────────────────────────");
  console.log(lines.join("\n"));
}

/**
 * Send one message. Never throws: a mail failure must not roll back a lead that
 * was already recorded. The failure is recorded in the outbox with its reason
 * and reported in the return value so callers can surface it.
 */
export async function sendMail(email: OutboundEmail): Promise<SendResult> {
  if (!smtpConfigured()) {
    const result: SendResult = { delivery: "dev" };
    await persistToOutbox(email, result);
    logToConsole(email, result);
    return result;
  }

  try {
    const transport = await getTransport();
    await transport.sendMail({
      from: fromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    const result: SendResult = { delivery: "sent" };
    await persistToOutbox(email, result);
    return result;
  } catch (error) {
    const result: SendResult = {
      delivery: "failed",
      error: error instanceof Error ? error.message : "Unknown SMTP error",
    };
    await persistToOutbox(email, result);
    console.error(`  email failed (${email.kind} -> ${email.to}): ${result.error}`);
    return result;
  }
}
