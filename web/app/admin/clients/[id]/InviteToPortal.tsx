"use client";

import { useActionState, useState } from "react";
import { Ban, Loader2, Send, UserPlus, X } from "lucide-react";
import { inviteToPortalAction, revokeInvitationAction, type ActionResult } from "@/app/admin/actions";
import {
  EmptyState,
  StatusPill,
  invitationStatusTone,
} from "@/components/ui/primitives";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";

/**
 * Invite a client contact to the portal.
 *
 * The invite link is single-use and expiring, and the database only ever holds
 * its SHA-256 digest. The raw token exists solely inside the invitation email,
 * so it is displayed here only in the one case where SMTP is unconfigured and
 * the link would otherwise be unrecoverable.
 */
export function InviteToPortal({
  clientId,
  clientName,
  csrfToken,
  existingUsers,
  invitations,
}: {
  clientId: string;
  clientName: string;
  csrfToken: string;
  existingUsers: Array<{ id: string; name: string; email: string; active: boolean }>;
  invitations: Array<{
    id: string;
    email: string;
    name: string | null;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
    expires_at: string | Date;
    accepted_at: string | Date | null;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [inviteState, inviteAction, inviting] = useActionState<ActionResult | null, FormData>(
    inviteToPortalAction,
    null,
  );

  const alreadyHasAccess = (email: string) =>
    existingUsers.some((u) => u.email.toLowerCase() === email.toLowerCase());

  return (
    <div className={open ? "w-full" : "w-full sm:w-auto"}>
      <div className="flex sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rv-btn rv-btn-primary rv-btn-sm w-full sm:w-auto"
          aria-expanded={open}
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          Invite to portal
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-xl border border-rhymvex-white/10 bg-rhymvex-slate/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="rv-panel-title">Give {clientName} portal access</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-rhymvex-white/50 hover:text-rhymvex-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <form action={inviteAction} className="flex flex-col gap-3">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="client_id" value={clientId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="invite-name" className="rv-label">Name</label>
                <input id="invite-name" name="name" type="text" required className="rv-input" />
              </div>
              <div>
                <label htmlFor="invite-email" className="rv-label">Email</label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  className="rv-input"
                />
              </div>
              <div>
                <label htmlFor="invite-role" className="rv-label">Role</label>
                <input
                  id="invite-role"
                  name="role_title"
                  type="text"
                  placeholder="Founder, Marketing lead…"
                  className="rv-input"
                />
              </div>
              <div>
                <label htmlFor="invite-expiry" className="rv-label">Link valid for</label>
                <select
                  id="invite-expiry"
                  name="expires_in_hours"
                  defaultValue="168"
                  className="rv-select"
                >
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="336">14 days</option>
                </select>
              </div>
            </div>

            <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/50">
              The link works once and then stops. The recipient chooses their own password.
            </p>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={inviting} className="rv-btn rv-btn-primary rv-btn-sm">
                {inviting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                Send invitation
              </button>
              {inviteState ? (
                <p
                  role="status"
                  className={`text-[11px] ${inviteState.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
                >
                  {inviteState.ok ? inviteState.message : inviteState.error}
                </p>
              ) : null}
            </div>
          </form>

          {/* Invitation history, so a repeated send or a stale link is explainable. */}
          <div className="mt-4 border-t border-rhymvex-white/8 pt-3">
            <p className="rv-panel-title mb-2">Invitations sent</p>
            {invitations.length === 0 ? (
              <EmptyState>None sent yet.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-2 rounded border border-rhymvex-white/8 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-rhymvex-white/70">
                        {invitation.name ?? "—"} · {invitation.email}
                      </span>
                      <span className="block text-[10px] text-rhymvex-white/50">
                        {invitation.status === "PENDING"
                          ? `expires ${formatDateTime(invitation.expires_at)}`
                          : invitation.status === "ACCEPTED" && invitation.accepted_at
                            ? `accepted ${relativeTime(invitation.accepted_at)}`
                            : humanise(invitation.status)}
                        {alreadyHasAccess(invitation.email) ? " · already has access" : ""}
                      </span>
                    </span>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <StatusPill
                        value={humanise(invitation.status)}
                        tone={invitationStatusTone(invitation.status)}
                      />
                      <RevokeButton invitationId={invitation.id} csrfToken={csrfToken} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RevokeButton({ invitationId, csrfToken }: { invitationId: string; csrfToken: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    revokeInvitationAction,
    null,
  );

  if (state?.ok) return null;

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="invitation_id" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 text-[10px] text-rhymvex-white/50 transition-colors hover:text-rhymvex-ember"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <Ban className="size-3" aria-hidden="true" />
        )}
        Withdraw
      </button>
      {state && !state.ok ? (
        <span className="text-[10px] text-rhymvex-ember">{state.error}</span>
      ) : null}
    </form>
  );
}
