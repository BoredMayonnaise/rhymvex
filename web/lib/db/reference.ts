import { randomInt } from "node:crypto";
import { query } from "./client";

/**
 * Unique human-facing reference codes.
 *
 * Server-only: this needs both the CSPRNG and the database. It deliberately does
 * not live in `lib/format.ts`, which client components import for formatting
 * helpers — pulling `node:crypto` or the connection pool in there would drag
 * both into the browser bundle.
 */

/** Ambiguous characters (0/O, 1/I) are excluded so a code cannot be misread. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function referenceCode(length = 6, prefix = ""): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return prefix ? `${prefix}-${out}` : out;
}

export async function uniqueReference(
  table: "leads" | "clients" | "proposals" | "contracts" | "invoices",
  prefix: string,
): Promise<string> {
  // Collisions are vanishingly unlikely at this length, but a duplicate would
  // fail the insert, so retry rather than surface a 500 to a user.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = referenceCode(6, prefix);
    const existing = await query(`SELECT 1 FROM ${table} WHERE reference = $1`, [candidate]);
    if (existing.length === 0) return candidate;
  }
  // Fall back to a longer code rather than looping indefinitely.
  return `${prefix}-${referenceCode(12)}`;
}
