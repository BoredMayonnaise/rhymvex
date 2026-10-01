"use client";

import { useLeadCapture } from "./LeadCaptureProvider";

/**
 * A button that opens the modal capture.
 *
 * Lets a server component offer the modal without becoming a client component
 * itself: Services renders from JSON content, so it cannot hold the context.
 *
 * `className` is passed through so the button can wear whatever the surrounding
 * design language expects — a primary button in one place, a bare link in
 * another — without this component knowing about either.
 */
export function LeadCaptureButton({
  situation,
  className = "",
  children,
  ariaLabel,
}: {
  situation?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const { open } = useLeadCapture();

  return (
    <button
      type="button"
      onClick={() => open(situation ? { situation } : undefined)}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
