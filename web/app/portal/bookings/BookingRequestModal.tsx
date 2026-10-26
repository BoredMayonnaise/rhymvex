"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BookingRequestForm } from "./BookingRequestForm";

/**
 * Booking request modal for the client portal.
 *
 * Same pattern as the public site's lead capture: a button opens the shared
 * modal, the form lives inside, and on success the modal closes itself.
 * The modal is only mounted once (here), so there is no duplicate scroll-lock
 * or focus-trap to fight over.
 */
export function BookingRequestModal({
  csrfToken,
  triggerClassName = "",
  triggerLabel = "Request a booking",
}: {
  csrfToken: string;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName || "rv-btn rv-btn-primary"}
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {triggerLabel}
      </button>
      <Modal
        open={open}
        onClose={close}
        eyebrow="Book a time"
        title="Request a booking"
      >
        <p className="-mt-3 mb-5 text-sm leading-relaxed text-rhymvex-white/55">
          Tell us what you need and when suits you. We will confirm the time
          and who will be on the call.
        </p>
        <BookingRequestForm csrfToken={csrfToken} onSuccess={close} />
      </Modal>
    </>
  );
}
