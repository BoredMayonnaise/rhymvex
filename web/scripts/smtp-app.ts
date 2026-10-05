#!/usr/bin/env node
/**
 * Rhymvex Dual-Channel SMTP CLI Application
 *
 * Dedicated setup and testing utility for:
 * 1. Business Channel (Zoho Mail): Client confirmations, portal invitations, outbound proposals.
 * 2. System Channel (Google / Gmail): Team invitations, internal lead alerts with pipeline counts, error detection.
 *
 * Usage:
 *   Interactive wizard:
 *     npx tsx scripts/smtp-app.ts
 *
 *   Command line flags:
 *     npx tsx scripts/smtp-app.ts --verify
 *     npx tsx scripts/smtp-app.ts --test --channel=business --to client@example.com
 *     npx tsx scripts/smtp-app.ts --test --channel=system --to team@example.com
 *     npx tsx scripts/smtp-app.ts --channel=business --user support@rhymvex.space --pass "secret" --save
 *     npx tsx scripts/smtp-app.ts --channel=system --user alerts@gmail.com --pass "abcd efgh ijkl mnop" --save
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import {
  SMTP_PROVIDERS,
  resolveBusinessSmtpConfig,
  resolveSystemSmtpConfig,
  verifySmtpChannel,
  verifyBothSmtpChannels,
  type EmailChannel,
  type ResolvedSmtpConfig,
  type SmtpVerifyResult,
} from "../lib/mail/providers";

// Load .env.local if present
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  volt: "\x1b[38;2;110;231;255m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  slate: "\x1b[90m",
};

function banner() {
  console.log(`
${COLORS.volt}${COLORS.bold}┌────────────────────────────────────────────────────────────────┐
│  RHYMVEX · DUAL-CHANNEL SMTP APP                               │
│  Channel 1: Zoho Business Email (Client-Facing & Outbound)     │
│  Channel 2: Google / Gmail SMTP (Team Invites, Alerts & Health)│
└────────────────────────────────────────────────────────────────┘${COLORS.reset}
`);
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${COLORS.cyan}?${COLORS.reset} ${question} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

function saveToEnvLocal(updates: Record<string, string>): void {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  const lines = content.split("\n");
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (key in updates) {
        updatedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
    }
    return line;
  });

  // Append any keys that weren't in the file
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
  console.log(`${COLORS.green}✓ Updated configuration written to web/.env.local${COLORS.reset}`);
}

async function sendLiveTestEmail(
  channel: EmailChannel,
  config: ResolvedSmtpConfig,
  toAddress: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10_000,
    });

    const isBusiness = channel === "business";
    const channelName = isBusiness ? "Client Business Channel (Zoho)" : "System & Team Channel (Gmail)";

    const info = await transport.sendMail({
      from: config.from,
      to: toAddress,
      subject: `Rhymvex ${isBusiness ? "Business" : "System"} SMTP Verification · ${new Date().toISOString()}`,
      text: [
        `Hello from Rhymvex [${channel.toUpperCase()} CHANNEL],`,
        "",
        `This is a verification email confirming that your ${channelName} is operational.`,
        "",
        `Channel:   ${channel.toUpperCase()} (${channelName})`,
        `Host:      ${config.host}:${config.port} (${config.secure ? "SSL" : "TLS"})`,
        `Account:   ${config.user}`,
        `Sender:    ${config.from}`,
        `Timestamp: ${new Date().toUTCString()}`,
        "",
        "Operational status: GREEN",
      ].join("\n"),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:540px;margin:0 auto;background:#151B24;border:1px solid rgba(245,247,250,0.15);border-radius:12px;padding:28px;color:#F5F7FA;">
          <h2 style="margin:0 0 16px;color:#6EE7FF;font-size:20px;">Rhymvex ${channelName} Verified</h2>
          <p style="margin:0 0 16px;color:rgba(245,247,250,0.8);font-size:14px;line-height:1.6;">
            Your ${isBusiness ? "client-facing business email" : "internal team & system background alert"} transport is fully operational.
          </p>
          <div style="background:#0B0F14;border:1px solid rgba(245,247,250,0.1);border-radius:8px;padding:16px;font-family:monospace;font-size:13px;color:#6EE7FF;line-height:1.8;">
            <div><strong>Channel:</strong> ${channel.toUpperCase()}</div>
            <div><strong>Provider:</strong> ${config.providerName}</div>
            <div><strong>Host:</strong> ${config.host}:${config.port} (${config.secure ? "SSL" : "TLS"})</div>
            <div><strong>Account:</strong> ${config.user}</div>
            <div><strong>Sender:</strong> ${config.from}</div>
            <div><strong>Timestamp:</strong> ${new Date().toUTCString()}</div>
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:rgba(245,247,250,0.4);">
            Rhymvex Platform &middot; ${isBusiness ? "Client Engagement Subsystem" : "System Alert & Team Subsystem"}
          </p>
        </div>
      `,
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function verifyChannelAction(channel: EmailChannel): Promise<boolean> {
  const cfg = channel === "business" ? resolveBusinessSmtpConfig() : resolveSystemSmtpConfig();
  const label = channel === "business" ? "Client Channel (Zoho)" : "System Channel (Gmail)";

  console.log(`\n${COLORS.bold}Testing ${label}...${COLORS.reset}`);
  console.log(`  ${COLORS.dim}Host:${COLORS.reset}     ${cfg.host}:${cfg.port} (${cfg.secure ? "SSL" : "TLS"})`);
  console.log(`  ${COLORS.dim}Account:${COLORS.reset}  ${cfg.user || "(not configured)"}`);
  console.log(`  ${COLORS.dim}Sender:${COLORS.reset}   ${cfg.from}`);

  if (!cfg.isConfigured) {
    console.log(`  ${COLORS.yellow}⚠ Credentials incomplete. Operating in Dev Outbox mode.${COLORS.reset}`);
    return false;
  }

  process.stdout.write(`  Connecting and authenticating... `);
  const result = await verifySmtpChannel(channel);

  if (result.ok) {
    console.log(`${COLORS.green}${COLORS.bold}SUCCESS!${COLORS.reset} (${result.latencyMs}ms)`);
    console.log(`  ${COLORS.green}✓ Handshake complete. Authenticated as ${cfg.user}.${COLORS.reset}`);
    return true;
  } else {
    console.log(`${COLORS.red}${COLORS.bold}FAILED!${COLORS.reset} (${result.latencyMs}ms)`);
    console.log(`  ${COLORS.red}Error: ${result.error}${COLORS.reset}`);
    if (result.hint) {
      console.log(`\n  ${COLORS.yellow}${COLORS.bold}Diagnostic Guidance:${COLORS.reset}`);
      console.log(`    ${result.hint}`);
    }
    return false;
  }
}

async function verifyBothAction(): Promise<{ businessOk: boolean; systemOk: boolean }> {
  console.log(`\n${COLORS.bold}Verifying Dual SMTP Channels...${COLORS.reset}`);
  const businessOk = await verifyChannelAction("business");
  const systemOk = await verifyChannelAction("system");
  console.log("\n" + "-".repeat(50));
  console.log(
    `Overall Status: Business: ${businessOk ? `${COLORS.green}LIVE` : `${COLORS.yellow}DEV`}  |  System: ${
      systemOk ? `${COLORS.green}LIVE` : `${COLORS.yellow}DEV`
    }${COLORS.reset}\n`,
  );
  return { businessOk, systemOk };
}

async function runZohoSetup(rl: readline.Interface) {
  console.log("\n" + "=".repeat(64));
  console.log(`${COLORS.volt}${COLORS.bold}1. CONFIGURE ZOHO BUSINESS EMAIL (CLIENT-FACING CHANNEL)${COLORS.reset}`);
  console.log("=".repeat(64));
  console.log(`
${COLORS.bold}Role in Rhymvex:${COLORS.reset}
- Sends intake "Thank You" confirmations directly to clients with SLA promises.
- Sends Client Portal invitation links to external stakeholders.
- Delivers outbound business proposals and contracts.

${COLORS.bold}Requirements:${COLORS.reset}
1. Your domain business email (e.g. support@rhymvex.space).
2. Zoho Application-Specific Password:
   - Visit: ${COLORS.cyan}https://accounts.zoho.com/home#security/app_password${COLORS.reset}
   - Generate password for 'Rhymvex Client Mail'.
3. Ensure SMTP Access is enabled in Zoho Mail settings.
`);

  const regionChoice = await prompt(
    rl,
    "Choose Zoho Region:\n  1. Global / US (smtp.zoho.com - default)\n  2. Europe (smtp.zoho.eu)\n  3. India (smtp.zoho.in)\n  4. Australia (smtp.zoho.com.au)\nEnter 1-4 [default: 1]:",
  );

  let host = "smtp.zoho.com";
  if (regionChoice === "2") host = "smtp.zoho.eu";
  else if (regionChoice === "3") host = "smtp.zoho.in";
  else if (regionChoice === "4") host = "smtp.zoho.com.au";

  const email = await prompt(rl, "Enter your Zoho Business Email (e.g. support@rhymvex.space):");
  if (!email) {
    console.log(`${COLORS.red}Email cannot be empty.${COLORS.reset}`);
    return;
  }

  const pass = await prompt(rl, "Enter your Zoho Application-Specific Password:");
  if (!pass) {
    console.log(`${COLORS.red}Password cannot be empty.${COLORS.reset}`);
    return;
  }

  const displayName = (await prompt(rl, "Client-facing display name [default: Rhymvex]:")) || "Rhymvex";
  const from = `${displayName} <${email}>`;

  const config = resolveBusinessSmtpConfig({
    host,
    port: 465,
    secure: true,
    user: email,
    pass,
    from,
  });

  process.stdout.write(`  Connecting to Zoho... `);
  const result = await verifySmtpChannel("business", {
    host,
    port: 465,
    secure: true,
    user: email,
    pass,
    from,
  });

  if (result.ok) {
    console.log(`${COLORS.green}${COLORS.bold}SUCCESS!${COLORS.reset} (${result.latencyMs}ms)`);
    const sendTest = (await prompt(rl, "Send a live test email now? (y/n) [y]:")).toLowerCase();
    if (sendTest !== "n") {
      const recipient = (await prompt(rl, `Enter recipient [default: ${email}]:`)) || email;
      process.stdout.write(`  Delivering test message... `);
      const res = await sendLiveTestEmail("business", config, recipient);
      if (res.ok) console.log(`${COLORS.green}DELIVERED! Message ID: ${res.messageId}${COLORS.reset}`);
      else console.log(`${COLORS.red}Failed: ${res.error}${COLORS.reset}`);
    }

    const save = (await prompt(rl, "Save Zoho credentials to web/.env.local? (y/n) [y]:")).toLowerCase();
    if (save !== "n") {
      saveToEnvLocal({
        ZOHO_SMTP_HOST: host,
        ZOHO_SMTP_PORT: "465",
        ZOHO_SMTP_SECURE: "true",
        ZOHO_SMTP_USER: email,
        ZOHO_SMTP_PASSWORD: pass,
        ZOHO_SMTP_FROM: from,
      });
    }
  } else {
    console.log(`${COLORS.red}${COLORS.bold}FAILED!${COLORS.reset} (${result.latencyMs}ms)`);
    console.log(`${COLORS.red}${result.error}${COLORS.reset}`);
    if (result.hint) console.log(`\n${COLORS.yellow}${result.hint}${COLORS.reset}`);
  }
}

async function runGmailSetup(rl: readline.Interface) {
  console.log("\n" + "=".repeat(64));
  console.log(`${COLORS.volt}${COLORS.bold}2. CONFIGURE GMAIL SMTP (SYSTEM & TEAM BACKGROUND CHANNEL)${COLORS.reset}`);
  console.log("=".repeat(64));
  console.log(`
${COLORS.bold}Role in Rhymvex:${COLORS.reset}
- Sends onboarding invitations to team members and staff.
- Sends instant lead alerts with live pipeline counts to your internal email.
- Sends error detection and health monitoring alerts in the background.

${COLORS.bold}Requirements:${COLORS.reset}
1. A Google / Gmail account with 2-Step Verification turned ON:
   ${COLORS.cyan}https://myaccount.google.com/security${COLORS.reset}
2. A 16-character Google App Password:
   ${COLORS.cyan}https://myaccount.google.com/apppasswords${COLORS.reset}
   (Name it 'Rhymvex System Mail' and copy the 16 characters).
3. The internal notification email address where you want to receive lead alerts.
`);

  const email = await prompt(rl, "Enter your Gmail / Google account email:");
  if (!email) {
    console.log(`${COLORS.red}Email cannot be empty.${COLORS.reset}`);
    return;
  }

  const rawPass = await prompt(rl, "Enter your 16-character Google App Password (e.g. 'abcd efgh ijkl mnop'):");
  const pass = rawPass.replace(/\s+/g, "");
  if (!pass) {
    console.log(`${COLORS.red}Password cannot be empty.${COLORS.reset}`);
    return;
  }

  const alertRecipient =
    (await prompt(rl, `Where should new lead notices & error alerts be delivered? [default: ${email}]:`)) || email;
  const from = `Rhymvex System <${email}>`;

  const config = resolveSystemSmtpConfig({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: email,
    pass,
    from,
  });

  process.stdout.write(`  Connecting to Google SMTP... `);
  const result = await verifySmtpChannel("system", {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: email,
    pass,
    from,
  });

  if (result.ok) {
    console.log(`${COLORS.green}${COLORS.bold}SUCCESS!${COLORS.reset} (${result.latencyMs}ms)`);
    const sendTest = (await prompt(rl, "Send a live test alert now? (y/n) [y]:")).toLowerCase();
    if (sendTest !== "n") {
      process.stdout.write(`  Delivering test alert to ${alertRecipient}... `);
      const res = await sendLiveTestEmail("system", config, alertRecipient);
      if (res.ok) console.log(`${COLORS.green}DELIVERED! Message ID: ${res.messageId}${COLORS.reset}`);
      else console.log(`${COLORS.red}Failed: ${res.error}${COLORS.reset}`);
    }

    const save = (await prompt(rl, "Save Gmail credentials to web/.env.local? (y/n) [y]:")).toLowerCase();
    if (save !== "n") {
      saveToEnvLocal({
        GMAIL_SMTP_HOST: "smtp.gmail.com",
        GMAIL_SMTP_PORT: "465",
        GMAIL_SMTP_SECURE: "true",
        GMAIL_SMTP_USER: email,
        GMAIL_SMTP_PASSWORD: pass,
        GMAIL_SMTP_FROM: from,
        INTERNAL_NOTIFICATION_EMAIL: alertRecipient,
      });
    }
  } else {
    console.log(`${COLORS.red}${COLORS.bold}FAILED!${COLORS.reset} (${result.latencyMs}ms)`);
    console.log(`${COLORS.red}${result.error}${COLORS.reset}`);
    if (result.hint) console.log(`\n${COLORS.yellow}${result.hint}${COLORS.reset}`);
  }
}

function showDnsGuidance() {
  console.log(`
${COLORS.volt}${COLORS.bold}DNS & DELIVERABILITY GUIDE (SPF / DKIM / DMARC)${COLORS.reset}
--------------------------------------------------------------------------------
To ensure client confirmations and proposals from Zoho never land in spam:

${COLORS.bold}Zoho Business Domain Records (e.g. rhymvex.space):${COLORS.reset}
  • MX Records:
    - Priority 10:  mx.zoho.com
    - Priority 20:  mx2.zoho.com
    - Priority 50:  mx3.zoho.com
  • SPF Record (TXT @):
    v=spf1 include:zoho.com ~all
  • DKIM Record (TXT):
    Generated in Zoho Mail Admin Console -> Email Configuration -> DKIM
  • DMARC Record (TXT _dmarc):
    v=DMARC1; p=none; rua=mailto:admin@rhymvex.space
--------------------------------------------------------------------------------
`);
}

async function interactiveMenu() {
  banner();

  const businessCfg = resolveBusinessSmtpConfig();
  const systemCfg = resolveSystemSmtpConfig();

  console.log(`${COLORS.bold}Active Channels Status:${COLORS.reset}`);
  console.log(
    `  1. Client Channel (Zoho):   ${
      businessCfg.isConfigured
        ? `${COLORS.green}CONFIGURED${COLORS.reset} (${businessCfg.user})`
        : `${COLORS.yellow}DEV OUTBOX (not configured)${COLORS.reset}`
    }`,
  );
  console.log(
    `  2. System Channel (Gmail):  ${
      systemCfg.isConfigured
        ? `${COLORS.green}CONFIGURED${COLORS.reset} (${systemCfg.user})`
        : `${COLORS.yellow}DEV OUTBOX (not configured)${COLORS.reset}`
    }`,
  );
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let running = true;
    while (running) {
      console.log(`${COLORS.bold}Select an option:${COLORS.reset}`);
      console.log(`  1. Configure Zoho Mail (Client-Facing Channel)`);
      console.log(`  2. Configure Gmail SMTP (System & Team Channel)`);
      console.log(`  3. Verify Both Channels (Live Handshakes)`);
      console.log(`  4. Send Live Test Email`);
      console.log(`  5. View Deliverability & DNS Guide (SPF/DKIM/MX)`);
      console.log(`  6. Exit`);

      const choice = await prompt(rl, "\nEnter 1-6:");
      if (choice === "1") {
        await runZohoSetup(rl);
      } else if (choice === "2") {
        await runGmailSetup(rl);
      } else if (choice === "3") {
        await verifyBothAction();
      } else if (choice === "4") {
        const ch = (await prompt(rl, "Choose channel to test: 1. Client (Zoho) 2. System (Gmail) [1]:")) === "2" ? "system" : "business";
        const cfg = ch === "business" ? resolveBusinessSmtpConfig() : resolveSystemSmtpConfig();
        if (!cfg.isConfigured) {
          console.log(`\n${COLORS.yellow}Selected channel is not configured yet. Configure it first.${COLORS.reset}\n`);
        } else {
          const recipient = await prompt(rl, `Enter test recipient [default: ${cfg.user}]:`);
          const target = recipient || cfg.user;
          process.stdout.write(`  Sending test email to ${target}... `);
          const res = await sendLiveTestEmail(ch, cfg, target);
          if (res.ok) console.log(`${COLORS.green}${COLORS.bold}DELIVERED!${COLORS.reset} (Message ID: ${res.messageId})\n`);
          else console.log(`${COLORS.red}Failed: ${res.error}${COLORS.reset}\n`);
        }
      } else if (choice === "5") {
        showDnsGuidance();
      } else if (choice === "6" || choice === "q" || choice === "exit") {
        running = false;
        console.log(`\nExiting. Rhymvex dual-channel mailer ready.\n`);
      } else {
        console.log(`${COLORS.yellow}Invalid option. Enter 1-6.${COLORS.reset}`);
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    banner();
    console.log(`
Usage:
  npx tsx scripts/smtp-app.ts [options]

Options:
  --verify                   Verify both channels (exit code 0 on pass)
  --channel <business|system> Choose channel to test or configure
  --test                     Send test email on the specified channel
  --to <email>               Recipient address for test email
  --user <email>             Username/email
  --pass <password>          Password or App Password
  --host <hostname>          Host override
  --port <number>            Port override
  --save                     Save settings to web/.env.local
  --dns                      Print DNS deliverability records (SPF, DKIM, MX)
  --help                     Show this help screen
`);
    process.exit(0);
  }

  if (args.includes("--dns")) {
    showDnsGuidance();
    process.exit(0);
  }

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    const prefix = `${flag}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : undefined;
  };

  const channelArg = (getArg("--channel")?.toLowerCase() as EmailChannel) || undefined;
  const isVerify = args.includes("--verify");
  const isTest = args.includes("--test");
  const testTo = getArg("--to");
  const user = getArg("--user");
  const pass = getArg("--pass");
  const host = getArg("--host");
  const port = getArg("--port");
  const shouldSave = args.includes("--save");

  // Non-interactive execution if flags are passed
  if (isVerify) {
    banner();
    const { businessOk, systemOk } = await verifyBothAction();
    const hasAnyConfigured = resolveBusinessSmtpConfig().isConfigured || resolveSystemSmtpConfig().isConfigured;
    if (hasAnyConfigured && (!businessOk && resolveBusinessSmtpConfig().isConfigured || !systemOk && resolveSystemSmtpConfig().isConfigured)) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (channelArg && (user || pass || isTest)) {
    banner();
    const isBusiness = channelArg === "business";
    const prefix = isBusiness ? "ZOHO_SMTP" : "GMAIL_SMTP";

    const cfg = isBusiness
      ? resolveBusinessSmtpConfig({ host, port, user, pass })
      : resolveSystemSmtpConfig({ host, port, user, pass });

    const ok = await verifyChannelAction(channelArg);

    if (ok && (isTest || testTo)) {
      const recipient = testTo || cfg.user;
      process.stdout.write(`  Delivering test message to ${recipient}... `);
      const res = await sendLiveTestEmail(channelArg, cfg, recipient);
      if (res.ok) console.log(`${COLORS.green}DELIVERED! Message ID: ${res.messageId}${COLORS.reset}`);
      else console.log(`${COLORS.red}Failed: ${res.error}${COLORS.reset}`);
    }

    if (ok && shouldSave && user && pass) {
      const updates: Record<string, string> = {
        [`${prefix}_HOST`]: cfg.host,
        [`${prefix}_PORT`]: String(cfg.port),
        [`${prefix}_SECURE`]: String(cfg.secure),
        [`${prefix}_USER`]: cfg.user,
        [`${prefix}_PASSWORD`]: cfg.pass,
        [`${prefix}_FROM`]: cfg.from,
      };
      if (!isBusiness) {
        updates["INTERNAL_NOTIFICATION_EMAIL"] = testTo || cfg.user;
      }
      saveToEnvLocal(updates);
    }

    process.exit(ok ? 0 : 1);
  }

  // Interactive mode
  await interactiveMenu();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
