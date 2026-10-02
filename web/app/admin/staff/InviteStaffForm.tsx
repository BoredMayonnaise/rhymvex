"use client";

import { useActionState, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { inviteStaffAction, type ActionResult } from "@/app/admin/actions";
import { PERMISSIONS, ROLES, describeRole, type Role } from "@/lib/auth/rbac";
import { humanise } from "@/lib/format";

/**
 * Invite a team member.
 *
 * The permission set is chosen here, but it is only a *proposal*: the role's own
 * grant is applied server-side at acceptance time, and the action validates every
 * key against the known permission list before storing it.
 */
export function InviteStaffForm({ csrfToken, invitedBy }: { csrfToken: string; invitedBy: string }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(ROLES[2]);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    inviteStaffAction,
    null,
  );

  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Invite a team member</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rv-btn rv-btn-primary rv-btn-sm"
          aria-expanded={open}
        >
          {open ? (
            <X className="size-3.5" aria-hidden="true" />
          ) : (
            <UserPlus className="size-3.5" aria-hidden="true" />
          )}
          {open ? "Close" : "New invitation"}
        </button>
      </header>

      {open ? (
        <div className="rv-panel-body">
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="csrf" value={csrfToken} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="staff-name" className="rv-label">Name</label>
                <input id="staff-name" name="name" type="text" required className="rv-input" />
                {state && !state.ok && state.fields?.name ? (
                  <p className="rv-error">{state.fields.name}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="staff-email" className="rv-label">Email</label>
                <input
                  id="staff-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  className="rv-input"
                />
                {state && !state.ok && state.fields?.email ? (
                  <p className="rv-error">{state.fields.email}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="staff-role" className="rv-label">Role</label>
                <select
                  id="staff-role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="rv-select"
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {humanise(value)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-rhymvex-white/50">
                  {describeRole(role)}
                </p>
              </div>
              <div>
                <label htmlFor="staff-expiry" className="rv-label">Link valid for</label>
                <select
                  id="staff-expiry"
                  name="expires_in_hours"
                  defaultValue="72"
                  className="rv-select"
                >
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
              </div>
            </div>

            {/* Extra permissions on top of the role grant. Empty by default,
                because a role should normally be enough. */}
            <fieldset>
              <legend className="rv-label mb-2">
                Additional permissions (on top of the role)
              </legend>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {PERMISSIONS.map((permission) => (
                  <label
                    key={permission}
                    className="flex cursor-pointer items-center gap-2 rounded border border-rhymvex-white/8 px-2.5 py-1.5 text-[11px] text-rhymvex-white/60 transition-colors hover:border-rhymvex-white/20 has-[:checked]:border-rhymvex-volt/50 has-[:checked]:text-rhymvex-white"
                  >
                    <input
                      type="checkbox"
                      name="permissions"
                      value={permission}
                      className="size-3.5 accent-rhymvex-volt"
                    />
                    {permission}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/50">
              The invitation link works once, expires on its own, and cannot be used to sign in
              until the recipient sets a password. Only the link&apos;s hash is stored.
            </p>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="size-3.5" aria-hidden="true" />
                )}
                Send invitation
              </button>
              {state ? (
                <p
                  role="status"
                  className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
                >
                  {state.ok ? state.message : state.error}
                </p>
              ) : null}
            </div>

            <p className="m-0 text-[11px] text-rhymvex-white/50">Invited by {invitedBy}</p>
          </form>
        </div>
      ) : null}
    </div>
  );
}
