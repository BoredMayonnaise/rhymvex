"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Loader2, Mail as MailIcon } from "lucide-react";
import { sendLeadEmailAction, type ActionResult } from "@/app/admin/actions";
import { EmptyState, StatusPill, emailStatusTone } from "@/components/ui/primitives";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import type { EmailRecord } from "@/lib/data/email";

/**
 * Email thread for a lead.
 *
 * Shows the whole history, internal alerts included, because this is a staff
 * view of a conversation. The portal reads the same records through a filter
 * that excludes anything marked internal.
 */
export function EmailThread({
  leadId,
  leadEmail,
  leadName,
  emails,
  canSend,
  csrfToken,
}: {
  leadId: string;
  leadEmail: string;
  leadName: string;
  emails: EmailRecord[];
  canSend: boolean;
  csrfToken: string;
}) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Emails</h2>
        {canSend ? (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="rv-btn rv-btn-ghost rv-btn-sm"
            aria-expanded={composing}
          >
            <MailIcon className="size-3.5" aria-hidden="true" />
            Compose
          </button>
        ) : null}
      </header>

      <div className="rv-panel-body">
        {composing && canSend ? (
          <Compose leadId={leadId} leadEmail={leadEmail} leadName={leadName} csrfToken={csrfToken} onDone={() => setComposing(false)} />
        ) : null}

        {emails.length === 0 ? (
          <EmptyState>No email sent or received yet.</EmptyState>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {emails.map((email) => (
              <li key={email.id}>
                <details className="rounded-lg border border-rhymvex-white/8">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5 px-3.5 py-2.5">
                    <span
                      className={`rv-status ${email.direction === "OUTBOUND" ? "" : ""}`}
                      data-tone={email.direction === "OUTBOUND" ? "active" : "idle"}
                    >
                      <span className="rv-status-dot" aria-hidden="true" />
                      {email.direction === "OUTBOUND" ? "Out" : "In"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-rhymvex-white">
                      {email.subject}
                    </span>
                    {!email.client_visible ? (
                      <span className="rounded-full border border-rhymvex-ember/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-rhymvex-ember">
                        Internal
                      </span>
                    ) : null}
                    <StatusPill value={humanise(email.status)} tone={emailStatusTone(email.status)} />
                    <span className="text-[10px] text-rhymvex-white/50" title={formatDateTime(email.created_at)}>
                      {relativeTime(email.created_at)}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-rhymvex-white/50" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-rhymvex-white/8 px-3.5 py-3">
                    <p className="mb-2 text-[11px] text-rhymvex-white/50">
                      From {email.from_address} · To {email.to_addresses.join(", ")}
                      {email.cc_addresses.length ? ` · Cc ${email.cc_addresses.join(", ")}` : ""}
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-rhymvex-white/70">
                      {email.body_text}
                    </pre>
                    {email.error_message ? (
                      <p className="mt-2 text-[11px] text-rhymvex-ember">
                        Delivery failed: {email.error_message}
                      </p>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Compose({
  leadId,
  leadEmail,
  leadName,
  csrfToken,
  onDone,
}: {
  leadId: string;
  leadEmail: string;
  leadName: string;
  csrfToken: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sendLeadEmailAction,
    null,
  );

  return (
    <form action={formAction} className="mb-4 flex flex-col gap-3 rounded-lg border border-rhymvex-volt/25 bg-rhymvex-volt/[0.04] p-3.5">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={leadId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="thread-to" className="rv-label">To</label>
          <input id="thread-to" name="to" type="text" required defaultValue={leadEmail} className="rv-input" />
        </div>
        <div>
          <label htmlFor="thread-cc" className="rv-label">Cc</label>
          <input id="thread-cc" name="cc" type="text" placeholder="Optional" className="rv-input" />
        </div>
      </div>
      <div>
        <label htmlFor="thread-subject" className="rv-label">Subject</label>
        <input
          id="thread-subject"
          name="subject"
          type="text"
          required
          placeholder={`Following up, ${leadName.split(" ")[0]}`}
          className="rv-input"
        />
      </div>
      <div>
        <label htmlFor="thread-body" className="rv-label">Message</label>
        <textarea id="thread-body" name="body" rows={8} required className="rv-textarea" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Send
        </button>
        {state ? (
          <p role="status" className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}>
            {state.ok ? state.message : state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <button type="button" onClick={onDone} className="text-[11px] text-rhymvex-white/50 hover:text-rhymvex-white">
            Close
          </button>
        ) : null}
      </div>
    </form>
  );
}
