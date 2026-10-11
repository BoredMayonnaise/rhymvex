"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState, Panel, StatusPill, bookingStatusTone } from "@/components/ui/primitives";
import { formatDateTime, humanise, untilTime } from "@/lib/format";
import { BookingDetail, type BookingDetailRow } from "./BookingDetail";

/**
 * The bookings list.
 *
 * A client component because a row opens the detail dialog. The table stays a
 * table on a desktop and collapses to the shared mobile card layout, and the
 * columns that do not fit a narrow screen are hidden rather than squeezed —
 * that is what the detail dialog is for.
 */
export function BookingBrowser({
  csrfToken,
  upcoming,
  past,
  all,
}: {
  csrfToken: string;
  upcoming: BookingDetailRow[];
  past: BookingDetailRow[];
  /** Every booking, so the dialog can still find a row it opened after a refresh. */
  all: BookingDetailRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Built here rather than in the page: a Map cannot cross the server/client
  // boundary, so the server hands over plain rows.
  const byId = new Map(all.map((b) => [b.id, b]));
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  return (
    <>
      <BookingTable
        title="Upcoming"
        rows={upcoming}
        empty="Nothing scheduled ahead."
        showCountdown
        onOpen={setSelectedId}
      />

      <BookingTable
        title="Past and cancelled"
        rows={past}
        empty="No past bookings."
        onOpen={setSelectedId}
      />

      {selected ? (
        <BookingDetail
          booking={selected}
          csrfToken={csrfToken}
          // Closing only dismisses: the dialog itself refreshes the list once a
          // status change succeeds, so a plain close must not refetch.
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}

function BookingTable({
  title,
  rows,
  empty,
  showCountdown = false,
  onOpen,
}: {
  title: string;
  rows: BookingDetailRow[];
  empty: string;
  showCountdown?: boolean;
  onOpen: (id: string) => void;
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
                {showCountdown ? (
                  <th scope="col" className="text-right">In</th>
                ) : null}
                <th scope="col" className="rv-col-wide">Host</th>
                <th scope="col" className="rv-col-wide">Where</th>
                <th scope="col" className="text-right">Min</th>
                <th scope="col"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => {
                const withWho = booking.client_name ?? booking.lead_name;
                return (
                  <tr key={booking.id}>
                    <td data-label="Title" className="font-medium text-rhymvex-white">
                      <span className="block truncate">{booking.title}</span>
                      {/* The agenda is the part that was missing from the row; a
                          one-line hint tells you whether it is worth opening. */}
                      {booking.agenda ? (
                        <span className="mt-0.5 block truncate text-[10px] text-rhymvex-white/45">
                          {booking.agenda}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="With" className="whitespace-nowrap text-rhymvex-white/60">
                      {withWho ? (
                        booking.client_id ? (
                          <Link
                            href={`/admin/clients/${booking.client_id}`}
                            className="hover:text-rhymvex-volt"
                          >
                            {withWho}
                          </Link>
                        ) : booking.lead_id ? (
                          <Link
                            href={`/admin/leads/${booking.lead_id}`}
                            className="hover:text-rhymvex-volt"
                          >
                            {withWho}
                          </Link>
                        ) : (
                          withWho
                        )
                      ) : (
                        <span className="text-rhymvex-white/35">Internal</span>
                      )}
                    </td>
                    <td data-label="Kind" className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide">
                      {humanise(booking.kind)}
                    </td>
                    <td data-label="Status">
                      <StatusPill
                        value={humanise(booking.status)}
                        tone={bookingStatusTone(booking.status)}
                      />
                    </td>
                    <td data-label="When" className="whitespace-nowrap text-rhymvex-white/60">
                      {formatDateTime(booking.scheduled_for)}
                    </td>
                    {showCountdown ? (
                      <td data-label="In" className="rv-table-num whitespace-nowrap text-right text-rhymvex-volt">
                        {untilTime(booking.scheduled_for)}
                      </td>
                    ) : null}
                    <td data-label="Host" className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide">
                      {booking.host_name ?? (
                        <span className="text-rhymvex-ember">Unassigned</span>
                      )}
                    </td>
                    <td data-label="Where" className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide">
                      {booking.location ?? (
                        <span className="text-rhymvex-ember">Not set</span>
                      )}
                    </td>
                    <td data-label="Min" className="rv-table-num text-right text-rhymvex-white/50">
                      {booking.duration_mins}
                    </td>
                    <td data-label="" className="text-right">
                      <button
                        type="button"
                        onClick={() => onOpen(booking.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rhymvex-volt hover:underline"
                      >
                        <CalendarDays className="size-3" aria-hidden="true" />
                        Open
                      </button>
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