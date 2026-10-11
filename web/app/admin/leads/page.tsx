import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listLeads, LEAD_STATUSES, type LeadStatus } from "@/lib/data/leads";
import { formatDateTime, formatMoney, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill, leadStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; assigned?: string }>;
}) {
  await requireStaffPermission("leads.read");
  const params = await searchParams;
  const settings = await getOrgSettings();

  // Only statuses that actually exist are accepted, so a hand-edited query
  // string cannot widen the result set into an unexpected shape.
  const status = LEAD_STATUSES.includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : undefined;
  const search = (params.q ?? "").slice(0, 100);
  const assigned = (params.assigned ?? "").slice(0, 40);

  const leads = await listLeads({
    status: status ? [status] : undefined,
    search: search || undefined,
    assignedTo: assigned || undefined,
    limit: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Leads</h1>
          <p className="rv-page-sub">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
            {status ? ` · ${humanise(status)}` : ""}
            {search ? ` · matching “${search}”` : ""}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-rhymvex-white/50"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Name, company, email"
              aria-label="Search leads"
              className="rv-input w-56 pl-8"
            />
          </div>
          <button type="submit" className="rv-btn rv-btn-ghost rv-btn-sm">
            Search
          </button>
        </form>
      </header>

      {/* Status filters as links, so a filtered view is shareable. */}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        <FilterChip href="/admin/leads" label="All" active={!status && !assigned} />
        {LEAD_STATUSES.map((value) => (
          <FilterChip
            key={value}
            href={`/admin/leads?status=${value}`}
            label={humanise(value)}
            active={status === value}
          />
        ))}
      </nav>

      <Panel flush>
        {leads.length === 0 ? (
          <EmptyState>
            No leads match. New submissions from the website appear here the moment they arrive.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Leads</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="rv-col-wide">Company</th>
                  <th scope="col" className="rv-col-wide">Situation</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="rv-col-wide">Assigned</th>
                  <th scope="col" className="text-right">Value</th>
                  <th scope="col" className="rv-col-wide">Received</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td data-label="Name">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-medium text-rhymvex-white hover:text-rhymvex-volt"
                      >
                        {lead.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-rhymvex-white/50">
                        {lead.reference}
                      </p>
                    </td>
                    <td data-label="Company" className="whitespace-nowrap text-rhymvex-white/60 rv-col-wide">
                      {lead.company ?? "—"}
                    </td>
                    <td data-label="Situation" className="max-w-xs truncate text-rhymvex-white/60 rv-col-wide">
                      {lead.situation}
                    </td>
                    <td data-label="Status">
                      <StatusPill value={humanise(lead.status)} tone={leadStatusTone(lead.status)} />
                    </td>
                    <td data-label="Assigned" className="whitespace-nowrap text-rhymvex-white/60 rv-col-wide">
                      {lead.assigned_name ?? (
                        <span className="text-rhymvex-volt">Unassigned</span>
                      )}
                    </td>
                    <td data-label="Value" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/70">
                      {lead.estimated_value
                        ? formatMoney(lead.estimated_value, settings.currency)
                        : "—"}
                    </td>
                    <td data-label="Received"
                      className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide"
                      title={formatDateTime(lead.submitted_at)}
                    >
                      {relativeTime(lead.submitted_at)}
                    </td>
                    <td data-label="" className="text-right">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rhymvex-volt hover:underline"
                      >
                        Open
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-rhymvex-volt/50 bg-rhymvex-volt/10 text-rhymvex-volt"
          : "border-rhymvex-white/10 text-rhymvex-white/55 hover:border-rhymvex-white/25 hover:text-rhymvex-white/75"
      }`}
    >
      {label}
    </Link>
  );
}
