"use server";

import { revalidatePath } from "next/cache";
import { queryOne } from "@/lib/db/client";
import { csrfValid, getClientSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { addClientActivity } from "@/lib/data/clients";
import { fieldErrors, bookingRequestSchema } from "@/lib/validation";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Create a booking request from the client portal.
 *
 * The client can only ever create a booking with status REQUESTED — they
 * cannot confirm, cancel, or complete it. That is the staff side. The
 * `client_id` comes from the session, never from the form, so a portal
 * user cannot create a booking against another client.
 *
 * `host_id` is left null: the team decides who hosts. `location` is left
 * empty: the team decides where. `outcome` is left null: only exists after
 * the call has happened.
 */
export async function requestBookingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = bookingRequestSchema.safeParse({
    title: formData.get("title") || "",
    kind: formData.get("kind"),
    scheduled_for: formData.get("scheduled_for"),
    duration_mins: formData.get("duration_mins") || 45,
    agenda: formData.get("agenda") || "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const booking = await queryOne<{ id: string }>(
    `INSERT INTO bookings (title, kind, status, scheduled_for, duration_mins, client_id, agenda)
     VALUES ($1, $2, 'REQUESTED', $3, $4, $5, $6) RETURNING id`,
    [
      data.title,
      data.kind,
      data.scheduled_for,
      data.duration_mins,
      session.clientId,
      data.agenda,
    ],
  );

  await addClientActivity({
    clientId: session.clientId,
    kind: "booking",
    title: "Booking requested",
    detail: data.title,
  });

  await recordAudit(
    { type: "client", id: session.clientUserId, label: session.name },
    {
      action: "booking.requested",
      entityType: "booking",
      entityId: booking?.id,
      metadata: { title: data.title, kind: data.kind, when: data.scheduled_for },
      ...meta,
    },
  );

  revalidatePath("/portal/bookings");
  revalidatePath("/portal");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  return { ok: true, message: "Booking request sent. We will confirm shortly." };
}
