/**
 * SMTP Provider configurations and diagnostics.
 *
 * Provides dedicated presets for:
 * 1. Zoho Business Email (smtp.zoho.com, port 465 SSL or 587 STARTTLS)
 * 2. Google / Gmail (smtp.gmail.com, port 465 SSL or 587 STARTTLS)
 * 3. Custom SMTP servers
 */

export type SmtpProviderId =
  | "zoho"
  | "zoho-eu"
  | "zoho-in"
  | "zoho-au"
  | "zoho-cn"
  | "gmail"
  | "custom";

export interface SmtpProviderPreset {
  id: SmtpProviderId;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  requiresAppPassword: boolean;
  helpUrl: string;
  notes: string[];
}

export const SMTP_PROVIDERS: Record<SmtpProviderId, SmtpProviderPreset> = {
  zoho: {
    id: "zoho",
    name: "Zoho Mail (US / Global)",
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://accounts.zoho.com/home#security/app_password",
    notes: [
      "Requires an Application-Specific Password if Two-Factor Authentication (2FA) is enabled.",
      "The 'From' email address MUST match your Zoho username or an authorized Send-As alias.",
      "Ensure SMTP access is enabled in Zoho Mail -> Settings -> Mail Accounts.",
    ],
  },
  "zoho-eu": {
    id: "zoho-eu",
    name: "Zoho Mail (Europe)",
    host: "smtp.zoho.eu",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://accounts.zoho.eu/home#security/app_password",
    notes: [
      "For Zoho accounts registered in the European Union (zoho.eu).",
      "Requires an Application-Specific Password if 2FA is enabled.",
      "The 'From' address must match your Zoho account username or alias.",
    ],
  },
  "zoho-in": {
    id: "zoho-in",
    name: "Zoho Mail (India)",
    host: "smtp.zoho.in",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://accounts.zoho.in/home#security/app_password",
    notes: [
      "For Zoho accounts registered in India (zoho.in).",
      "Requires an Application-Specific Password if 2FA is enabled.",
    ],
  },
  "zoho-au": {
    id: "zoho-au",
    name: "Zoho Mail (Australia)",
    host: "smtp.zoho.com.au",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://accounts.zoho.com.au/home#security/app_password",
    notes: [
      "For Zoho accounts registered in Australia (zoho.com.au).",
      "Requires an Application-Specific Password if 2FA is enabled.",
    ],
  },
  "zoho-cn": {
    id: "zoho-cn",
    name: "Zoho Mail (China)",
    host: "smtp.zoho.com.cn",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://accounts.zoho.com.cn/home#security/app_password",
    notes: [
      "For Zoho accounts registered in China (zoho.com.cn).",
    ],
  },
  gmail: {
    id: "gmail",
    name: "Google / Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    requiresAppPassword: true,
    helpUrl: "https://myaccount.google.com/apppasswords",
    notes: [
      "Requires 2-Step Verification enabled on the Google Account.",
      "Must use a 16-character App Password (e.g. 'abcd efgh ijkl mnop').",
      "Regular Google account passwords are rejected by Google SMTP.",
    ],
  },
  custom: {
    id: "custom",
    name: "Custom SMTP Server",
    host: "",
    port: 587,
    secure: false,
    requiresAppPassword: false,
    helpUrl: "",
    notes: ["Configure standard host, port, and security flags."],
  },
};

export interface ResolvedSmtpConfig {
  provider: SmtpProviderId;
  providerName: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  isConfigured: boolean;
}

/**
 * Detect provider from explicit env or inferred host/user.
 */
export function detectProvider(
  providerEnv?: string,
  hostEnv?: string,
  userEnv?: string,
): SmtpProviderId {
  const p = providerEnv?.trim().toLowerCase();
  if (p && p in SMTP_PROVIDERS) {
    return p as SmtpProviderId;
  }

  const host = hostEnv?.trim().toLowerCase() || "";
  if (host.includes("zoho.eu")) return "zoho-eu";
  if (host.includes("zoho.in")) return "zoho-in";
  if (host.includes("zoho.com.au")) return "zoho-au";
  if (host.includes("zoho.com.cn")) return "zoho-cn";
  if (host.includes("zoho")) return "zoho";
  if (host.includes("gmail") || host.includes("google")) return "gmail";

  const user = userEnv?.trim().toLowerCase() || "";
  if (user.endsWith("@gmail.com") || user.endsWith("@googlemail.com")) return "gmail";
  if (user.endsWith("@zohomail.com") || user.endsWith("@zoho.com")) return "zoho";

  return host ? "custom" : "custom";
}

/**
 * Resolves SMTP configuration merging environment variables and provider defaults.
 */
export function resolveSmtpConfig(overrides?: {
  provider?: string;
  host?: string;
  port?: number | string;
  secure?: boolean | string;
  user?: string;
  pass?: string;
  from?: string;
}): ResolvedSmtpConfig {
  const rawProvider = overrides?.provider || process.env.SMTP_PROVIDER;
  const rawHost = overrides?.host || process.env.SMTP_HOST;
  const rawUser = overrides?.user || process.env.SMTP_USER || "";
  const rawPass = (overrides?.pass || process.env.SMTP_PASSWORD || "").trim();
  const rawFrom = overrides?.from || process.env.SMTP_FROM || "";

  const providerId = detectProvider(rawProvider, rawHost, rawUser);
  const preset = SMTP_PROVIDERS[providerId];

  const host = rawHost?.trim() || preset.host;
  let port: number;
  if (overrides?.port !== undefined) {
    port = typeof overrides.port === "string" ? parseInt(overrides.port, 10) : overrides.port;
  } else if (process.env.SMTP_PORT) {
    port = parseInt(process.env.SMTP_PORT, 10);
  } else {
    port = preset.port;
  }
  if (Number.isNaN(port)) port = preset.port;

  let secure: boolean;
  if (overrides?.secure !== undefined) {
    secure = overrides.secure === true || overrides.secure === "true";
  } else if (process.env.SMTP_SECURE !== undefined) {
    secure = process.env.SMTP_SECURE === "true";
  } else {
    secure = port === 465 || preset.secure;
  }

  // Google app passwords often contain spaces when copied (e.g. 'abcd efgh ijkl mnop')
  // We sanitize app passwords by removing spaces.
  const pass = providerId === "gmail" ? rawPass.replace(/\s+/g, "") : rawPass;

  // Resolve 'From' address.
  // For Zoho, if FROM is not specified or doesn't match, warn or align with user.
  let from = rawFrom.trim();
  if (!from && rawUser) {
    from = `Rhymvex <${rawUser.trim()}>`;
  } else if (!from) {
    from = "Rhymvex <support@rhymvex.space>";
  }

  const isConfigured = Boolean(host && rawUser && pass);

  return {
    provider: providerId,
    providerName: preset.name,
    host,
    port,
    secure,
    user: rawUser.trim(),
    pass,
    from,
    isConfigured,
  };
}

/**
 * Diagnostic explanation for common SMTP error codes across Zoho, Gmail, and standard servers.
 */
export function diagnoseSmtpError(error: unknown, config: ResolvedSmtpConfig): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Google / Gmail specific errors
  if (config.provider === "gmail" || lower.includes("gmail") || lower.includes("google")) {
    if (lower.includes("535-5.7.8") || lower.includes("badcredentials") || lower.includes("username and password not accepted")) {
      return (
        "Google rejected the credentials. Note: Google DOES NOT accept standard account passwords for SMTP. " +
        "You must generate a 16-character Google App Password: " +
        "1. Go to https://myaccount.google.com/security and ensure 2-Step Verification is ON. " +
        "2. Go to https://myaccount.google.com/apppasswords. " +
        "3. Create an app password named 'Rhymvex Website' and use that 16-character code as SMTP_PASSWORD."
      );
    }
    if (lower.includes("534-5.7.9") || lower.includes("application-specific password required")) {
      return "Google requires an Application-Specific Password. Go to https://myaccount.google.com/apppasswords to create one.";
    }
  }

  // Zoho specific errors
  if (config.provider.startsWith("zoho") || lower.includes("zoho")) {
    if (lower.includes("553") && (lower.includes("relaying disallowed") || lower.includes("relay"))) {
      return (
        `Zoho error '553 Relaying disallowed': Zoho requires your 'From' address to match your authenticated Zoho email (${config.user}) or a verified alias. ` +
        `Ensure SMTP_FROM is set to: "${config.user}" or "Name <${config.user}>".`
      );
    }
    if (lower.includes("535") || lower.includes("authentication failed")) {
      return (
        "Zoho authentication failed. If Two-Factor Authentication (2FA) is enabled on your Zoho account, you MUST use an Application-Specific Password: " +
        "1. Log in to https://accounts.zoho.com. " +
        "2. Navigate to Security -> Application-Specific Passwords. " +
        "3. Generate a password for 'Rhymvex Website' and use it as SMTP_PASSWORD. " +
        "Also ensure SMTP access is enabled in Zoho Mail -> Settings -> Mail Accounts."
      );
    }
  }

  // Generic network errors
  if (lower.includes("econnrefused")) {
    return `Connection refused by ${config.host}:${config.port}. Check that the host and port are correct and not blocked by a firewall.`;
  }
  if (lower.includes("etimedout")) {
    return `Connection timed out connecting to ${config.host}:${config.port}. Verify port ${config.port} and TLS settings. Port 465 requires secure: true; port 587 uses STARTTLS.`;
  }
  if (lower.includes("certificate") || lower.includes("self signed")) {
    return `TLS certificate verification error on ${config.host}. Ensure host matches the certificate domain.`;
  }

  return msg;
}

export interface SmtpVerifyResult {
  ok: boolean;
  latencyMs: number;
  provider: SmtpProviderId;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  error?: string;
  hint?: string;
}

/**
 * Verifies the SMTP connection using `transport.verify()`.
 */
export async function verifySmtpConnection(
  overrides?: Parameters<typeof resolveSmtpConfig>[0],
): Promise<SmtpVerifyResult> {
  const config = resolveSmtpConfig(overrides);
  const start = Date.now();

  if (!config.isConfigured) {
    return {
      ok: false,
      latencyMs: 0,
      provider: config.provider,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      error: "SMTP is not fully configured (missing host, user, or password).",
      hint: "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in web/.env.local or pass credentials.",
    };
  }

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
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transport.verify();
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      latencyMs,
      provider: config.provider,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const rawError = error instanceof Error ? error.message : String(error);
    const hint = diagnoseSmtpError(error, config);

    return {
      ok: false,
      latencyMs,
      provider: config.provider,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      error: rawError,
      hint,
    };
  }
}

export type EmailChannel = "business" | "system";

/**
 * Resolves the Client-Facing Business Email Channel (Zoho).
 * Prioritizes ZOHO_SMTP_* environment variables, falling back to SMTP_*.
 */
export function resolveBusinessSmtpConfig(overrides?: Parameters<typeof resolveSmtpConfig>[0]): ResolvedSmtpConfig {
  const user = overrides?.user || process.env.ZOHO_SMTP_USER || (process.env.SMTP_PROVIDER === "zoho" ? process.env.SMTP_USER : undefined);
  const pass = overrides?.pass || process.env.ZOHO_SMTP_PASSWORD || (process.env.SMTP_PROVIDER === "zoho" ? process.env.SMTP_PASSWORD : undefined);
  const host = overrides?.host || process.env.ZOHO_SMTP_HOST || (process.env.SMTP_PROVIDER === "zoho" ? process.env.SMTP_HOST : "smtp.zoho.com");
  const port = overrides?.port || process.env.ZOHO_SMTP_PORT || (process.env.SMTP_PROVIDER === "zoho" ? process.env.SMTP_PORT : 465);
  const secure = overrides?.secure !== undefined ? overrides.secure : process.env.ZOHO_SMTP_SECURE || (process.env.SMTP_PROVIDER === "zoho" ? process.env.SMTP_SECURE : true);
  const from = overrides?.from || process.env.ZOHO_SMTP_FROM || process.env.SMTP_FROM || (user ? `Rhymvex <${user}>` : "Rhymvex <support@rhymvex.space>");

  return resolveSmtpConfig({
    provider: "zoho",
    host,
    port,
    secure,
    user,
    pass,
    from,
  });
}

/**
 * Resolves the Internal & Background System Channel (Google / Gmail).
 * Prioritizes GMAIL_SMTP_* environment variables, falling back to SMTP_*.
 */
export function resolveSystemSmtpConfig(overrides?: Parameters<typeof resolveSmtpConfig>[0]): ResolvedSmtpConfig {
  const user = overrides?.user || process.env.GMAIL_SMTP_USER || (process.env.SMTP_PROVIDER === "gmail" ? process.env.SMTP_USER : undefined);
  const pass = overrides?.pass || process.env.GMAIL_SMTP_PASSWORD || (process.env.SMTP_PROVIDER === "gmail" ? process.env.SMTP_PASSWORD : undefined);
  const host = overrides?.host || process.env.GMAIL_SMTP_HOST || (process.env.SMTP_PROVIDER === "gmail" ? process.env.SMTP_HOST : "smtp.gmail.com");
  const port = overrides?.port || process.env.GMAIL_SMTP_PORT || (process.env.SMTP_PROVIDER === "gmail" ? process.env.SMTP_PORT : 465);
  const secure = overrides?.secure !== undefined ? overrides.secure : process.env.GMAIL_SMTP_SECURE || (process.env.SMTP_PROVIDER === "gmail" ? process.env.SMTP_SECURE : true);
  const from = overrides?.from || process.env.GMAIL_SMTP_FROM || (user ? `Rhymvex System <${user}>` : "Rhymvex System <no-reply@rhymvex.space>");

  return resolveSmtpConfig({
    provider: "gmail",
    host,
    port,
    secure,
    user,
    pass,
    from,
  });
}

/**
 * Verifies a specific channel ("business" for Zoho or "system" for Gmail).
 */
export async function verifySmtpChannel(
  channel: EmailChannel,
  overrides?: Parameters<typeof resolveSmtpConfig>[0],
): Promise<SmtpVerifyResult> {
  const config = channel === "business" ? resolveBusinessSmtpConfig(overrides) : resolveSystemSmtpConfig(overrides);
  return verifySmtpConnection({
    provider: config.provider,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass,
    from: config.from,
  });
}

/**
 * Verifies both channels simultaneously.
 */
export async function verifyBothSmtpChannels(): Promise<{
  business: SmtpVerifyResult;
  system: SmtpVerifyResult;
}> {
  const [business, system] = await Promise.all([
    verifySmtpChannel("business"),
    verifySmtpChannel("system"),
  ]);
  return { business, system };
}
