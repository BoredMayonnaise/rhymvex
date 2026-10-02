"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Circle } from "lucide-react";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/locales";
import { getTranslator } from "@/lib/i18n";

/**
 * Post-submission state.
 *
 * Deliberately not "Email sent." The lead is recorded and a person will read it,
 * so the confirmation is about that, not about the mechanics of a mail server.
 *
 * The final step stays open because it genuinely is open. A response-time
 * promise is only made when the backend has a configured SLA; with none set,
 * the copy says nothing about when, which is the honest version.
 */

/**
 * The four steps the endpoint reports, keyed by their canonical `key`.
 *
 * The API answers in English because those labels are part of its contract.
 * Display is translated, so a visitor is not shown a confirmation that switches
 * language halfway down the page.
 */
const SUCCESS_STEP_KEYS: Record<string, string> = {
  received: "success.stepReceived",
  recorded: "success.stepRecorded",
  notified: "success.stepNotified",
  consultation: "success.stepConsultation",
};

type Step = {
  key: "received" | "recorded" | "notified" | "consultation";
  label: string;
  done: boolean;
};

export function IntakeSuccess({
  steps,
  reference,
  calendarUrl,
  onReset,
  locale = DEFAULT_LOCALE,
}: {
  steps: Step[];
  reference: string | null;
  calendarUrl: string;
  onReset: () => void;
  /** Locale this form was rendered for, so the confirmation reads in kind. */
  locale?: LocaleCode;
}) {
  // Replay the checklist one row at a time. Each row confirms work that has
  // already happened, so this is pacing, not a fake progress bar.
  const [revealed, setRevealed] = useState(0);
  const t = getTranslator(locale);

  useEffect(() => {
    if (revealed >= steps.length) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), 260);
    return () => clearTimeout(timer);
  }, [revealed, steps.length]);

  return (
    <div
      id="intake-result"
      tabIndex={-1}
      className="flex flex-col gap-8"
      aria-live="polite"
    >
      <div>
        <p className="rv-eyebrow mb-3">{t("success.eyebrow")}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight text-rhymvex-white sm:text-4xl">
          {t("success.heading")}
        </h2>
        <div className="mt-4 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-rhymvex-white/65">
          <p className="m-0">{t("success.line1")}</p>
          <p className="m-0">{t("success.line2")}</p>
          <p className="m-0">{t("success.line3")}</p>
        </div>
      </div>

      <ol className="m-0 list-none border-y border-rhymvex-white/8 py-1">
        {steps.map((step, index) => {
          const shown = index < revealed;
          const done = step.done;
          const key = SUCCESS_STEP_KEYS[step.key];
          return (
            <li
              key={step.key}
              className="rv-step transition-opacity duration-300"
              data-done={done ? "true" : "false"}
              style={{ opacity: shown ? 1 : 0.25 }}
            >
              <span className="rv-step-mark" aria-hidden="true">
                {done ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-2" />}
              </span>
              <span
                className={
                  done
                    ? "text-sm font-medium text-rhymvex-white"
                    : "text-sm text-rhymvex-white/55"
                }
              >
                {key ? t(key) : step.label}
                {!done ? <span className="sr-only"> — {t("success.notYet")}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-rhymvex-volt" aria-hidden="true" />
          <p className="m-0 text-sm text-rhymvex-white/70">{t("success.checkEmail")}</p>
        </div>

        {reference ? (
          <p className="m-0 font-mono text-xs text-rhymvex-white/50">
            {t("success.reference", { ref: reference })}
          </p>
        ) : null}

        {/* The secondary path stays available. Someone who sent a request may
            also want a conversation, and being told to just wait is unhelpful. */}
        {calendarUrl ? (
          <div className="flex flex-col gap-3 border-t border-rhymvex-white/8 pt-5">
            <p className="m-0 text-sm text-rhymvex-white/55">
              {t("success.ratherTalk")}
            </p>
            <a
              href={calendarUrl}
              className="rv-btn rv-btn-ghost self-start"
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {t("nav.bookCall")}
            </a>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onReset}
          className="self-start text-xs text-rhymvex-white/50 underline underline-offset-4 transition-colors hover:text-rhymvex-volt"
        >
          {t("success.sendAnother")}
        </button>
      </div>
    </div>
  );
}
