import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import {
  listAcceptedProposalsWithoutContract,
  listContracts,
} from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import {
  EmptyState,
  Panel,
  Stat,
  StatusPill,
  contractStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

/**
 * Contracts.
 *
 * A contract follows an accepted proposal, and the way to start one is on that
 * proposal rather than here: the commercial terms have to come from something
 * the client already agreed to, not from someone retyping a number here.
 */
export default async function ContractsPage() {
  await requireStaffPermission("contracts.read");
  const [contracts, settings, acceptedProposals] = await Promise.all([
    listContracts(),
    getOrgSettings(),
    listAcceptedProposalsWithoutContract(),
  ]);

  const awaiting = contracts.filter((c) =>
    ["SENT", "AWAITING_SIGNATURE"].includes(c.status),
  );
  const signed = contracts.filter((c) => ["SIGNED", "ACTIVE", "COMPLETED"].includes(c.status));
  const signedValue = signed.reduce((sum, c) => sum + (c.value_total ?? 0), 0);
  const drafts = contracts.filter((c) => c.status === "DRAFT").length;

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

      {/* Where the pipeline actually stands, and what is still being written. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Awaiting signature"
          value={String(awaiting.length)}
          meta={
            acceptedProposals.length > 0
              ? `${acceptedProposals.length} proposal(s) still to paper`
              : awaiting.length > 0
                ? "with the client"
                : "nothing outstanding"
          }
        />
        <Stat
          label="Drafts"
          value={String(drafts)}
          meta={drafts > 0 ? "not sent yet" : "all sent"}
        />
        <Stat
          label="Signed"
          value={String(signed.length)}
          meta="agreed and on file"
        />
        <Stat
          label="Signed value"
          value={formatMoney(signedValue, settings.currency)}
          meta="across signed contracts"
        />
      </div>

      {/* A client said yes and there is no paperwork behind it. That is the one
          gap on this page worth surfacing above the list itself. */}
      {acceptedProposals.length > 0 ? (
        <Panel title="Accepted, no contract yet" flush>
          <ul>
            {acceptedProposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/proposals/${proposal.id}`}
                    className="text-xs font-medium text-rhymvex-white hover:text-rhymvex-volt"
                  >
                    {proposal.title}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-rhymvex-white/50">
                    {proposal.client_name} ·{" "}
                    <span className="font-mono">{proposal.reference}</span>
                    {proposal.investment
                      ? ` · ${formatMoney(proposal.investment, proposal.currency || settings.currency)}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/proposals/${proposal.id}`}
                  className="rv-btn rv-btn-primary rv-btn-sm shrink-0"
                >
                  Draft contract
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel flush>
        {contracts.length === 0 ? (
          <EmptyState>
            {acceptedProposals.length > 0
              ? "Nothing drafted yet. Start with the accepted proposal above."
              : "No contracts yet. Accept a proposal, then draft the contract from it."}
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
                  <th scope="col" className="rv-col-wide">Sent</th>
                  <th scope="col">Signed</th>
                  <th scope="col" className="rv-col-wide">Created</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td data-label="Contract">
                      <Link
                        href={`/admin/contracts/${contract.id}`}
                        className="font-medium text-rhymvex-white hover:text-rhymvex-volt"
                      >
                        {contract.title}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-rhymvex-white/50">
                        {contract.reference}
                      </p>
                    </td>
                    <td data-label="Client" className="whitespace-nowrap text-rhymvex-white/60">
                      <Link
                        href={`/admin/clients/${contract.client_id}`}
                        className="hover:text-rhymvex-volt"
                      >
                        {contract.client_name}
                      </Link>
                    </td>
                    <td data-label="Status">
                      <StatusPill
                        value={humanise(contract.status)}
                        tone={contractStatusTone(contract.status)}
                      />
                      {/* A draft has no agreement text yet, and sending one would
                          be sending an empty promise. */}
                      {contract.status === "DRAFT" ? (
                        <span className="mt-1 block text-[10px] text-rhymvex-white/45">
                          check the agreement text before sending
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Value" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {contract.value_total
                        ? formatMoney(contract.value_total, contract.currency || settings.currency)
                        : "—"}
                    </td>
                    <td data-label="Sent" className="whitespace-nowrap text-rhymvex-white/50 rv-col-wide">
                      {contract.sent_at ? formatDate(contract.sent_at) : "not sent"}
                    </td>
                    <td data-label="Signed" className="whitespace-nowrap text-rhymvex-white/50">
                      {contract.signed_at
                        ? `${contract.signed_by_name ?? "Signed"} · ${formatDate(contract.signed_at)}`
                        : "not signed"}
                    </td>
                    <td data-label="Created" className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide">
                      {formatDate(contract.created_at)}
                    </td>
                    <td data-label="" className="text-right">
                      <Link
                        href={`/admin/contracts/${contract.id}`}
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
