"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { FormResult } from "@/app/(auth)/actions";

/**
 * Shared credential form.
 *
 * One component for both workspaces. The only difference between them is where
 * a successful sign-in lands, which the caller's redirect handles.
 */
export function CredentialForm({
  action,
  submitLabel,
  serverError,
}: {
  action: (prev: FormResult | null, formData: FormData) => Promise<FormResult>;
  submitLabel: string;
  serverError?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const error = state && !state.ok ? state.error : serverError;
  const fields = state && !state.ok ? state.fields : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/8 px-4 py-3 text-sm text-rhymvex-ember"
        >
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="rv-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="rv-input"
          aria-invalid={fields?.email ? "true" : undefined}
        />
        {fields?.email ? <p className="rv-error">{fields.email}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="rv-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rv-input"
          aria-invalid={fields?.password ? "true" : undefined}
        />
        {fields?.password ? <p className="rv-error">{fields.password}</p> : null}
      </div>

      <button type="submit" disabled={pending} className="rv-btn rv-btn-primary mt-1 disabled:opacity-60">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Checking
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
