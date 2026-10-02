"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { changePasswordAction, type PortalActionResult } from "@/app/portal/actions";

export function PasswordForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, pending] = useActionState<PortalActionResult | null, FormData>(
    changePasswordAction,
    null,
  );
  const fields = state && !state.ok ? state.fields : undefined;

  return (
    <form action={formAction} className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Change password</h2>
      </header>
      <div className="rv-panel-body flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrfToken} />

        <div>
          <label htmlFor="current_password" className="rv-label">Current password</label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
            className="rv-input"
            aria-invalid={fields?.current_password ? "true" : undefined}
          />
          {fields?.current_password ? <p className="rv-error">{fields.current_password}</p> : null}
        </div>

        <div>
          <label htmlFor="new_password" className="rv-label">New password</label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            required
            autoComplete="new-password"
            className="rv-input"
            aria-invalid={fields?.new_password ? "true" : undefined}
            aria-describedby="new-password-help"
          />
          {fields?.new_password ? (
            <p className="rv-error">{fields.new_password}</p>
          ) : (
            <p id="new-password-help" className="mt-1 text-[10px] text-rhymvex-white/50">
              At least 10 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirm_password" className="rv-label">Confirm new password</label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            className="rv-input"
            aria-invalid={fields?.confirm_password ? "true" : undefined}
          />
          {fields?.confirm_password ? <p className="rv-error">{fields.confirm_password}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Change password
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
