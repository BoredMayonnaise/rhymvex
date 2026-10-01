import { SITUATIONS } from "@/lib/validation";

/**
 * Shared lead capture plumbing.
 *
 * Four placements post to the same endpoint: the hero form, the modal, the
 * closing panel, and the full intake page. They all build their payload and
 * interpret their response here, so the honeypot, the timing signal and the
 * result shape cannot drift apart between them.
 *
 * Client-safe: imports only validation schemas, never a server module.
 */

/** Honeypot input name. A real person never sees or fills this. */
export const HONEYPOT_FIELD = "website_confirm";

export type CaptureStep = {
  key: "received" | "recorded" | "notified" | "consultation";
  label: string;
  done: boolean;
};

export type CaptureResult =
  | { ok: true; reference: string; steps: CaptureStep[]; emailDelivered: boolean }
  | { ok: false; error: string; fields?: Record<string, string>; rateLimited?: boolean };

/**
 * Read a form into the payload the endpoint expects.
 *
 * Only the fields the placement actually rendered are sent, so a compact form
 * cannot accidentally submit a blank value for something it never showed.
 */
export function buildPayload(form: HTMLFormElement, startedAt: number) {
  const value = (name: string) => {
    const entry = new FormData(form).get(name);
    return typeof entry === "string" ? entry : "";
  };

  return {
    name: value("name"),
    email: value("email"),
    company: value("company"),
    role_title: value("role_title"),
    phone: value("phone"),
    website: value("website"),
    situation: value("situation"),
    message: value("message"),
    budget_band: value("budget_band"),
    timeline: value("timeline"),
    [HONEYPOT_FIELD]: value(HONEYPOT_FIELD),
    startedAt,
  };
}

/** POST the payload and normalise whatever comes back. */
export async function postLeadCapture(
  payload: ReturnType<typeof buildPayload>,
): Promise<CaptureResult> {
  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json.ok) {
      return {
        ok: false,
        error: json.error ?? "Something went wrong. Please try again.",
        fields: json.fields,
        rateLimited: response.status === 429,
      };
    }

    return {
      ok: true,
      reference: json.reference ?? "",
      steps: (json.steps as CaptureStep[]) ?? [],
      emailDelivered: Boolean(json.emailDelivered),
    };
  } catch {
    return {
      ok: false,
      error: "We could not reach the server. Check your connection and try again.",
    };
  }
}

export { SITUATIONS };
