"use server";

import { revalidatePath } from "next/cache";
import { queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { addClientActivity } from "@/lib/data/clients";
import type { ActionResult } from "./leads";

/**
 * Move a booking along: confirm a request, complete a call, record a no-show.
 *
 * The outcome note is saved with the transition, so the context of a call
 * survives the person who was in it.
 */
export async function updateBookingStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("bookings.write")) {
    return { ok: false, error: "Your role cannot change bookings." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const bookingId = String(formData.get("booking_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const outcome = String(formData.get("outcome") ?? "").slice(0, 4000);

  const allowed = ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  if (!isRecordId(bookingId) || !allowed.includes(status)) {
    return { ok: false, error: "Invalid status change." };
  }

  const booking = await queryOne<{
    id: string;
    title: string;
    status: string;
    scheduled_for: Date;
    client_id: string | null;
    lead_id: string | null;
  }>(
    "SELECT id, title, status, scheduled_for, client_id, lead_id FROM bookings WHERE id = $1",
    [bookingId],
  );
  if (!booking) return { ok: false, error: "Booking not found." };

  // A call cannot have happened before its time.
  if (status === "COMPLETED" && new Date(booking.scheduled_for).getTime() > Date.now()) {
    return { ok: false, error: "That call is still in the future." };
  }

  // Notes belong to a call that happened or is being closed out, so they are only
  // accepted on the transition that records one.
  if (outcome && booking.status !== "CONFIRMED") {
    return { ok: false, error: "Only a confirmed booking can take notes." };
  }

  // $1 is cast where it lands: status is an enum column, and an uncast
  // parameter would be deduced inconsistently against the comparison below.
  const { query } = await import("@/lib/db/client");
  await query(
    `UPDATE bookings
        SET status = $1::booking_status,
            outcome = coalesce(nullif($2, ''), outcome),
            updated_at = now()
      WHERE id = $3`,
    [status, outcome, bookingId],
  );

  // A completed or cancelled call is news for the client, and their portal
  // shows the same record.
  if (["COMPLETED", "CANCELLED"].includes(status) && booking.client_id) {
    await addClientActivity({
      clientId: booking.client_id,
      kind: "booking",
      title:
        status === "COMPLETED" ? "Call completed" : "Call cancelled",
      detail: booking.title,
    });
  }

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "booking.updated",
      entityType: "booking",
      entityId: bookingId,
      metadata: { from: booking.status, to: status, title: booking.title },
      ...(await requestMeta()),
    },
  );

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  // The client sees their own bookings in the portal, so this is theirs too.
  revalidatePath("/portal/bookings");
  revalidatePath("/portal");

  return { ok: true, message: `Marked ${humanise(status).toLowerCase()}.` };
}
