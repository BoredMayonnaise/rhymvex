import { requireClientSession } from "@/lib/auth/guards";
import { listPortalContracts } from "@/lib/data/portal";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, contractStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function PortalContractsPage() {
  const session = await requireClientSession();
  const [contracts, settings] = await Promise.all([
    listPortalContracts(session),
    getOrgSettings(),
  ]);

  const needsAction = contracts.filter((c) =>
    ["SENT", "AWAITING_SIGNATURE"].includes(c.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Contracts</h1>
          <p className="rv-page-sub">
            {needsAction.length > 0
              ? `${needsAction.length} waiting for your signature`
              : `${contracts.length} on file`}
          </p>
        </div>
      </header>

      {contracts.length === 0 ? (
        <Panel>
          <EmptyState>No contracts yet.</EmptyState>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-3">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <details className="rv-panel group">
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 select-none hover:bg-rhymvex-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start justify-between gap-2 sm:flex-1">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-rhymvex-white">
                        {contract.title}
                      </span>
                      <span className="block text-[11px] text-rhymvex-white/50">
                        {contract.reference}
                        {contract.signed_at ? ` · signed ${formatDate(contract.signed_at)}` : ""}
                      </span>
                    </span>
                    <div className="sm:hidden">
                      <StatusPill
                        value={humanise(contract.status)}
                        tone={contractStatusTone(contract.status)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-rhymvex-white/5 pt-2 sm:border-t-0 sm:pt-0 sm:justify-end sm:gap-3">
                    {contract.value_total ? (
                      <span className="rv-table-num font-mono text-xs font-semibold text-rhymvex-white/75">
                        {formatMoney(contract.value_total, contract.currency || settings.currency)}
                      </span>
                    ) : null}
                    <div className="hidden sm:block">
                      <StatusPill
                        value={humanise(contract.status)}
                        tone={contractStatusTone(contract.status)}
                      />
                    </div>
                  </div>
                </summary>
                {contract.body ? (
                  <div className="border-t border-rhymvex-white/8 px-4 py-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-rhymvex-white/65">
                      {contract.body}
                    </pre>
                  </div>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
