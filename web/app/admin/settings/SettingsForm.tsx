"use client";

import { useActionState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
import { updateSettingsAction, type ActionResult } from "@/app/admin/actions";
import type { OrgSettings } from "@/lib/data/org";
import type { EffectMap } from "@/lib/org-setting-effects";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/currency";

/**
 * Settings form.
 *
 * Each field carries what it actually does. The previous version described
 * `notification_email` as the destination for every internal alert, which was
 * simply untrue — alerts are addressed from `INTERNAL_NOTIFICATION_EMAIL` and
 * never consult this row — and left the two inert fields, `company_name` and
 * `timezone`, with no explanation at all.
 *
 * A field that stores a value and changes nothing says so here, at the moment
 * someone is about to type into it, rather than in a report afterwards.
 */
export function SettingsForm({
  settings,
  slaMinutes,
  csrfToken,
  effects,
}: {
  settings: OrgSettings;
  slaMinutes: number | null;
  csrfToken: string;
  effects: EffectMap;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateSettingsAction,
    null,
  );
  const fields = state && !state.ok ? state.fields : undefined;

  const note = (key: keyof OrgSettings, extra?: string) => {
    const effect = effects[key];
    return (
      <>
        <p className="mt-1 text-[10px] leading-relaxed text-rhymvex-white/45">
          {effect.applies}
        </p>
        {effect.caveat ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-rhymvex-ember/70">
            {effect.caveat}
          </p>
        ) : null}
        {extra ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-rhymvex-white/45">{extra}</p>
        ) : null}
      </>
    );
  };

  return (
    <FormModal
      trigger={(open) => (
        <button type="button" onClick={open} className="rv-btn rv-btn-ghost rv-btn-sm">
          <Settings2 className="size-3.5" aria-hidden="true" />
          Edit organisation
        </button>
      )}
      title="Organisation"
      eyebrow="Settings"
      success={state?.ok === true}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrfToken} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="rv-label">
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              defaultValue={settings.company_name}
              className="rv-input"
            />
            {fields?.company_name ? <p className="rv-error">{fields.company_name}</p> : null}
            {note("company_name")}
          </div>

          <div>
            <label htmlFor="currency" className="rv-label">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              required
              defaultValue={settings.currency}
              className="rv-select"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCIES[code].label}
                </option>
              ))}
            </select>
            {fields?.currency ? <p className="rv-error">{fields.currency}</p> : null}
            {note("currency")}
          </div>

          <div>
            <label htmlFor="reporting_currency" className="rv-label">
              Reporting currency
            </label>
            <select
              id="reporting_currency"
              name="reporting_currency"
              defaultValue={settings.reporting_currency ?? ""}
              className="rv-select"
            >
              <option value="">Off — totals stay per currency</option>
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCIES[code].label}
                </option>
              ))}
            </select>
            {fields?.reporting_currency ? (
              <p className="rv-error">{fields.reporting_currency}</p>
            ) : null}
            {note("reporting_currency")}
          </div>

          <div>
            <label htmlFor="contact_email" className="rv-label">
              Public contact address
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              required
              defaultValue={settings.contact_email}
              className="rv-input"
            />
            {fields?.contact_email ? <p className="rv-error">{fields.contact_email}</p> : null}
            {note("contact_email")}
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
              className="rv-input"
            />
            {fields?.notification_email ? (
              <p className="rv-error">{fields.notification_email}</p>
            ) : null}
            {note("notification_email")}
          </div>

          <div>
            <label htmlFor="timezone" className="rv-label">
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              type="text"
              required
              defaultValue={settings.timezone}
              className="rv-input"
            />
            {fields?.timezone ? <p className="rv-error">{fields.timezone}</p> : null}
            {note("timezone")}
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
              className="rv-input"
            />
            {fields?.response_sla_minutes ? (
              <p className="rv-error">{fields.response_sla_minutes}</p>
            ) : null}
            {note(
              "response_sla_minutes",
              slaMinutes
                ? "Clients are told a person replies within this window."
                : "Empty: the confirmation makes no response-time promise.",
            )}
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
      </form>
    </FormModal>
  );
}