import { requireStaffPermission } from "@/lib/auth/guards";
import {
  getBookingCounts,
  getHostLoad,
  listClosedBookings,
  listOpenBookings,
} from "@/lib/data/workspace";
import { EmptyState, Panel, Stat } from "@/components/ui/primitives";
import { pluralise } from "@/lib/format";
import { BookingBrowser } from "./BookingBrowser";

export const dynamic = "force-dynamic";

/**
 * The window the load panel looks at, and the call time one person is expected
 * to hold inside it.
 *
 * The target is a display threshold, not a stored setting or a promise to a
 * client — but the panel is only useful if "full" means the same thing on every
 * row, and a bar drawn against the busiest person instead always shows that
 * person at exactly 100%, whatever the week actually looks like.
 */
const LOAD_WINDOW_DAYS = 30;
const LOAD_TARGET_MINUTES = 12 * 60;

export default async function BookingsPage() {
  const session = await requireStaffPermission("bookings.read");

  // Two scoped queries rather than one capped list: history fills a descending
  // list up and pushes the far-future rows off the end, which are precisely
  // the rows this page exists to show.
  const [counts, open, past] = await Promise.all([
    getBookingCounts(),
    listOpenBookings(200),
    listClosedBookings(40),
  ]);

  const scheduledHours = round1(counts.openMinutes / 60);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Bookings</h1>
          <p className="rv-page-sub">
            {pluralise(counts.open, "booking")} ahead · {scheduledHours}h scheduled
          </p>
        </div>
      </header>

      {/* What needs a decision, before the list itself. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Upcoming"
          value={String(counts.open)}
          meta={`${scheduledHours}h of calls`}
        />
        <Stat
          label="Awaiting confirmation"
          value={String(counts.awaiting)}
          meta={counts.awaiting > 0 ? "still to confirm" : "nothing waiting"}
        />
        <Stat
          label="Missing a location"
          value={String(counts.missingLocation)}
          meta={counts.missingLocation > 0 ? "where will it happen?" : "all have one"}
        />
        <Stat
          label="Closed"
          value={String(counts.closed)}
          meta="completed or cancelled"
        />
      </div>

      <BookingBrowser csrfToken={session.csrfToken} upcoming={open} past={past} all={[...open, ...past]} />

      {/* Below the list: it answers a question you only ask once you have read
          what is already booked. */}
      <UpcomingLoad />
    </div>
  );
}

/** How scheduled time is spread across the team, to spot an overloaded month. */
async function UpcomingLoad() {
  const rows = await getHostLoad(LOAD_WINDOW_DAYS);
  const targetHours = LOAD_TARGET_MINUTES / 60;
  const overbooked = rows.filter((r) => r.minutes > LOAD_TARGET_MINUTES);

  return (
    <Panel
      title={`Host load, next ${LOAD_WINDOW_DAYS} days`}
      action={<span className="rv-panel-note">target {targetHours}h each</span>}
      flush
    >
      {rows.length === 0 ? (
        <EmptyState>Nothing scheduled in the next {LOAD_WINDOW_DAYS} days.</EmptyState>
      ) : (
        <>
          <div className="px-4 py-2">
            {rows.map((row) => (
              <LoadRow key={row.id ?? "unassigned"} row={row} />
            ))}
          </div>
          {/* The bar has to be read against something, and so does the colour. */}
          <p className="border-t border-rhymvex-white/5 px-4 py-2.5 rv-panel-note">
            {overbooked.length > 0
              ? `Full bar is ${targetHours}h. Over target: ${overbooked
                  .map((r) => r.name)
                  .join(", ")}.`
              : `Full bar is ${targetHours}h. Everyone is inside it.`}
          </p>
        </>
      )}
    </Panel>
  );
}

function LoadRow({ row }: { row: { name: string; count: number; minutes: number } }) {
  const hours = round1(row.minutes / 60);
  const over = row.minutes > LOAD_TARGET_MINUTES;
  // Clamped so an overbooked host reads as "past full" rather than drawing a
  // bar that runs off the end of its track.
  const percent = Math.min(100, (row.minutes / LOAD_TARGET_MINUTES) * 100);

  return (
    <div className="rv-meter-row">
      <span className="truncate text-rhymvex-white/60" title={row.name}>
        {row.name}
      </span>
      <span
        className="rv-meter-track"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.name}: ${hours} hours across ${pluralise(row.count, "booking")}${
          over ? ", over the target" : ""
        }`}
      >
        <span className="rv-meter-fill" data-over={over} style={{ width: `${percent}%` }} />
      </span>
      <span
        className={`rv-table-num text-right ${
          over ? "text-rhymvex-ember" : "text-rhymvex-white/55"
        }`}
      >
        {hours}h
      </span>
    </div>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
