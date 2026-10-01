import { NextResponse } from "next/server";
import { fieldErrors, intakeSchema } from "@/lib/validation";
import { assertLikelyHuman } from "@/lib/spam";
import { checkIntakeRateLimit, recordSubmissionTiming, requestMeta } from "@/lib/ratelimit";
import { submitIntake } from "@/lib/data/intake";
import { envInt } from "@/lib/env";
import { recordAudit, ANONYMOUS_ACTOR } from "@/lib/audit";

/**
 * Public intake endpoint.
 *
 * This replaces mailto as the primary contact path. The browser never opens an
 * email client: the request is validated, the lead is recorded, an audit event
 * is written, both emails are sent through SMTP, and the response drives the
 * in-site success state.
 *
 * Order of defence: rate limit → honeypot/timing → schema → persist.
 * A rejected submission is not told why in detail, so the endpoint does not
 * become a way to probe the validation rules.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const meta = await requestMeta();

  // 1. Rate limit, per IP.
  const limit = await checkIntakeRateLimit(meta.ipAddress);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many submissions from this connection. Please try again later, or email us directly.",
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // 2. Parse the body defensively. A non-JSON body is a client error.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  // 3. Honeypot and fill-time check, before any parsing cost is trusted.
  const human = assertLikelyHuman({
    website_confirm: (raw as Record<string, unknown>).website_confirm as string | undefined,
    startedAt: (raw as Record<string, unknown>).startedAt as number | undefined,
  });
  if (!human.ok) {
    await recordAudit(ANONYMOUS_ACTOR, {
      action: "intake.rejected",
      entityType: "intake",
      metadata: { reason: human.reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    // Reported as success so a bot learns nothing about which check caught it.
    return NextResponse.json({
      ok: true,
      reference: "RECEIVED",
      steps: [
        { key: "received", label: "Request received", done: true },
        { key: "recorded", label: "Information recorded", done: true },
        { key: "notified", label: "Rhymvex team notified", done: true },
        { key: "consultation", label: "Human consultation", done: false },
      ],
    });
  }

  // 4. Schema validation. Returns per-field messages so the form can show them.
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  // 5. Repeat-submission timing signal from the stored IP record.
  const timingOk = await recordSubmissionTiming(
    meta.ipAddress,
    parsed.data.startedAt,
    envInt("INTAKE_MIN_SECONDS", 3),
  );
  if (!timingOk) {
    await recordAudit(ANONYMOUS_ACTOR, {
      action: "intake.rejected",
      entityType: "intake",
      metadata: { reason: "implausible-timing" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({
      ok: true,
      reference: "RECEIVED",
      steps: [
        { key: "received", label: "Request received", done: true },
        { key: "recorded", label: "Information recorded", done: true },
        { key: "notified", label: "Rhymvex team notified", done: true },
        { key: "consultation", label: "Human consultation", done: false },
      ],
    });
  }

  // 6. Record, audit, and send.
  try {
    const result = await submitIntake(parsed.data, meta);
    return NextResponse.json({
      ok: true,
      reference: result.reference,
      steps: result.steps,
      emailDelivered: result.emailDelivered,
    });
  } catch (error) {
    // The lead is written before email, so a failure here means the write
    // itself failed. Log the detail server-side; tell the visitor only that we
    // could not record it, so they retry rather than assume it landed.
    console.error("intake failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "We could not record your request just now. Please try again, or email hello@rhymvex.com.",
      },
      { status: 500 },
    );
  }
}
