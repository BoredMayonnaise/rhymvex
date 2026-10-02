import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { can as canDo } from "@/lib/auth/session";
import { queryOne } from "@/lib/db/client";
import { auditForEntity, describeAuditAction } from "@/lib/audit";
import { formatDate, formatDateTime, formatMoney, humanise } from "@/lib/format";
import {
  EmptyState,
  Field,
  Panel,
  StatusPill,
  proposalStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";
import { ProposalActions } from "./ProposalActions";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPermission("proposals.read");
  const { id } = await params;

  const proposal = await queryOne<{
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    model: string | null;
    scope: string | null;
    deliverables: string[];
    exclusions: string[];
    timeline: string | null;
    investment: number | null;
    currency: string;
    status: string;
    sent_at: Date | null;
    viewed_at: Date | null;
    decided_at: Date | null;
    created_at: Date;
    client_id: string | null;
    client_name: string | null;
    lead_id: string | null;
    lead_name: string | null;
    lead_company: string | null;
  }>(
    `SELECT p.*, c.name AS client_name, l.name AS lead_name, l.company AS lead_company
       FROM proposals p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN leads l ON l.id = p.lead_id
      WHERE p.id = $1`,
    [id],
  );

  if (!proposal) notFound();

  const [settings, audit] = await Promise.all([getOrgSettings(), auditForEntity("proposal", id)]);
  const forWhom = proposal.client_name ?? proposal.lead_company ?? proposal.lead_name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/proposals"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All proposals
        </Link>
      </div>

      <header className="rv-page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="rv-page-title">{proposal.title}</h1>
            <StatusPill
              value={humanise(proposal.status)}
              tone={proposalStatusTone(proposal.status)}
            />
          </div>
          <p className="rv-page-sub">
            <span className="font-mono">{proposal.reference}</span> · for {forWhom}
            {proposal.model ? ` · ${humanise(proposal.model)}` : ""}
          </p>
        </div>
        <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          csrfToken={session.csrfToken}
          canSend={canDo(session, "proposals.send")}
          canWrite={canDo(session, "proposals.write")}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {proposal.summary ? (
            <Panel title="Summary">
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/70">
                {proposal.summary}
              </p>
            </Panel>
          ) : null}

          {proposal.scope ? (
            <Panel title="Scope">
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/70">
                {proposal.scope}
              </p>
            </Panel>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Deliverables" flush>
              {proposal.deliverables.length === 0 ? (
                <EmptyState>None listed.</EmptyState>
              ) : (
                <ul className="px-4 py-2">
                  {proposal.deliverables.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 py-1.5 text-xs text-rhymvex-white/70"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rhymvex-volt" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Not included" flush>
              {proposal.exclusions.length === 0 ? (
                <EmptyState>None listed.</EmptyState>
              ) : (
                <ul className="px-4 py-2">
                  {proposal.exclusions.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 py-1.5 text-xs text-rhymvex-white/55"
                    >
                      <span
                        className="mt-1.5 size-1 shrink-0 rounded-full bg-rhymvex-white/25"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Commercials">
            <dl className="rv-dl">
              <Field label="Investment">
                {proposal.investment
                  ? formatMoney(proposal.investment, proposal.currency || settings.currency)
                  : "—"}
              </Field>
              <Field label="Timeline">{proposal.timeline ?? "—"}</Field>
              <Field label="Model">
                {proposal.model ? humanise(proposal.model) : "—"}
              </Field>
              <Field label="For">
                {proposal.client_id ? (
                  <Link
                    href={`/admin/clients/${proposal.client_id}`}
                    className="text-rhymvex-volt hover:underline"
                  >
                    {proposal.client_name}
                  </Link>
                ) : proposal.lead_id ? (
                  <Link
                    href={`/admin/leads/${proposal.lead_id}`}
                    className="text-rhymvex-volt hover:underline"
                  >
                    {proposal.lead_company ?? proposal.lead_name}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
            </dl>
          </Panel>

          <Panel title="Timeline">
            <dl className="rv-dl">
              <Field label="Drafted">{formatDateTime(proposal.created_at)}</Field>
              <Field label="Sent">
                {proposal.sent_at ? formatDateTime(proposal.sent_at) : "not sent"}
              </Field>
              <Field label="Viewed">
                {proposal.viewed_at ? formatDateTime(proposal.viewed_at) : "not yet"}
              </Field>
              <Field label="Decided">
                {proposal.decided_at ? formatDate(proposal.decided_at) : "pending"}
              </Field>
            </dl>
          </Panel>

          <Panel title="Audit" flush>
            {audit.length === 0 ? (
              <EmptyState>Nothing recorded.</EmptyState>
            ) : (
              <ul>
                {audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                  >
                    <p className="text-[11px] text-rhymvex-white/70">
                      <span className="font-semibold text-rhymvex-white">
                        {entry.actor_label ?? humanise(entry.actor_type)}
                      </span>{" "}
                      {describeAuditAction(entry.action).toLowerCase()}
                    </p>
                    <p className="text-[10px] text-rhymvex-white/50">
                      {formatDateTime(entry.occurred_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
