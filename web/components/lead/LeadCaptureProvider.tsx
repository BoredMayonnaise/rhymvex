"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { Modal } from "@/components/ui/Modal";
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
      <Modal
        open={open}
        onClose={close}
        eyebrow="Start here"
        title="Tell us what you're trying to solve."
      >
        <p className="-mt-3 mb-5 text-sm leading-relaxed text-rhymvex-white/55">
          You don't need to know what you need yet. Describe the situation and we'll
          understand it first.
        </p>
        <LeadCaptureForm
          variant="modal"
          initialSituation={situation}
          onComplete={close}
        />
      </Modal>
    </LeadCaptureContext.Provider>
  );
}