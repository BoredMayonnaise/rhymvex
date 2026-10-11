import { requireStaffPermission } from "@/lib/auth/guards";
import { getAccountingTotals, listInvoices } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise, leadTotal } from "@/lib/format";
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

  // Each headline is led with the preferred currency and names anything else,
  // because a collected figure taken across two currencies is not a number.
  const collected = leadTotal(totals.collected, currency);
  const outstanding = leadTotal(totals.outstanding, currency);
  const overdue = leadTotal(totals.overdue, currency);
  const draft = leadTotal(totals.draft, currency);

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
          value={collected.primary ? formatMoney(collected.primary.total, collected.primary.currency) : "—"}
          meta={collected.others.length > 0 ? `plus ${collected.others.map((o) => o.currency).join(", ")}` : "settled invoices"}
        />
        <Stat
          label="Outstanding"
          value={outstanding.primary ? formatMoney(outstanding.primary.total, outstanding.primary.currency) : "—"}
          meta={outstanding.others.length > 0 ? `plus ${outstanding.others.map((o) => o.currency).join(", ")}` : "sent or viewed, not yet paid"}
        />
        <Stat
          label="Overdue"
          value={overdue.primary ? formatMoney(overdue.primary.total, overdue.primary.currency) : "—"}
          meta={overdue.others.length > 0 ? `plus ${overdue.others.map((o) => o.currency).join(", ")}` : overdue.primary && overdue.primary.total > 0 ? "needs chasing" : "nothing overdue"}
        />
        <Stat
          label="Draft"
          value={draft.primary ? formatMoney(draft.primary.total, draft.primary.currency) : "—"}
          meta={draft.others.length > 0 ? `plus ${draft.others.map((o) => o.currency).join(", ")}` : "not yet issued"}
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
                    <td data-label="Reference" className="whitespace-nowrap font-mono text-[11px] text-rhymvex-white/50">
                      {invoice.reference}
                    </td>
                    <td data-label="Client" className="whitespace-nowrap text-rhymvex-white/65">{invoice.client_name}</td>
                    <td data-label="Description" className="max-w-xs truncate text-rhymvex-white/60">
                      {invoice.description}
                    </td>
                    <td data-label="Status">
                      <StatusPill
                        value={humanise(invoice.status)}
                        tone={invoiceStatusTone(invoice.status)}
                      />
                    </td>
                    <td data-label="Amount" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {formatMoney(invoice.amount, invoice.currency || currency)}
                    </td>
                    <td data-label="Paid" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/55">
                      {formatMoney(invoice.amount_paid, invoice.currency || currency)}
                    </td>
                    <td data-label="Balance" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/70">
                      {formatMoney(
                        Math.max(0, invoice.amount - invoice.amount_paid),
                        invoice.currency || currency,
                      )}
                    </td>
                    <td data-label="Issued" className="whitespace-nowrap text-rhymvex-white/55">
                      {formatDate(invoice.issued_at)}
                    </td>
                    <td data-label="Due"
                      className={`whitespace-nowrap ${
                        invoice.status === "OVERDUE" ? "text-rhymvex-ember" : "text-rhymvex-white/55"
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
