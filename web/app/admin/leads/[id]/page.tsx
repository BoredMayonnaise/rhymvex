import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, User } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/session";
import { getLead, listLeadNotes } from "@/lib/data/leads";
import { listEmails } from "@/lib/data/email";
import { auditForEntity, describeAuditAction } from "@/lib/audit";
import { formatDateTime, formatMoney, humanise, relativeTime } from "@/lib/format";
import {
  EmptyState,
  Field,
  Panel,
  StatusPill,
  emailStatusTone,
  leadStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";
import { listStaff } from "@/lib/data/workspace";
import { getLeadDetailExtras } from "@/lib/data/lead-detail";
import { LeadActions } from "./LeadActions";
import { LeadNoteForm } from "./LeadNoteForm";
import { EmailThread } from "./EmailThread";
import { BookingPanel } from "./BookingPanel";
import { ProposalPanel } from "./ProposalPanel";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPermission("leads.read");
  const { id } = await params;

  const lead = await getLead(id);
  if (!lead) notFound();

  const [settings, notes, emails, audit, staff, extras] = await Promise.all([
    getOrgSettings(),
    listLeadNotes(lead.id),
    listEmails({ leadId: lead.id, includeInternal: true, limit: 100 }),
    auditForEntity("lead", lead.id),
    listStaff(),
    getLeadDetailExtras(lead.id),
  ]);

  const canWrite = can(session, "leads.write");
  const leadBookings = extras.bookings;
  const leadProposals = extras.proposals;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/40 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All leads
        </Link>
      </div>

      <header className="rv-page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="rv-page-title">{lead.name}</h1>
            <StatusPill value={humanise(lead.status)} tone={leadStatusTone(lead.status)} />
          </div>
          <p className="rv-page-sub">
            {lead.company ?? "No company given"}
            {lead.role_title ? ` · ${lead.role_title}` : ""} ·{" "}
            <span className="font-mono">{lead.reference}</span>
          </p>
        </div>
        <LeadActions
          lead={lead}
          staff={staff.map((s) => ({ id: s.id, name: s.name }))}
          canWrite={canWrite}
          canAssign={can(session, "leads.assign")}
          canPropose={can(session, "proposals.write")}
          canBook={can(session, "bookings.write")}
          canEmail={can(session, "email.send")}
          canConvert={can(session, "clients.write")}
          csrfToken={session.csrfToken}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* The request itself, first and unedited. This is the thing the
              whole relationship is about, so it is not summarised. */}
          <Panel title="Request">
            <div className="flex flex-col gap-4">
              <div>
                <p className="rv-label mb-1.5">Situation</p>
                <p className="text-sm text-rhymvex-white">{lead.situation}</p>
              </div>
              <div>
                <p className="rv-label mb-1.5">In their words</p>
                <blockquote className="border-l-2 border-rhymvex-volt/50 pl-4 text-sm leading-relaxed text-rhymvex-white/75 italic">
                  {lead.message}
                </blockquote>
              </div>
              <div className="grid gap-3 border-t border-rhymvex-white/7 pt-4 sm:grid-cols-3">
                {lead.budget_band ? (
                  <div>
                    <p className="rv-label mb-1">Budget</p>
                    <p className="text-xs text-rhymvex-white/70">{lead.budget_band}</p>
                  </div>
                ) : null}
                {lead.timeline ? (
                  <div>
                    <p className="rv-label mb-1">Timeline</p>
                    <p className="text-xs text-rhymvex-white/70">{lead.timeline}</p>
                  </div>
                ) : null}
                {lead.referral_source ? (
                  <div>
                    <p className="rv-label mb-1">Came from</p>
                    <p className="text-xs text-rhymvex-white/70">{lead.referral_source}</p>
                  </div>
                ) : null}
              </div>
              <p className="border-t border-rhymvex-white/7 pt-3 text-[11px] text-rhymvex-white/30">
                Received {formatDateTime(lead.submitted_at)} · {relativeTime(lead.submitted_at)} ·
                source {lead.source}
              </p>
            </div>
          </Panel>

          {/* Internal notes. Visually and structurally walled off: a different
              colour, an explicit "never visible to the client" label, and no
              code path that can reach them from the portal. */}
          <Panel
            title="Internal notes"
            action={
              <span className="rounded-full border border-rhymvex-ember/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-rhymvex-ember">
                Never client visible
              </span>
            }
          >
            {canWrite ? <LeadNoteForm leadId={lead.id} csrfToken={session.csrfToken} /> : null}
            {notes.length === 0 ? (
              <EmptyState>
                {canWrite ? "No notes yet." : "No notes."}
              </EmptyState>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-rhymvex-ember/15 bg-rhymvex-ember/[0.04] p-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-rhymvex-white">
                        {note.author_name}
                      </span>
                      <time
                        dateTime={new Date(note.created_at).toISOString()}
                        className="text-[10px] text-rhymvex-white/30"
                      >
                        {relativeTime(note.created_at)}
                      </time>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/75">
                      {note.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <EmailThread
            leadId={lead.id}
            leadEmail={lead.email}
            leadName={lead.name}
            emails={emails}
            canSend={can(session, "email.send")}
            csrfToken={session.csrfToken}
          />

          <BookingPanel bookings={leadBookings} />

          <ProposalPanel proposals={leadProposals} currency={settings.currency} />
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Contact">
            <dl className="rv-dl">
              <Field label="Name">
                <span className="flex items-center gap-1.5">
                  <User className="size-3 shrink-0 text-rhymvex-white/30" aria-hidden="true" />
                  {lead.name}
                </span>
              </Field>
              <Field label="Email">
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 break-all text-rhymvex-volt hover:underline"
                >
                  <Mail className="size-3 shrink-0" aria-hidden="true" />
                  {lead.email}
                </a>
              </Field>
              {lead.phone ? <Field label="Phone">{lead.phone}</Field> : null}
              {lead.website ? (
                <Field label="Website">
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-rhymvex-volt hover:underline"
                  >
                    {lead.website}
                  </a>
                </Field>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Company">
            {lead.company ? (
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-rhymvex-white">{lead.company}</p>
                  {lead.role_title ? (
                    <p className="mt-0.5 text-xs text-rhymvex-white/45">{lead.role_title}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState>No company given.</EmptyState>
            )}
          </Panel>

          <Panel title="Assigned team">
            <dl className="rv-dl">
              <Field label="Owner">
                {lead.assigned_name ?? (
                  <span className="text-rhymvex-volt">Unassigned</span>
                )}
              </Field>
              {lead.recommended_model ? (
                <Field label="Recommended">{humanise(lead.recommended_model)}</Field>
              ) : null}
              <Field label="Estimate">
                {lead.estimated_value
                  ? formatMoney(lead.estimated_value, settings.currency)
                  : "—"}
              </Field>
              <Field label="Submitted">
                {formatDateTime(lead.submitted_at)}
              </Field>
              {lead.last_contacted_at ? (
                <Field label="Last contacted">{formatDateTime(lead.last_contacted_at)}</Field>
              ) : null}
              {lead.lost_reason ? (
                <Field label="Lost because">{lead.lost_reason}</Field>
              ) : null}
            </dl>
            {lead.client_id ? (
              <Link
                href={`/admin/clients/${lead.client_id}`}
                className="mt-3 inline-block text-[11px] font-semibold text-rhymvex-volt hover:underline"
              >
                View the client record
              </Link>
            ) : null}
          </Panel>

          <Panel title="Audit history" flush>
            {audit.length === 0 ? (
              <EmptyState>Nothing recorded.</EmptyState>
            ) : (
              <ul className="max-h-[26rem] overflow-y-auto">
                {audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                  >
                    <p className="text-xs text-rhymvex-white/75">
                      <span className="font-semibold text-rhymvex-white">
                        {entry.actor_label ?? humanise(entry.actor_type)}
                      </span>{" "}
                      {describeAuditAction(entry.action).toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-[10px] text-rhymvex-white/30">
                      {formatDateTime(entry.occurred_at)}
                      {entry.ip_address ? ` · ${entry.ip_address}` : ""}
                    </p>
                    {Object.keys(entry.metadata ?? {}).length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-rhymvex-white/30 hover:text-rhymvex-volt">
                          Metadata
                        </summary>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded border border-rhymvex-white/8 bg-rhymvex-black/40 p-2 font-mono text-[10px] text-rhymvex-white/50">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
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
