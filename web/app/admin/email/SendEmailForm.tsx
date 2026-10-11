"use client";

import { useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
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
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sendBusinessEmailAction,
    null,
  );

  return (
    <FormModal
      trigger={(open) => (
        <button type="button" onClick={open} className="rv-btn rv-btn-ghost rv-btn-sm">
          <Send className="size-3.5" aria-hidden="true" />
          New message
        </button>
      )}
      title="Compose"
      eyebrow="Business email"
      success={state?.ok === true}
    >
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
                <p id="biz-to-help" className="mt-1 text-[10px] text-rhymvex-white/50">
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

            <p className="m-0 text-[11px] text-rhymvex-white/50">
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
    </FormModal>
  );
}
