"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  HONEYPOT_FIELD,
  buildPayload,
  postLeadCapture,
  SITUATIONS,
  type CaptureStep,
} from "./lead-capture-shared";

/**
 * Compact lead capture.
 *
 * Asks for the four things that make a request worth reading: who, where to
 * reply, which situation fits, and what is actually going on. Everything else
 * the full intake form collects is optional and belongs after they have decided
 * to talk to us, so it stays on /intake.
 *
 * The framing matters more than the field count: this is not "book a demo", it
 * is an invitation to explain a problem. The copy says so before the first
 * field rather than after submission.
 */

export type LeadCaptureVariant = "hero" | "panel" | "modal";

export function LeadCaptureForm({
  variant = "hero",
  initialSituation = "",
  onComplete,
}: {
  variant?: LeadCaptureVariant;
  /** Preselected situation, when the visitor arrived from a service card. */
  initialSituation?: string;
  /** Called after a successful submission, so a modal can close itself. */
  onComplete?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<CaptureStep[] | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Render time, so a submission that arrives implausibly fast is treated as a
  // bot. Re-armed after a genuine failure so a real retry is not penalised.
  const startedAt = useRef(Date.now());
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFields({});

    const result = await postLeadCapture(buildPayload(event.currentTarget, startedAt.current));

    if (!result.ok) {
      setError(result.error);
      setFields(result.fields ?? {});
      setSubmitting(false);
      startedAt.current = Date.now();
      return;
    }

    setSteps(result.steps);
    setReference(result.reference);
    // Move focus to the confirmation so it is announced, not just shown.
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  if (steps) {
    return (
      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="flex flex-col gap-5">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-rhymvex-white">
            We&rsquo;ve got it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/65">
            Your message has been received by the Rhymvex team. We&rsquo;ve captured your details and
            what you&rsquo;re trying to solve. A real person will read it and get back to you before
            recommending anything.
          </p>
        </div>

        <ol className="m-0 flex list-none flex-col border-y border-rhymvex-white/10 py-1">
          {steps.map((step) => (
            <li key={step.key} className="rv-step" data-done={step.done ? "true" : "false"}>
              <span className="rv-step-mark" aria-hidden="true">
                {step.done ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <span className="size-1.5 rounded-full bg-rhymvex-white/25" />
                )}
              </span>
              <span
                className={
                  step.done
                    ? "text-sm font-medium text-rhymvex-white"
                    : "text-sm text-rhymvex-white/55"
                }
              >
                {step.label}
                {!step.done ? <span className="sr-only"> — not yet</span> : null}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-3">
          <p className="m-0 flex items-center gap-2 text-sm text-rhymvex-white/70">
            <Check className="size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
            Check your email for a confirmation.
          </p>
          {reference ? (
            <p className="m-0 font-mono text-xs text-rhymvex-white/50">Reference {reference}</p>
          ) : null}
          {onComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="self-start text-xs text-rhymvex-white/50 underline underline-offset-4 transition-colors hover:text-rhymvex-volt"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // The hero sits in a narrow column beside the token card, and every field
  // below the fold is a field that looks unfilled. There it packs the three
  // short answers into one row; the modal and the closing panel have the full
  // width and can breathe.
  const compact = variant === "hero";

  return (
    <form onSubmit={onSubmit} noValidate className="rv-capture flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/8 px-4 py-3 text-sm text-rhymvex-ember"
        >
          {error}
        </p>
      ) : null}

      {/* Honeypot. Hidden from people and assistive tech; only a script that
          fills every input on the page will populate it. */}
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor={`lc-${variant}-${HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`lc-${variant}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className={compact ? "grid gap-4 sm:grid-cols-3" : "flex flex-col gap-4"}>
        <Field
          idPrefix={variant}
          label="Your name"
          name="name"
          error={fields.name}
          required
          autoComplete="name"
        />
        <Field
          idPrefix={variant}
          label="Email"
          name="email"
          type="email"
          error={fields.email}
          required
          autoComplete="email"
        />

        <div className={compact ? "" : "mt-4"}>
          <label htmlFor={`lc-${variant}-situation`} className="rv-label">
            Where are you right now?
          </label>
          <select
            id={`lc-${variant}-situation`}
            name="situation"
            // Only accepted if it is one of the real options, so a crafted link
            // cannot push arbitrary text into the lead record.
            defaultValue={
              SITUATIONS.includes(initialSituation as (typeof SITUATIONS)[number])
                ? initialSituation
                : ""
            }
            className="rv-select"
            aria-invalid={fields.situation ? "true" : undefined}
            // Same wiring the message and name fields below already have: without
            // an id on the error and a describedby on the control, the message is
            // drawn but never announced.
            aria-describedby={
              fields.situation ? `lc-${variant}-situation-error` : undefined
            }
          >
            <option value="">Pick the closest fit</option>
            {SITUATIONS.map((situation) => (
              <option key={situation} value={situation}>
                {situation}
              </option>
            ))}
          </select>
          {fields.situation ? (
            <p id={`lc-${variant}-situation-error`} className="rv-error">
              {fields.situation}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`lc-${variant}-message`} className="rv-label">
          What&rsquo;s getting in your way?
        </label>
        <textarea
          id={`lc-${variant}-message`}
          name="message"
          rows={compact ? 3 : 5}
          required
          placeholder="The more specific you are, the more useful our first reply will be. What have you already tried?"
          className="rv-textarea"
          aria-invalid={fields.message ? "true" : undefined}
          aria-describedby={fields.message ? `lc-${variant}-message-error` : undefined}
        />
        {fields.message ? (
          <p id={`lc-${variant}-message-error`} className="rv-error">
            {fields.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-xs leading-relaxed text-rhymvex-white/50">
          We&rsquo;ll email you to confirm we received this.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="rv-btn rv-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Sending
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              Send this over
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  idPrefix,
  label,
  name,
  error,
  type = "text",
  required = false,
  autoComplete,
}: {
  idPrefix: string;
  label: string;
  name: string;
  error?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `lc-${idPrefix}-${name}`;
  return (
    <div>
      <label htmlFor={id} className="rv-label">
        {label}
        {required ? <span className="ms-1 text-rhymvex-volt">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="rv-input"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="rv-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}