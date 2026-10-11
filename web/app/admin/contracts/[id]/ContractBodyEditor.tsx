"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { updateContractBodyAction, type ActionResult } from "@/app/admin/actions";

/**
 * Edit the agreement text before it goes out.
 *
 * Only offered while the contract has not been sent, or was sent but never
 * signed — once a client has signed a particular wording, changing that wording
 * is a different act (a new contract), not an edit.
 */
export function ContractBodyEditor({
  contractId,
  initialBody,
  csrfToken,
}: {
  contractId: string;
  initialBody: string;
  csrfToken: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateContractBodyAction,
    null,
  );

  // Saved: drop out of edit mode and let the page show the new text. Done in an
  // effect rather than during render so this does not set state mid-render.
  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rv-btn rv-btn-ghost rv-btn-sm w-fit"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit agreement text
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="contract_id" value={contractId} />

      <div>
        <label htmlFor="contract-body-edit" className="rv-label">
          Agreement text
        </label>
        <textarea
          id="contract-body-edit"
          name="body"
          rows={18}
          defaultValue={initialBody}
          className="rv-textarea font-mono text-[11px]"
        />
        <p className="mt-1 text-[10px] text-rhymvex-white/50">
          If the client has already signed, changing this wording is a new agreement rather than an
          edit.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Save text
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rv-btn rv-btn-ghost rv-btn-sm"
        >
          Cancel
        </button>
        {state && !state.ok ? (
          <p role="alert" className="text-[11px] text-rhymvex-ember">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}