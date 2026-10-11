import { query, queryOne } from "@/lib/db/client";
import { envInt } from "@/lib/env";

/**
 * Security policy, resolved.
 *
 * Layering, lowest to highest:
 *
 *   1. Compiled-in defaults. The behaviour the code ships with.
 *   2. Environment variables, where one exists. A deployment can still pin a
 *      value the way it always could.
 *   3. The `security_settings` row. What an admin set from the security page.
 *
 * Secrets are not in any of these layers. SMTP credentials and SESSION_SECRET
 * stay in the environment and are not readable or writable from here — policy
 * is not the same thing as a key.
 *
 * Read through a short memo rather than React's per-request `cache`, because
 * several call sites (sign-in throttling, session creation) run outside a
 * render. The memo window is what bounds how long a change takes to reach every
 * instance; five seconds is short enough that "it applies immediately" is true
 * in any sense a person would notice.
 */

const MEMO_MS = 5000;

export type CookieSamesite = "lax" | "strict";

export type SecuritySettings = {
  staffSessionHours: number;
  staffRememberedDays: number;
  clientSessionDays: number;
  clientRememberedDays: number;
  cookieSamesite: CookieSamesite;
  passwordMinLength: number;
  passwordMaxLength: number;
  passwordRequireLower: boolean;
  passwordRequireUpper: boolean;
  passwordRequireDigit: boolean;
  scryptN: number;
  scryptR: number;
  scryptP: number;
  signinIpLimit: number;
  signinAccountLimit: number;
  signinWindowSeconds: number;
  intakeRateLimit: number;
  intakeWindowSeconds: number;
  intakeMinSeconds: number;
};

export type SecuritySettingKey = keyof SecuritySettings;

/**
 * The shipped defaults.
 *
 * These are the numbers that were hardcoded in the source before the settings
 * page existed, so a deployment with an empty `security_settings` table behaves
 * exactly as it did before.
 */
export const SECURITY_DEFAULTS: SecuritySettings = {
  staffSessionHours: 12,
  staffRememberedDays: 30,
  clientSessionDays: 7,
  clientRememberedDays: 30,
  cookieSamesite: "lax",
  passwordMinLength: 10,
  passwordMaxLength: 200,
  passwordRequireLower: true,
  passwordRequireUpper: true,
  passwordRequireDigit: true,
  scryptN: 16384,
  scryptR: 8,
  scryptP: 1,
  signinIpLimit: 20,
  signinAccountLimit: 5,
  signinWindowSeconds: 900,
  intakeRateLimit: 5,
  intakeWindowSeconds: 3600,
  intakeMinSeconds: 3,
};

/** Guard rails for the editor. Narrower than the CHECK constraints on purpose. */
export const SECURITY_LIMITS = {
  staffSessionHours: { min: 1, max: 720, step: 1, label: "Staff session (hours)" },
  staffRememberedDays: { min: 1, max: 365, step: 1, label: "Staff remembered (days)" },
  clientSessionDays: { min: 1, max: 365, step: 1, label: "Client session (days)" },
  clientRememberedDays: { min: 1, max: 365, step: 1, label: "Client remembered (days)" },
  passwordMinLength: { min: 8, max: 128, step: 1, label: "Minimum password length" },
  passwordMaxLength: { min: 32, max: 512, step: 1, label: "Maximum password length" },
  signinIpLimit: { min: 1, max: 10000, step: 1, label: "Sign-in attempts per IP" },
  signinAccountLimit: { min: 1, max: 1000, step: 1, label: "Failed sign-ins per account" },
  signinWindowSeconds: { min: 30, max: 86400, step: 30, label: "Sign-in window (seconds)" },
  intakeRateLimit: { min: 1, max: 10000, step: 1, label: "Intake submissions per IP" },
  intakeWindowSeconds: { min: 30, max: 86400, step: 30, label: "Intake window (seconds)" },
  intakeMinSeconds: { min: 0, max: 300, step: 1, label: "Fastest allowed form fill" },
} as const;

/** Only the keys the editor may write. Everything else is derived. */
export const EDITABLE_KEYS = [
  "staffSessionHours",
  "staffRememberedDays",
  "clientSessionDays",
  "clientRememberedDays",
  "cookieSamesite",
  "passwordMinLength",
  "passwordMaxLength",
  "passwordRequireLower",
  "passwordRequireUpper",
  "passwordRequireDigit",
  "scryptN",
  "scryptR",
  "scryptP",
  "signinIpLimit",
  "signinAccountLimit",
  "signinWindowSeconds",
  "intakeRateLimit",
  "intakeWindowSeconds",
  "intakeMinSeconds",
] as const satisfies readonly SecuritySettingKey[];

export type EditableKey = (typeof EDITABLE_KEYS)[number];

/** Human label for a key, from SECURITY_LIMITS where one exists. */
export function labelForKey(key: EditableKey): string {
  const limits = SECURITY_LIMITS as Partial<Record<EditableKey, { label: string }>>;
  return limits[key]?.label ?? key;
}

type SettingRow = {
  [K in SecuritySettingKey]?: SecuritySettingKey extends K ? number | boolean | string | null : never;
} & {
  updated_at: Date;
  updated_by: string | null;
};

let memo: { at: number; value: SecuritySettings; overridden: Set<SecuritySettingKey> } | null = null;

const COLUMN = {
  staffSessionHours: "staff_session_hours",
  staffRememberedDays: "staff_remembered_days",
  clientSessionDays: "client_session_days",
  clientRememberedDays: "client_remembered_days",
  cookieSamesite: "cookie_samesite",
  passwordMinLength: "password_min_length",
  passwordMaxLength: "password_max_length",
  passwordRequireLower: "password_require_lower",
  passwordRequireUpper: "password_require_upper",
  passwordRequireDigit: "password_require_digit",
  scryptN: "scrypt_n",
  scryptR: "scrypt_r",
  scryptP: "scrypt_p",
  signinIpLimit: "signin_ip_limit",
  signinAccountLimit: "signin_account_limit",
  signinWindowSeconds: "signin_window_seconds",
  intakeRateLimit: "intake_rate_limit",
  intakeWindowSeconds: "intake_window_seconds",
  intakeMinSeconds: "intake_min_seconds",
} satisfies Record<SecuritySettingKey, string>;

/**
 * The environment layer.
 *
 * Only the knobs that already had a variable. Anything without one skips this
 * layer and goes straight from default to database.
 */
function envLayer(): Partial<SecuritySettings> {
  return {
    signinIpLimit: envInt("SIGN_IN_IP_LIMIT", SECURITY_DEFAULTS.signinIpLimit),
    signinAccountLimit: envInt("SIGN_IN_ACCOUNT_LIMIT", SECURITY_DEFAULTS.signinAccountLimit),
    signinWindowSeconds: envInt("SIGN_IN_WINDOW_SECONDS", SECURITY_DEFAULTS.signinWindowSeconds),
    intakeRateLimit: envInt("INTAKE_RATE_LIMIT", SECURITY_DEFAULTS.intakeRateLimit),
    intakeWindowSeconds: envInt(
      "INTAKE_RATE_WINDOW_SECONDS",
      SECURITY_DEFAULTS.intakeWindowSeconds,
    ),
    intakeMinSeconds: envInt("INTAKE_MIN_SECONDS", SECURITY_DEFAULTS.intakeMinSeconds),
  };
}

/** Whether an env var was actually set, so the page can say "from environment". */
function envIsSet(name: string): boolean {
  return Boolean(process.env[name]);
}

export type ResolvedSecuritySettings = {
  settings: SecuritySettings;
  /** Keys an admin has set, as opposed to inherited. */
  overridden: Set<SecuritySettingKey>;
  /** Keys pinned by an environment variable, which outrank the built-in default. */
  fromEnv: Set<SecuritySettingKey>;
  updatedAt: Date | null;
  updatedBy: string | null;
};

/**
 * Select list, aliased back to the camelCase keys the rest of this module uses.
 *
 * Aliasing rather than reading by column name: `Object.entries(COLUMN)` is the
 * one place that knows the snake_case spelling, and mapping from it means a
 * column added to the table and a key added to the type cannot drift apart
 * silently — an unaliased read of `scrypt_n` under the key `scryptN` returns
 * undefined, which looks exactly like "not overridden".
 */
const SELECT_LIST = (Object.entries(COLUMN) as Array<[SecuritySettingKey, string]>)
  .map(([key, column]) => `${column} AS "${key}"`)
  .join(", ");

export async function resolveSecuritySettings(): Promise<ResolvedSecuritySettings> {
  if (memo && Date.now() - memo.at < MEMO_MS) {
    return {
      settings: memo.value,
      overridden: memo.overridden,
      fromEnv: envSetKeys(),
      updatedAt: null,
      updatedBy: null,
    };
  }

  const row = await queryOne<SettingRow>(
    `SELECT ${SELECT_LIST}, updated_at, updated_by
       FROM security_settings WHERE id = true`,
  );

  const base = { ...SECURITY_DEFAULTS, ...envLayer() };
  const overridden = new Set<SecuritySettingKey>();
  const value = { ...base };

  if (row) {
    for (const key of Object.keys(COLUMN) as SecuritySettingKey[]) {
      const stored = row[key];
      if (stored === null || stored === undefined) continue;
      (value[key] as number | boolean | string) = stored as never;
      overridden.add(key);
    }
  }

  memo = { at: Date.now(), value, overridden };

  return {
    settings: value,
    overridden,
    fromEnv: envSetKeys(),
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}

function envSetKeys(): Set<SecuritySettingKey> {
  const set = new Set<SecuritySettingKey>();
  const pairs: Array<[SecuritySettingKey, string]> = [
    ["signinIpLimit", "SIGN_IN_IP_LIMIT"],
    ["signinAccountLimit", "SIGN_IN_ACCOUNT_LIMIT"],
    ["signinWindowSeconds", "SIGN_IN_WINDOW_SECONDS"],
    ["intakeRateLimit", "INTAKE_RATE_LIMIT"],
    ["intakeWindowSeconds", "INTAKE_RATE_WINDOW_SECONDS"],
    ["intakeMinSeconds", "INTAKE_MIN_SECONDS"],
  ];
  for (const [key, name] of pairs) if (envIsSet(name)) set.add(key);
  return set;
}

/** The hot path: settings only, no provenance. */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  return (await resolveSecuritySettings()).settings;
}

/** Drop the memo. Called after a write so the next read is the new value. */
export function invalidateSecuritySettings(): void {
  memo = null;
}

function dbType(key: SecuritySettingKey): "int" | "bool" | "text" {
  if (key === "cookieSamesite") return "text";
  if (key.startsWith("passwordRequire")) return "bool";
  return "int";
}

/**
 * Write one override. `null` clears it, which is how a key goes back to
 * inheriting whatever the environment says.
 */
export async function setSecuritySetting(
  key: SecuritySettingKey,
  value: number | boolean | string | null,
): Promise<void> {
  const column = COLUMN[key];
  const type = dbType(key);
  await query(
    `INSERT INTO security_settings (id, ${column}, updated_at)
     VALUES (true, $1::${type}, now())
     ON CONFLICT (id) DO UPDATE SET ${column} = EXCLUDED.${column}, updated_at = now()`,
    [value],
  );
  invalidateSecuritySettings();
}

/** Clear every override, returning the deployment to its defaults. */
export async function clearSecuritySettings(): Promise<void> {
  await query(`DELETE FROM security_settings WHERE id = true`);
  invalidateSecuritySettings();
}