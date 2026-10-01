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
