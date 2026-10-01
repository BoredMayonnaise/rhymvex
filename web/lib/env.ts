import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Load web/.env.local into process.env.
 *
 * Next.js already does this for the app runtime, so `loadEnv` is a no-op there.
 * It exists for the standalone scripts (migrate, seed, verify) that tsx runs
 * directly, which do not get Next's env handling. The angle brackets in
 * SMTP_FROM make the file invalid shell syntax, so sourcing it is not an option.
 *
 * Guarded on NEXT_RUNTIME: during a build or a server render that variable is
 * set, and the filesystem read would make the bundler trace the entire project.
 * Doing the work only when the variable is absent keeps the build output tight
 * and avoids touching the filesystem during rendering.
 */
export function loadEnv(): void {
  if (process.env.RV_ENV_LOADED === "1") return;
  if (process.env.NEXT_RUNTIME) {
    process.env.RV_ENV_LOADED = "1";
    return;
  }

  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) continue;
    try {
      // Available on Node 20.12+. Throws only if the file is unreadable.
      process.loadEnvFile(full);
    } catch {
      // Fall through to the manual parser below.
      parseEnvFile(full);
    }
    break;
  }

  process.env.RV_ENV_LOADED = "1";
}

function parseEnvFile(full: string): void {
  // Lazy require so this module stays importable from edge-ish contexts.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  for (const rawLine of readFileSync(full, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    // Strip one layer of matching quotes, and any trailing comment outside them.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

/** Read an integer env var, falling back when unset or unparseable. */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Read a required env var, throwing with actionable guidance. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required but not set. Copy web/.env.example to web/.env.local and fill it in.`,
    );
  }
  return value;
}
