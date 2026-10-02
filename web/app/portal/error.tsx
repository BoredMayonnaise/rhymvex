"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Error boundary for every client portal page.
 *
 * Separate from the admin boundary because the two workspaces have different
 * audiences and different consequences: this one is shown to a client who has
 * come to read their invoices and contracts, so the copy reassures rather than
 * debugs. The guard still runs server-side in the layout, so a boundary here can
 * never become a way around the session check.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] route error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return <ErrorState context="portal" digest={error.digest} reset={reset} />;
}
