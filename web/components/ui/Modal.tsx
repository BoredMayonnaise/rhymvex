"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Shared modal dialog.
 *
 * Behaviour matches the rest of the app: Escape closes, Tab is trapped, the
 * page behind is scroll-locked, focus returns to the trigger, and Lenis pauses
 * while it is open. Panels roll up from the bottom on phones and centre on
 * larger screens.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  /** Wider max-width for long forms. */
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Escape, focus trap and scroll lock.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    window.dispatchEvent(new CustomEvent("rv-modal-open"));
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(id);
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      body.style.paddingRight = prevPad;
      window.dispatchEvent(new CustomEvent("rv-modal-close"));
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      data-lenis-prevent
      data-lenis-prevent-touch
      data-lenis-prevent-wheel
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-rhymvex-black/80 backdrop-blur-sm rv-animate-fade touch-none"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`rv-animate-sheet relative flex max-h-[90dvh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} flex-col rounded-t-3xl border border-rhymvex-white/15 bg-rhymvex-slate/95 backdrop-blur-xl sm:rounded-2xl`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-rhymvex-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-rhymvex-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? <p className="rv-eyebrow">{eyebrow}</p> : null}
            <h3 id={titleId} className={`${eyebrow ? "mt-1.5" : ""} text-base font-bold text-rhymvex-white`}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-me-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-rhymvex-white/60 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-white"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A modal triggered by an arbitrary button. Owns the open/close state and
 * closes when the form reports success.
 */
export function FormModal({
  trigger,
  title,
  eyebrow,
  onSuccess,
  success,
  children,
}: {
  /** Render prop: given an `open()` callback, return the trigger element. */
  trigger: (open: () => void) => ReactNode;
  title: string;
  eyebrow?: string;
  /** Close the dialog when a server action reports success. Pass the action's state. */
  success?: boolean;
  onSuccess?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (success) {
      router.refresh();
      const t = window.setTimeout(close, 900);
      return () => window.clearTimeout(t);
    }
  }, [success, close, router]);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal open={open} onClose={close} title={title} eyebrow={eyebrow}>
        {children}
      </Modal>
    </>
  );
}
