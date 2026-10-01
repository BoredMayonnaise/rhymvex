import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listContracts } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, contractStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  await requireStaffPermission("contracts.read");
  const [contracts, settings] = await Promise.all([listContracts(), getOrgSettings()]);

  const awaiting = contracts.filter((c) =>
    ["SENT", "AWAITING_SIGNATURE"].includes(c.status),
  );
  const signed = contracts.filter((c) => ["SIGNED", "ACTIVE", "COMPLETED"].includes(c.status));
  const signedValue = signed.reduce((sum, c) => sum + (c.value_total ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Contracts</h1>
          <p className="rv-page-sub">
            {awaiting.length} awaiting signature · {formatMoney(signedValue, settings.currency)}{" "}
            signed
          </p>
        </div>
      </header>

      <Panel flush>
        {contracts.length === 0 ? (
          <EmptyState>
            No contracts yet. A contract follows an accepted proposal.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Contracts</caption>
              <thead>
                <tr>
                  <th scope="col">Contract</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Value</th>
                  <th scope="col">Signed</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <p className="font-medium text-rhymvex-white">{contract.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-rhymvex-white/30">
                        {contract.reference}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/60">{contract.client_name}</td>
                    <td>
                      <StatusPill
                        value={humanise(contract.status)}
                        tone={contractStatusTone(contract.status)}
                      />
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {contract.value_total
                        ? formatMoney(contract.value_total, contract.currency || settings.currency)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/50">
                      {formatDate(contract.signed_at)}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/45">
                      {formatDate(contract.created_at)}
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
