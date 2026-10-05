"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { SITUATIONS, TIMELINES, fieldErrors, intakeSchema } from "@/lib/validation";
import { DEFAULT_LOCALE, getLocale, type Locale } from "@/lib/locales";
import { bandOptions, getCurrency, type Currency } from "@/lib/currency";
import { getTranslator } from "@/lib/i18n";
import { IntakeSuccess } from "./IntakeSuccess";
import { RvMark } from "@/components/RvMark";

/**
 * Public intake form.
 *
 * This is the replacement for the old mailto flow. Nothing here opens an email
 * client: the form posts to /api/intake and the response drives the success
 * state.
 *
 * Order matters more than field count. The visitor's own words come first,
 * because that is the only part we cannot proceed without, and because asking
 * a stranger for their email address before they have said anything is the
 * part that makes people close the tab. Identity comes next, optional context
 * last, and it stays folded away until it is asked for.
 */

type FieldErrors = Record<string, string>;

type Step = {
  key: "received" | "recorded" | "notified" | "consultation";
  label: string;
  done: boolean;
};

/**
 * Visual order of the fields, so "send them to the first thing that needs
 * fixing" walks the page the same way a reader does. Without this the focus
 * jump is arbitrary, and on a phone the error it lands on is off-screen.
 */
const FOCUS_ORDER = [
  "situation",
  "message",
  "name",
  "email",
  "company",
  "role_title",
  "budget_band_key",
  "timeline",
  "website",
  "phone",
] as const;

const MIN_MESSAGE_CHARS = 20;

/**
 * Sentinel for the server's generic "check the fields" message, so the visitor
 * reads a translated sentence rather than an English one. Any other error text
 * comes from the API already in the visitor's own words.
 */
const GENERIC_ERROR = "__intake_fix_fields__";

/**
 * Canonical English values mapped to catalogue keys. The situation and timeline
 * options are validated as exact English strings, because they are part of the
 * API contract and appear in stored lead records; only their display is
 * translated.
 */
const SITUATION_KEYS: Record<string, string> = {
  "You need clarity": "situations.clarity",
  "You need a system that scales": "situations.scales",
  "You need ongoing momentum": "situations.momentum",
  "Something specific": "situations.specific",
};

/** Service alignment tags mapped to each situation option. */
const SITUATION_TAGS: Record<string, string> = {
  "You need clarity": "Sprint · 2 weeks",
  "You need a system that scales": "Platform Build · 6–8 weeks",
  "You need ongoing momentum": "Retainer · Monthly",
  "Something specific": "Custom Architecture",
};

const TIMELINE_KEYS: Record<string, string> = {
  "As soon as possible": "form.asap",
  "Within a month": "form.withinMonth",
  "This quarter": "form.thisQuarter",
  "Just exploring": "form.justExploring",
};

export function IntakeForm({
  initialSituation = "",
  initialMessage = "",
  calendarUrl = "",
  region = getLocale(DEFAULT_LOCALE),
  currency = getCurrency(),
  preselectedPackage = null,
  slaMinutes,
}: {
  initialSituation?: string;
  initialMessage?: string;
  calendarUrl?: string;
  /** The language this form was written in. */
  region?: Locale;
  /**
   * The money the bands are offered in. Resolved on the server from the
   * visitor's remembered currency, so the figures on the form are the ones the
   * server will record and the first paint is already correct.
   */
  currency?: Currency;
  preselectedPackage?: { name: string; duration: string } | null;
  slaMinutes?: number | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [message, setMessage] = useState(initialMessage);
  // Tracked separately from `fields` so the Ember treatment on the situation
  // cards clears the moment one is chosen, rather than waiting for a resubmit.
  const [situationChosen, setSituationChosen] = useState(Boolean(initialSituation));

  // Render timestamp, used to reject implausibly fast submissions.
  // One translator for the whole form, resolved from the locale it was
  // rendered for. Every label below goes through it, so the form cannot end up
  // half translated just because a component was missed.
  const t = getTranslator(region.code);

  const startedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const firstSituation = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const firstProblem = FOCUS_ORDER.find((key) => fields[key]);
  const situationUnanswered = Boolean(fields.situation) && !situationChosen;

  useEffect(() => {
    if (!firstProblem) return;
    if (firstProblem === "situation") {
      firstSituation.current?.focus();
      return;
    }
    formRef.current?.querySelector<HTMLElement>(`#${firstProblem}`)?.focus();
  }, [firstProblem]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    setSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      role_title: String(data.get("role_title") ?? ""),
      phone: String(data.get("phone") ?? ""),
      website: String(data.get("website") ?? ""),
      situation: String(data.get("situation") ?? ""),
      message: String(data.get("message") ?? ""),
      // The band is posted as its key plus the currency it was shown in. The
      // label is rebuilt server-side from that pair, so a hand-edited request
      // cannot write a range whose numbers belong to a different currency.
      budget_band_key: String(data.get("budget_band_key") ?? ""),
      currency: currency.code,
      region: region.code,
      timeline: String(data.get("timeline") ?? ""),
      // Honeypot: a real person never sees or fills this.
      website_confirm: String(data.get("website_confirm") ?? ""),
      startedAt: startedAt.current,
    };

    // Checked here against the same schema the endpoint uses, so a short
    // message costs no round trip and the wording of an error cannot drift
    // between the two. The server stays the authority on what is accepted.
    const local = clientErrors(payload);
    if (Object.keys(local).length > 0) {
      setError("Please check the highlighted fields.");
      setFields(local);
      setSubmitting(false);
      // Re-arm the timing guard so a genuine retry is not treated as a bot.
      startedAt.current = Date.now();
      return;
    }

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setError(json.error ?? GENERIC_ERROR);
        if (json.fields) setFields(json.fields as FieldErrors);
        setSubmitting(false);
        startedAt.current = Date.now();
        return;
      }

      setSteps((json.steps as Step[]) ?? null);
      setReference(json.reference ?? null);
      // Focus the confirmation so the outcome is announced, not just shown.
      requestAnimationFrame(() => {
        document.getElementById("intake-result")?.focus();
      });
    } catch {
      setError(t("form.networkError"));
      setSubmitting(false);
      startedAt.current = Date.now();
    }
  }

  if (steps) {
    return (
      <IntakeSuccess
        steps={steps}
        reference={reference}
        calendarUrl={calendarUrl}
        locale={region.code}
        onReset={() => {
          setSteps(null);
          setReference(null);
          setSubmitting(false);
          startedAt.current = Date.now();
        }}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="rv-capture flex flex-col gap-6 pt-7"
    >
      {/* Honeypot. Hidden from people and from assistive tech; only a bot that
          fills every field on the page will populate it. */}
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor="website_confirm">Website</label>
        <input
          id="website_confirm"
          name="website_confirm"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* The most load-bearing sentence in the form: it says which fields are
          required and that everything after them is not. It was set as `text-xs`
          at 50% white, which made it the quietest thing on the page and left it
          reading as a stray caption under the rule rather than as the form's
          lead-in. Promoted to the same register as the page lede so the
          hierarchy matches the importance. */}
      <p className="-mt-1 max-w-md text-sm leading-relaxed text-rhymvex-white/70">
        {t("form.intro")}
      </p>

      {error ? (
        <p role="alert" className="rounded-lg border border-rhymvex-ember/40 bg-rhymvex-ember/8 px-4 py-3 text-sm text-rhymvex-ember">
          {error === GENERIC_ERROR ? t("form.fixFields") : error}
        </p>
      ) : null}

      {/* Preselected Scope Banner (when arriving from Scope Builder or service cards) */}
      {preselectedPackage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rhymvex-volt/30 bg-rhymvex-volt/8 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-rhymvex-volt animate-pulse" />
            <div>
              <span className="font-semibold text-rhymvex-white">
                Selected Scope: {preselectedPackage.name}
              </span>
              <span className="ms-1.5 text-rhymvex-white/60">({preselectedPackage.duration})</span>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-rhymvex-volt">
            Pre-configured
          </span>
        </div>
      )}

      {/* The ask. Situation first, then their words: the two fields a lead is
          actually made of, and the only two that are not optional. */}
      <fieldset className="flex flex-col gap-4">
        <legend className="rv-eyebrow mb-1">{t("form.yourSituation")}</legend>

        <div>
          <p id="situation-question" className="rv-label">
            {t("form.whereNow")} <span className="text-rhymvex-volt">*</span>
          </p>
          <div
            className="mt-3 grid gap-2.5 sm:grid-cols-2"
            role="radiogroup"
            aria-required="true"
            aria-describedby={
              fields.situation ? "situation-question situation-error" : "situation-question"
            }
            aria-invalid={fields.situation ? "true" : undefined}
          >
            {SITUATIONS.map((situation, index) => (
              <label
                key={situation}
                className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-[0.9375rem] leading-snug text-rhymvex-white/70 transition-colors duration-200 hover:border-rhymvex-white/30 hover:text-rhymvex-white has-[:checked]:bg-rhymvex-volt/10 has-[:checked]:text-rhymvex-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rhymvex-volt ${
                  situationUnanswered
                    ? "border-rhymvex-ember/60"
                    : "border-rhymvex-white/10 has-[:checked]:border-rhymvex-volt"
                }`}
              >
                <input
                  ref={index === 0 ? firstSituation : undefined}
                  type="radio"
                  name="situation"
                  value={situation}
                  defaultChecked={initialSituation === situation}
                  onChange={() => setSituationChosen(true)}
                  aria-invalid={fields.situation ? "true" : undefined}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-[1.125rem] shrink-0 place-items-center rounded-full border border-rhymvex-white/25 transition-colors duration-200 peer-checked:border-rhymvex-volt peer-focus-visible:border-rhymvex-volt"
                >
                  <span className="size-[0.5rem] scale-0 rounded-full bg-rhymvex-volt transition-transform duration-200 peer-checked:scale-100" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-rhymvex-white">
                    {t(SITUATION_KEYS[situation] ?? "")}
                  </span>
                  {SITUATION_TAGS[situation] && (
                    <span className="mt-1 text-[11px] font-mono text-rhymvex-volt/75">
                      {SITUATION_TAGS[situation]}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
          {fields.situation ? (
            <p id="situation-error" className="rv-error">
              {fields.situation}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="message" className="rv-label">
            {t("form.gettingInWay")} <span className="text-rhymvex-volt">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("form.messagePlaceholder")}
            className="rv-textarea"
            aria-invalid={fields.message ? "true" : undefined}
            aria-describedby={`message-hint${fields.message ? " message-error" : ""}`}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p id="message-hint" className="text-rhymvex-white/50">
              {t("form.messageHint", { n: MIN_MESSAGE_CHARS })}
            </p>
            <div>
              {message.trim().length >= MIN_MESSAGE_CHARS ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-rhymvex-volt font-medium">
                  <Check className="size-3" strokeWidth={3} />
                  Minimum reached ({message.trim().length} chars)
                </span>
              ) : (
                <span className="font-mono text-[11px] text-rhymvex-white/45">
                  {message.trim().length} / {MIN_MESSAGE_CHARS} characters
                </span>
              )}
            </div>
          </div>
          {initialMessage ? (
            <p className="mt-2 text-xs text-rhymvex-white/50">
              {t("form.prefilled")}
            </p>
          ) : null}
          {fields.message ? (
            <p id="message-error" className="rv-error">
              {fields.message}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* Who we are talking to. */}
      <fieldset className="flex flex-col gap-4 border-t border-rhymvex-white/8 pt-7">
        <legend className="rv-eyebrow mb-1">{t("form.aboutYou")}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.yourName")} name="name" error={fields.name} required autoComplete="name" />
          <Field
            label={t("form.email")}
            name="email"
            type="email"
            error={fields.email}
            required
            autoComplete="email"
          />
          <Field label={t("form.company")} name="company" error={fields.company} autoComplete="organization" />
          <Field
            label={t("form.yourRole")}
            name="role_title"
            error={fields.role_title}
            placeholder={t("form.rolePlaceholder")}
            autoComplete="organization-title"
          />
        </div>
      </fieldset>

      {/* Optional, and folded away. Four more inputs on screen reads as a
          qualification form, which is the opposite of what this page promises.
          Opening it is the visitor saying they want to give us more. */}
      <details className="group border-t border-rhymvex-white/8 pt-7">
        <summary className="rv-eyebrow -mx-3 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-rhymvex-white/55 transition-colors duration-200 hover:bg-rhymvex-white/4 hover:text-rhymvex-white [&::-webkit-details-marker]:hidden">
          <span>
            {t("form.aLittleContext")}{" "}
            <span className="text-rhymvex-white/40 font-normal lowercase tracking-normal">
              (budget, timeline & website)
            </span>
          </span>
          <span className="flex items-center gap-2 text-[0.6875rem] font-medium tracking-normal text-rhymvex-white/50 normal-case">
            {t("form.optional")}
            <ChevronDown
              className="size-3.5 transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>

        <div className="mt-5 flex flex-col gap-5">
          <p className="-mt-1 text-xs text-rhymvex-white/50">
            {t("form.contextHelp")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <BandField
              currency={currency}
              error={fields.budget_band}
              label={t("form.budgetRange")}
              empty={t("form.notSureYet")}
            />
            <SelectField
              label={t("form.timeline")}
              name="timeline"
              options={TIMELINES.map((o) => t(TIMELINE_KEYS[o] ?? ""))}
              error={fields.timeline}
              empty={t("form.notSureYet")}
            />
            <Field
              label={t("form.website")}
              name="website"
              type="url"
              error={fields.website}
              placeholder="https://"
            />
            <Field label={t("form.phone")} name="phone" type="tel" error={fields.phone} autoComplete="tel" />
          </div>
        </div>
      </details>

      {/* SLA Trust Seal: visible on both mobile and desktop before submitting */}
      <div className="flex items-center gap-2.5 rounded-xl border border-rhymvex-white/10 bg-rhymvex-slate/40 px-4 py-3 text-xs text-rhymvex-white/75 backdrop-blur-sm">
        <span className="size-2 rounded-full bg-rhymvex-volt animate-pulse shrink-0" />
        <p className="leading-snug">
          <strong className="font-semibold text-rhymvex-white">Guaranteed SLA:</strong> A lead architect reviews and replies within {slaMinutes ? `${slaMinutes} minutes` : "45 minutes"}.
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t border-rhymvex-white/8 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 max-w-sm text-xs leading-relaxed text-rhymvex-white/50">
          {t("form.consent")}
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="rv-btn rv-btn-primary w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("form.sending")}
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              {t("form.submit")}
            </>
          )}
        </button>
      </div>

      {calendarUrl ? (
        <p className="text-center text-xs text-rhymvex-white/50">
          Prefer to talk directly?{" "}
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rhymvex-volt underline-offset-4 hover:underline inline-flex items-center gap-1 font-medium"
          >
            <span>Book a 15-minute intro on our calendar</span>
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        </p>
      ) : null}

      <p className="flex items-center justify-center gap-2 text-xs text-rhymvex-white/50">
        <RvMark label={null} className="size-4" />
        Rhymvex
      </p>
    </form>
  );
}

/**
 * Run the intake schema on the client, dropping the two fields a visitor can
 * never act on. The honeypot and the fill-time check belong to the server,
 * which answers them with a decoy success; surfacing them here would tell a
 * script exactly which field caught it.
 */
function clientErrors(payload: unknown): FieldErrors {
  const result = intakeSchema.safeParse(payload);
  if (result.success) return {};

  const out: FieldErrors = {};
  for (const [key, message] of Object.entries(fieldErrors(result.error))) {
    if (key === "website_confirm" || key === "startedAt") continue;
    out[key] = message;
  }
  return out;
}

function Field({
  label,
  name,
  error,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="rv-label">
        {label}
        {required ? <span className="ms-1 text-rhymvex-volt">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rv-input"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error ? (
        <p id={`${name}-error`} className="rv-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Budget bands for a currency.
 *
 * The option *value* is the band key and the visible text is that currency's
 * authored label, so the pair the browser submits is correct by construction.
 * The "Not sure yet" choice renders first as the empty option, which is what an
 * unanswered optional field should look like; it is a word from the catalogue
 * rather than from the currency, because it is language and not money.
 */
function BandField({
  currency,
  error,
  label,
  empty,
}: {
  currency: Currency;
  error?: string;
  label: string;
  empty: string;
}) {
  const options = bandOptions(currency);

  return (
    <div>
      <label htmlFor="budget_band_key" className="rv-label">
        {label}
      </label>
      <select
        id="budget_band_key"
        name="budget_band_key"
        defaultValue=""
        className="rv-select"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "budget-band-error" : undefined}
      >
        <option value="">{empty}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id="budget-band-error" className="rv-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  error,
  empty,
}: {
  label: string;
  name: string;
  options: readonly string[];
  error?: string;
  /** Copy for the unanswered choice. Passed in so it is translated like the rest. */
  empty: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="rv-label">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="rv-select"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <option value="">{empty}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${name}-error`} className="rv-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
