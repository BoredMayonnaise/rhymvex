"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  FolderKanban,
  MapPin,
  User,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { updateBookingStatusAction, type ActionResult } from "@/app/admin/actions";
import { formatDateTime, humanise, untilTime } from "@/lib/format";

/** What the dialog reads. `BookingRow` in lib/data/workspace satisfies this. */
export type BookingDetailRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  scheduled_for: Date;
  duration_mins: number;
  location: string | null;
  agenda: string | null;
  outcome: string | null;
  host_name: string | null;
  client_name: string | null;
  lead_name: string | null;
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  project_name: string | null;
};

/**
 * Everything a booking knows, which is more than a table row can carry.
 *
 * The list stays scannable on a phone; this is where the where, the agenda and
 * what actually happened get read, and where the booking is moved on.
 */
export function BookingDetail({
  booking,
  csrfToken,
  onClose,
}: {
  booking: BookingDetailRow | null;
  csrfToken: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateBookingStatusAction,
    null,
  );

  // The row this dialog describes changed underneath it, so pull the new list
  // before closing: otherwise the dialog would reopen against a stale status.
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  if (!booking) return null;

  const scheduled = new Date(booking.scheduled_for);
  const upcoming = scheduled.getTime() > Date.now();
  const transitions =
    booking.status === "REQUESTED"
      ? [
          { value: "CONFIRMED", label: "Confirm", primary: true },
          { value: "CANCELLED", label: "Decline" },
        ]
      : booking.status === "CONFIRMED"
        ? [
            { value: "COMPLETED", label: "Mark completed", primary: true },
            { value: "NO_SHOW", label: "No show" },
            { value: "CANCELLED", label: "Cancel" },
          ]
        : [];

  return (
    <Modal
      open={booking !== null}
      onClose={onClose}
      title={booking.title}
      eyebrow={`${humanise(booking.kind)} · ${humanise(booking.status)}`}
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2.5 text-xs">
          <Row icon={CalendarDays} label="When">
            <span className="text-rhymvex-white">{formatDateTime(scheduled)}</span>
            {upcoming ? (
              <span className="ml-2 text-rhymvex-volt">in {untilTime(scheduled)}</span>
            ) : null}
          </Row>
          <Row icon={Clock} label="Length">
            <span className="text-rhymvex-white">{booking.duration_mins} min</span>
          </Row>
          <Row icon={User} label="With">
            {booking.client_id ? (
              <Link
                href={`/admin/clients/${booking.client_id}`}
                className="text-rhymvex-white hover:text-rhymvex-volt"
              >
                {booking.client_name ?? booking.lead_name ?? "Client"}
              </Link>
            ) : booking.lead_id ? (
              <Link
                href={`/admin/leads/${booking.lead_id}`}
                className="text-rhymvex-white hover:text-rhymvex-volt"
              >
                {booking.lead_name ?? "Lead"}
              </Link>
            ) : (
              <span className="text-rhymvex-white">Internal</span>
            )}
            {booking.host_name ? (
              <span className="ml-2 text-rhymvex-white/55">hosted by {booking.host_name}</span>
            ) : (
              <span className="ml-2 text-rhymvex-ember">no host</span>
            )}
          </Row>
          {booking.project_id ? (
            <Row icon={FolderKanban} label="Project">
              <Link
                href={`/admin/projects/${booking.project_id}`}
                className="text-rhymvex-white hover:text-rhymvex-volt"
              >
                {booking.project_name ?? "Project"}
              </Link>
            </Row>
          ) : null}
          <Row icon={MapPin} label="Where">
            {booking.location ? (
              // A location may be a meeting link or an address; a real URL is
              // shown as one, anything else stays plain text.
              /^https?:\/\//.test(booking.location) ? (
                <a
                  href={booking.location}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rhymvex-volt hover:underline"
                >
                  {booking.location}
                </a>
              ) : (
                <span className="text-rhymvex-white">{booking.location}</span>
              )
            ) : (
              <span className="text-rhymvex-ember">Not set</span>
            )}
          </Row>
        </dl>

        {booking.agenda ? (
          <div>
            <p className="rv-eyebrow mb-1.5">Agenda</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-rhymvex-white/70">
              {booking.agenda}
            </p>
          </div>
        ) : null}

        {booking.outcome ? (
          <div>
            <p className="rv-eyebrow mb-1.5">Outcome</p>
            <p className="whitespace-pre-wrap rounded-md border border-rhymvex-white/8 bg-rhymvex-black/30 p-3 text-xs leading-relaxed text-rhymvex-white/70">
              {booking.outcome}
            </p>
          </div>
        ) : null}

        {transitions.length > 0 ? (
          <form action={formAction} className="flex flex-col gap-3 border-t border-rhymvex-white/8 pt-4">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="booking_id" value={booking.id} />

            {booking.status === "CONFIRMED" ? (
              <div>
                <label htmlFor="booking-outcome" className="rv-label">
                  Notes from the call
                </label>
                <textarea
                  id="booking-outcome"
                  name="outcome"
                  rows={3}
                  placeholder="What was decided, what happens next…"
                  className="rv-textarea"
                />
                <p className="mt-1 text-[10px] text-rhymvex-white/50">
                  Saved with the status change, so the next person has the context.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {transitions.map((option) => (
                <button
                  key={option.value}
                  type="submit"
                  name="status"
                  value={option.value}
                  disabled={pending}
                  className={
                    option.primary
                      ? "rv-btn rv-btn-primary rv-btn-sm"
                      : "rv-btn rv-btn-ghost rv-btn-sm"
                  }
                >
                  {option.label}
                </button>
              ))}
              {state && !state.ok ? (
                <p role="alert" className="text-[11px] text-rhymvex-ember">
                  {state.error}
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="border-t border-rhymvex-white/8 pt-4 text-[11px] text-rhymvex-white/50">
            This booking is closed. Nothing further to do.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-rhymvex-white/40" aria-hidden="true" />
      <dt className="w-14 shrink-0 text-rhymvex-white/50">{label}</dt>
      <dd className="min-w-0 flex-1 text-xs">{children}</dd>
    </div>
  );
}