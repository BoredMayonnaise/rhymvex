"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { markProposalViewedAction } from "@/app/portal/actions";

/**
 * Marks a proposal VIEWED the first time its details panel is expanded.
 * This replaces staff manually clicking "Mark as viewed".
 */
export function ProposalViewTracker({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      if (details.dataset.status !== "SENT" || !details.dataset.proposalId) return;

      const formData = new FormData();
      formData.set("csrf", csrfToken);
      formData.set("proposal_id", details.dataset.proposalId);

      startTransition(async () => {
        await markProposalViewedAction(null, formData);
        router.refresh();
      });
    };

    // `toggle` does not bubble; capture it at the document level.
    document.addEventListener("toggle", handler, true);
    return () => document.removeEventListener("toggle", handler, true);
  }, [csrfToken, router]);

  return null;
}
