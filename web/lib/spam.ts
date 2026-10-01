import { envInt } from "@/lib/env";

/**
 * Spam heuristics for the public intake form.
 *
 * Two cheap signals, neither of which inconveniences a real person:
 *   1. A honeypot field that is hidden from people and from assistive tech.
 *      A bot that fills every input on the page populates it.
 *   2. A minimum fill time. The form stamps its render time; a request that
 *      arrives in under a second or two is a script.
 *
 * Server-only: reads the environment, so it must not be imported by a client
 * component.
 */
export function assertLikelyHuman(input: {
  website_confirm?: string;
  startedAt?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.website_confirm && input.website_confirm.length > 0) {
    return { ok: false, reason: "honeypot" };
  }

  const minSeconds = envInt("INTAKE_MIN_SECONDS", 3);
  if (input.startedAt) {
    // A clock skewed into the future is not a person filling in a form.
    const elapsed = Date.now() - input.startedAt;
    if (elapsed < minSeconds * 1000) return { ok: false, reason: "too-fast" };
  }

  return { ok: true };
}
