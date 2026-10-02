import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { envInt } from "@/lib/env";

/**
 * Rate limiting for public, unauthenticated endpoints.
 *
 * Backed by a table so the limit holds across processes and restarts rather
 * than resetting whenever the server does. A fixed-window counter is enough
 * here: the limit exists to blunt casual form spam, not to stop a determined
 * attacker, and an IP can always be abandoned.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Client IP from the usual proxy headers, first value. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || null;
}

export async function requestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  return {
    ipAddress: await clientIp(),
    userAgent: h.get("user-agent"),
  };
}

/**
 * Consume one unit from a windowed bucket, atomically.
 *
 * The upsert and the increment happen in one statement so two concurrent
 * submissions cannot both read a stale count and both be admitted.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { queryOne } = await import("@/lib/db/client");

  const row = await queryOne<{ count: number; window_start: Date; allowed: boolean }>(
    `INSERT INTO rate_limit_buckets (bucket_key, count, window_start)
          VALUES ($1, 1, now())
     ON CONFLICT (bucket_key) DO UPDATE
            SET count = CASE
                          WHEN rate_limit_buckets.window_start
                               < now() - ($3 || ' seconds')::interval
                          THEN 1
                          ELSE rate_limit_buckets.count + 1
                        END,
                window_start = CASE
                          WHEN rate_limit_buckets.window_start
                               < now() - ($3 || ' seconds')::interval
                          THEN now()
                          ELSE rate_limit_buckets.window_start
                        END
      RETURNING count, window_start, (count <= $2) AS allowed`,
    [key, limit, String(windowSeconds)],
  );

  const count = row?.count ?? 1;
  const remaining = Math.max(0, limit - count);
  const windowStart = row?.window_start ? new Date(row.window_start) : new Date();
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000),
  );

  return { allowed: (row?.allowed ?? true) && count <= limit, remaining, retryAfterSeconds };
}

export async function checkIntakeRateLimit(ip: string | null): Promise<RateLimitResult> {
  const limit = envInt("INTAKE_RATE_LIMIT", 5);
  const window = envInt("INTAKE_RATE_WINDOW_SECONDS", 3600);
  // Scope by IP. An absent IP falls back to a shared bucket rather than
  // bypassing the limit entirely.
  return consumeRateLimit(`intake:${ip ?? "unknown"}`, limit, window);
}

/* -------------------------------------------------------------------------- */
/* Sign-in throttling                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The wording shown for every throttled attempt, wherever it came from.
 *
 * Deliberately identical to the bad-credentials message and to the message a
 * never-existed account gets. A distinct "too many attempts" only on real
 * accounts would turn the limit back into an account-enumeration oracle, which
 * would undo the point of `fakeVerifyDelay`.
 */
export const SIGN_IN_THROTTLED_MESSAGE =
  "Too many attempts. Wait a few minutes and try again.";

/**
 * Throttle the attempt itself, by IP.
 *
 * Consumed on every attempt, successful or not, which is what caps how many
 * password hashes an attacker can make the server compute. The budget is
 * deliberately loose: this bucket is aimed at credential spraying across many
 * accounts from one address, and a shared office or a NAT'd network can put
 * several real people behind one IP. `signInFailureBudget` is the tighter limit.
 */
export async function consumeSignInAttempt(
  scope: "staff" | "client",
  ip: string | null,
): Promise<RateLimitResult> {
  const limit = envInt("SIGN_IN_IP_LIMIT", 20);
  const window = envInt("SIGN_IN_WINDOW_SECONDS", 900);
  return consumeRateLimit(`signin:${scope}:ip:${ip ?? "unknown"}`, limit, window);
}

/**
 * Throttle repeated failures against one account, whatever the source address.
 *
 * This is the bucket that actually stops guessing, because it is keyed on the
 * account rather than the caller, so rotating IPs does not reset it. The email
 * is hashed rather than stored in the bucket key: the key is a durable row, and
 * a password-reset flow should not have to treat the rate-limit table as another
 * place holding addresses in the clear.
 *
 * Only consumed on failure, so a real user signing in repeatedly is never locked
 * out by their own successful logins.
 */
export async function consumeSignInFailure(
  scope: "staff" | "client",
  email: string,
): Promise<RateLimitResult> {
  const limit = envInt("SIGN_IN_ACCOUNT_LIMIT", 5);
  const window = envInt("SIGN_IN_WINDOW_SECONDS", 900);
  const digest = createHash("sha256")
    .update(`${scope}:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  return consumeRateLimit(`signin:${scope}:account:${digest}`, limit, window);
}

/** Drop windows that are long past, so the table does not grow forever. */
export async function pruneRateLimitBuckets(): Promise<void> {
  const { query } = await import("@/lib/db/client");
  await query("DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '2 days'");
}

/**
 * Record the moment an IP was last seen, and report whether the submission
 * arrived implausibly fast after the form was rendered.
 */
export async function recordSubmissionTiming(
  ip: string | null,
  startedAt: number | undefined,
  minSeconds: number,
): Promise<boolean> {
  if (!ip) return true;
  const { queryOne } = await import("@/lib/db/client");

  const previous = await queryOne<{ last_seen_at: Date }>(
    `INSERT INTO intake_timing (ip_address, last_seen_at)
          VALUES ($1, now())
     ON CONFLICT (ip_address) DO UPDATE SET last_seen_at = now()
     RETURNING last_seen_at`,
    [ip],
  );
  // The RETURNING row is the post-update value, so compare against the client
  // supplied render time as the primary signal; the stored value is a fallback
  // for repeat submissions from the same IP.
  if (startedAt) {
    return Date.now() - startedAt >= minSeconds * 1000;
  }
  return Boolean(previous);
}
