import { requireClientSession } from "@/lib/auth/guards";
import { listPortalBookings } from "@/lib/data/portal";
import { formatDateTime, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, bookingStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PortalBookingsPage() {
  const session = await requireClientSession();
  const bookings = await listPortalBookings(session);

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => new Date(b.scheduled_for).getTime() >= now && ["REQUESTED", "CONFIRMED"].includes(b.status),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Bookings</h1>
          <p className="rv-page-sub">
            {upcoming.length} upcoming
          </p>
        </div>
      </header>

      <Panel title="Upcoming" flush>
        {upcoming.length === 0 ? (
          <EmptyState>Nothing scheduled at the moment.</EmptyState>
        ) : (
          <ul>
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-rhymvex-white/5 px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rhymvex-white">{booking.title}</p>
                  <p className="mt-0.5 text-xs text-rhymvex-volt">
                    {formatDateTime(booking.scheduled_for)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-rhymvex-white/40">
                    {booking.duration_mins} min
                    {booking.host_name ? ` · with ${booking.host_name}` : ""}
                    {booking.location ? ` · ${booking.location}` : ""}
                  </p>
                  {booking.agenda ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-rhymvex-white/50">
                      {booking.agenda}
                    </p>
                  ) : null}
                </div>
                <StatusPill
                  value={humanise(booking.status)}
                  tone={bookingStatusTone(booking.status)}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {past.length > 0 ? (
        <Panel title="Past" flush>
          <ul>
            {past.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-rhymvex-white/70">{booking.title}</p>
                  <p className="text-[10px] text-rhymvex-white/30">
                    {formatDateTime(booking.scheduled_for)}
                    {booking.host_name ? ` · ${booking.host_name}` : ""}
                  </p>
                </div>
                <StatusPill
                  value={humanise(booking.status)}
                  tone={bookingStatusTone(booking.status)}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
