import { requireStaffPermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/session";
import { listStaff } from "@/lib/data/workspace";
import { listInvitations } from "@/lib/auth/invitations";
import { formatDate, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, Stat, StatusPill, invitationStatusTone } from "@/components/ui/primitives";
import { describeRole, ROLES } from "@/lib/auth/rbac";
import { InviteStaffForm } from "./InviteStaffForm";
import { RevokeInviteButton } from "./RevokeInviteButton";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireStaffPermission("staff.read");
  const [staff, invitations] = await Promise.all([listStaff(), listInvitations("STAFF")]);

  const staffInvites = invitations.filter((i) => i.status === "PENDING");
  const history = invitations.filter((i) => i.status !== "PENDING").slice(0, 20);

  const canInvite = can(session, "staff.invite");
  const canManage = can(session, "staff.manage");

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Staff &amp; Access</h1>
          <p className="rv-page-sub">
            {staff.filter((s) => s.active).length} active · {staffInvites.length} pending invitation
            {staffInvites.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active staff"
          value={String(staff.filter((s) => s.active).length)}
          meta={`${staff.filter((s) => !s.active).length} disabled`}
        />
        <Stat
          label="Open leads"
          value={String(staff.reduce((s, m) => s + m.open_leads, 0))}
          meta="across the team"
        />
        <Stat
          label="Active projects"
          value={String(staff.reduce((s, m) => s + m.active_projects, 0))}
          meta="in delivery"
        />
        <Stat
          label="Pending invites"
          value={String(staffInvites.length)}
          meta="expire on their own"
        />
      </div>

      {canInvite ? (
        <InviteStaffForm csrfToken={session.csrfToken} invitedBy={session.name} />
      ) : null}

      <Panel title="Team" flush>
        <div className="overflow-x-auto">
          <table className="rv-table">
            <caption className="sr-only">Team members</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Leads</th>
                <th scope="col" className="text-right">Projects</th>
                <th scope="col" className="text-right">Tasks</th>
                <th scope="col">Last seen</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <p className="font-medium text-rhymvex-white">{member.name}</p>
                    <p className="mt-0.5 text-[11px] text-rhymvex-white/50">{member.email}</p>
                    {member.title ? (
                      <p className="text-[11px] text-rhymvex-white/50">{member.title}</p>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill
                      value={humanise(member.role)}
                      tone={member.role === "ADMIN" ? "active" : "idle"}
                    />
                  </td>
                  <td>
                    <StatusPill
                      value={member.active ? "Active" : "Disabled"}
                      tone={member.active ? "done" : "idle"}
                    />
                  </td>
                  <td className="rv-table-num text-right text-rhymvex-white/70">{member.open_leads}</td>
                  <td className="rv-table-num text-right text-rhymvex-white/70">
                    {member.active_projects}
                  </td>
                  <td className="rv-table-num text-right text-rhymvex-white/70">
                    {member.open_tasks}
                  </td>
                  <td className="whitespace-nowrap text-rhymvex-white/55">
                    {member.last_login_at ? relativeTime(member.last_login_at) : "never"}
                  </td>
                  <td className="text-right">
                    {/* Marks your own row and nothing else.
                        This used to render the word "manage" for anyone holding
                        `staff.manage`, which read as a control. There is no
                        role-change or deactivate action behind it, so it
                        promised something the page cannot do. Changing a role
                        also has to rotate that person's sessions, which is a
                        deliberate piece of work rather than a label — until it
                        exists, this cell says only what is true. Revoking a
                        pending invitation below is a real action and stays. */}
                    {member.id === session.staffId ? (
                      <span className="text-[11px] text-rhymvex-volt">You</span>
                    ) : (
                      <span className="text-[11px] text-rhymvex-white/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Pending invitations" flush>
        {staffInvites.length === 0 ? (
          <EmptyState>No outstanding invitations.</EmptyState>
        ) : (
          <ul>
            {staffInvites.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-rhymvex-white">
                    {invitation.name} · {invitation.email}
                  </p>
                  <p className="text-[11px] text-rhymvex-white/50">
                    {humanise(invitation.role)} · invited by {invitation.created_by_name ?? "an admin"}{" "}
                    · expires {formatDate(invitation.expires_at)}
                  </p>
                </div>
                <StatusPill
                  value={humanise(invitation.status)}
                  tone={invitationStatusTone(invitation.status)}
                />
                {canManage ? (
                  <RevokeInviteButton invitationId={invitation.id} csrfToken={session.csrfToken} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {history.length > 0 ? (
        <Panel title="Invitation history" flush>
          <ul>
            {history.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-rhymvex-white/70">
                    {invitation.name ?? "—"} · {invitation.email}
                  </p>
                  <p className="text-[10px] text-rhymvex-white/50">
                    {invitation.role ? `${humanise(invitation.role)} · ` : ""}
                    invited {relativeTime(invitation.created_at)}
                  </p>
                </div>
                <StatusPill
                  value={humanise(invitation.status)}
                  tone={invitationStatusTone(invitation.status)}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="What each role can do">
        <p className="mb-3 text-[11px] leading-relaxed text-rhymvex-white/50">
          Permissions are resolved on the server for every action. Hiding a link is a
          convenience, not the control.
        </p>
        <ul className="flex flex-col gap-2.5">
          {ROLES.map((role) => (
            <li key={role} className="border-b border-rhymvex-white/5 pb-2.5 last:border-b-0 last:pb-0">
              <p className="text-xs font-semibold text-rhymvex-volt">{humanise(role)}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-rhymvex-white/55">
                {describeRole(role)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
