import { envInt } from "@/lib/env";
import { query } from "@/lib/db/client";

/**
 * Dual-Channel SMTP Engine.
 *
 * Automatically routes email between two specialized transports:
 * 1. Business Channel (Zoho Mail): Client confirmations, client portal invitations,
 *    and outbound business proposals.
 * 2. System Channel (Google / Gmail): Team invitations, internal lead notifications
 *    with live pipeline stats, and automated error detection.
 *
 * When a channel is unconfigured, it gracefully writes to `email_outbox` in "dev"
 * delivery mode so the platform remains fully functional locally and in staging.
 */

import {
  resolveSmtpConfig,
  resolveBusinessSmtpConfig,
  resolveSystemSmtpConfig,
  diagnoseSmtpError,
  verifySmtpConnection,
  verifySmtpChannel,
  type ResolvedSmtpConfig,
  type SmtpVerifyResult,
  type EmailChannel,
} from "./providers";

export type OutboundEmail = {
  kind:
    | "CLIENT_CONFIRMATION"
    | "INTERNAL_NOTIFICATION"
    | "STAFF_INVITATION"
    | "PORTAL_INVITATION"
    | "OUTBOUND";
  channel?: EmailChannel;
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
  channel: EmailChannel;
  error?: string;
  hint?: string;
};

export function resolveChannelForEmail(email: OutboundEmail): EmailChannel {
  if (email.channel) return email.channel;
  if (email.kind === "STAFF_INVITATION" || email.kind === "INTERNAL_NOTIFICATION") {
    return "system";
  }
  return "business";
}

export function getBusinessSmtpConfig(): ResolvedSmtpConfig {
  return resolveBusinessSmtpConfig();
}

export function getSystemSmtpConfig(): ResolvedSmtpConfig {
  return resolveSystemSmtpConfig();
}

export function getActiveSmtpConfig(): ResolvedSmtpConfig {
  // Returns business config as primary representation for legacy callers
  return resolveBusinessSmtpConfig();
}

export function businessSmtpConfigured(): boolean {
  return resolveBusinessSmtpConfig().isConfigured;
}

export function systemSmtpConfigured(): boolean {
  return resolveSystemSmtpConfig().isConfigured;
}

export function smtpConfigured(): boolean {
  return businessSmtpConfigured() || systemSmtpConfigured() || resolveSmtpConfig().isConfigured;
}

export function fromAddress(channel: EmailChannel = "business"): string {
  const cfg = channel === "business" ? resolveBusinessSmtpConfig() : resolveSystemSmtpConfig();
  return cfg.from;
}

export function internalNotificationAddress(): string {
  return (
    process.env.INTERNAL_NOTIFICATION_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
    "support@rhymvex.space"
  );
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

// Independent transport caching for both channels
let businessTransportPromise: Promise<import("nodemailer").Transporter> | null = null;
let businessConfigKey = "";

let systemTransportPromise: Promise<import("nodemailer").Transporter> | null = null;
let systemConfigKey = "";

async function getTransportForChannel(channel: EmailChannel) {
  const { default: nodemailer } = await import("nodemailer");

  if (channel === "business") {
    const cfg = resolveBusinessSmtpConfig();
    const configKey = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}`;
    if (!businessTransportPromise || businessConfigKey !== configKey) {
      businessConfigKey = configKey;
      businessTransportPromise = (async () => {
        return nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        });
      })();
    }
    return { transport: await businessTransportPromise, config: cfg };
  } else {
    const cfg = resolveSystemSmtpConfig();
    const configKey = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}`;
    if (!systemTransportPromise || systemConfigKey !== configKey) {
      systemConfigKey = configKey;
      systemTransportPromise = (async () => {
        return nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        });
      })();
    }
    return { transport: await systemTransportPromise, config: cfg };
  }
}

export async function verifySmtp(channel?: EmailChannel): Promise<SmtpVerifyResult> {
  if (channel) {
    return verifySmtpChannel(channel);
  }
  return verifySmtpConnection();
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
    `  ┌─ email ${result.delivery} [${result.channel.toUpperCase()}] ─────────────────────────────`,
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
 * Send one message. Automatically routes to Business (Zoho) or System (Gmail).
 * Never throws: a mail failure must not abort a lead transaction.
 */
export async function sendMail(email: OutboundEmail): Promise<SendResult> {
  const channel = resolveChannelForEmail(email);
  const cfg = channel === "business" ? resolveBusinessSmtpConfig() : resolveSystemSmtpConfig();

  // If this specific channel is not configured, record in dev outbox
  if (!cfg.isConfigured) {
    const result: SendResult = { delivery: "dev", channel };
    await persistToOutbox(email, result);
    logToConsole(email, result);
    return result;
  }

  try {
    const { transport, config } = await getTransportForChannel(channel);
    await transport.sendMail({
      from: config.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    const result: SendResult = { delivery: "sent", channel };
    await persistToOutbox(email, result);
    return result;
  } catch (error) {
    const rawError = error instanceof Error ? error.message : "Unknown SMTP error";
    const hint = diagnoseSmtpError(error, cfg);
    const result: SendResult = {
      delivery: "failed",
      channel,
      error: rawError,
      hint,
    };
    await persistToOutbox(email, result);
    console.error(`  email failed (${email.kind} [${channel}] -> ${email.to}): ${result.error}`);
    if (hint && hint !== rawError) {
      console.error(`  smtp diagnosis: ${hint}`);
    }
    return result;
  }
}
