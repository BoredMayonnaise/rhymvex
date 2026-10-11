"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2 } from "lucide-react";
import { createContractFromProposalAction, type ActionResult } from "@/app/admin/actions";
import { Modal } from "@/components/ui/Modal";

/**
 * Draft a contract from an accepted proposal.
 *
 * The commercial terms come from the proposal rather than being retyped, so this
 * is a review-and-confirm step: read what was agreed, adjust if the paperwork
 * needs to say something different, then send it.
 */
export function CreateContractForm({
  proposalId,
  proposalReference,
  proposalTitle,
  clientName,
  scope,
  deliverables,
  exclusions,
  timeline,
  investment,
  currency,
  csrfToken,
  canWrite,
}: {
  proposalId: string;
  proposalReference: string;
  proposalTitle: string;
  clientName: string;
  scope: string | null;
  deliverables: string[];
  exclusions: string[];
  timeline: string | null;
  investment: number | null;
  currency: string;
  csrfToken: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createContractFromProposalAction,
    null,
  );

  // A newly drafted contract is the thing the user wants to look at next, so
  // success takes them to it rather than leaving them on the proposal.
  useEffect(() => {
    if (state?.ok && state.contractId) {
      setOpen(false);
      router.push(`/admin/contracts/${state.contractId}`);
    }
    // A failure keeps the dialog open with the reason shown inside it.
  }, [state, router]);

  if (!canWrite) return null;

  // Prefilled from the proposal, editable if the paperwork needs to differ.
  const suggested = [
    `${proposalTitle}`,
    "",
    clientName,
    "",
    "1. Scope",
    scope?.trim() || "(as per the proposal)",
    "",
    "2. Deliverables",
    ...(deliverables.length > 0 ? deliverables.map((d) => `• ${d}`) : ["• (as per the proposal)"]),
    "",
    "3. Not included",
    ...(exclusions.length > 0 ? exclusions.map((e) => `• ${e}`) : ["• (as per the proposal)"]),
    timeline ? `\n4. Timeline\n${timeline}` : "",
    "",
    "5. Fees",
    investment !== null
      ? `Total ${new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: currency || "USD",
        }).format(investment)}, payable as agreed.`
      : "As agreed in the proposal.",
    "",
    "6. Agreement",
    "Both parties agree to the deliverables and terms above. Either party may end the engagement with 30 days' written notice.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rv-btn rv-btn-ghost rv-btn-sm">
        <FileSignature className="size-3.5" aria-hidden="true" />
        Create contract
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Draft a contract"
        eyebrow={`From proposal ${proposalReference}`}
        wide
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="proposal_id" value={proposalId} />

          <p className="m-0 rounded-md border border-rhymvex-white/8 bg-rhymvex-black/30 p-3 text-[11px] leading-relaxed text-rhymvex-white/55">
            {clientName} accepted {proposalReference}, so the terms below are taken from it.
            Adjust the wording if the paperwork needs to say something different, then send it for
            signature.
          </p>

          <div>
            <label htmlFor="contract-title" className="rv-label">
              Title
            </label>
            <input
              id="contract-title"
              name="title"
              type="text"
              required
              defaultValue={proposalTitle}
              className="rv-input"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="contract-value" className="rv-label">
                Total value
              </label>
              <input
                id="contract-value"
                name="value_total"
                type="number"
                min="0"
                step="0.01"
                defaultValue={investment ?? ""}
                className="rv-input"
              />
            </div>
            <div>
              <label htmlFor="contract-currency" className="rv-label">
                Currency
              </label>
              <input
                id="contract-currency"
                name="currency"
                type="text"
                maxLength={8}
                defaultValue={currency || "USD"}
                className="rv-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contract-body" className="rv-label">
              Agreement
            </label>
            <textarea
              id="contract-body"
              name="body"
              rows={16}
              defaultValue={suggested}
              className="rv-textarea font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              Draft contract
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rv-btn rv-btn-ghost rv-btn-sm">
              Cancel
            </button>
            {state && !state.ok ? (
              <p role="alert" className="text-[11px] text-rhymvex-ember">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  );
}

