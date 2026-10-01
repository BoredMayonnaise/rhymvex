import { requireStaffPermission } from "@/lib/auth/guards";
import { query, queryOne } from "@/lib/db/client";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill } from "@/components/ui/primitives";
import { recentAudit, describeAuditAction } from "@/lib/audit";
import { listInvitations } from "@/lib/auth/invitations";
import { smtpConfigured } from "@/lib/mail/smtp";
import { invitationStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Security.
 *
 * A read-only view of the controls that are actually in force, plus the audit
 * trail. It reports the state of the system rather than letting anyone change
 * it from a page, so there is no privileged action here to get wrong.
 */
export default async function SecurityPage() {
  await requireStaffPermission("security.read");

  const [
    staffCount,
    portalUsers,
    activeStaffSessions,
    activeClientSessions,
    pendingInvites,
    failedLogins,
    auditCount,
    audit,
    recentSecurity,
  ] = await Promise.all([
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM staff WHERE active"),
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM client_users WHERE active"),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM sessions WHERE expires_at > now()",
    ),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM client_sessions WHERE expires_at > now()",
    ),
    listInvitations().then((all) => all.filter((i) => i.status === "PENDING")),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_log WHERE action = 'staff.login_failed' AND occurred_at > now() - interval '7 days'",
    ),
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM audit_log"),
    recentAudit(60),
    query<{
      id: string;
      actor_label: string | null;
      actor_type: string;
      action: string;
      ip_address: string | null;
      user_agent: string | null;
      occurred_at: Date;
    }>(
      `SELECT id, actor_label, actor_type, action, ip_address, user_agent, occurred_at
         FROM audit_log
        WHERE action IN ('staff.login','staff.login_failed','staff.logout','portal.login',
                         'invitation.accepted','staff.invited','client.portal_invited',
                         'staff.invite_revoked','client.portal_invite_revoked')
        ORDER BY occurred_at DESC, id DESC
        LIMIT 40`,
    ),
  ]);

  const controls = [
    { label: "Password storage", value: "scrypt, per-user salt", ok: true },
    { label: "Session cookies", value: "httpOnly, SameSite=Lax, signed, Secure in production", ok: true },
    { label: "CSRF", value: "Session-bound token, checked on every mutation", ok: true },
    { label: "Authorisation", value: "Server-side, per action, from the session", ok: true },
    { label: "Tenant isolation", value: "Portal reads scoped by session client id in SQL", ok: true },
    { label: "Audit immutability", value: "Append-only, enforced by database trigger", ok: true },
    {
      label: "Intake rate limit",
      value: `${process.env.INTAKE_RATE_LIMIT ?? 5} per hour per IP`,
      ok: true,
    },
    { label: "Spam protection", value: "Honeypot field and minimum fill time", ok: true },
    {
      label: "SMTP",
      value: smtpConfigured() ? "Configured" : "Not configured (writing to the outbox)",
      ok: smtpConfigured(),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Security</h1>
          <p className="rv-page-sub">Controls in force, and the audit trail behind them</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active staff"
          value={String(staffCount?.count ?? 0)}
          meta={`${activeStaffSessions?.count ?? 0} live sessions`}
        />
        <Stat
          label="Portal users"
          value={String(portalUsers?.count ?? 0)}
          meta={`${activeClientSessions?.count ?? 0} live sessions`}
        />
        <Stat
          label="Pending invitations"
          value={String(pendingInvites.length)}
          meta="single-use, expiring"
        />
        <Stat
          label="Failed sign-ins"
          value={String(failedLogins?.count ?? 0)}
          meta="last 7 days"
        />
      </div>

      <Panel title="Controls">
        <ul className="flex flex-col gap-2">
          {controls.map((control) => (
            <li
              key={control.label}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-rhymvex-white/5 pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-xs font-medium text-rhymvex-white/80">{control.label}</span>
              <span className="flex items-center gap-2.5">
                <span className="text-[11px] text-rhymvex-white/45">{control.value}</span>
                <StatusPill
                  value={control.ok ? "Active" : "Not configured"}
                  tone={control.ok ? "done" : "warn"}
                />
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pending invitations" flush>
        {pendingInvites.length === 0 ? (
          <EmptyState>No outstanding invitations.</EmptyState>
        ) : (
          <table className="rv-table">
            <caption className="sr-only">Pending invitations</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Name</th>
                <th scope="col">Kind</th>
                <th scope="col">Role</th>
                <th scope="col">Client</th>
                <th scope="col">Expires</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="text-rhymvex-white/70">{invitation.email}</td>
                  <td className="text-rhymvex-white/60">{invitation.name ?? "—"}</td>
                  <td className="whitespace-nowrap text-rhymvex-white/50">
                    {invitation.kind === "STAFF" ? "Team" : "Client portal"}
                  </td>
                  <td className="whitespace-nowrap text-rhymvex-white/50">
                    {invitation.role ? humanise(invitation.role) : "—"}
                  </td>
                  <td className="text-rhymvex-white/50">{invitation.client_name ?? "—"}</td>
                  <td className="whitespace-nowrap text-rhymvex-white/45">
                    {formatDateTime(invitation.expires_at)}
                  </td>
                  <td>
                    <StatusPill
                      value={humanise(invitation.status)}
                      tone={invitationStatusTone(invitation.status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Authentication events" flush>
          {recentSecurity.length === 0 ? (
            <EmptyState>Nothing recorded.</EmptyState>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {recentSecurity.map((entry) => (
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
                  <p className="text-[10px] text-rhymvex-white/25">
                    {formatDateTime(entry.occurred_at)} · {relativeTime(entry.occurred_at)}
                    {entry.ip_address ? ` · ${entry.ip_address}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Full audit trail" flush>
          <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/35">
            {auditCount?.count ?? 0} entries. Newest first. Entries cannot be edited or deleted.
          </p>
          {audit.length === 0 ? (
            <EmptyState>Nothing recorded.</EmptyState>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
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
                    {entry.entity_type ? (
                      <span className="text-rhymvex-white/25">
                        {" "}
                        · {entry.entity_type}
                        {entry.entity_id ? ` ${entry.entity_id.slice(0, 8)}` : ""}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-rhymvex-white/25">
                    {formatDateTime(entry.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
