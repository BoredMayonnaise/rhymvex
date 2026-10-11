import { requireStaffPermission } from "@/lib/auth/guards";
import { getOverview, listClients } from "@/lib/data/workspace";
import { query } from "@/lib/db/client";
import { formatMoney, humanise, leadTotal, preferCurrencyTotals, type CurrencyTotal } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, leadStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

/**
 * Reports.
 *
 * Two questions this page exists to answer: where does work come from, and does
 * it convert. Everything here is derived from the same lead and invoice records
 * the workspace uses, so a number can always be traced back to the rows behind
 * it.
 */
export default async function ReportsPage() {
  const session = await requireStaffPermission("reports.read");
  const [overview, clients, settings, funnel, sources, monthly] = await Promise.all([
    getOverview(session.staffId),
    listClients(),
    getOrgSettings(),
    getFunnel(),
    getSources(),
    getMonthly(),
  ]);

  const totalLeads = funnel.reduce((sum, r) => sum + r.count, 0);
  // "Won" is now one row per currency, so the count is the sum of them and the
  // value is reported per currency rather than added together.
  const wonRows = funnel.filter((r) => r.status === "WON");
  const lostRows = funnel.filter((r) => r.status === "LOST");
  const wonCount = wonRows.reduce((sum, r) => sum + r.count, 0);
  const lostCount = lostRows.reduce((sum, r) => sum + r.count, 0);
  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;
  const lostRate = totalLeads > 0 ? Math.round((lostCount / totalLeads) * 100) : 0;

  const wonTotals: CurrencyTotal[] = wonRows.map((r) => ({
    currency: r.currency,
    total: r.value,
    count: r.count,
  }));
  const wonValue = leadTotal(wonTotals, settings.currency);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Reports</h1>
          <p className="rv-page-sub">Derived from the same records the workspace runs on</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads recorded" value={String(totalLeads)} meta="all time" />
        <Stat
          label="Conversion"
          value={`${conversionRate}%`}
          meta={`${wonCount} won · ${lostRate}% lost`}
        />
        <Stat
          label="Won value"
          value={wonValue.primary ? formatMoney(wonValue.primary.total, wonValue.primary.currency) : "—"}
          meta={
            wonValue.others.length > 0
              ? `plus ${wonValue.others.map((o) => o.currency).join(", ")} from converted leads`
              : "from converted leads"
          }
        />
        <Stat
          label="Clients"
          value={String(clients.length)}
          meta={`${clients.filter((c) => c.status === "ACTIVE").length} active`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Lead funnel" flush>
          {totalLeads === 0 ? (
            <EmptyState>No leads recorded yet.</EmptyState>
          ) : (
            <div className="px-4 py-2">
              {funnel.map((row) => {
                const width = totalLeads > 0 ? (row.count / totalLeads) * 100 : 0;
                return (
                  <div key={`${row.status}-${row.currency}`} className="rv-meter-row">
                    <span className="truncate text-rhymvex-white/60">
                      {humanise(row.status)}
                      {row.currency !== settings.currency ? (
                        <span className="ml-1 font-mono text-[10px] text-rhymvex-white/35">{row.currency}</span>
                      ) : null}
                    </span>
                    <span className="rv-meter-track">
                      <span className="rv-meter-fill" style={{ width: `${Math.max(2, width)}%` }} />
                    </span>
                    <span className="rv-table-num text-right text-rhymvex-white/50">{row.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Where leads come from" flush>
          {sources.length === 0 ? (
            <EmptyState>Nothing recorded yet.</EmptyState>
          ) : (
            <table className="rv-table">
              <caption className="sr-only">Lead sources</caption>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className="text-right">Leads</th>
                  <th scope="col" className="text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.source}>
                    <td data-label="Source" className="text-rhymvex-white/70">{row.source}</td>
                    <td data-label="Leads" className="rv-table-num text-right text-rhymvex-white/70">{row.count}</td>
                    <td data-label="Won" className="rv-table-num text-right text-rhymvex-white/50">
                      {row.won_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Leads and revenue by month" flush>
        {monthly.length === 0 ? (
          <EmptyState>Not enough history yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Monthly volume</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="text-right">Leads in</th>
                  <th scope="col" className="text-right">Won</th>
                  <th scope="col" className="text-right">Collected</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.month}>
                    <td data-label="Month" className="whitespace-nowrap text-rhymvex-white/70">{row.month}</td>
                    <td data-label="Leads in" className="rv-table-num text-right text-rhymvex-white/70">{row.leads_in}</td>
                    <td data-label="Won" className="rv-table-num text-right text-rhymvex-white/70">{row.won}</td>
                    <td data-label="Collected" className="rv-table-num text-right text-rhymvex-white/70">
                      {row.collected.length === 0 ? (
                        "—"
                      ) : (
                        <span className="flex flex-col items-end gap-0.5">
                          {preferCurrencyTotals(row.collected, settings.currency).map((c) => (
                            <span key={c.currency}>{formatMoney(c.total, c.currency)}</span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Lead status right now" flush>
        <div className="overflow-x-auto">
          <table className="rv-table">
            <caption className="sr-only">Current lead status</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Currency</th>
                <th scope="col" className="text-right">Count</th>
                <th scope="col" className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {overview.statusMix.map((row) => (
                <tr key={`${row.status}-${row.currency}`}>
                  <td data-label="Status">
                    <StatusPill value={humanise(row.status)} tone={leadStatusTone(row.status)} />
                  </td>
                  <td data-label="Currency" className="font-mono text-[11px] text-rhymvex-white/50">
                    {row.currency}
                  </td>
                  <td data-label="Count" className="rv-table-num text-right text-rhymvex-white/70">{row.count}</td>
                  <td data-label="Value" className="rv-table-num text-right text-rhymvex-white/70">
                    {formatMoney(row.value, row.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

async function getFunnel() {
  return query<{ status: string; currency: string; count: number; value: number }>(
    `SELECT status, coalesce(currency, 'USD') AS currency, count(*)::int AS count,
            coalesce(sum(estimated_value), 0)::float AS value
       FROM leads GROUP BY status, currency ORDER BY count DESC`,
  );
}

async function getSources() {
  return query<{ source: string; count: number; won_count: number }>(
    `SELECT source, count(*)::int AS count,
            count(*) FILTER (WHERE status = 'WON')::int AS won_count
       FROM leads GROUP BY source ORDER BY count DESC`,
  );
}

async function getMonthly() {
  return query<{ month: string; leads_in: number; won: number; collected: CurrencyTotal[] }>(
    `WITH months AS (
       SELECT to_char(date_trunc('month', submitted_at), 'YYYY-MM') AS month,
              date_trunc('month', submitted_at) AS start
         FROM leads
        GROUP BY 1, 2
     )
     SELECT m.month,
            m.start,
            (SELECT count(*)::int FROM leads l
              WHERE date_trunc('month', l.submitted_at) = m.start) AS leads_in,
            (SELECT count(*)::int FROM leads l
              WHERE date_trunc('month', l.updated_at) = m.start AND l.status = 'WON') AS won,
            (SELECT coalesce(json_agg(t), '[]'::json) FROM (
                SELECT coalesce(i.currency, 'USD') AS currency,
                       sum(i.amount_paid)::float AS total,
                       0::int AS count
                  FROM invoices i
                 WHERE date_trunc('month', i.paid_at) = m.start
                 GROUP BY coalesce(i.currency, 'USD')
             ) t) AS collected
       FROM months m
      ORDER BY m.start DESC
      LIMIT 12`,
  );
}
