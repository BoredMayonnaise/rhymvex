import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  FolderOpen,
  MessageSquare,
} from "lucide-react";
import { requireClientSession } from "@/lib/auth/guards";
import { getPortalOverview, listProjectMilestones } from "@/lib/data/portal";
import { formatDate, formatDateTime, formatMoney, humanise, relativeTime, untilTime } from "@/lib/format";
import { Dots, EmptyState, Panel, Stat, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";

export const dynamic = "force-dynamic";

/**
 * Client overview.
 *
 * Answers one question: what is happening with my work? Everything on this
 * screen is either the current state of an engagement, the next thing that
 * happens, or a thing waiting on the client.
 */
export default async function PortalOverviewPage() {
  const session = await requireClientSession();
  const [overview, settings] = await Promise.all([
    getPortalOverview(session),
    getOrgSettings(),
  ]);

  const primary = overview.primary;
  const milestones = primary ? await listProjectMilestones(session, primary.id) : [];
  const firstName = session.name.split(" ")[0];
  const totalActionItems =
    (overview.openProposals ?? 0) +
    (overview.unsignedContracts ?? 0) +
    (overview.unpaidInvoices ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <div className="flex items-center gap-2">
            <span className="rv-eyebrow">Client Portal</span>
            <span className="text-xs text-rhymvex-white/40">·</span>
            <span className="text-xs font-medium text-rhymvex-white/60">{session.clientName}</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-rhymvex-white sm:text-3xl">
            Welcome, {firstName}
          </h1>
          <p className="rv-page-sub">
            Overview of your active deliverables, decisions, and studio touchpoints.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <PwaInstallButton />
          <Link
            href="/portal/messages"
            className="rv-btn rv-btn-ghost rv-btn-sm w-full justify-center sm:w-auto"
          >
            <MessageSquare className="size-3.5 text-rhymvex-volt" aria-hidden="true" />
            <span>Message team</span>
          </Link>
        </div>
      </header>

      {/* Quick summary stats - 2-column on phone, 4-column on desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Active Project"
          value={primary ? `${primary.progress}%` : "0"}
          meta={primary ? (primary.phase ?? humanise(primary.status)) : "No active project"}
          href={primary ? `/portal/projects/${primary.id}` : "/portal/projects"}
        />
        <Stat
          label="Action Items"
          value={String(totalActionItems)}
          meta={
            totalActionItems > 0
              ? `${totalActionItems} awaiting your review`
              : "All caught up"
          }
          href={
            overview.unsignedContracts > 0
              ? "/portal/contracts"
              : overview.openProposals > 0
              ? "/portal/proposals"
              : overview.unpaidInvoices > 0
              ? "/portal/invoices"
              : undefined
          }
        />
        <Stat
          label="Unread Messages"
          value={String(overview.unreadMessages)}
          meta={overview.unreadMessages > 0 ? "new replies waiting" : "direct thread with team"}
          href="/portal/messages"
        />
        <Stat
          label="Next Booking"
          value={
            overview.nextBooking
              ? formatDate(overview.nextBooking.scheduled_for)
              : "None"
          }
          meta={
            overview.nextBooking
              ? `${untilTime(overview.nextBooking.scheduled_for)} · ${overview.nextBooking.duration_mins}m`
              : "Schedule a session"
          }
          href="/portal/bookings"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Current engagement. The single most important thing on the page. */}
          {primary ? (
            <Panel title="Current engagement">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-rhymvex-white">
                      {primary.name}
                    </h2>
                    {primary.summary ? (
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-rhymvex-white/55">
                        {primary.summary}
                      </p>
                    ) : null}
                  </div>
                  <div className="self-start sm:self-auto">
                    <StatusPill
                      value={humanise(primary.status)}
                      tone={projectStatusTone(primary.status)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-rhymvex-white/8 bg-rhymvex-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-rhymvex-white/60">
                      Stage: <span className="font-semibold text-rhymvex-white">{primary.phase ?? humanise(primary.status)}</span>
                    </span>
                    <span className="rv-table-num font-mono text-sm font-bold text-rhymvex-volt">{primary.progress}%</span>
                  </div>
                  <Track percent={primary.progress} label={`${primary.name} progress`} />
                  {milestones.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3 pt-1">
                      <Dots
                        total={milestones.length}
                        filled={milestones.filter((m) => m.completed_at).length}
                        label={`${milestones.filter((m) => m.completed_at).length} of ${milestones.length} stages complete`}
                      />
                      <span className="text-[11px] text-rhymvex-white/50">
                        {milestones.filter((m) => m.completed_at).length} of {milestones.length}{" "}
                        stages complete
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Next step. Stated plainly, with a date when there is one. */}
                {primary.next_step ? (
                  <div className="rounded-xl border border-rhymvex-volt/25 bg-rhymvex-volt/[0.05] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="rv-panel-title">Next deliverable / step</p>
                      {primary.next_step_due ? (
                        <span className="font-mono text-[11px] font-semibold text-rhymvex-volt">
                          Due {formatDate(primary.next_step_due)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-rhymvex-white">{primary.next_step}</p>
                    {primary.next_step_due && new Date(primary.next_step_due).getTime() > Date.now() ? (
                      <p className="mt-1 text-xs text-rhymvex-white/50">
                        Target window: {untilTime(primary.next_step_due)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <Link
                    href={`/portal/projects/${primary.id}`}
                    className="rv-btn rv-btn-primary flex w-full items-center justify-center gap-2 py-2.5 sm:inline-flex sm:w-auto"
                  >
                    <span>View project & deliverables</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="Current engagement">
              <EmptyState>
                No active project yet. We&apos;ll add one here as soon as the work starts.
              </EmptyState>
            </Panel>
          )}

          {/* Only surfaced when there is genuinely something to act on. */}
          {totalActionItems > 0 ? (
            <Panel title="Waiting on you">
              <ul className="flex flex-col gap-2.5">
                {overview.unsignedContracts > 0 ? (
                  <ActionRow
                    href="/portal/contracts"
                    icon={FileSignature}
                    title={`${overview.unsignedContracts} contract${overview.unsignedContracts === 1 ? "" : "s"} to sign`}
                    detail="Signature is all that's outstanding."
                    badge="Sign required"
                  />
                ) : null}
                {overview.openProposals > 0 ? (
                  <ActionRow
                    href="/portal/proposals"
                    icon={FileText}
                    title={`${overview.openProposals} proposal${overview.openProposals === 1 ? "" : "s"} to review`}
                    detail="Have a read and let us know what you think."
                    badge="Review proposal"
                  />
                ) : null}
                {overview.unpaidInvoices > 0 ? (
                  <ActionRow
                    href="/portal/invoices"
                    icon={CreditCard}
                    title={`${formatMoney(overview.outstanding, settings.currency)} outstanding`}
                    detail={`${overview.unpaidInvoices} invoice${overview.unpaidInvoices === 1 ? "" : "s"} unpaid.`}
                    badge="Payment due"
                  />
                ) : null}
              </ul>
            </Panel>
          ) : null}

          {overview.projects.length > 1 ? (
            <Panel title="Other projects" flush>
              <ul>
                {overview.projects
                  .filter((p) => p.id !== primary?.id)
                  .map((project) => (
                    <li key={project.id} className="border-b border-rhymvex-white/5 last:border-b-0">
                      <Link
                        href={`/portal/projects/${project.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-rhymvex-white/2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-rhymvex-white">
                            {project.name}
                          </span>
                          <span className="block text-[11px] text-rhymvex-white/50">
                            {project.phase ?? humanise(project.status)}
                          </span>
                        </span>
                        <StatusPill
                          value={humanise(project.status)}
                          tone={projectStatusTone(project.status)}
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {overview.nextBooking ? (
            <Panel title="Next booking">
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-rhymvex-white">
                  <CalendarDays className="size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
                  {overview.nextBooking.title}
                </p>
                <p className="text-sm font-semibold text-rhymvex-volt">
                  {formatDateTime(overview.nextBooking.scheduled_for)}
                </p>
                <p className="text-[11px] text-rhymvex-white/50">
                  {overview.nextBooking.duration_mins} min
                  {overview.nextBooking.host_name ? ` · with ${overview.nextBooking.host_name}` : ""}
                  {overview.nextBooking.location ? ` · ${overview.nextBooking.location}` : ""}
                </p>
                <Link
                  href="/portal/bookings"
                  className="rv-btn rv-btn-ghost rv-btn-sm w-full justify-center sm:w-auto self-start"
                >
                  All bookings
                </Link>
              </div>
            </Panel>
          ) : null}

          <Panel title="Recent activity" flush>
            {overview.recentActivity.length === 0 ? (
              <EmptyState>Nothing to report yet.</EmptyState>
            ) : (
              <ul>
                {overview.recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0"
                  >
                    <span className="mt-0.5 shrink-0 text-rhymvex-white/50">
                      <ActivityIcon kind={item.kind} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-rhymvex-white">{item.title}</p>
                      {item.detail ? (
                        <p className="truncate text-[11px] text-rhymvex-white/50">{item.detail}</p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-rhymvex-white/50">
                        {relativeTime(item.occurred_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {overview.unpaidInvoices === 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-rhymvex-volt/20 bg-rhymvex-volt/[0.04] p-3.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
              <p className="m-0 text-xs leading-relaxed text-rhymvex-white/60">
                Nothing outstanding on your account. All invoices up to date.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  href,
  icon: Icon,
  title,
  detail,
  badge = "Action required",
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-xl border border-rhymvex-volt/25 bg-rhymvex-volt/[0.04] p-3.5 transition-all hover:border-rhymvex-volt/50 hover:bg-rhymvex-volt/[0.07] sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="flex items-center justify-between sm:justify-start sm:gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rhymvex-volt/10 text-rhymvex-volt">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <span className="rounded-full border border-rhymvex-volt/40 bg-rhymvex-volt/15 px-2 py-0.5 text-[10px] font-semibold text-rhymvex-volt sm:hidden">
            {badge}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="block text-xs font-semibold text-rhymvex-white group-hover:text-rhymvex-volt transition-colors">
              {title}
            </span>
            <span className="hidden rounded-full border border-rhymvex-volt/40 bg-rhymvex-volt/15 px-2 py-0.5 text-[9px] font-semibold text-rhymvex-volt sm:inline-block">
              {badge}
            </span>
          </div>
          <span className="mt-0.5 block text-[11px] text-rhymvex-white/55">{detail}</span>
        </div>
        <div className="flex items-center justify-end text-xs font-medium text-rhymvex-volt">
          <span className="sm:hidden text-[11px] me-1">Review</span>
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === "proposal") return <FileText className="size-3.5" aria-hidden="true" />;
  if (kind === "booking") return <CalendarDays className="size-3.5" aria-hidden="true" />;
  if (kind === "invoice") return <CreditCard className="size-3.5" aria-hidden="true" />;
  if (kind === "contract") return <FileSignature className="size-3.5" aria-hidden="true" />;
  return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
}
