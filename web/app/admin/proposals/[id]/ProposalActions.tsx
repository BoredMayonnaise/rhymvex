"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { updateProposalStatusAction, type ActionResult } from "@/app/admin/actions";

/**
 * Move a proposal through its states.
 *
 * Transitions are recorded in the audit trail, and accepting one advances the
 * originating lead so the pipeline does not need re-keying.
 */
export function ProposalActions({
  proposalId,
  status,
  csrfToken,
  canSend,
  canWrite,
}: {
  proposalId: string;
  status: string;
  csrfToken: string;
  canSend: boolean;
  canWrite: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateProposalStatusAction,
    null,
  );

  if (!canWrite) return null;

  const nextStates: Record<string, Array<{ value: string; label: string; primary?: boolean }>> = {
    DRAFT: [
      { value: "SENT", label: "Mark as sent", primary: true },
      { value: "WITHDRAWN", label: "Withdraw" },
    ],
    SENT: [
      { value: "VIEWED", label: "Mark as viewed" },
      { value: "ACCEPTED", label: "Accepted", primary: true },
      { value: "DECLINED", label: "Declined" },
    ],
    VIEWED: [
      { value: "ACCEPTED", label: "Accepted", primary: true },
      { value: "DECLINED", label: "Declined" },
    ],
    ACCEPTED: [{ value: "WITHDRAWN", label: "Withdraw" }],
  };

  const options = nextStates[status] ?? [];

  return (
    <div className="flex flex-col items-end gap-2">
      {options.length === 0 ? (
        <p className="text-[11px] text-rhymvex-white/50">No further action available.</p>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="proposal_id" value={proposalId} />
          {options.map((option) => (
            <button
              key={option.value}
              type="submit"
              name="status"
              value={option.value}
              disabled={pending || (option.value === "SENT" && !canSend)}
              title={
                option.value === "SENT" && !canSend
                  ? "Your role cannot send proposals"
                  : undefined
              }
              className={
                option.primary
                  ? "rv-btn rv-btn-primary rv-btn-sm"
                  : "rv-btn rv-btn-ghost rv-btn-sm"
              }
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : option.value === "SENT" ? (
                <Send className="size-3.5" aria-hidden="true" />
              ) : null}
              {option.label}
            </button>
          ))}
        </form>
      )}
      {state ? (
        <p
          role="status"
          className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
        >
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </div>
  );
}
