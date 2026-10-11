"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import {
  sendContractAction,
  updateContractStatusAction,
  type ActionResult,
} from "@/app/admin/actions";

/**
 * Move a contract along.
 *
 * Sending is a separate permission from editing, so it is a separate button: the
 * act of putting a commitment in front of a client is a deliberate step, not a
 * side effect of saving. Everything is recorded in the audit trail.
 */
export function ContractActions({
  contractId,
  status,
  csrfToken,
  canSend,
  canWrite,
}: {
  contractId: string;
  status: string;
  csrfToken: string;
  canSend: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sendState, sendAction, sending] = useActionState<ActionResult | null, FormData>(
    sendContractAction,
    null,
  );
  const [statusState, statusAction, updating] = useActionState<ActionResult | null, FormData>(
    updateContractStatusAction,
    null,
  );

  // A successful transition moves the contract's status, so the detail page
  // needs the new one rather than the one this render was built from.
  const currentStatus = statusState?.ok ? (statusState.status ?? status) : status;

  // The action revalidates the route; refresh so the page behind these buttons
  // shows the new status rather than waiting for a manual reload. This sits
  // above the early return below so the hook order never changes.
  useEffect(() => {
    if (sendState?.ok || statusState?.ok) router.refresh();
  }, [sendState, statusState, router]);

  if (!canWrite) return null;

  // Only the transitions that make sense from where the contract is now. There
  // is no manual "mark awaiting signature" step: `sendContractAction` puts a
  // contract straight into AWAITING_SIGNATURE, and `updateContractStatusAction`
  // only handles what happens after a signature.
  const staffMoves: Record<string, Array<{ value: string; label: string; primary?: boolean }>> = {
    DRAFT: [],
    SENT: [],
    AWAITING_SIGNATURE: [],
    SIGNED: [
      { value: "ACTIVE", label: "Activate", primary: true },
      { value: "TERMINATED", label: "Terminate" },
    ],
    ACTIVE: [
      { value: "COMPLETED", label: "Mark completed", primary: true },
      { value: "TERMINATED", label: "Terminate" },
    ],
    COMPLETED: [],
    TERMINATED: [],
  };

  const moves = staffMoves[currentStatus] ?? [];
  const canSendNow = currentStatus === "DRAFT" || currentStatus === "SENT";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canSendNow ? (
          <form action={sendAction}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="contract_id" value={contractId} />
            <input type="hidden" name="status" value="AWAITING_SIGNATURE" />
            <button
              type="submit"
              disabled={sending || !canSend}
              title={canSend ? undefined : "Your role cannot send contracts"}
              className="rv-btn rv-btn-primary rv-btn-sm disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-3.5" aria-hidden="true" />
              )}
              {currentStatus === "DRAFT" ? "Send for signature" : "Resend"}
            </button>
          </form>
        ) : null}

        {moves.map((move) => (
          <form action={statusAction} key={move.value}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="contract_id" value={contractId} />
            <input type="hidden" name="status" value={move.value} />
            <button
              type="submit"
              disabled={updating}
              className={
                move.primary
                  ? "rv-btn rv-btn-primary rv-btn-sm"
                  : "rv-btn rv-btn-ghost rv-btn-sm"
              }
            >
              {updating ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {move.label}
            </button>
          </form>
        ))}
      </div>

      {canSendNow && !canSend ? (
        <p className="text-[11px] text-rhymvex-white/50">
          Your role can edit this contract but not send it.
        </p>
      ) : null}

      {sendState ? (
        <p
          role="status"
          className={`text-[11px] ${sendState.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
        >
          {sendState.ok ? sendState.message : sendState.error}
        </p>
      ) : null}
      {statusState ? (
        <p
          role="status"
          className={`text-[11px] ${statusState.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
        >
          {statusState.ok ? statusState.message : statusState.error}
        </p>
      ) : null}
    </div>
  );
}