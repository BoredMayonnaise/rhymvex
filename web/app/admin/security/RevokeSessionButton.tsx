"use client";

import { useActionState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { revokeSessionAction, type ActionResult } from "@/app/admin/actions";

/**
 * End one live session.
 *
 * A form with a submit rather than a button that fires on click: ending a
 * session is not undoable, and a mis-click should cost a confirmation rather
 * than somebody's access.
 */
export function RevokeSessionButton({
  sessionId,
  personName,
  csrfToken,
}: {
  sessionId: string;
  personName: string;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    revokeSessionAction,
    null,
  );

  return (
    <form action={formAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="session_id" value={sessionId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-rhymvex-white/45 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-ember disabled:opacity-40"
        title={`End ${personName}'s session`}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <XCircle className="size-3.5" aria-hidden="true" />
        )}
        End
      </button>
      {state && !state.ok ? (
        <span role="alert" className="text-[10px] text-rhymvex-ember">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}