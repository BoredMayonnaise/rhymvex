"use client";

import { useActionState, useState } from "react";
import { Loader2, RotateCcw, Save, Shield } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
import {
  resetSecuritySettingsAction,
  updateSecuritySettingsAction,
  type ActionResult,
} from "@/app/admin/actions";
import type { SecuritySettings } from "@/lib/security-settings";

type Fields = Record<string, string>;

const GROUPS: Array<{
  title: string;
  help: string;
  rows: Array<
    | {
        kind: "number";
        key: keyof SecuritySettings;
        label: string;
        min: number;
        max: number;
        step: number;
        suffix?: string;
      }
    | {
        kind: "toggle";
        key: keyof SecuritySettings;
        label: string;
        help: string;
      }
    | {
        kind: "select";
        key: keyof SecuritySettings;
        label: string;
        options: Array<[string, string]>;
        help?: string;
      }
  >;
}> = [
  {
    title: "Sessions",
    help: "How long a sign-in stays valid. Shorter is safer; longer saves re-entering a password.",
    rows: [
      {
        kind: "number",
        key: "staffSessionHours",
        label: "Team session",
        min: 1,
        max: 720,
        step: 1,
        suffix: "hours",
      },
      {
        kind: "number",
        key: "staffRememberedDays",
        label: "Team session, “remember me”",
        min: 1,
        max: 365,
        step: 1,
        suffix: "days",
      },
      {
        kind: "number",
        key: "clientSessionDays",
        label: "Portal session",
        min: 1,
        max: 365,
        step: 1,
        suffix: "days",
      },
      {
        kind: "number",
        key: "clientRememberedDays",
        label: "Portal session, “remember me”",
        min: 1,
        max: 365,
        step: 1,
        suffix: "days",
      },
      {
        kind: "select",
        key: "cookieSamesite",
        label: "Cookie SameSite",
        options: [
          ["lax", "Lax — sends on top-level navigation"],
          ["strict", "Strict — never sent cross-site"],
        ],
        help: "Strict also withholds the cookie from links arriving in email, so a client clicking through to the portal would sign in again.",
      },
    ],
  },
  {
    title: "Passwords",
    help: "Applied when a password is set or changed. Existing passwords are not re-checked until their owner next changes one.",
    rows: [
      {
        kind: "number",
        key: "passwordMinLength",
        label: "Minimum length",
        min: 8,
        max: 128,
        step: 1,
        suffix: "chars",
      },
      {
        kind: "number",
        key: "passwordMaxLength",
        label: "Maximum length",
        min: 32,
        max: 512,
        step: 1,
        suffix: "chars",
      },
      {
        kind: "toggle",
        key: "passwordRequireLower",
        label: "Require a lowercase letter",
        help: "",
      },
      {
        kind: "toggle",
        key: "passwordRequireUpper",
        label: "Require an uppercase letter",
        help: "",
      },
      {
        kind: "toggle",
        key: "passwordRequireDigit",
        label: "Require a number",
        help: "",
      },
    ],
  },
  {
    title: "Hashing cost",
    help: "Higher is slower to brute-force and slower to sign in. Applies to new hashes only — existing ones keep verifying under the cost they were made with.",
    rows: [
      {
        kind: "number",
        key: "scryptN",
        label: "Cost (N)",
        min: 2,
        max: 1048576,
        step: 1,
        suffix: "power of 2",
      },
      {
        kind: "number",
        key: "scryptR",
        label: "Block size (r)",
        min: 1,
        max: 32,
        step: 1,
      },
      {
        kind: "number",
        key: "scryptP",
        label: "Parallelism (p)",
        min: 1,
        max: 16,
        step: 1,
      },
    ],
  },
  {
    title: "Throttling",
    help: "Sign-in is throttled per account and per address. The per-account limit is what actually stops guessing, because it survives the caller changing address.",
    rows: [
      {
        kind: "number",
        key: "signinAccountLimit",
        label: "Failed sign-ins per account",
        min: 1,
        max: 1000,
        step: 1,
      },
      {
        kind: "number",
        key: "signinIpLimit",
        label: "Sign-in attempts per address",
        min: 1,
        max: 10000,
        step: 1,
      },
      {
        kind: "number",
        key: "signinWindowSeconds",
        label: "Window",
        min: 30,
        max: 86400,
        step: 30,
        suffix: "seconds",
      },
      {
        kind: "number",
        key: "intakeRateLimit",
        label: "Intake submissions per address",
        min: 1,
        max: 10000,
        step: 1,
      },
      {
        kind: "number",
        key: "intakeWindowSeconds",
        label: "Intake window",
        min: 30,
        max: 86400,
        step: 30,
        suffix: "seconds",
      },
      {
        kind: "number",
        key: "intakeMinSeconds",
        label: "Fastest allowed form fill",
        min: 0,
        max: 300,
        step: 1,
        suffix: "seconds",
      },
    ],
  },
];

const FLAG_KEYS = [
  "passwordRequireLower",
  "passwordRequireUpper",
  "passwordRequireDigit",
];

/**
 * The security policy editor.
 *
 * The form is a full statement of the policy rather than a patch, so every
 * field is always submitted — a partial write here would mean a setting that
 * looks saved and is not. Defaults are rendered as the starting value, so
 * opening this and saving without touching anything is a no-op rather than a
 * rewrite of the defaults as explicit overrides.
 */
export function SecurityPolicyForm({
  csrfToken,
  settings,
  overridden,
  hasOverrides,
}: {
  csrfToken: string;
  settings: SecuritySettings;
  overridden: string[];
  hasOverrides: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(updateSecuritySettingsAction, null);
  const [resetState, resetAction, resetting] = useActionState<
    ActionResult | null,
    FormData
  >(resetSecuritySettingsAction, null);
  const [confirming, setConfirming] = useState(false);

  const fields: Fields = (state && !state.ok ? state.fields : undefined) ?? {};
  const overriddenSet = new Set(overridden);

  return (
    <FormModal
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="rv-btn rv-btn-primary rv-btn-sm"
        >
          <Shield className="size-3.5" aria-hidden="true" />
          Edit policy
        </button>
      )}
      title="Security policy"
      eyebrow="Policy"
      success={state?.ok === true || resetState?.ok === true}
    >
      {/* Two sibling forms, deliberately not nested. A <form> inside a <form>
          is invalid HTML and React refuses the inner submit outright, which is
          how "Reset to defaults" ends up doing nothing at all. */}
      <div className="flex flex-col gap-5">
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="csrf" value={csrfToken} />
          {/* Markers, so an unchecked group still arrives as "off" rather than
              as "absent". The action reads the whole group, not just the first
              value, because these share a name with the checkbox itself. */}
          {FLAG_KEYS.map((k) => (
            <input key={k} type="hidden" name={k} value="" />
          ))}

          {GROUPS.map((group) => (
            <fieldset key={group.title} className="flex flex-col gap-2">
              <legend className="rv-eyebebrow">{group.title}</legend>
              <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/50">
                {group.help}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {group.rows.map((row) => {
                  const id = `sp-${row.key}`;
                  const isOverridden = overriddenSet.has(row.key);

                  if (row.kind === "number") {
                    return (
                      <div key={row.key}>
                        <label htmlFor={id} className="rv-label">
                          {row.label}
                          {isOverridden ? (
                            <span className="ms-2 text-rhymvex-volt">
                              overridden
                            </span>
                          ) : null}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={id}
                            name={row.key}
                            type="number"
                            min={row.min}
                            max={row.max}
                            step={row.step}
                            defaultValue={settings[row.key] as number}
                            aria-invalid={fields[row.key] ? true : undefined}
                            className="rv-input"
                          />
                          {row.suffix ? (
                            <span className="shrink-0 text-[11px] text-rhymvex-white/45">
                              {row.suffix}
                            </span>
                          ) : null}
                        </div>
                        {fields[row.key] ? (
                          <p className="rv-error">{fields[row.key]}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (row.kind === "select") {
                    return (
                      <div key={row.key} className="sm:col-span-2">
                        <label htmlFor={id} className="rv-label">
                          {row.label}
                          {isOverridden ? (
                            <span className="ms-2 text-rhymvex-volt">
                              overridden
                            </span>
                          ) : null}
                        </label>
                        <select
                          id={id}
                          name={row.key}
                          defaultValue={settings[row.key] as string}
                          className="rv-select"
                        >
                          {row.options.map(([v, text]) => (
                            <option key={v} value={v}>
                              {text}
                            </option>
                          ))}
                        </select>
                        {row.help ? (
                          <p className="mt-1 text-[10px] text-rhymvex-white/45">
                            {row.help}
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <label
                      key={row.key}
                      htmlFor={id}
                      className="flex items-center gap-2 rounded-md border border-rhymvex-white/8 px-2.5 py-2 text-xs text-rhymvex-white/75"
                    >
                      <input
                        id={id}
                        name={row.key}
                        type="checkbox"
                        defaultChecked={Boolean(settings[row.key])}
                        className="size-3.5 accent-rhymvex-volt"
                      />
                      {row.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rv-btn rv-btn-primary rv-btn-sm"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              Apply policy
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
      </div>

      {hasOverrides ? (
        <div className="mt-5 border-t border-rhymvex-white/8 pt-4">
          <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/50">
            {overridden.length} setting{overridden.length === 1 ? "" : "s"}{" "}
            currently override the built-in defaults. Resetting puts everything
            back, including anything pinned by an environment variable.
          </p>
          {confirming ? (
            <form
              action={resetAction}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="csrf" value={csrfToken} />
              <input
                name="confirm"
                placeholder="Type RESET"
                aria-label="Type RESET to confirm"
                className="rv-input w-40"
              />
              <button
                type="submit"
                disabled={resetting}
                className="rv-btn rv-btn-ghost rv-btn-sm text-rhymvex-ember"
              >
                {resetting ? "Resetting" : "Confirm reset"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rv-btn rv-btn-ghost rv-btn-sm"
              >
                Cancel
              </button>
              {resetState ? (
                <p role="status" className="text-[11px] text-rhymvex-volt">
                  {resetState.ok ? resetState.message : resetState.error}
                </p>
              ) : null}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rv-btn rv-btn-ghost rv-btn-sm mt-2 text-rhymvex-ember/80"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset to defaults
            </button>
          )}
        </div>
      ) : null}
    </FormModal>
  );
}
