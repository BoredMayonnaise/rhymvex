"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { decideProposalAction, type PortalActionResult } from "@/app/portal/actions";

export function ProposalDecision({
  proposalId,
  csrfToken,
}: {
  proposalId: string;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<PortalActionResult | null, FormData>(
    decideProposalAction,
    null,
  );

  if (state?.ok) {
    return <p role="status" className="text-xs text-rhymvex-volt">{state.message}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="proposal_id" value={proposalId} />
          <input type="hidden" name="decision" value="ACCEPTED" />
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            <Check className="size-3.5" aria-hidden="true" />
            Accept
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="proposal_id" value={proposalId} />
          <input type="hidden" name="decision" value="DECLINED" />
          <button type="submit" disabled={pending} className="rv-btn rv-btn-ghost rv-btn-sm">
            <X className="size-3.5" aria-hidden="true" />
            Decline
          </button>
        </form>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-[11px] text-rhymvex-ember">{state.error}</p>
      ) : null}
    </div>
  );
}
