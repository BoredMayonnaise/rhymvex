import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listProposals } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill, proposalStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  await requireStaffPermission("proposals.read");
  const [proposals, settings] = await Promise.all([listProposals(), getOrgSettings()]);

  const live = proposals.filter((p) => ["SENT", "VIEWED"].includes(p.status));
  const liveValue = live.reduce((sum, p) => sum + (p.investment ?? 0), 0);
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");

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
                  <th scope="col">Model</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Investment</th>
                  <th scope="col">Sent</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td>
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
                    <td className="whitespace-nowrap text-rhymvex-white/60">
                      {proposal.client_name ?? proposal.lead_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/50">
                      {proposal.model ? humanise(proposal.model) : "—"}
                    </td>
                    <td>
                      <StatusPill
                        value={humanise(proposal.status)}
                        tone={proposalStatusTone(proposal.status)}
                      />
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/75">
                      {proposal.investment
                        ? formatMoney(proposal.investment, proposal.currency || settings.currency)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/55">
                      {proposal.sent_at ? formatDate(proposal.sent_at) : relativeTime(proposal.created_at)}
                    </td>
                    <td className="text-right">
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
