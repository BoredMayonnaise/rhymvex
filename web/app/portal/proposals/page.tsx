import Link from "next/link";
import { FileText } from "lucide-react";
import { requireClientSession } from "@/lib/auth/guards";
import { listPortalProposals } from "@/lib/data/portal";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, proposalStatusTone } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function PortalProposalsPage() {
  const session = await requireClientSession();
  const [proposals, settings] = await Promise.all([
    listPortalProposals(session),
    getOrgSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Proposals</h1>
          <p className="rv-page-sub">
            {proposals.length === 0
              ? "Nothing here yet"
              : `${proposals.length} ${proposals.length === 1 ? "proposal" : "proposals"}`}
          </p>
        </div>
      </header>

      {proposals.length === 0 ? (
        <Panel>
          <EmptyState>
            When we agree the shape of the work, the proposal appears here for you to read.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-3">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <details className="rv-panel">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                  <FileText className="size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-rhymvex-white">
                      {proposal.title}
                    </span>
                    <span className="block text-[11px] text-rhymvex-white/35">
                      {proposal.model ? `${humanise(proposal.model)} · ` : ""}
                      {proposal.sent_at ? `sent ${formatDate(proposal.sent_at)}` : "draft"}
                    </span>
                  </span>
                  {proposal.investment ? (
                    <span className="rv-table-num shrink-0 text-xs text-rhymvex-white/70">
                      {formatMoney(proposal.investment, proposal.currency || settings.currency)}
                    </span>
                  ) : null}
                  <StatusPill
                    value={humanise(proposal.status)}
                    tone={proposalStatusTone(proposal.status)}
                  />
                </summary>

                <div className="border-t border-rhymvex-white/8 px-4 py-4">
                  {proposal.summary ? (
                    <p className="mt-0 text-sm leading-relaxed text-rhymvex-white/70">
                      {proposal.summary}
                    </p>
                  ) : null}
                  {proposal.scope ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/60">
                      {proposal.scope}
                    </p>
                  ) : null}

                  {proposal.deliverables.length > 0 ? (
                    <div className="mt-4">
                      <p className="rv-panel-title mb-1.5">What you get</p>
                      <ul className="flex flex-col gap-1">
                        {proposal.deliverables.map((item) => (
                          <li key={item} className="flex gap-2 text-xs text-rhymvex-white/65">
                            <span
                              className="mt-1.5 size-1 shrink-0 rounded-full bg-rhymvex-volt"
                              aria-hidden="true"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {proposal.exclusions.length > 0 ? (
                    <div className="mt-4">
                      <p className="rv-panel-title mb-1.5">Not included</p>
                      <ul className="flex flex-col gap-1">
                        {proposal.exclusions.map((item) => (
                          <li key={item} className="flex gap-2 text-xs text-rhymvex-white/45">
                            <span
                              className="mt-1.5 size-1 shrink-0 rounded-full bg-rhymvex-white/25"
                              aria-hidden="true"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {proposal.timeline ? (
                    <p className="mt-4 text-xs text-rhymvex-white/45">
                      Timeline: {proposal.timeline}
                    </p>
                  ) : null}

                  <p className="mt-4 border-t border-rhymvex-white/8 pt-3 text-[11px] text-rhymvex-white/30">
                    Reference {proposal.reference}. Reply to the email that sent this to talk it
                    through — a real person reads it.
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
