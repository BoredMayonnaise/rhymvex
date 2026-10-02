import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  Inbox,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { getOverview } from "@/lib/data/workspace";
import { describeAuditAction } from "@/lib/audit";
import { formatDateTime, formatMoney, humanise, relativeTime, untilTime } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, bookingStatusTone, leadStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await requireStaffPermission("leads.read");
  const [overview, settings] = await Promise.all([getOverview(session.staffId), getOrgSettings()]);

  const pipelineMax = Math.max(1, ...overview.statusMix.map((r) => r.value));

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Overview</h1>
          <p className="rv-page-sub">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date())}
          </p>
        </div>
        <Link href="/admin/leads" className="rv-btn rv-btn-ghost rv-btn-sm">
          <Inbox className="size-3.5" aria-hidden="true" />
          All leads
        </Link>
      </header>

      {/* Key numbers. Deliberately six: one screen, no scrolling to compare. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Pipeline value"
          value={formatMoney(overview.pipelineValue, settings.currency)}
          meta={`${overview.openLeadCount} open leads`}
          href="/admin/leads"
        />
        <Stat
          label="Open leads"
          value={String(overview.openLeadCount)}
          meta={
            overview.newLeadCount > 0
              ? `${overview.newLeadCount} new, unassigned`
              : "nothing waiting"
          }
          href="/admin/leads"
        />
        <Stat
          label="Active projects"
          value={String(overview.activeProjectCount)}
          meta={`${overview.deliveryPulse.inReview} in review`}
          href="/admin/projects"
        />
        <Stat
          label="Collected"
          value={formatMoney(overview.collectedRevenue, settings.currency)}
          meta={`${formatMoney(overview.outstandingRevenue, settings.currency)} outstanding`}
          href="/admin/accounting"
        />
        <Stat
          label="Won this quarter"
          value={formatMoney(overview.wonThisQuarter, settings.currency)}
          meta="from converted leads"
        />
        <Stat
          label="Delivery"
          value={`${overview.deliveryPulse.active}`}
          meta={`${overview.deliveryPulse.blocked} on hold · ${overview.deliveryPulse.deliveredThisMonth} delivered this month`}
          href="/admin/projects"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* NEW LEADS gets its own panel and the top of the first column,
            because the first job of this page is deciding what to pick up. */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {overview.newLeads.length > 0 ? (
            <Panel
              title="New leads"
              action={
                <Link
                  href="/admin/leads?status=RECEIVED"
                  className="text-[11px] font-semibold text-rhymvex-volt hover:underline"
                >
                  Review all
                </Link>
              }
              flush
            >
              <ul>
                {overview.newLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="border-b border-rhymvex-white/5 px-4 py-3.5 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rv-eyebrow">New lead</span>
                          <span className="text-[11px] text-rhymvex-white/50">
                            {relativeTime(lead.submitted_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-rhymvex-white">
                          {lead.name}
                        </p>
                        <p className="text-xs text-rhymvex-white/55">
                          {lead.company ?? "No company given"}
                        </p>
                        <p className="mt-1.5 text-xs text-rhymvex-white/55">{lead.situation}</p>
                      </div>
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="rv-btn rv-btn-primary rv-btn-sm shrink-0"
                      >
                        Review lead
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Pipeline mix" flush>
              <div className="px-4 py-2">
                {overview.statusMix.length === 0 ? (
                  <EmptyState>No open leads.</EmptyState>
                ) : (
                  overview.statusMix.map((row) => (
                    <div key={row.status} className="rv-meter-row">
                      <span className="truncate text-rhymvex-white/60">{humanise(row.status)}</span>
                      <span className="rv-meter-track">
                        <span
                          className="rv-meter-fill"
                          style={{ width: `${Math.max(3, (row.value / pipelineMax) * 100)}%` }}
                        />
                      </span>
                      <span className="rv-table-num text-right text-rhymvex-white/50">
                        {row.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Delivery pulse" flush>
              <div className="divide-y divide-rhymvex-white/5">
                <PulseRow
                  label="In progress"
                  value={overview.deliveryPulse.active}
                  tone="active"
                />
                <PulseRow label="In review" value={overview.deliveryPulse.inReview} tone="active" />
                <PulseRow label="On hold" value={overview.deliveryPulse.blocked} tone="warn" />
                <PulseRow
                  label="Delivered this month"
                  value={overview.deliveryPulse.deliveredThisMonth}
                  tone="done"
                />
              </div>
              {overview.deliveryPulse.byOwner.length > 0 ? (
                <div className="border-t border-rhymvex-white/5 px-4 py-2.5">
                  <p className="rv-panel-title mb-1.5">Load</p>
                  {overview.deliveryPulse.byOwner.map((owner) => (
                    <div key={owner.name} className="rv-meter-row">
                      <span className="truncate text-rhymvex-white/60">{owner.name}</span>
                      <span className="rv-meter-track">
                        <span
                          className="rv-meter-fill"
                          style={{ width: `${Math.min(100, owner.active * 22)}%` }}
                        />
                      </span>
                      <span className="rv-table-num text-right text-rhymvex-white/50">
                        {owner.active}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>

          <Panel title="Recent activity" flush>
            {overview.recentActivity.length === 0 ? (
              <EmptyState>Nothing recorded yet.</EmptyState>
            ) : (
              <ul>
                {overview.recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={`mt-1 size-1.5 shrink-0 rounded-full ${
                        item.actor_type === "staff"
                          ? "bg-rhymvex-volt"
                          : "bg-rhymvex-white/25"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-rhymvex-white/75">
                        <span className="font-semibold text-rhymvex-white">
                          {item.actor_label ?? "System"}
                        </span>{" "}
                        {describeAuditAction(item.action).toLowerCase()}
                        {item.entity_id ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-mono text-[11px] text-rhymvex-white/50">
                              {humanise(item.entity_type)} {item.entity_id.slice(0, 8)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <time
                      dateTime={new Date(item.occurred_at).toISOString()}
                      className="shrink-0 text-[11px] text-rhymvex-white/50"
                    >
                      {relativeTime(item.occurred_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="My focus today" flush>
            {overview.myFocus.length === 0 ? (
              <EmptyState>Nothing assigned to you right now.</EmptyState>
            ) : (
              <ul>
                {overview.myFocus.map((item, i) => (
                  <li
                    key={`${item.kind}-${i}`}
                    className="border-b border-rhymvex-white/5 last:border-b-0"
                  >
                    <Link
                      href={item.href}
                      className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-rhymvex-white/3"
                    >
                      <FocusIcon kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-rhymvex-white">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-rhymvex-white/50">
                          {item.meta}
                        </span>
                      </span>
                      {item.when ? (
                        <span className="shrink-0 text-[10px] text-rhymvex-white/50">
                          {untilTime(item.when)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Upcoming bookings" flush>
            {overview.upcomingBookings.length === 0 ? (
              <EmptyState>Nothing scheduled.</EmptyState>
            ) : (
              <ul>
                {overview.upcomingBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-rhymvex-white">
                          {booking.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-rhymvex-white/50">
                          {booking.client_name ?? booking.lead_name ?? "Internal"} ·{" "}
                          {booking.duration_mins} min
                          {booking.host_name ? ` · ${booking.host_name}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-rhymvex-volt">
                          {formatDateTime(booking.scheduled_for)}
                        </p>
                      </div>
                      <StatusPill
                        value={humanise(booking.status)}
                        tone={bookingStatusTone(booking.status)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-rhymvex-white/5 px-4 py-2">
              <Link
                href="/admin/bookings"
                className="text-[11px] font-semibold text-rhymvex-volt hover:underline"
              >
                All bookings
              </Link>
            </div>
          </Panel>

          <Panel title="Reference">
            <dl className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-rhymvex-white/50">Open leads</dt>
                <dd className="rv-table-num text-rhymvex-white">{overview.openLeadCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-rhymvex-white/50">Active projects</dt>
                <dd className="rv-table-num text-rhymvex-white">{overview.activeProjectCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-rhymvex-white/50">Clients</dt>
                <dd className="rv-table-num text-rhymvex-white">
                  <Link href="/admin/clients" className="hover:text-rhymvex-volt">
                    view
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-rhymvex-white/50">Response SLA</dt>
                <dd className="text-rhymvex-white/70">
                  {settings.response_sla_minutes
                    ? `${settings.response_sla_minutes} min`
                    : "not set"}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PulseRow({ label, value, tone }: { label: string; value: number; tone: "active" | "warn" | "done" }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-rhymvex-white/60">{label}</span>
      <StatusPill
        value={String(value)}
        tone={value === 0 ? "idle" : tone}
      />
    </div>
  );
}

function FocusIcon({ kind }: { kind: string }) {
  const className = "mt-0.5 size-3.5 shrink-0 text-rhymvex-white/50";
  if (kind === "booking") return <CalendarDays className={className} aria-hidden="true" />;
  if (kind === "task") return <CheckCircle2 className={className} aria-hidden="true" />;
  if (kind === "proposal") return <Coins className={className} aria-hidden="true" />;
  return <Inbox className={className} aria-hidden="true" />;
}
