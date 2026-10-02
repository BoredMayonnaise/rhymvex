"use client";

import { useActionState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { revokeInvitationAction, type ActionResult } from "@/app/admin/actions";

/**
 * Withdraw a pending invitation.
 *
 * The token stops working immediately; the invitation row is kept as REVOKED so
 * the history stays truthful rather than the record disappearing.
 */
export function RevokeInviteButton({
  invitationId,
  csrfToken,
}: {
  invitationId: string;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    revokeInvitationAction,
    null,
  );

  if (state?.ok) {
    return <span className="text-[10px] text-rhymvex-volt">withdrawn</span>;
  }

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
