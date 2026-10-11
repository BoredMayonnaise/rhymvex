import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSecuritySettings, type SecuritySettings } from "@/lib/security-settings";

/**
 * Password hashing with scrypt from node:crypto.
 *
 * Chosen over bcrypt/argon2 to avoid native build dependencies, and over a bare
 * SHA hash because scrypt is memory-hard. The parameters are stored inline with
 * each digest so they can be raised later without invalidating existing hashes.
 *
 * Digest format:  scrypt$N$r$p$<salt-b64url>$<hash-b64url>
 *
 * Cost comes from the security policy, so it can be raised from the security
 * page without a deploy. `verifyPassword` reads N/r/p back out of the stored
 * digest rather than from current policy — that is what lets the cost go up and
 * every hash written under the old value still verify.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt rejects N above 32, and wants headroom over its working set. Computed
// per call from whatever the policy says rather than frozen at import, so
// raising the cost in the UI does not fail against a stale ceiling.
function maxmemFor(N: number, r: number): number {
  return 128 * N * r * 2;
}

/**
 * NFKC normalisation, so a password typed with a composed or decomposed accent
 * hashes to the same value either way. Buffer input has nothing to normalise —
 * it arrives already encoded, from invitation-token derivation.
 */
function normalise(password: string | Buffer): string | Buffer {
  return typeof password === "string" ? password.normalize("NFKC") : password;
}

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** The cost parameters in force, for the security page to report. */
export async function scryptParameters(): Promise<{ N: number; r: number; p: number }> {
  const { scryptN, scryptR, scryptP } = await getSecuritySettings();
  return { N: scryptN, r: scryptR, p: scryptP };
}

/**
 * The policy check, separated from the lookup so a form can render live
 * feedback against an already-resolved policy without a query per keystroke.
 */
export function checkPasswordAgainstPolicy(
  password: string,
  policy: Pick<
    SecuritySettings,
    | "passwordMinLength"
    | "passwordMaxLength"
    | "passwordRequireLower"
    | "passwordRequireUpper"
    | "passwordRequireDigit"
  >,
): string | null {
  if (password.length < policy.passwordMinLength) {
    return `Password must be at least ${policy.passwordMinLength} characters.`;
  }
  if (password.length > policy.passwordMaxLength) {
    return `Password must be under ${policy.passwordMaxLength} characters.`;
  }
  if (policy.passwordRequireLower && !/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (policy.passwordRequireUpper && !/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (policy.passwordRequireDigit && !/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  return null;
}

/**
 * Rejects inputs that are obviously not a real password, to avoid wasted work.
 *
 * The rules are the policy's, not this function's — so a workspace on managed
 * devices that already enforce length and complexity elsewhere can turn the
 * character-class requirements off without a code change.
 */
export async function validatePasswordStrength(password: string): Promise<string | null> {
  return checkPasswordAgainstPolicy(password, await getSecuritySettings());
}

export async function hashPassword(password: string | Buffer): Promise<string> {
  const { scryptN: N, scryptR: r, scryptP: p } = await getSecuritySettings();
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(normalise(password), salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  });
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(normalise(password), salt, expected.length, {
      N,
      r,
      p,
      maxmem: maxmemFor(N, r),
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Burn roughly the same CPU as a real verification. Called when no account
 * matches, so response timing does not reveal whether an email is registered.
 */
export async function fakeVerifyDelay(): Promise<void> {
  const { scryptN: N, scryptR: r, scryptP: p } = await getSecuritySettings();
  await scrypt("timing-equaliser", randomBytes(SALT_LENGTH), KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  }).catch(() => undefined);
}
