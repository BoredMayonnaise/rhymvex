"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { acceptInvitationAction, type FormResult } from "../actions";
import { AuthShell } from "../AuthShell";

/**
 * Invitation acceptance.
 *
 * The same page serves team and client invitations, since the token decides
 * which. Copy and framing switch on `kind`, so a client sees a client
 * invitation and a team member sees a team one, from one implementation.
 */
export function AcceptInvitationForm({
  token,
  kind,
  email,
  invitedName,
  clientName,
  roleName,
  expiresAt,
  invalid,
  invalidMessage,
}: {
  token: string;
  kind: "STAFF" | "CLIENT_PORTAL";
  email: string;
  invitedName: string | null;
  clientName: string | null;
  roleName: string | null;
  expiresAt: string;
  invalid: boolean;
  invalidMessage: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormResult | null, FormData>(
    acceptInvitationAction,
    null,
  );

  const isClient = kind === "CLIENT_PORTAL";
  const errors = state && !state.ok ? state.fields : undefined;
  const serverError = state && !state.ok ? state.error : null;

  // Expiry is stated plainly but without a countdown, which would be a client
  // component ticking for no benefit.
  const expiry = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(expiresAt));

  if (invalid) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="This link isn't valid"
        intro={invalidMessage}
        footer={
          <Link href={isClient ? "/portal-sign-in" : "/login"} className="text-rhymvex-volt underline underline-offset-4">
            Go to sign in
          </Link>
        }
      >
        <p className="text-sm leading-relaxed text-rhymvex-white/50">
          Invitation links work once and expire. If yours has stopped working, the Rhymvex team can
          send a new one.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={isClient ? "Client portal" : "Rhymvex workspace"}
      title={isClient ? "Set your password" : "Accept your invitation"}
      intro={
        isClient ? (
          <>
            You&apos;ve been given access to the Rhymvex client portal
            {clientName ? (
              <>
                {" "}
                for <span className="text-rhymvex-white">{clientName}</span>
              </>
            ) : null}
            . Choose a password to get in.
          </>
        ) : (
          <>
            You&apos;ve been invited to join the Rhymvex workspace
            {roleName ? (
              <>
                {" "}
                as <span className="text-rhymvex-volt">{roleName}</span>
              </>
            ) : null}
            . Choose a password to accept.
          </>
        )
      }
      footer={
        <>
          Invitation for{" "}
          <span className="text-rhymvex-white/60">{email}</span> · expires {expiry} UTC
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        {serverError ? (
          <p
            role="alert"
            className="rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/8 px-4 py-3 text-sm text-rhymvex-ember"
          >
            {serverError}
          </p>
        ) : null}

        <div>
          <label htmlFor="name" className="rv-label">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            autoComplete="name"
            defaultValue={invitedName ?? ""}
            className="rv-input"
            aria-invalid={errors?.name ? "true" : undefined}
          />
          {errors?.name ? <p className="rv-error">{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="password" className="rv-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="rv-input"
            aria-invalid={errors?.password ? "true" : undefined}
            aria-describedby="password-help"
          />
          {errors?.password ? (
            <p className="rv-error">{errors.password}</p>
          ) : (
            <p id="password-help" className="mt-1.5 text-xs text-rhymvex-white/50">
              At least 10 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
          )}
        </div>

        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary mt-1 disabled:opacity-60">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Setting up
            </>
          ) : isClient ? (
            "Create my account"
          ) : (
            "Accept and sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
