"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateProfileAction, type PortalActionResult } from "@/app/portal/actions";

export function ProfileForm({
  name,
  email,
  roleTitle,
  csrfToken,
}: {
  name: string;
  email: string;
  roleTitle: string | null;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<PortalActionResult | null, FormData>(
    updateProfileAction,
    null,
  );
  const fields = state && !state.ok ? state.fields : undefined;

  return (
    <form action={formAction} className="rv-panel">
      <header className="rv-panel-head">
        <h2 className="rv-panel-title">Your details</h2>
      </header>
      <div className="rv-panel-body flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrfToken} />

        <div>
          <label htmlFor="profile-name" className="rv-label">Name</label>
          <input
            id="profile-name"
            name="name"
            type="text"
            required
            defaultValue={name}
            className="rv-input"
          />
          {fields?.name ? <p className="rv-error">{fields.name}</p> : null}
        </div>

        <div>
          <label htmlFor="profile-email" className="rv-label">Email</label>
          <input id="profile-email" type="email" value={email} disabled className="rv-input opacity-60" />
          <p className="mt-1 text-[10px] text-rhymvex-white/50">
            Contact your Rhymvex lead to change this.
          </p>
        </div>

        <div>
          <label htmlFor="profile-role" className="rv-label">Your role</label>
          <input
            id="profile-role"
            name="role_title"
            type="text"
            defaultValue={roleTitle ?? ""}
            placeholder="Founder, Marketing lead…"
            className="rv-input"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Save
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
