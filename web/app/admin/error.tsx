"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Error boundary for every /admin page.
 *
 * A client component because the boundary needs `reset`, and it owns the logging
 * because the render path is server-side and would otherwise be silent. The
 * detail goes to the server log; the page gets the digest.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return <ErrorState context="admin" digest={error.digest} reset={reset} />;
}
