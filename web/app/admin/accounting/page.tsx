import { requireStaffPermission } from "@/lib/auth/guards";
import { getAccountingTotals, listInvoices } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, invoiceStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  await requireStaffPermission("accounting.read");
  const [invoices, totals, settings] = await Promise.all([
    listInvoices(),
    getAccountingTotals(),
    getOrgSettings(),
  ]);

  const currency = settings.currency;
  const collectionRate =
    totals.collected + totals.outstanding > 0
      ? Math.round((totals.collected / (totals.collected + totals.outstanding)) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Accounting</h1>
          <p className="rv-page-sub">
            {totals.invoiceCount} invoices · {totals.paidCount} settled
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Collected"
          value={formatMoney(totals.collected, currency)}
          meta={`${collectionRate}% of everything invoiced`}
        />
        <Stat
          label="Outstanding"
          value={formatMoney(totals.outstanding, currency)}
          meta="sent or viewed, not yet paid"
        />
        <Stat
          label="Overdue"
          value={formatMoney(totals.overdue, currency)}
          meta={totals.overdue > 0 ? "needs chasing" : "nothing overdue"}
        />
        <Stat
          label="Draft"
          value={formatMoney(totals.draft, currency)}
          meta="not yet issued"
        />
      </div>

      <Panel title="Invoices" flush>
        {invoices.length === 0 ? (
          <EmptyState>No invoices raised.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Invoices</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Client</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Amount</th>
                  <th scope="col" className="text-right">Paid</th>
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
                    <td className="whitespace-nowrap text-rhymvex-white/65">{invoice.client_name}</td>
                    <td className="max-w-xs truncate text-rhymvex-white/60">
                      {invoice.description}
                    </td>
                    <td>
                      <StatusPill
                        value={humanise(invoice.status)}
                        tone={invoiceStatusTone(invoice.status)}
                      />
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {formatMoney(invoice.amount, invoice.currency || currency)}
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/55">
                      {formatMoney(invoice.amount_paid, invoice.currency || currency)}
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/70">
                      {formatMoney(
                        Math.max(0, invoice.amount - invoice.amount_paid),
                        invoice.currency || currency,
                      )}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/45">
                      {formatDate(invoice.issued_at)}
                    </td>
                    <td
                      className={`whitespace-nowrap ${
                        invoice.status === "OVERDUE" ? "text-rhymvex-ember" : "text-rhymvex-white/45"
                      }`}
                    >
                      {formatDate(invoice.due_at)}
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
