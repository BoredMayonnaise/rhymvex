"use client";

import { useActionState, useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { FormResult } from "@/app/(auth)/actions";

/**
 * Shared credential form.
 *
 * One component for both workspaces with enhanced UX:
 * - Password visibility toggle
 * - Caps Lock warning indicator
 * - "Remember this device" option
 * - Deep-link redirect (`nextUrl`) preservation
 * - Clear iconography and accessible validation feedback
 */
export function CredentialForm({
  action,
  submitLabel,
  serverError,
  nextUrl,
}: {
  action: (prev: FormResult | null, formData: FormData) => Promise<FormResult>;
  submitLabel: string;
  serverError?: string | null;
  nextUrl?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const error = state && !state.ok ? state.error : serverError;
  const fields = state && !state.ok ? state.fields : undefined;

  const handleKeyModifier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Preserve intended destination URL across sign-in */}
      {nextUrl ? <input type="hidden" name="next" value={nextUrl} /> : null}

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/10 p-3.5 text-xs leading-relaxed text-rhymvex-ember shadow-inner"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      {/* Email input */}
      <div>
        <label htmlFor="email" className="rv-label mb-1.5 flex items-center justify-between">
          <span>Email address</span>
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-rhymvex-white/40">
            <Mail className="size-4" aria-hidden="true" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@domain.com"
            required
            autoFocus
            className="rv-input ps-9.5 text-sm transition-colors focus:border-rhymvex-volt focus:ring-1 focus:ring-rhymvex-volt"
            aria-invalid={fields?.email ? "true" : undefined}
            aria-describedby={fields?.email ? "email-error" : undefined}
          />
        </div>
        {fields?.email ? (
          <p id="email-error" className="rv-error mt-1.5 text-xs text-rhymvex-ember">
            {fields.email}
          </p>
        ) : null}
      </div>

      {/* Password input */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="rv-label">
            Password
          </label>
          {capsLockActive ? (
            <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-amber-400">
              <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1 py-0.5 text-[9px] font-bold">
                ⇪ CAPS
              </span>
              <span>Caps Lock is ON</span>
            </span>
          ) : null}
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-rhymvex-white/40">
            <Lock className="size-4" aria-hidden="true" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            required
            onKeyDown={handleKeyModifier}
            onKeyUp={handleKeyModifier}
            className="rv-input pe-10 ps-9.5 text-sm transition-colors focus:border-rhymvex-volt focus:ring-1 focus:ring-rhymvex-volt"
            aria-invalid={fields?.password ? "true" : undefined}
            aria-describedby={fields?.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 end-0 flex items-center pe-3 text-rhymvex-white/40 transition-colors hover:text-rhymvex-white focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {fields?.password ? (
          <p id="password-error" className="rv-error mt-1.5 text-xs text-rhymvex-ember">
            {fields.password}
          </p>
        ) : null}
      </div>

      {/* Remember me option */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-rhymvex-white/70 transition-colors hover:text-rhymvex-white">
          <input
            type="checkbox"
            name="remember"
            value="true"
            defaultChecked
            className="size-4 rounded border-rhymvex-white/20 bg-rhymvex-black/60 text-rhymvex-volt accent-rhymvex-volt focus:ring-1 focus:ring-rhymvex-volt focus:ring-offset-0"
          />
          <span>Remember this device for 30 days</span>
        </label>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={pending}
        className="rv-btn rv-btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin text-rhymvex-black" aria-hidden="true" />
            <span>Authenticating…</span>
          </>
        ) : (
          <>
            <span>{submitLabel}</span>
            <ArrowRight className="size-4 text-rhymvex-black transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
