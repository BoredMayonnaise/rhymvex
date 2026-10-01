"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  FilePlus2,
  Loader2,
  Mail,
  UserPlus,
  X,
} from "lucide-react";
import {
  convertLeadToClientAction,
  createBookingForLeadAction,
  createProposalForLeadAction,
  sendLeadEmailAction,
  updateLeadStatusAction,
  type ActionResult,
} from "@/app/admin/actions";
import type { Lead } from "@/lib/data/leads";

/**
 * Lead actions.
 *
 * One row of buttons that each open a panel, rather than a wall of forms. The
 * common case is "assign and move on", and that has to be a single click.
 *
 * Each panel submits a server action that re-checks permission and CSRF. The
 * `can*` props only decide what is rendered; they are not the authorisation.
 */

const STATUSES: Array<{ value: string; label: string }> = [
  { value: "RECEIVED", label: "Received" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONSULTATION", label: "Consultation" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "DECLINED", label: "Declined" },
  { value: "ARCHIVED", label: "Archived" },
];

const MODELS = [
  { value: "", label: "Not decided yet" },
  { value: "BRAND_SPRINT", label: "Brand Sprint" },
  { value: "BRAND_SYSTEM", label: "Brand System" },
  { value: "RHYTHM_RETAINER", label: "Rhythm Retainer" },
  { value: "CUSTOM", label: "Custom engagement" },
];

type Panel = "status" | "note" | "convert" | "booking" | "proposal" | "email" | null;

export function LeadActions({
  lead,
  staff,
  canWrite,
  canAssign,
  canPropose,
  canBook,
  canEmail,
  canConvert,
  csrfToken,
}: {
  lead: Lead;
  staff: Array<{ id: string; name: string }>;
  canWrite: boolean;
  canAssign: boolean;
  canPropose: boolean;
  canBook: boolean;
  canEmail: boolean;
  canConvert: boolean;
  csrfToken: string;
}) {
  const [panel, setPanel] = useState<Panel>(null);

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canAssign || canWrite ? (
          <button
            type="button"
            onClick={() => toggle("status")}
            className="rv-btn rv-btn-ghost rv-btn-sm"
            aria-expanded={panel === "status"}
          >
            Assign &amp; status
          </button>
        ) : null}
        {canEmail ? (
          <button
            type="button"
            onClick={() => toggle("email")}
            className="rv-btn rv-btn-ghost rv-btn-sm"
            aria-expanded={panel === "email"}
          >
            <Mail className="size-3.5" aria-hidden="true" />
            Send email
          </button>
        ) : null}
        {canBook ? (
          <button
            type="button"
            onClick={() => toggle("booking")}
            className="rv-btn rv-btn-ghost rv-btn-sm"
            aria-expanded={panel === "booking"}
          >
            <CalendarPlus className="size-3.5" aria-hidden="true" />
            Schedule
          </button>
        ) : null}
        {canPropose ? (
          <button
            type="button"
            onClick={() => toggle("proposal")}
            className="rv-btn rv-btn-ghost rv-btn-sm"
            aria-expanded={panel === "proposal"}
          >
            <FilePlus2 className="size-3.5" aria-hidden="true" />
            Proposal
          </button>
        ) : null}
        {!lead.client_id && canConvert ? (
          <button
            type="button"
            onClick={() => toggle("convert")}
            className="rv-btn rv-btn-primary rv-btn-sm"
            aria-expanded={panel === "convert"}
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            Create client
          </button>
        ) : null}
      </div>

      {panel ? (
        <div className="mt-3 rounded-xl border border-rhymvex-white/10 bg-rhymvex-slate/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="rv-panel-title">
              {panel === "status" && "Assign and set status"}
              {panel === "convert" && "Create a client from this lead"}
              {panel === "booking" && "Schedule a consultation"}
              {panel === "proposal" && "Create a proposal"}
              {panel === "email" && "Send an email"}
            </p>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
              className="text-rhymvex-white/40 hover:text-rhymvex-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {panel === "status" ? (
            <StatusForm lead={lead} staff={staff} csrfToken={csrfToken} onDone={() => setPanel(null)} />
          ) : null}
          {panel === "convert" ? (
            <ConvertForm lead={lead} staff={staff} csrfToken={csrfToken} />
          ) : null}
          {panel === "booking" ? (
            <BookingForm lead={lead} staff={staff} csrfToken={csrfToken} onDone={() => setPanel(null)} />
          ) : null}
          {panel === "proposal" ? (
            <ProposalForm lead={lead} csrfToken={csrfToken} onDone={() => setPanel(null)} />
          ) : null}
          {panel === "email" ? (
            <EmailForm lead={lead} csrfToken={csrfToken} onDone={() => setPanel(null)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`mt-3 text-xs ${result.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
    >
      {result.ok ? result.message : result.error}
    </p>
  );
}

function StatusForm({
  lead,
  staff,
  csrfToken,
  onDone,
}: {
  lead: Lead;
  staff: Array<{ id: string; name: string }>;
  csrfToken: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateLeadStatusAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={lead.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="rv-label">Status</label>
          <select id="status" name="status" defaultValue={lead.status} className="rv-select">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assigned_to" className="rv-label">Assigned to</label>
          <select id="assigned_to" name="assigned_to" defaultValue={lead.assigned_to ?? ""} className="rv-select">
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recommended_model" className="rv-label">Recommended engagement</label>
          <select
            id="recommended_model"
            name="recommended_model"
            defaultValue={lead.recommended_model ?? ""}
            className="rv-select"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="estimated_value" className="rv-label">Estimated value</label>
          <input
            id="estimated_value"
            name="estimated_value"
            type="number"
            min="0"
            step="100"
            defaultValue={lead.estimated_value ?? ""}
            placeholder="0"
            className="rv-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="lost_reason" className="rv-label">
          If lost or declined, why
        </label>
        <input
          id="lost_reason"
          name="lost_reason"
          type="text"
          defaultValue={lead.lost_reason ?? ""}
          placeholder="Budget, timing, went elsewhere…"
          className="rv-input"
        />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Save
        </button>
        {state?.ok ? (
          <button type="button" onClick={onDone} className="text-[11px] text-rhymvex-white/40 hover:text-rhymvex-white">
            Close
          </button>
        ) : null}
      </div>
      <ResultLine result={state} />
    </form>
  );
}

function ConvertForm({
  lead,
  staff,
  csrfToken,
}: {
  lead: Lead;
  staff: Array<{ id: string; name: string }>;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    convertLeadToClientAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={lead.id} />

      <p className="m-0 rounded-lg border border-rhymvex-volt/25 bg-rhymvex-volt/[0.06] p-3 text-xs leading-relaxed text-rhymvex-white/65">
        This marks the lead as won, links the two records, and makes {lead.name} the primary
        contact. It does not send anything to the client on its own.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="rv-label">Client name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={lead.company ?? lead.name}
            className="rv-input"
          />
        </div>
        <div>
          <label htmlFor="legal_name" className="rv-label">Legal name</label>
          <input id="legal_name" name="legal_name" type="text" defaultValue={lead.company ?? ""} className="rv-input" />
        </div>
        <div>
          <label htmlFor="industry" className="rv-label">Industry</label>
          <input id="industry" name="industry" type="text" placeholder="Coffee retail" className="rv-input" />
        </div>
        <div>
          <label htmlFor="account_manager" className="rv-label">Account manager</label>
          <select id="account_manager" name="account_manager" defaultValue="" className="rv-select">
            <option value="">Me</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="engagement_model" className="rv-label">Engagement model</label>
          <select id="engagement_model" name="engagement_model" defaultValue="" className="rv-select">
            {MODELS.filter((m) => m.value).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="engagement_name" className="rv-label">Engagement name</label>
          <input
            id="engagement_name"
            name="engagement_name"
            type="text"
            placeholder="Leave blank to use the model name"
            className="rv-input"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm self-start">
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-3.5" aria-hidden="true" />}
        Create client record
      </button>
      <ResultLine result={state} />
    </form>
  );
}

function BookingForm({
  lead,
  staff,
  csrfToken,
  onDone,
}: {
  lead: Lead;
  staff: Array<{ id: string; name: string }>;
  csrfToken: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createBookingForLeadAction,
    null,
  );

  // Default to tomorrow, 10:00 UTC, as a usable starting point.
  const tomorrow = new Date(Date.now() + 86400_000);
  tomorrow.setUTCHours(10, 0, 0, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={lead.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="rv-label">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue="Discovery consultation"
            className="rv-input"
          />
        </div>
        <div>
          <label htmlFor="kind" className="rv-label">Kind</label>
          <select id="kind" name="kind" defaultValue="DISCOVERY" className="rv-select">
            {["DISCOVERY", "CONSULTATION", "REVIEW", "WORKSHOP", "CHECK_IN", "OTHER"].map((k) => (
              <option key={k} value={k}>
                {k.charAt(0) + k.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scheduled_for" className="rv-label">When (UTC)</label>
          <input
            id="scheduled_for"
            name="scheduled_for"
            type="datetime-local"
            required
            defaultValue={tomorrow.toISOString().slice(0, 16)}
            className="rv-input"
          />
        </div>
        <div>
          <label htmlFor="duration_mins" className="rv-label">Minutes</label>
          <input
            id="duration_mins"
            name="duration_mins"
            type="number"
            min="15"
            max="480"
            step="15"
            defaultValue="45"
            className="rv-input"
          />
        </div>
        <div>
          <label htmlFor="host_id" className="rv-label">Host</label>
          <select id="host_id" name="host_id" defaultValue="" className="rv-select">
            <option value="">Me</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location" className="rv-label">Where</label>
          <input id="location" name="location" type="text" defaultValue="Video call" className="rv-input" />
        </div>
      </div>

      <div>
        <label htmlFor="agenda" className="rv-label">Agenda</label>
        <textarea id="agenda" name="agenda" rows={3} placeholder="What this call needs to cover" className="rv-textarea" />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Schedule
        </button>
        {state?.ok ? (
          <button type="button" onClick={onDone} className="text-[11px] text-rhymvex-white/40 hover:text-rhymvex-white">
            Close
          </button>
        ) : null}
      </div>
      <ResultLine result={state} />
    </form>
  );
}

function ProposalForm({
  lead,
  csrfToken,
  onDone,
}: {
  lead: Lead;
  csrfToken: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createProposalForLeadAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={lead.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="rv-label">Title</label>
          <input id="title" name="title" type="text" required defaultValue="Brand System" className="rv-input" />
        </div>
        <div>
          <label htmlFor="model" className="rv-label">Model</label>
          <select id="model" name="model" defaultValue="" className="rv-select">
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="investment" className="rv-label">Investment</label>
          <input id="investment" name="investment" type="number" min="0" step="100" placeholder="7800" className="rv-input" />
        </div>
        <div>
          <label htmlFor="timeline" className="rv-label">Timeline</label>
          <input id="timeline" name="timeline" type="text" placeholder="6–8 weeks" className="rv-input" />
        </div>
      </div>

      <div>
        <label htmlFor="summary" className="rv-label">Summary</label>
        <textarea id="summary" name="summary" rows={2} className="rv-textarea" />
      </div>
      <div>
        <label htmlFor="scope" className="rv-label">Scope</label>
        <textarea id="scope" name="scope" rows={3} className="rv-textarea" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="deliverables" className="rv-label">Deliverables, one per line</label>
          <textarea id="deliverables" name="deliverables" rows={4} className="rv-textarea" />
        </div>
        <div>
          <label htmlFor="exclusions" className="rv-label">Exclusions, one per line</label>
          <textarea id="exclusions" name="exclusions" rows={4} className="rv-textarea" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Create draft
        </button>
        {state?.ok ? (
          <button type="button" onClick={onDone} className="text-[11px] text-rhymvex-white/40 hover:text-rhymvex-white">
            Close
          </button>
        ) : null}
      </div>
      <ResultLine result={state} />
    </form>
  );
}

function EmailForm({
  lead,
  csrfToken,
  onDone,
}: {
  lead: Lead;
  csrfToken: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sendLeadEmailAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="lead_id" value={lead.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="to" className="rv-label">To</label>
          <input
            id="to"
            name="to"
            type="text"
            required
            defaultValue={lead.email}
            className="rv-input"
          />
        </div>
        <div>
          <label htmlFor="cc" className="rv-label">Cc</label>
          <input id="cc" name="cc" type="text" placeholder="Optional" className="rv-input" />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="rv-label">Subject</label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          placeholder="Following up on your brand system enquiry"
          className="rv-input"
        />
      </div>

      <div>
        <label htmlFor="body" className="rv-label">Message</label>
        <textarea id="body" name="body" rows={7} required className="rv-textarea" />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Send
        </button>
        {state?.ok ? (
          <button type="button" onClick={onDone} className="text-[11px] text-rhymvex-white/40 hover:text-rhymvex-white">
            Close
          </button>
        ) : null}
      </div>
      <ResultLine result={state} />
    </form>
  );
}
