import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with scrypt from node:crypto.
 *
 * Chosen over bcrypt/argon2 to avoid native build dependencies, and over a bare
 * SHA hash because scrypt is memory-hard. The parameters are stored inline with
 * each digest so they can be raised later without invalidating existing hashes.
 *
 * Digest format:  scrypt$N$r$p$<salt-b64url>$<hash-b64url>
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// ~64 MiB of memory per hash. Tuned to Node's default maxmem of 32 MiB plus
// headroom; raising N requires raising maxmem with it.
const PARAMS = { N: 16384, r: 8, p: 1 };
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2; // 32 MiB
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Rejects inputs that are obviously not a real password, to avoid wasted work. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 200) return "Password must be under 200 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
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
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: Math.max(MAXMEM, 256 * N * r),
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
  await scrypt("timing-equaliser", randomBytes(SALT_LENGTH), KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  }).catch(() => undefined);
}
