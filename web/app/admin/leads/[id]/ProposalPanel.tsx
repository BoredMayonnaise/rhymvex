import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState, StatusPill, proposalStatusTone } from "@/components/ui/primitives";
import { formatDate, formatMoney, humanise, relativeTime } from "@/lib/format";
import type { LeadProposal } from "@/lib/data/lead-detail";

/** Proposals written against this lead. */
export function ProposalPanel({
  proposals,
  currency,
}: {
  proposals: LeadProposal[];
  currency: string;
}) {
  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Proposals</h2>
        <Link href="/admin/proposals" className="text-[11px] font-semibold text-rhymvex-volt hover:underline">
          All proposals
        </Link>
      </header>
      <div className="rv-panel-body">
        {proposals.length === 0 ? (
          <EmptyState>No proposal written for this lead yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="rounded-lg border border-rhymvex-white/8 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/proposals/${proposal.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-rhymvex-white hover:text-rhymvex-volt"
                    >
                      <FileText className="size-3.5 shrink-0 text-rhymvex-white/35" aria-hidden="true" />
                      {proposal.title}
                    </Link>
                    <p className="mt-1 font-mono text-[10px] text-rhymvex-white/30">
                      {proposal.reference}
                      {proposal.model ? ` · ${humanise(proposal.model)}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-rhymvex-white/35">
                      {proposal.sent_at
                        ? `Sent ${formatDate(proposal.sent_at)}`
                        : `Drafted ${relativeTime(proposal.created_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill
                      value={humanise(proposal.status)}
                      tone={proposalStatusTone(proposal.status)}
                    />
                    {proposal.investment ? (
                      <span className="rv-table-num text-[11px] text-rhymvex-white/60">
                        {formatMoney(proposal.investment, proposal.currency || currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
