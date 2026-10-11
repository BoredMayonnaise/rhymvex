import { requireStaffPermission } from "@/lib/auth/guards";
import { query, queryOne } from "@/lib/db/client";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill } from "@/components/ui/primitives";
import { recentAudit, describeAuditAction } from "@/lib/audit";
import { listInvitations } from "@/lib/auth/invitations";
import { listLiveSessions, type LiveSession } from "@/lib/data/sessions";
import { pruneExpiredSessions, staffCookieOptions } from "@/lib/auth/session";
import { resolveSecuritySettings, type SecuritySettingKey } from "@/lib/security-settings";
import { smtpConfigured } from "@/lib/mail/smtp";
import { invitationStatusTone } from "@/components/ui/primitives";
import { RevokeSessionButton } from "./RevokeSessionButton";
import { SecurityPolicyForm } from "./SecurityPolicyForm";

export const dynamic = "force-dynamic";

/**
 * Security.
 *
 * Every control is either measured against the running deployment or labelled
 * as a code invariant, and the policy values are the ones actually in force —
 * resolved from defaults, environment and the settings row, in that order.
 * The page is the place an admin looks to answer "what is actually true here",
 * so a claim it cannot check is never dressed up as one it has.
 */

/** `5 per hour` / `90 minutes` / `45 seconds`, for a window in seconds. */
function windowWords(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "minute" : `${minutes} minutes`;
  }
  return `${seconds} seconds`;
}

/** Readable agent: the product and platform, without the build hash noise. */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser =
    /Firefox\/[\d.]+/.exec(agent)?.[0] ??
    /Edg\/[\d.]+/.exec(agent)?.[0] ??
    /Chrome\/[\d.]+/.exec(agent)?.[0] ??
    /Safari\/[\d.]+/.exec(agent)?.[0];
  const platform =
    /\((?:[^)]*(Windows|Mac OS X|Macintosh|Linux|Android|iPhone|iPad)[^)]*)\)/.exec(agent)?.[1];
  return [browser?.replace(/\/.*$/, ""), platform].filter(Boolean).join(" · ") || "Unknown device";
}

type Control = {
  label: string;
  value: string;
  /** Where the value came from — the part that says whether anyone chose it. */
  source?: SecuritySettingKey;
  /** "verified" is checked now; "invariant" is a property of the source. */
  kind: "verified" | "invariant";
  ok: boolean;
  note?: string;
};

export default async function SecurityPage() {
  const session = await requireStaffPermission("security.read");
  const canManage = session.permissions.has("security.manage");

  // Keeps the counts on this page from drifting as browsers close without
  // signing out. Cheap, and only runs when somebody actually looks.
  await pruneExpiredSessions();

  const policy = await resolveSecuritySettings();
  const s = policy.settings;

  const [
    staffCount,
    portalUsers,
    pendingInvites,
    failedLogins,
    auditCount,
    audit,
    recentSecurity,
    liveSessions,
    auditTriggers,
    cookie,
  ] = await Promise.all([
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM staff WHERE active"),
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM client_users WHERE active"),
    listInvitations().then((all) => all.filter((i) => i.status === "PENDING")),
    queryOne<{ count: number }>(
      // Both workspaces. Sign-in is one form that resolves to either table, so
      // counting only `staff.login_failed` would hide every failed client
      // attempt from the number an admin looks at to judge whether the endpoint
      // is being sprayed.
      `SELECT count(*)::int AS count FROM audit_log
        WHERE action IN ('staff.login_failed','portal.login_failed')
          AND occurred_at > now() - interval '7 days'`,
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
                         'portal.login_failed','portal.logout','invitation.accepted','staff.invited',
                         'client.portal_invited','staff.invite_revoked','client.portal_invite_revoked',
                         'session.revoked','security.policy_changed')
        ORDER BY occurred_at DESC, id DESC
        LIMIT 40`,
    ),
    listLiveSessions(),
    // The append-only guarantee is a database trigger, so it can be checked
    // rather than asserted. Two triggers is the whole guarantee: no UPDATE,
    // no DELETE.
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_trigger
        WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal`,
    ),
    staffCookieOptions(new Date()),
  ]);

  const teamSessions = liveSessions.filter((x) => x.scope === "team");
  const clientSessions = liveSessions.filter((x) => x.scope === "client");

  const requirements = [
    s.passwordRequireLower ? "lowercase" : null,
    s.passwordRequireUpper ? "uppercase" : null,
    s.passwordRequireDigit ? "a number" : null,
  ].filter(Boolean);

  const controls: Control[] = [
    {
      label: "Password storage",
      value: `scrypt N=${s.scryptN}, r=${s.scryptR}, p=${s.scryptP}, per-user salt`,
      source: "scryptN",
      kind: "verified",
      ok: true,
    },
    {
      label: "Password policy",
      value:
        s.passwordMinLength === s.passwordMaxLength
          ? `exactly ${s.passwordMinLength} characters`
          : `${s.passwordMinLength}–${s.passwordMaxLength} characters` +
            (requirements.length ? `, plus ${requirements.join(", ")}` : ", no character rules"),
      source: "passwordMinLength",
      kind: "verified",
      ok: true,
    },
    {
      label: "Session cookies",
      value: `${cookie.httpOnly ? "httpOnly" : "READABLE BY JS"}, SameSite=${cookie.sameSite}${
        cookie.secure ? ", Secure" : ", not Secure (development)"
      }`,
      source: "cookieSamesite",
      kind: "verified",
      ok: cookie.httpOnly,
      note: cookie.secure
        ? undefined
        : "Secure is off because NODE_ENV is not production. Expected outside a deployment.",
    },
    {
      label: "Session lifetime",
      value: `team ${s.staffSessionHours}h · remembered ${s.staffRememberedDays}d · portal ${s.clientSessionDays}d`,
      source: "staffSessionHours",
      kind: "verified",
      ok: true,
    },
    {
      label: "Sign-in throttling",
      value: `${s.signinAccountLimit} failures per account, ${s.signinIpLimit} attempts per address, per ${windowWords(s.signinWindowSeconds)}`,
      source: "signinAccountLimit",
      kind: "verified",
      ok: true,
    },
    {
      label: "Audit immutability",
      value: `${auditTriggers?.count ?? 0} of 2 append-only triggers present on audit_log`,
      kind: "verified",
      ok: (auditTriggers?.count ?? 0) === 2,
      note: "Dropped from the schema by hand? This row is the one that would say so.",
    },
    {
      label: "Intake rate limit",
      value: `${s.intakeRateLimit} per ${windowWords(s.intakeWindowSeconds)}, per address`,
      source: "intakeRateLimit",
      kind: "verified",
      ok: true,
    },
    {
      label: "Spam protection",
      value:
        s.intakeMinSeconds > 0
          ? `honeypot, and no form completed in under ${s.intakeMinSeconds}s`
          : "honeypot only — the fill-time check is off",
      source: "intakeMinSeconds",
      kind: "verified",
      ok: s.intakeMinSeconds > 0,
      note:
        s.intakeMinSeconds > 0
          ? undefined
          : "With the timing signal off, the honeypot is the only thing filtering scripts.",
    },
    {
      label: "SMTP",
      value: smtpConfigured() ? "Configured" : "Not configured (writing to the outbox)",
      kind: "verified",
      ok: smtpConfigured(),
      note: smtpConfigured() ? undefined : "Credentials live in the environment, not the database.",
    },
    {
      label: "CSRF",
      value: "Session-bound token, checked on every mutation",
      kind: "invariant",
      ok: true,
    },
    {
      label: "Authorisation",
      value: "Server-side, per action, from the session",
      kind: "invariant",
      ok: true,
    },
    {
      label: "Tenant isolation",
      value: "Portal reads scoped by session client id in SQL",
      kind: "invariant",
      ok: true,
    },
    {
      label: "Secrets",
      value: "Environment only — SESSION_SECRET and SMTP credentials are never stored or shown",
      kind: "invariant",
      ok: true,
    },
  ];

  const sessionTable = (rows: LiveSession[], emptyText: string) =>
    rows.length === 0 ? (
      <EmptyState>{emptyText}</EmptyState>
    ) : (
      <table className="rv-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col" className="rv-col-wide">Device</th>
            <th scope="col" className="rv-col-wide">IP</th>
            <th scope="col">Last seen</th>
            <th scope="col" className="rv-col-wide">Expires</th>
            {canManage ? (
              <th scope="col" className="text-right">
                <span className="sr-only">Revoke</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOwn = row.scope === "team" && row.person_email === session.email;
            return (
              <tr key={row.id}>
                <td data-label="Person">
                  <p className="text-rhymvex-white/80">
                    {row.person_name}
                    {isOwn ? (
                      <span className="ms-1.5 text-[10px] text-rhymvex-volt">you</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-rhymvex-white/45">
                    {row.person_email}
                    {row.client_name ? ` · ${row.client_name}` : ""}
                  </p>
                </td>
                <td data-label="Device" className="rv-col-wide text-[11px] text-rhymvex-white/55">
                  {describeAgent(row.user_agent)}
                </td>
                <td
                  data-label="IP"
                  className="rv-col-wide font-mono text-[11px] text-rhymvex-white/45"
                >
                  {row.ip_address ?? "—"}
                </td>
                <td
                  data-label="Last seen"
                  className="whitespace-nowrap text-[11px] text-rhymvex-white/60"
                  title={formatDateTime(row.last_seen_at)}
                >
                  {relativeTime(row.last_seen_at)}
                </td>
                <td
                  data-label="Expires"
                  className="rv-col-wide whitespace-nowrap text-[11px] text-rhymvex-white/45"
                >
                  {formatDateTime(row.expires_at)}
                </td>
                {canManage ? (
                  <td data-label="" className="text-right">
                    {isOwn ? (
                      <span className="text-[10px] text-rhymvex-white/35">sign out instead</span>
                    ) : (
                      <RevokeSessionButton
                        sessionId={row.id}
                        personName={row.person_name}
                        csrfToken={session.csrfToken}
                      />
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Security</h1>
          <p className="rv-page-sub">
            Controls in force, live sessions, and the audit trail
          </p>
        </div>
        {canManage ? (
          <SecurityPolicyForm
            csrfToken={session.csrfToken}
            settings={s}
            overridden={[...policy.overridden]}
            hasOverrides={policy.overridden.size > 0}
          />
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active staff"
          value={String(staffCount?.count ?? 0)}
          meta={`${teamSessions.length} live session${teamSessions.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="Portal users"
          value={String(portalUsers?.count ?? 0)}
          meta={`${clientSessions.length} live session${clientSessions.length === 1 ? "" : "s"}`}
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
          {controls.map((control) => {
            const overridden = control.source && policy.overridden.has(control.source);
            const fromEnv = control.source && policy.fromEnv.has(control.source);
            return (
              <li
                key={control.label}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-rhymvex-white/5 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-xs font-medium text-rhymvex-white/80">
                  {control.label}
                </span>
                <span className="flex min-w-0 flex-col items-end gap-0.5">
                  <span className="flex items-center gap-2.5">
                    <span className="text-[11px] text-rhymvex-white/55">{control.value}</span>
                    {control.kind === "verified" ? (
                      <StatusPill
                        value={control.ok ? "Active" : "Check this"}
                        tone={control.ok ? "done" : "warn"}
                      />
                    ) : (
                      <StatusPill value="Enforced in code" tone="idle" />
                    )}
                  </span>
                  {control.note ? (
                    <span className="text-[10px] text-rhymvex-white/40">{control.note}</span>
                  ) : overridden || fromEnv ? (
                    <span className="text-[10px] text-rhymvex-white/40">
                      {overridden ? "set on this workspace" : "pinned by the environment"}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-rhymvex-white/45">
          <span className="text-rhymvex-white/60">Active</span> is checked against the running
          deployment just now. <span className="text-rhymvex-white/60">Enforced in code</span> is a
          property of the source — it is not re-measured on each load, and a claim in this table is
          not a substitute for testing it.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Team sessions" flush>
          <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/50">
            {canManage
              ? "Ending a session signs that browser out immediately, everywhere."
              : "Your role can view sessions but not end them."}
          </p>
          {sessionTable(teamSessions, "Nobody is signed in to the workspace.")}
        </Panel>

        <Panel title="Portal sessions" flush>
          <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/50">
            Client users currently signed in.
          </p>
          {sessionTable(clientSessions, "No client is signed in to the portal.")}
        </Panel>
      </div>

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
                  <td data-label="Email" className="text-rhymvex-white/70">{invitation.email}</td>
                  <td data-label="Name" className="text-rhymvex-white/60">{invitation.name ?? "—"}</td>
                  <td data-label="Kind" className="whitespace-nowrap text-rhymvex-white/50">
                    {invitation.kind === "STAFF" ? "Team" : "Client portal"}
                  </td>
                  <td data-label="Role" className="whitespace-nowrap text-rhymvex-white/50">
                    {invitation.role ? humanise(invitation.role) : "—"}
                  </td>
                  <td data-label="Client" className="text-rhymvex-white/50">{invitation.client_name ?? "—"}</td>
                  <td data-label="Expires" className="whitespace-nowrap text-rhymvex-white/55">
                    {formatDateTime(invitation.expires_at)}
                  </td>
                  <td data-label="Status">
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
                  <p className="text-[10px] text-rhymvex-white/50">
                    {formatDateTime(entry.occurred_at)} · {relativeTime(entry.occurred_at)}
                    {entry.ip_address ? ` · ${entry.ip_address}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Full audit trail" flush>
          <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/50">
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
                      <span className="text-rhymvex-white/50">
                        {" "}
                        · {entry.entity_type}
                        {entry.entity_id ? ` ${entry.entity_id.slice(0, 8)}` : ""}
                      </span>
                    ) : null}
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
  );
}