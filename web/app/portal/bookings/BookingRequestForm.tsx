"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";

const KINDS = [
  "DISCOVERY",
  "CONSULTATION",
  "REVIEW",
  "WORKSHOP",
  "CHECK_IN",
  "OTHER",
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rv-btn rv-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Sending
        </>
      ) : (
        <>
          <Check className="size-4" aria-hidden="true" />
          Request booking
        </>
      )}
    </button>
  );
}

/**
 * Booking request form for the client portal.
 *
 * Rendered inline on the bookings page (not a modal) so it feels like a
 * natural part of the portal — the client is asking for a time, not filling
 * in a separate form. The server action handles all validation and
 * creation; this component is purely presentational.
 */
export function BookingRequestForm({
  csrfToken,
  onSuccess,
}: {
  csrfToken: string;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSuccess(null);

        // Dynamic import keeps the server action out of the initial bundle.
        const { requestBookingAction } = await import(
          "@/app/portal/actions/bookings"
        );
        const result = await requestBookingAction(null, formData);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setSuccess(result.message);
        onSuccess?.();
      }}
      className="flex flex-col gap-4"
    >
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/8 px-4 py-3 text-sm text-rhymvex-ember"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-lg border border-rhymvex-volt/30 bg-rhymvex-volt/10 px-4 py-3 text-sm text-rhymvex-volt"
        >
          {success}
        </p>
      ) : null}

      <input type="hidden" name="csrf" value={csrfToken} />

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="brf-title" className="rv-label">
            Title
          </label>
          <input
            id="brf-title"
            name="title"
            type="text"
            required
            maxLength={160}
            placeholder="e.g. Kickoff call, Design review"
            className="rv-input"
          />
        </div>

        <div>
          <label htmlFor="brf-kind" className="rv-label">
            What kind of call is this?
          </label>
          <select id="brf-kind" name="kind" required className="rv-select" defaultValue="CONSULTATION">
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "CHECK_IN" ? "Check-in" : kind.charAt(0) + kind.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brf-when" className="rv-label">
              Preferred date and time
            </label>
            <input
              id="brf-when"
              name="scheduled_for"
              type="datetime-local"
              required
              className="rv-input"
            />
          </div>
          <div>
            <label htmlFor="brf-duration" className="rv-label">
              Duration (minutes)
            </label>
            <input
              id="brf-duration"
              name="duration_mins"
              type="number"
              min={15}
              max={480}
              defaultValue={45}
              className="rv-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="brf-agenda" className="rv-label">
            Agenda <span className="text-rhymvex-white/40">(optional)</span>
          </label>
          <textarea
            id="brf-agenda"
            name="agenda"
            rows={4}
            maxLength={4000}
            placeholder="What would you like to cover? Any specific topics or questions?"
            className="rv-textarea"
          />
        </div>
      </div>

      <p className="m-0 text-xs leading-relaxed text-rhymvex-white/50">
        Send a request and the team will confirm a time that works for everyone.
      </p>

      <SubmitButton />
    </form>
  );
}
