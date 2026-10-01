"use client";

import { useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendPortalMessageAction, type PortalActionResult } from "@/app/portal/actions";

/**
 * Send a message to the Rhymvex team.
 *
 * The client id is taken from the session on the server, never from a form
 * field, so there is no way to post into another client's thread.
 */
export function MessageComposer({ csrfToken }: { csrfToken: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PortalActionResult | null, FormData>(
    sendPortalMessageAction,
    null,
  );

  if (state?.ok) {
    return (
      <p
        role="status"
        className="rounded-lg border border-rhymvex-volt/30 bg-rhymvex-volt/[0.06] px-4 py-3 text-sm text-rhymvex-volt"
      >
        Sent. It&apos;s with the team now.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rv-btn rv-btn-primary rv-btn-sm self-start"
      >
        <Send className="size-3.5" aria-hidden="true" />
        New message
      </button>
    );
  }

  return (
    <form action={formAction} className="rv-panel">
      <div className="rv-panel-body flex flex-col gap-3">
        <input type="hidden" name="csrf" value={csrfToken} />

        <div>
          <label htmlFor="msg-subject" className="rv-label">Subject</label>
          <input
            id="msg-subject"
            name="subject"
            type="text"
            placeholder="What is this about?"
            className="rv-input"
          />
        </div>

        <div>
          <label htmlFor="msg-body" className="rv-label">Message</label>
          <textarea
            id="msg-body"
            name="body"
            rows={6}
            required
            placeholder="Tell us what's on your mind. Questions, changes, something that needs deciding."
            className="rv-textarea"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
            Send
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-rhymvex-white/40 hover:text-rhymvex-white"
          >
            Cancel
          </button>
          {state && !state.ok ? (
            <p role="alert" className="text-[11px] text-rhymvex-ember">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
