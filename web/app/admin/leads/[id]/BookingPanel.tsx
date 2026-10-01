import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState, StatusPill, bookingStatusTone } from "@/components/ui/primitives";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import type { LeadBooking } from "@/lib/data/lead-detail";

/** Bookings against this lead. Read-only here; created from the lead actions. */
export function BookingPanel({ bookings }: { bookings: LeadBooking[] }) {
  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Bookings</h2>
        <Link href="/admin/bookings" className="text-[11px] font-semibold text-rhymvex-volt hover:underline">
          All bookings
        </Link>
      </header>
      <div className="rv-panel-body">
        {bookings.length === 0 ? (
          <EmptyState>Nothing scheduled with this lead yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="rounded-lg border border-rhymvex-white/8 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-rhymvex-white">
                      <CalendarDays className="size-3.5 shrink-0 text-rhymvex-white/35" aria-hidden="true" />
                      {booking.title}
                    </p>
                    <p className="mt-1 text-[11px] text-rhymvex-volt">
                      {formatDateTime(booking.scheduled_for)} · {booking.duration_mins} min
                    </p>
                    <p className="mt-0.5 text-[11px] text-rhymvex-white/35">
                      {humanise(booking.kind)}
                      {booking.host_name ? ` · ${booking.host_name}` : ""}
                      {booking.location ? ` · ${booking.location}` : ""}
                    </p>
                    {booking.agenda ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-rhymvex-white/50">
                        {booking.agenda}
                      </p>
                    ) : null}
                    {booking.outcome ? (
                      <p className="mt-1.5 rounded border border-rhymvex-white/8 bg-rhymvex-black/30 p-2 text-[11px] leading-relaxed text-rhymvex-white/55">
                        {booking.outcome}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill
                      value={humanise(booking.status)}
                      tone={bookingStatusTone(booking.status)}
                    />
                    <span className="text-[10px] text-rhymvex-white/25">
                      {relativeTime(booking.scheduled_for)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
