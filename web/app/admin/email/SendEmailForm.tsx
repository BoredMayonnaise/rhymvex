"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Loader2, Send } from "lucide-react";
import { sendBusinessEmailAction, type ActionResult } from "@/app/admin/actions";

/**
 * Compose from the inbox.
 *
 * Optional, not required: the point of Business Email is that messages sent
 * from a lead, client or proposal are already recorded against that record. This
 * is for the message that has no existing thread to hang off.
 */
export function SendEmailForm({
  csrfToken,
  actorName,
  replyTo,
}: {
  csrfToken: string;
  actorName: string;
  replyTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sendBusinessEmailAction,
    null,
  );

  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Compose</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rv-btn rv-btn-ghost rv-btn-sm"
          aria-expanded={open}
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {open ? "Close" : "New message"}
        </button>
      </header>

      {open ? (
        <div className="rv-panel-body">
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="csrf" value={csrfToken} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="biz-to" className="rv-label">To</label>
                <input
                  id="biz-to"
                  name="to"
                  type="text"
                  required
                  placeholder="someone@company.com"
                  aria-describedby="biz-to-help"
                  className="rv-input"
                />
                <p id="biz-to-help" className="mt-1 text-[10px] text-rhymvex-white/30">
                  Separate multiple addresses with commas.
                </p>
              </div>
              <div>
                <label htmlFor="biz-cc" className="rv-label">Cc</label>
                <input id="biz-cc" name="cc" type="text" placeholder="Optional" className="rv-input" />
              </div>
            </div>

            <div>
              <label htmlFor="biz-subject" className="rv-label">Subject</label>
              <input id="biz-subject" name="subject" type="text" required className="rv-input" />
            </div>

            <div>
              <label htmlFor="biz-body" className="rv-label">Message</label>
              <textarea
                id="biz-body"
                name="body"
                rows={10}
                required
                className="rv-textarea"
                defaultValue={`Hi,\n\n`}
              />
            </div>

            <p className="m-0 text-[11px] text-rhymvex-white/30">
              Sending as {actorName} · {replyTo}
            </p>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                Send
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
          </form>
        </div>
      ) : null}
    </div>
  );
}
