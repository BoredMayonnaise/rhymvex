"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { LeadCaptureForm } from "./LeadCaptureForm";

/**
 * Modal lead capture.
 *
 * One dialog, opened from anywhere on the page through `useLeadCapture()`. The
 * provider is mounted once in the root layout, so a trigger is just a button
 * that calls `open()` — no per-section state, and no chance of two dialogs
 * fighting over the scroll lock.
 *
 * The form inside is the same component the hero and closing panel use, so the
 * three placements behave identically.
 */

type LeadCaptureOptions = {
  /** Preselects the situation, so a service card opens the form already
      half-answered instead of making the visitor pick it again. */
  situation?: string;
};

type LeadCaptureContextValue = {
  open: (options?: LeadCaptureOptions) => void;
};

const LeadCaptureContext = createContext<LeadCaptureContextValue>({
  open: () => undefined,
});

export function useLeadCapture(): LeadCaptureContextValue {
  return useContext(LeadCaptureContext);
}

export function LeadCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    // Cleared on close so the next open starts from the visitor's own words
    // rather than the last card they happened to click.
    setSituation("");
  }, []);

  const openCapture = useCallback((options?: LeadCaptureOptions) => {
    setSituation(options?.situation ?? "");
    setOpen(true);
  }, []);

  return (
    <LeadCaptureContext.Provider value={{ open: openCapture }}>
      {children}
      <LeadCaptureModal
        open={open}
        onClose={close}
        initialSituation={situation}
      />
    </LeadCaptureContext.Provider>
  );
}

function LeadCaptureModal({
  open,
  onClose,
  initialSituation,
}: {
  open: boolean;
  onClose: () => void;
  initialSituation: string;
}) {
  const titleId = useId();
  const describedBy = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Remember whatever had focus so it can be handed back on close.
  useEffect(() => {
    if (open) triggerRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Escape to dismiss, Tab kept inside the dialog, body scroll locked while open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not(-1)',
      );
      if (!focusable || focusable.length === 0) return;

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

    // Lock scroll without letting the page shift as the scrollbar disappears.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    // Move focus in, so a keyboard user is inside the dialog immediately.
    requestAnimationFrame(() => {
      // The first real field, not the first focusable thing. A selector list
      // matches in document order and the close button precedes the form, so the
      // previous query focused the one control whose effect is to dismiss the
      // dialog — the most likely accidental first keystroke. Buttons are left out
      // entirely, and tabindex="-1" keeps the honeypot out of it as well.
      const target = panelRef.current?.querySelector<HTMLElement>(
        "input:not([tabindex='-1']), textarea, select",
      );
      target?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-rhymvex-black/80 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-rhymvex-white/12 bg-rhymvex-slate/95 p-6 shadow-2xl sm:rounded-2xl sm:p-7"
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <p className="rv-eyebrow">Start here</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -me-1 shrink-0 rounded-lg p-1.5 text-rhymvex-white/50 transition-colors hover:bg-rhymvex-white/5 hover:text-rhymvex-white"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <h2
          id={titleId}
          className="font-display text-xl font-bold tracking-tight text-rhymvex-white"
        >
          Tell us what you&rsquo;re trying to solve.
        </h2>
        <p id={describedBy} className="mt-2 text-sm leading-relaxed text-rhymvex-white/55">
          You don&rsquo;t need to know what you need yet. Describe the situation and we&rsquo;ll
          understand it first.
        </p>

        <div className="mt-6">
          <LeadCaptureForm
            variant="modal"
            initialSituation={initialSituation}
            onComplete={onClose}
          />
        </div>
      </div>
    </div>
  );
}