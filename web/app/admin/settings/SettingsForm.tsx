"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateSettingsAction, type ActionResult } from "@/app/admin/actions";
import type { OrgSettings } from "@/lib/data/org";

/**
 * Settings form.
 *
 * The SLA field is the consequential one, so it says plainly what changing it
 * does. Everything else is ordinary organisation data.
 */
export function SettingsForm({
  settings,
  slaMinutes,
  csrfToken,
}: {
  settings: OrgSettings;
  slaMinutes: number | null;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateSettingsAction,
    null,
  );
  const fields = state && !state.ok ? state.fields : undefined;

  return (
    <form action={formAction} className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Organisation</h2>
      </header>

      <div className="rv-panel-body flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrfToken} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="rv-label">Company name</label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              defaultValue={settings.company_name}
              className="rv-input"
            />
            {fields?.company_name ? <p className="rv-error">{fields.company_name}</p> : null}
          </div>
          <div>
            <label htmlFor="currency" className="rv-label">Currency</label>
            <input
              id="currency"
              name="currency"
              type="text"
              required
              maxLength={8}
              defaultValue={settings.currency}
              className="rv-input"
            />
          </div>
          <div>
            <label htmlFor="contact_email" className="rv-label">Public contact address</label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              required
              defaultValue={settings.contact_email}
              className="rv-input"
            />
            {fields?.contact_email ? <p className="rv-error">{fields.contact_email}</p> : null}
          </div>
          <div>
            <label htmlFor="notification_email" className="rv-label">
              Internal notifications go to
            </label>
            <input
              id="notification_email"
              name="notification_email"
              type="email"
              required
              defaultValue={settings.notification_email}
              aria-describedby="notify-help"
              className="rv-input"
            />
            <p id="notify-help" className="mt-1 text-[10px] text-rhymvex-white/30">
              New-lead alerts and the workspace link are only ever sent here.
            </p>
            {fields?.notification_email ? (
              <p className="rv-error">{fields.notification_email}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="timezone" className="rv-label">Timezone</label>
            <input
              id="timezone"
              name="timezone"
              type="text"
              required
              defaultValue={settings.timezone}
              className="rv-input"
            />
          </div>
          <div>
            <label htmlFor="response_sla_minutes" className="rv-label">
              Response SLA (minutes)
            </label>
            <input
              id="response_sla_minutes"
              name="response_sla_minutes"
              type="number"
              min="0"
              step="15"
              defaultValue={slaMinutes ?? ""}
              placeholder="Leave empty for no promise"
              aria-describedby="sla-help"
              className="rv-input"
            />
            <p id="sla-help" className="mt-1 text-[10px] text-rhymvex-white/30">
              {slaMinutes
                ? "Clients are told a person replies within this window."
                : "Empty: the confirmation makes no response-time promise."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Save settings
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
      </div>
    </form>
  );
}
