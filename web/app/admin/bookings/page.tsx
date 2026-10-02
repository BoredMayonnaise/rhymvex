import Link from "next/link";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listBookings } from "@/lib/data/workspace";
import { formatDateTime, humanise, untilTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill, bookingStatusTone } from "@/components/ui/primitives";
import { query } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requireStaffPermission("bookings.read");
  const bookings = await listBookings(200);

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => new Date(b.scheduled_for).getTime() >= now && ["REQUESTED", "CONFIRMED"].includes(b.status),
  );
  const past = bookings
    .filter((b) => !upcoming.includes(b))
    .slice(0, 40);

  const totalMinutes = upcoming.reduce((sum, b) => sum + b.duration_mins, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Bookings</h1>
          <p className="rv-page-sub">
            {upcoming.length} upcoming · {Math.round(totalMinutes / 60 * 10) / 10} hours scheduled
          </p>
        </div>
      </header>

      <BookingTable
        title="Upcoming"
        rows={upcoming}
        empty="Nothing scheduled ahead."
        showCountdown
      />

      <BookingTable title="Past and cancelled" rows={past} empty="No past bookings." />

      <UpcomingLoad />
    </div>
  );
}

function BookingTable({
  title,
  rows,
  empty,
  showCountdown = false,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listBookings>>;
  empty: string;
  showCountdown?: boolean;
}) {
  return (
    <Panel title={title} flush>
      {rows.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="rv-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">With</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">When</th>
                {showCountdown ? <th scope="col" className="text-right">In</th> : null}
                <th scope="col" className="text-right">Min</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => {
                return (
                  <tr key={booking.id}>
                    <td className="font-medium text-rhymvex-white">{booking.title}</td>
                    <td className="whitespace-nowrap text-rhymvex-white/60">
                      {booking.client_name ?? booking.lead_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/55">
                      {humanise(booking.kind)}
                    </td>
                    <td>
                      <StatusPill
                        value={humanise(booking.status)}
                        tone={bookingStatusTone(booking.status)}
                      />
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/60">
                      {formatDateTime(booking.scheduled_for)}
                    </td>
                    {showCountdown ? (
                      <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-volt">
                        {untilTime(booking.scheduled_for)}
                      </td>
                    ) : null}
                    <td className="rv-table-num text-right text-rhymvex-white/50">
                      {booking.duration_mins}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** How scheduled time is spread across the team, to spot an overloaded week. */
async function UpcomingLoad() {
  const rows = await query<{ name: string; count: number; minutes: number }>(
    `SELECT COALESCE(s.name, 'Unassigned') AS name,
            count(*)::int AS count,
            sum(b.duration_mins)::int AS minutes
       FROM bookings b LEFT JOIN staff s ON s.id = b.host_id
      WHERE b.scheduled_for >= now() AND b.status IN ('REQUESTED','CONFIRMED')
      GROUP BY s.name ORDER BY minutes DESC`,
  );

  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.minutes));

  return (
    <Panel title="Load, next 30 days">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.name} className="rv-meter-row">
            <span className="truncate text-rhymvex-white/60">{row.name}</span>
            <span className="rv-meter-track">
              <span
                className="rv-meter-fill"
                style={{ width: `${Math.max(4, (row.minutes / max) * 100)}%` }}
              />
            </span>
            <span className="rv-table-num text-right text-rhymvex-white/55">
              {Math.round((row.minutes / 60) * 10) / 10}h
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
