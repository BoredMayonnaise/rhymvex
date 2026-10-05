import Link from "next/link";
import { Mail } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/session";
import { listInbox } from "@/lib/data/workspace";
import { emailStats } from "@/lib/data/email";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, emailStatusTone } from "@/components/ui/primitives";
import {
  getBusinessSmtpConfig,
  getSystemSmtpConfig,
  internalNotificationAddress,
  smtpConfigured,
} from "@/lib/mail/smtp";
import { SendEmailForm } from "./SendEmailForm";
import { SmtpStatusPanel } from "./SmtpStatusPanel";

export const dynamic = "force-dynamic";

/**
 * Business Email.
 *
 * An inbox, not a mailto link. Every message is tied to the lead, client,
 * project or proposal it concerns, so the conversation history lives with the
 * business record instead of in somebody's inbox.
 */
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dir?: string }>;
}) {
  const session = await requireStaffPermission("email.read");
  const params = await searchParams;

  const direction =
    params.dir === "INBOUND" || params.dir === "OUTBOUND" ? params.dir : undefined;
  const search = (params.q ?? "").slice(0, 100);

  const [emails, stats] = await Promise.all([
    listInbox({ search: search || undefined, direction, includeInternal: true }),
    emailStats(),
  ]);

  const canSend = can(session, "email.send");

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Business Email</h1>
          <p className="rv-page-sub">
            {stats.total} recorded
            {stats.lastSentAt ? ` · last sent ${relativeTime(stats.lastSentAt)}` : ""}
            {!smtpConfigured() ? " · SMTP not configured, messages are in the outbox" : ""}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          {direction ? <input type="hidden" name="dir" value={direction} /> : null}
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-rhymvex-white/50"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Subject, body, address"
              aria-label="Search email"
              className="rv-input w-56 pl-8"
            />
          </div>
          <button type="submit" className="rv-btn rv-btn-ghost rv-btn-sm">
            Search
          </button>
        </form>
      </header>

      <SmtpStatusPanel
        csrfToken={session.csrfToken}
        businessConfig={getBusinessSmtpConfig()}
        systemConfig={getSystemSmtpConfig()}
        notificationEmail={internalNotificationAddress()}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Recorded" value={String(stats.total)} meta="all business email" />
        <Stat
          label="Sent"
          value={String(stats.sent)}
          meta="handed to the mail service"
        />
        <Stat
          label="Failed"
          value={String(stats.failed)}
          meta={stats.failed > 0 ? "needs a retry" : "none"}
        />
      </div>

      {canSend ? (
        <SendEmailForm
          csrfToken={session.csrfToken}
          actorName={session.name}
          replyTo={process.env.SMTP_FROM?.trim() || "Rhymvex <support@rhymvex.space>"}
        />
      ) : null}

      <nav aria-label="Filter by direction" className="flex flex-wrap gap-1.5">
        <DirChip href="/admin/email" label="All" active={!direction && !search} />
        <DirChip
          href={`/admin/email?dir=OUTBOUND${search ? `&q=${encodeURIComponent(search)}` : ""}`}
          label="Outbound"
          active={direction === "OUTBOUND"}
        />
        <DirChip
          href={`/admin/email?dir=INBOUND${search ? `&q=${encodeURIComponent(search)}` : ""}`}
          label="Inbound"
          active={direction === "INBOUND"}
        />
      </nav>

      <Panel flush>
        {emails.length === 0 ? (
          <EmptyState>
            No email matches. Intake confirmations and internal notifications appear here
            automatically.
          </EmptyState>
        ) : (
          <ul>
            {emails.map((email) => {
              const related = email.project_name
                ? { href: `/admin/clients/${email.client_id}`, label: email.project_name }
                : email.client_name && email.client_id
                  ? { href: `/admin/clients/${email.client_id}`, label: email.client_name }
                  : email.lead_id
                    ? { href: `/admin/leads/${email.lead_id}`, label: email.lead_company ?? email.lead_name ?? "Lead" }
                    : null;

              return (
                <li key={email.id} className="border-b border-rhymvex-white/5 last:border-b-0">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5 px-4 py-3 transition-colors hover:bg-rhymvex-white/2">
                      <span className="rv-status" data-tone={email.direction === "OUTBOUND" ? "active" : "idle"}>
                        <span className="rv-status-dot" aria-hidden="true" />
                        {email.direction === "OUTBOUND" ? "Out" : "In"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-rhymvex-white">
                          {email.subject}
                        </span>
                        <span className="block truncate text-[11px] text-rhymvex-white/50">
                          {email.direction === "OUTBOUND"
                            ? `to ${email.to_addresses.join(", ")}`
                            : `from ${email.from_address}`}
                          {related ? ` · ${related.label}` : ""}
                        </span>
                      </span>
                      {!email.client_visible ? (
                        <span className="rounded-full border border-rhymvex-ember/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-rhymvex-ember">
                          Internal
                        </span>
                      ) : null}
                      <StatusPill
                        value={humanise(email.status)}
                        tone={emailStatusTone(email.status)}
                      />
                      <span
                        className="shrink-0 text-[10px] text-rhymvex-white/50"
                        title={formatDateTime(email.created_at)}
                      >
                        {relativeTime(email.created_at)}
                      </span>
                    </summary>
                    <div className="border-t border-rhymvex-white/5 bg-rhymvex-black/20 px-4 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-rhymvex-white/65">
                        {email.body_text}
                      </pre>
                      {related ? (
                        <Link
                          href={related.href}
                          className="mt-3 inline-block text-[11px] font-semibold text-rhymvex-volt hover:underline"
                        >
                          Open the {email.project_name ? "project" : email.client_name ? "client" : "lead"} record
                        </Link>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function DirChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-rhymvex-volt/50 bg-rhymvex-volt/10 text-rhymvex-volt"
          : "border-rhymvex-white/10 text-rhymvex-white/55 hover:border-rhymvex-white/25 hover:text-rhymvex-white/75"
      }`}
    >
      {label}
    </Link>
  );
}
