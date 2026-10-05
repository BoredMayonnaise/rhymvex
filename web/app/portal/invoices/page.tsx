import { requireClientSession } from "@/lib/auth/guards";
import { listPortalInvoices } from "@/lib/data/portal";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, invoiceStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const session = await requireClientSession();
  const [invoices, settings] = await Promise.all([
    listPortalInvoices(session),
    getOrgSettings(),
  ]);

  const outstanding = invoices
    .filter((i) => ["SENT", "VIEWED", "OVERDUE"].includes(i.status))
    .reduce((sum, i) => sum + (i.amount - i.amount_paid), 0);
  const paid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Invoices</h1>
          <p className="rv-page-sub">
            {invoices.length === 0
              ? "Nothing to show"
              : `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`}
          </p>
        </div>
      </header>

      {invoices.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2">
          <Stat
            label="Outstanding"
            value={formatMoney(outstanding, settings.currency)}
            meta={outstanding > 0 ? "payment due" : "nothing due"}
          />
          <Stat
            label="Paid to date"
            value={formatMoney(paid, settings.currency)}
            meta="across all engagements"
          />
        </div>
      ) : null}

      <Panel flush>
        {invoices.length === 0 ? (
          <EmptyState>No invoices yet.</EmptyState>
        ) : (
          <>
            {/* Mobile Card List (< sm) */}
            <div className="divide-y divide-rhymvex-white/8 sm:hidden">
              {invoices.map((invoice) => {
                const balance = Math.max(0, invoice.amount - invoice.amount_paid);
                return (
                  <div key={invoice.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-rhymvex-white">
                          {invoice.reference}
                        </span>
                        <p className="mt-0.5 text-xs text-rhymvex-white/70 line-clamp-2">
                          {invoice.description}
                        </p>
                      </div>
                      <StatusPill
                        value={humanise(invoice.status)}
                        tone={invoiceStatusTone(invoice.status)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-rhymvex-white/[0.02] p-2.5 text-xs border border-rhymvex-white/5">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-rhymvex-white/45">
                          Amount
                        </span>
                        <span className="font-mono font-semibold text-rhymvex-white">
                          {formatMoney(invoice.amount, invoice.currency || settings.currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] uppercase tracking-wider text-rhymvex-white/45">
                          Balance Due
                        </span>
                        <span className={`font-mono font-bold ${balance > 0 ? "text-rhymvex-volt" : "text-rhymvex-white/60"}`}>
                          {formatMoney(balance, invoice.currency || settings.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-rhymvex-white/45">
                      <span>Issued {formatDate(invoice.issued_at)}</span>
                      <span>Due {formatDate(invoice.due_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="rv-table">
                <caption className="sr-only">Invoices</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Description</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">Amount</th>
                    <th scope="col" className="text-right">Balance</th>
                    <th scope="col">Issued</th>
                    <th scope="col">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="whitespace-nowrap font-mono text-[11px] text-rhymvex-white/50">
                        {invoice.reference}
                      </td>
                      <td className="max-w-xs truncate text-rhymvex-white/70">
                        {invoice.description}
                      </td>
                      <td>
                        <StatusPill
                          value={humanise(invoice.status)}
                          tone={invoiceStatusTone(invoice.status)}
                        />
                      </td>
                      <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                        {formatMoney(invoice.amount, invoice.currency || settings.currency)}
                      </td>
                      <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/70">
                        {formatMoney(
                          Math.max(0, invoice.amount - invoice.amount_paid),
                          invoice.currency || settings.currency,
                        )}
                      </td>
                      <td className="whitespace-nowrap text-rhymvex-white/55">
                        {formatDate(invoice.issued_at)}
                      </td>
                      <td className="whitespace-nowrap text-rhymvex-white/55">
                        {formatDate(invoice.due_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
