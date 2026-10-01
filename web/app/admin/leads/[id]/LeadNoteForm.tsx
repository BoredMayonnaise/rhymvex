"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { addLeadNoteAction, type ActionResult } from "@/app/admin/actions";

/**
 * Internal note composer.
 *
 * Separate from the other action panels because notes are the most frequent
 * interaction on a lead and deserve to be one keystroke away rather than
 * behind a button.
 */
export function LeadNoteForm({ leadId, csrfToken }: { leadId: string; csrfToken: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addLeadNoteAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={leadId} />
      <label htmlFor="note-body" className="sr-only">
        Internal note
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={2}
        required
        placeholder="What did they say? What did you agree? What is the next step?"
        className="rv-textarea min-h-[4.5rem]"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-ghost rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Add note
        </button>
        {state ? (
          <p role="status" className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}>
            {state.ok ? state.message : state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
