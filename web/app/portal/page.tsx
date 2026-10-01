import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, CreditCard, FileSignature, FileText } from "lucide-react";
import { requireClientSession } from "@/lib/auth/guards";
import { getPortalOverview, listProjectMilestones } from "@/lib/data/portal";
import { formatDate, formatDateTime, formatMoney, humanise, relativeTime, untilTime } from "@/lib/format";
import { Dots, EmptyState, Panel, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

/**
 * Client overview.
 *
 * Answers one question: what is happening with my work? Everything on this
 * screen is either the current state of an engagement, the next thing that
 * happens, or a thing waiting on the client. Nothing about how the studio is
 * run internally appears here.
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

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <p className="rv-eyebrow">Welcome</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-rhymvex-white sm:text-3xl">
            {firstName}
          </h1>
          <p className="rv-page-sub">{session.clientName}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Current engagement. The single most important thing on the page. */}
          {primary ? (
            <Panel title="Current engagement">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-rhymvex-white">
                      {primary.name}
                    </h2>
                    {primary.summary ? (
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-rhymvex-white/55">
                        {primary.summary}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill
                    value={humanise(primary.status)}
                    tone={projectStatusTone(primary.status)}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-rhymvex-white/45">
                      {primary.phase ?? humanise(primary.status)}
                    </span>
                    <span className="rv-table-num text-rhymvex-volt">{primary.progress}%</span>
                  </div>
                  <Track percent={primary.progress} label={`${primary.name} progress`} />
                  {milestones.length > 0 ? (
                    <div className="mt-3 flex items-center gap-3">
                      <Dots
                        total={milestones.length}
                        filled={milestones.filter((m) => m.completed_at).length}
                        label={`${milestones.filter((m) => m.completed_at).length} of ${milestones.length} stages complete`}
                      />
                      <span className="text-[11px] text-rhymvex-white/35">
                        {milestones.filter((m) => m.completed_at).length} of {milestones.length}{" "}
                        stages complete
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Next step. Stated plainly, with a date when there is one. */}
                {primary.next_step ? (
                  <div className="rounded-lg border border-rhymvex-volt/25 bg-rhymvex-volt/[0.05] p-4">
                    <p className="rv-panel-title mb-1.5">Next step</p>
                    <p className="m-0 text-sm font-medium text-rhymvex-white">{primary.next_step}</p>
                    {primary.next_step_due ? (
                      <p className="mt-1 text-xs text-rhymvex-white/45">
                        {formatDate(primary.next_step_due)}
                        {primary.next_step_due && new Date(primary.next_step_due).getTime() > Date.now()
                          ? ` · ${untilTime(primary.next_step_due)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <Link
                    href={`/portal/projects/${primary.id}`}
                    className="rv-btn rv-btn-primary rv-btn-sm"
                  >
                    View project
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
          {overview.openProposals > 0 || overview.unsignedContracts > 0 || overview.unpaidInvoices > 0 ? (
            <Panel title="Waiting on you">
              <ul className="flex flex-col gap-2.5">
                {overview.openProposals > 0 ? (
                  <ActionRow
                    href="/portal/proposals"
                    icon={FileText}
                    title={`${overview.openProposals} proposal${overview.openProposals === 1 ? "" : "s"} to review`}
                    detail="Have a read and let us know what you think."
                  />
                ) : null}
                {overview.unsignedContracts > 0 ? (
                  <ActionRow
                    href="/portal/contracts"
                    icon={FileSignature}
                    title={`${overview.unsignedContracts} contract${overview.unsignedContracts === 1 ? "" : "s"} to sign`}
                    detail="Signature is all that's outstanding."
                  />
                ) : null}
                {overview.unpaidInvoices > 0 ? (
                  <ActionRow
                    href="/portal/invoices"
                    icon={CreditCard}
                    title={`${formatMoney(overview.outstanding, settings.currency)} outstanding`}
                    detail={`${overview.unpaidInvoices} invoice${overview.unpaidInvoices === 1 ? "" : "s"} unpaid.`}
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
                          <span className="block text-[11px] text-rhymvex-white/35">
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
                <p className="text-sm text-rhymvex-volt">
                  {formatDateTime(overview.nextBooking.scheduled_for)}
                </p>
                <p className="text-[11px] text-rhymvex-white/40">
                  {overview.nextBooking.duration_mins} min
                  {overview.nextBooking.host_name ? ` · with ${overview.nextBooking.host_name}` : ""}
                  {overview.nextBooking.location ? ` · ${overview.nextBooking.location}` : ""}
                </p>
                <Link
                  href="/portal/bookings"
                  className="rv-btn rv-btn-ghost rv-btn-sm self-start"
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
                    <span className="mt-0.5 shrink-0 text-rhymvex-white/30">
                      <ActivityIcon kind={item.kind} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-rhymvex-white">{item.title}</p>
                      {item.detail ? (
                        <p className="truncate text-[11px] text-rhymvex-white/40">{item.detail}</p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-rhymvex-white/25">
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
                Nothing outstanding on your account.
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
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg border border-rhymvex-white/8 px-3.5 py-3 transition-colors hover:border-rhymvex-volt/35"
      >
        <Icon className="size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-rhymvex-white">{title}</span>
          <span className="block text-[11px] text-rhymvex-white/40">{detail}</span>
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-rhymvex-white/25" aria-hidden="true" />
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
