"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check, X } from "lucide-react";
import { NOTES, type NoteName } from "@/lib/notes";
import { addOns, buildScopeMailto } from "@/lib/services";
import type { ServicePackage } from "@/lib/services";

/**
 * Scope conversation starter.
 *
 * Not a configurator, and deliberately not framed as one. The visitor names the
 * problem they think they have, confirms what the engagement covers, adds
 * anything that might genuinely help, and arrives with a defined brief. Core
 * items are locked because they are what makes the package that package.
 *
 * Progressive enhancement: the card's own mailto CTA stays a plain link, so the
 * journey works with JS off. This only adds a better way to do the same thing.
 */
export function ScopeBuilder({ pkg }: { pkg: ServicePackage }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const toggle = (
    setter: Dispatch<SetStateAction<Record<string, boolean>>>,
    id: string,
  ) => setter((prev) => ({ ...prev, [id]: !prev[id] }));

  const coreItems = pkg.outcomes.filter((o) => o.core);
  const optional = pkg.outcomes.filter((o) => !o.core);

  const chosenExtras = addOns.filter((a) => extras[a.id]);
  const chosenOptional = optional.filter((o) => picked[o.id]);
  const total = coreItems.length + chosenOptional.length + chosenExtras.length;

  /** Resets to the package default: everything core, nothing optional. */
  const reset = () => {
    setPicked({});
    setExtras({});
  };

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the control that opened the dialog.
    triggerRef.current?.focus();
  }, []);

  const href = buildScopeMailto(
    pkg,
    chosenOptional.map((s) => s.id),
    chosenExtras.map((a) => a.id),
  );

  // --- Dialog behaviour: escape, focus trap, scroll lock -------------------
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Lock the page behind the dialog without layout shift from the scrollbar.
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    // Move focus in once the panel is mounted.
    const id = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("button, input")
        ?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(id);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="rv-btn rv-btn-ghost mt-2 w-full"
      >
        Talk through your situation
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 cursor-default bg-rhymvex-black/80 backdrop-blur-sm"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-rhymvex-white/10 bg-rhymvex-slate/95 sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-rhymvex-white/10 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="rv-eyebrow">Talk through your situation</p>
                <h3 id={titleId} className="mt-2 text-display-3">
                  {pkg.name}
                </h3>
                <p id={descId} className="mt-1 text-sm text-rhymvex-white/50">
                  {pkg.duration} · {pkg.engagement} · quoted as{" "}
                  {pkg.priceNote.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-rhymvex-white/60 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-white"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <fieldset>
                <legend className="rv-eyebrow text-rhymvex-white/40">
                  What this engagement covers
                </legend>
                <ul className="mt-4 space-y-2.5">
                  {coreItems.map((item) => (
                    <Row key={item.id} locked label={item.label} />
                  ))}
                </ul>
              </fieldset>

              {optional.length > 0 && (
                <fieldset className="mt-6">
                  <legend className="rv-eyebrow text-rhymvex-white/40">
                    If it would genuinely help
                  </legend>
                  <ul className="mt-4 space-y-2.5">
                    {optional.map((item) => (
                      <Row
                        key={item.id}
                        label={item.label}
                        checked={!!picked[item.id]}
                        onChange={() => toggle(setPicked, item.id)}
                      />
                    ))}
                  </ul>
                </fieldset>
              )}

              <fieldset className="mt-6">
                <legend className="rv-eyebrow text-rhymvex-white/40">
                  Additional support
                </legend>
                <ul className="mt-4 space-y-2.5">
                  {addOns.map((addOn) => (
                    <Row
                      key={addOn.id}
                      label={addOn.name}
                      hint={addOn.note}
                      checked={!!extras[addOn.id]}
                      onChange={() => toggle(setExtras, addOn.id)}
                    />
                  ))}
                </ul>
              </fieldset>
            </div>

            {/* Footer */}
            <div className="border-t border-rhymvex-white/10 px-5 py-4 sm:px-6">
              <p className="flex items-center gap-2 text-xs text-rhymvex-white/45">
                <TempoGlyph name={pkg.note} className="size-3.5 text-rhymvex-volt" />
                {total} item{total === 1 ? "" : "s"} noted. We come back with a
                recommendation and a price, in writing.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a href={href} className="rv-btn rv-btn-primary sm:flex-1">
                  Send this over
                </a>
                <button
                  type="button"
                  onClick={reset}
                  className="rv-btn rv-btn-ghost sm:flex-1"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Same glyph as the card, falling back if the content file names a bad note. */
function TempoGlyph({ name, className }: { name: string; className?: string }) {
  const Glyph = NOTES[name as NoteName] ?? NOTES.music2;
  return <Glyph className={className} aria-hidden="true" />;
}

function Row({
  label,
  hint,
  checked,
  locked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked?: boolean;
  locked?: boolean;
  onChange?: () => void;
}) {
  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
          locked
            ? "cursor-default border-rhymvex-white/5 bg-rhymvex-black/20"
            : checked
              ? "border-rhymvex-volt/45 bg-rhymvex-volt/8"
              : "border-rhymvex-white/10 hover:border-rhymvex-white/25"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={locked ? true : !!checked}
          disabled={locked}
          onChange={onChange}
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
            locked || checked
              ? "border-rhymvex-volt bg-rhymvex-volt text-rhymvex-black"
              : "border-rhymvex-white/25"
          }`}
        >
          {locked || checked ? (
            <Check className="size-3" strokeWidth={3} />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug text-rhymvex-white/85">
            {label}
          </span>
          {hint && (
            <span className="mt-1 block text-xs leading-relaxed text-rhymvex-white/40">
              {hint}
            </span>
          )}
        </span>
        {locked && (
          <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-rhymvex-white/30">
            Included
          </span>
        )}
      </label>
    </li>
  );
}
