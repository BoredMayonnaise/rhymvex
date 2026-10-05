import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/session";
import { getClient, listClientActivity, listClientBookings, listClientContacts, listClientContracts, listClientEmails, listClientEngagements, listClientFiles, listClientInvoices, listClientMessages, listClientProjects, listClientProposals, listClientUsers } from "@/lib/data/clients";
import { auditForEntity, describeAuditAction } from "@/lib/audit";
import { listInvitations, type Invitation } from "@/lib/auth/invitations";
import { formatDate, formatDateTime, formatMoney, humanise, relativeTime } from "@/lib/format";
import {
  Dots,
  EmptyState,
  Field,
  Panel,
  StatusPill,
  Track,
  bookingStatusTone,
  contractStatusTone,
  emailStatusTone,
  invoiceStatusTone,
  projectStatusTone,
  proposalStatusTone,
} from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";
import { InviteToPortal } from "./InviteToPortal";

export const dynamic = "force-dynamic";

const CLIENT_TONE: Record<string, "idle" | "active" | "warn" | "done"> = {
  PROSPECT: "warn",
  ACTIVE: "active",
  DORMANT: "idle",
  CHURNED: "idle",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await requireStaffPermission("clients.read");
  const { id } = await params;
  const sp = await searchParams;

  const client = await getClient(id);
  if (!client) notFound();

  const [settings, contacts, users, projects, engagements, proposals, contracts, bookings, invoices, files, messages, emails, activity, audit, invitations] =
    await Promise.all([
      getOrgSettings(),
      listClientContacts(client.id),
      listClientUsers(client.id),
      listClientProjects(client.id),
      listClientEngagements(client.id),
      listClientProposals(client.id),
      listClientContracts(client.id),
      listClientBookings(client.id),
      listClientInvoices(client.id),
      listClientFiles(client.id),
      listClientMessages(client.id),
      listClientEmails(client.id, true),
      listClientActivity(client.id),
      auditForEntity("client", client.id),
      listInvitations("CLIENT_PORTAL"),
    ]);

  // Only invitations for this client, so one client can never see another's
  // pending portal invitations.
  const clientInvitations = invitations.filter(
    (i): i is Invitation => i.client_id === client.id,
  );

  const outstanding = invoices.reduce(
    (sum, i) => sum + (i.status === "PAID" || i.status === "VOID" ? 0 : i.amount - i.amount_paid),
    0,
  );
  const collected = invoices.reduce((sum, i) => sum + i.amount_paid, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All clients
        </Link>
      </div>

      {sp.created ? (
        <p
          role="status"
          className="rounded-lg border border-rhymvex-volt/35 bg-rhymvex-volt/[0.07] px-4 py-3 text-sm text-rhymvex-volt"
        >
          Client created. {humanise(projects[0]?.status ?? "planning")} work is ready to set up.
        </p>
      ) : null}

      <header className="rv-page-head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="rv-page-title break-words">{client.name}</h1>
            <StatusPill
              value={humanise(client.status)}
              tone={CLIENT_TONE[client.status] ?? "idle"}
            />
          </div>
          <p className="rv-page-sub break-words">
            <span className="font-mono">{client.reference}</span>
            {client.industry ? ` · ${client.industry}` : ""} · client since{" "}
            {formatDate(client.created_at)}
          </p>
        </div>
        {can(session, "clients.portal_invite") ? (
          <InviteToPortal
            clientId={client.id}
            clientName={client.name}
            csrfToken={session.csrfToken}
            existingUsers={users}
            invitations={clientInvitations}
          />
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="rv-stat min-w-0">
          <p className="rv-stat-label">Collected</p>
          <p className="rv-stat-value truncate">{formatMoney(collected, settings.currency)}</p>
        </div>
        <div className="rv-stat min-w-0">
          <p className="rv-stat-label">Outstanding</p>
          <p className="rv-stat-value truncate">{formatMoney(outstanding, settings.currency)}</p>
        </div>
        <div className="rv-stat min-w-0">
          <p className="rv-stat-label">Active projects</p>
          <p className="rv-stat-value">
            {
              projects.filter((p) =>
                ["PLANNING", "DISCOVERY", "IN_PROGRESS", "IN_REVIEW"].includes(p.status),
              ).length
            }
          </p>
        </div>
        <div className="rv-stat min-w-0">
          <p className="rv-stat-label">Portal users</p>
          <p className="rv-stat-value">{users.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Engagements" flush>
            {engagements.length === 0 ? (
              <EmptyState>No engagement recorded.</EmptyState>
            ) : (
              <ul>
                {engagements.map((engagement) => (
                  <li
                    key={engagement.id}
                    className="border-b border-rhymvex-white/5 px-4 py-3.5 last:border-b-0"
                  >
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-rhymvex-white">{engagement.name}</p>
                        <p className="mt-0.5 text-xs text-rhymvex-white/55">
                          {humanise(engagement.model)}
                          {engagement.billing_cycle ? ` · ${humanise(engagement.billing_cycle)}` : ""}
                        </p>
                        {engagement.summary ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-rhymvex-white/50">
                            {engagement.summary}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start sm:text-right">
                        <StatusPill value={humanise(engagement.status)} tone="active" />
                        {engagement.value_total ? (
                          <p className="rv-table-num text-xs text-rhymvex-white/60 sm:mt-1.5">
                            {formatMoney(engagement.value_total, settings.currency)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Projects" flush>
            {projects.length === 0 ? (
              <EmptyState>No projects.</EmptyState>
            ) : (
              <ul>
                {projects.map((project) => (
                  <li key={project.id} className="border-b border-rhymvex-white/5 px-4 py-3.5 last:border-b-0">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <p className="text-sm font-semibold text-rhymvex-white">{project.name}</p>
                          <div className="flex shrink-0 items-center gap-2 sm:hidden">
                            <span className="rv-table-num text-xs text-rhymvex-white/50">
                              {project.progress}%
                            </span>
                            <StatusPill
                              value={humanise(project.status)}
                              tone={projectStatusTone(project.status)}
                            />
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-rhymvex-white/55">
                          {project.phase ?? humanise(project.status)}
                          {project.lead_staff_name ? ` · ${project.lead_staff_name}` : ""}
                          {project.target_date ? ` · target ${formatDate(project.target_date)}` : ""}
                        </p>
                        {project.next_step ? (
                          <p className="mt-1.5 text-xs text-rhymvex-volt">
                            Next: {project.next_step}
                            {project.next_step_due ? ` (${formatDate(project.next_step_due)})` : ""}
                          </p>
                        ) : null}
                        <div className="mt-2 max-w-xs">
                          <Track
                            percent={project.progress}
                            label={`${project.name} progress`}
                          />
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                        <span className="rv-table-num text-xs text-rhymvex-white/50">
                          {project.progress}%
                        </span>
                        <StatusPill
                          value={humanise(project.status)}
                          tone={projectStatusTone(project.status)}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Proposals" flush>
              {proposals.length === 0 ? (
                <EmptyState>None.</EmptyState>
              ) : (
                <ul>
                  {proposals.map((p) => (
                    <li key={p.id} className="border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0">
                      <Link
                        href={`/admin/proposals/${p.id}`}
                        className="text-xs font-medium text-rhymvex-white hover:text-rhymvex-volt"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StatusPill
                          value={humanise(p.status)}
                          tone={proposalStatusTone(p.status)}
                        />
                        {p.investment ? (
                          <span className="rv-table-num text-[11px] text-rhymvex-white/55">
                            {formatMoney(p.investment, p.currency || settings.currency)}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Contracts" flush>
              {contracts.length === 0 ? (
                <EmptyState>None.</EmptyState>
            ) : (
                <ul>
                  {contracts.map((ct) => (
                    <li key={ct.id} className="border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0">
                      <p className="text-xs font-medium text-rhymvex-white">{ct.title}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StatusPill
                          value={humanise(ct.status)}
                          tone={contractStatusTone(ct.status)}
                        />
                        {ct.value_total ? (
                          <span className="rv-table-num text-[11px] text-rhymvex-white/55">
                            {formatMoney(ct.value_total, ct.currency || settings.currency)}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Invoices" flush>
            {invoices.length === 0 ? (
              <EmptyState>No invoices.</EmptyState>
            ) : (
              <>
                {/* Mobile Cards (< sm) */}
                <div className="divide-y divide-rhymvex-white/5 sm:hidden">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-col gap-2 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-rhymvex-white/60">
                          {invoice.reference}
                        </span>
                        <StatusPill
                          value={humanise(invoice.status)}
                          tone={invoiceStatusTone(invoice.status)}
                        />
                      </div>
                      <p className="text-xs text-rhymvex-white/85 line-clamp-2">
                        {invoice.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-rhymvex-white/[0.03] p-2 text-xs border border-rhymvex-white/5">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-rhymvex-white/45">
                            Amount
                          </span>
                          <span className="font-mono font-medium text-rhymvex-white/80">
                            {formatMoney(invoice.amount, invoice.currency || settings.currency)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] uppercase tracking-wider text-rhymvex-white/45">
                            Paid
                          </span>
                          <span className="font-mono font-medium text-rhymvex-white/60">
                            {formatMoney(invoice.amount_paid, invoice.currency || settings.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-rhymvex-white/45">
                        Due {formatDate(invoice.due_at)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= sm) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="rv-table">
                    <caption className="sr-only">Invoices</caption>
                    <thead>
                      <tr>
                        <th scope="col">Reference</th>
                        <th scope="col">Description</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="text-right">Amount</th>
                        <th scope="col" className="text-right">Paid</th>
                        <th scope="col">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="font-mono text-[11px] text-rhymvex-white/50">
                            {invoice.reference}
                          </td>
                          <td className="text-rhymvex-white/70">{invoice.description}</td>
                          <td>
                            <StatusPill
                              value={humanise(invoice.status)}
                              tone={invoiceStatusTone(invoice.status)}
                            />
                          </td>
                          <td className="rv-table-num text-right text-rhymvex-white/75">
                            {formatMoney(invoice.amount, invoice.currency || settings.currency)}
                          </td>
                          <td className="rv-table-num text-right text-rhymvex-white/55">
                            {formatMoney(invoice.amount_paid, invoice.currency || settings.currency)}
                          </td>
                          <td className="whitespace-nowrap text-rhymvex-white/55">
                            {formatDate(invoice.due_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Files" flush>
              {files.length === 0 ? (
                <EmptyState>Nothing shared yet.</EmptyState>
              ) : (
                <ul>
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-start justify-between gap-2 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-rhymvex-white/75">{file.name}</p>
                        <p className="truncate text-[10px] text-rhymvex-white/50">
                          {file.uploader_name ?? "Rhymvex"} · {relativeTime(file.uploaded_at)}
                          {file.project_name ? ` · ${file.project_name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                          file.client_visible
                            ? "border-rhymvex-volt/30 text-rhymvex-volt"
                            : "border-rhymvex-white/15 text-rhymvex-white/50"
                        }`}
                      >
                        {file.client_visible ? "Shared" : "Internal"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Messages" flush>
              {messages.length === 0 ? (
                <EmptyState>No portal messages.</EmptyState>
              ) : (
                <ul>
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className="border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0 min-w-0"
                    >
                      <p className="truncate text-xs font-medium text-rhymvex-white">
                        {message.subject || "(no subject)"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-rhymvex-white/50 break-words">
                        {message.body}
                      </p>
                      <p className="mt-1 text-[10px] text-rhymvex-white/50">
                        {message.from_staff ?? message.from_client} ·{" "}
                        {relativeTime(message.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Business email" flush>
            {emails.length === 0 ? (
              <EmptyState>No email recorded for this client.</EmptyState>
            ) : (
              <ul>
                {emails.map((email) => (
                  <li
                    key={email.id}
                    className="flex flex-col gap-1.5 border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-2 sm:py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="rv-status shrink-0" data-tone="idle">
                        <span className="rv-status-dot" aria-hidden="true" />
                        {email.direction === "OUTBOUND" ? "Out" : "In"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-rhymvex-white/70">
                        {email.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {!email.client_visible ? (
                        <span className="rounded-full border border-rhymvex-ember/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-rhymvex-ember">
                          Internal
                        </span>
                      ) : null}
                      <StatusPill value={humanise(email.status)} tone={emailStatusTone(email.status)} />
                      <span className="text-[10px] text-rhymvex-white/50 whitespace-nowrap">
                        {relativeTime(email.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Company">
            <dl className="rv-dl">
              <Field label="Name">{client.name}</Field>
              {client.legal_name && client.legal_name !== client.name ? (
                <Field label="Legal">{client.legal_name}</Field>
              ) : null}
              {client.industry ? <Field label="Industry">{client.industry}</Field> : null}
              {client.website ? (
                <Field label="Website">
                  <a
                    href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-rhymvex-volt hover:underline"
                  >
                    {client.website}
                    <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  </a>
                </Field>
              ) : null}
              {client.phone ? <Field label="Phone">{client.phone}</Field> : null}
              {client.address ? <Field label="Address">{client.address}</Field> : null}
              {/* The name, not `account_manager`, which is the uuid. The query
                  already joins staff for exactly this. */}
              <Field label="Manager">
                {client.account_manager_name ?? "Unassigned"}
              </Field>
              {client.lead_id && client.lead_reference ? (
                <Field label="From lead">
                  <Link
                    href={`/admin/leads/${client.lead_id}`}
                    className="font-mono text-[11px] text-rhymvex-volt hover:underline"
                  >
                    {client.lead_reference}
                  </Link>
                </Field>
              ) : null}
            </dl>
            {client.notes ? (
              <p className="mt-3 border-t border-rhymvex-white/7 pt-3 text-xs leading-relaxed text-rhymvex-white/50">
                {client.notes}
              </p>
            ) : null}
          </Panel>

          <Panel title="Contacts" flush>
            {contacts.length === 0 ? (
              <EmptyState>No contacts recorded.</EmptyState>
            ) : (
              <ul>
                {contacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0 min-w-0"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-rhymvex-white">{contact.name}</span>
                      {contact.is_primary ? (
                        <span className="shrink-0 rounded-full border border-rhymvex-volt/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-rhymvex-volt">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-rhymvex-white/50">{contact.email}</p>
                    {contact.role_title ? (
                      <p className="truncate text-[11px] text-rhymvex-white/50">{contact.role_title}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Portal access" flush>
            {users.length === 0 ? (
              <EmptyState>Nobody has portal access yet.</EmptyState>
            ) : (
              <ul>
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-2 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-rhymvex-white">{user.name}</p>
                      <p className="truncate text-[11px] text-rhymvex-white/50">{user.email}</p>
                      <p className="text-[10px] text-rhymvex-white/50">
                        {user.last_login_at
                          ? `last in ${relativeTime(user.last_login_at)}`
                          : `invited ${formatDate(user.created_at)}`}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusPill
                        value={user.active ? "Active" : "Disabled"}
                        tone={user.active ? "done" : "idle"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Activity" flush>
            {activity.length === 0 ? (
              <EmptyState>Nothing recorded.</EmptyState>
            ) : (
              <ul>
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
                  >
                    <p className="text-xs text-rhymvex-white/75">{item.title}</p>
                    {item.detail ? (
                      <p className="text-[11px] text-rhymvex-white/50">{item.detail}</p>
                    ) : null}
                    <p className="text-[10px] text-rhymvex-white/50">
                      {formatDateTime(item.occurred_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Audit" flush>
            {audit.length === 0 ? (
              <EmptyState>Nothing recorded.</EmptyState>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-rhymvex-white/5 px-4 py-2 last:border-b-0"
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
