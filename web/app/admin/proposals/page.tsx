import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listContracts, listProposals } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise, relativeTime } from "@/lib/format";
import {
  EmptyState,
  Panel,
  Stat,
  StatusPill,
  proposalStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  await requireStaffPermission("proposals.read");
  const [proposals, settings, contracts] = await Promise.all([
    listProposals(),
    getOrgSettings(),
    listContracts(),
  ]);

  const live = proposals.filter((p) => ["SENT", "VIEWED"].includes(p.status));
  const liveValue = live.reduce((sum, p) => sum + (p.investment ?? 0), 0);
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  // An accepted proposal with no contract behind it is the gap that costs money,
  // so it is surfaced here as well as on the contracts page.
  const contractedProposalIds = new Set(contracts.map((c) => c.proposal_id).filter(Boolean));
  const needsPaperwork = accepted.filter((p) => !contractedProposalIds.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Proposals</h1>
          <p className="rv-page-sub">
            {live.length} awaiting a decision · {formatMoney(liveValue, settings.currency)} in play ·{" "}
            {accepted.length} accepted
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Awaiting decision"
          value={String(live.length)}
          meta={live.length > 0 ? "with the client" : "nothing outstanding"}
        />
        <Stat
          label="In play"
          value={formatMoney(liveValue, settings.currency)}
          meta="across live proposals"
        />
        <Stat
          label="Accepted"
          value={String(accepted.length)}
          meta={
            needsPaperwork.length > 0
              ? `${needsPaperwork.length} need a contract`
              : "all papered"
          }
        />
        <Stat
          label="Contracts"
          value={String(contracts.length)}
          meta="drafted or signed"
        />
      </div>

      {needsPaperwork.length > 0 ? (
        <Panel title="Accepted, no contract yet" flush>
          <ul>
            {needsPaperwork.map((proposal) => (
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
                    {proposal.client_name ?? proposal.lead_name} ·{" "}
                    <span className="font-mono">{proposal.reference}</span>
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
        {proposals.length === 0 ? (
          <EmptyState>
            No proposals yet. Create one from a lead, or once a client relationship exists.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Proposals</caption>
              <thead>
                <tr>
                  <th scope="col">Proposal</th>
                  <th scope="col">For</th>
                  <th scope="col" className="rv-col-wide">Model</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Investment</th>
                  <th scope="col" className="rv-col-wide">Sent</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td data-label="Proposal">
                      <Link
                        href={`/admin/proposals/${proposal.id}`}
                        className="font-medium text-rhymvex-white hover:text-rhymvex-volt"
                      >
                        {proposal.title}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-rhymvex-white/50">
                        {proposal.reference}
                      </p>
                    </td>
                    <td data-label="For" className="whitespace-nowrap text-rhymvex-white/60">
                      {proposal.client_name ?? proposal.lead_name ?? "—"}
                    </td>
                    <td data-label="Model" className="whitespace-nowrap text-rhymvex-white/50 rv-col-wide">
                      {proposal.model ? humanise(proposal.model) : "—"}
                    </td>
                    <td data-label="Status">
                      <StatusPill
                        value={humanise(proposal.status)}
                        tone={proposalStatusTone(proposal.status)}
                      />
                      {proposal.status === "ACCEPTED" && !contractedProposalIds.has(proposal.id) ? (
                        <span className="mt-1 block text-[10px] text-rhymvex-ember">
                          no contract yet
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Investment" className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {proposal.investment
                        ? formatMoney(proposal.investment, proposal.currency || settings.currency)
                        : "—"}
                    </td>
                    <td data-label="Sent" className="whitespace-nowrap text-rhymvex-white/55 rv-col-wide">
                      {proposal.sent_at ? formatDate(proposal.sent_at) : relativeTime(proposal.created_at)}
                    </td>
                    <td data-label="" className="text-right">
                      <Link
                        href={`/admin/proposals/${proposal.id}`}
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
