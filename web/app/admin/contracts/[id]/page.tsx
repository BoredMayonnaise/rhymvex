import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { can as canDo } from "@/lib/auth/session";
import { getContract } from "@/lib/data/workspace";
import { auditForEntity, describeAuditAction } from "@/lib/audit";
import { formatDate, formatDateTime, formatMoney, humanise } from "@/lib/format";
import {
  EmptyState,
  Field,
  Panel,
  StatusPill,
  contractStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";
import { ContractActions } from "./ContractActions";
import { ContractBodyEditor } from "./ContractBodyEditor";

export const dynamic = "force-dynamic";

/**
 * One contract.
 *
 * The id comes from the URL and this is a staff route, so the contract is read
 * by id without a client filter — a member of staff may need to see any
 * contract. The client's own view of the same record is a separate read in
 * `lib/data/portal.ts` that is scoped to their client id.
 */
export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPermission("contracts.read");
  const { id } = await params;

  const contract = await getContract(id);
  if (!contract) notFound();

  const [settings, audit] = await Promise.all([
    getOrgSettings(),
    auditForEntity("contract", contract.id),
  ]);

  const canWrite = canDo(session, "contracts.write");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/contracts"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All contracts
        </Link>
      </div>

      <header className="rv-page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="rv-page-title">{contract.title}</h1>
            <StatusPill
              value={humanise(contract.status)}
              tone={contractStatusTone(contract.status)}
            />
          </div>
          <p className="rv-page-sub">
            <span className="font-mono">{contract.reference}</span> ·{" "}
            <Link
              href={`/admin/clients/${contract.client_id}`}
              className="text-rhymvex-volt hover:underline"
            >
              {contract.client_name}
            </Link>
          </p>
        </div>
        <ContractActions
          contractId={contract.id}
          status={contract.status}
          csrfToken={session.csrfToken}
          canSend={canDo(session, "contracts.send")}
          canWrite={canWrite}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Agreement">
            {contract.body ? (
              <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-rhymvex-white/70">
                {contract.body}
              </pre>
            ) : (
              <EmptyState>
                No agreement text yet. This contract was created as a shell — add the terms before
                sending it.
              </EmptyState>
            )}
          </Panel>

          {/* Editing the terms. A draft can always be revised; once sent, the
              text is fixed and only the status moves, because a client may
              already have read what was sent. */}
          {canWrite && (contract.status === "DRAFT" || contract.status === "SENT") ? (
            <ContractBodyEditor
              contractId={contract.id}
              initialBody={contract.body ?? ""}
              csrfToken={session.csrfToken}
            />
          ) : null}

          {contract.signed_at ? (
            <Panel title="Signature">
              <dl className="rv-dl">
                <Field label="Signed by">{contract.signed_by_name ?? "—"}</Field>
                <Field label="When">{formatDateTime(contract.signed_at)}</Field>
                <Field label="From">{contract.signature_ip ?? "not recorded"}</Field>
              </dl>
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Commercials">
            <dl className="rv-dl">
              <Field label="Value">
                {contract.value_total
                  ? formatMoney(contract.value_total, contract.currency || settings.currency)
                  : "—"}
              </Field>
              <Field label="From proposal">
                {contract.proposal_id ? (
                  <Link
                    href={`/admin/proposals/${contract.proposal_id}`}
                    className="text-rhymvex-volt hover:underline"
                  >
                    {contract.proposal_reference}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Project">
                {contract.project_id ? (
                  <Link
                    href={`/admin/projects/${contract.project_id}`}
                    className="text-rhymvex-volt hover:underline"
                  >
                    {contract.project_name}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Drafted by">{contract.created_by_name ?? "—"}</Field>
            </dl>
          </Panel>

          <Panel title="Timeline">
            <dl className="rv-dl">
              <Field label="Drafted">{formatDateTime(contract.created_at)}</Field>
              <Field label="Sent">
                {contract.sent_at ? formatDateTime(contract.sent_at) : "not sent"}
              </Field>
              <Field label="Signed">
                {contract.signed_at ? formatDateTime(contract.signed_at) : "pending"}
              </Field>
              <Field label="Signed by">{contract.signed_by_name ?? "—"}</Field>
              <Field label="Updated">{formatDate(contract.updated_at)}</Field>
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