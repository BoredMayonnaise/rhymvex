"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { signContractAction, type PortalActionResult } from "@/app/portal/actions";

/**
 * Signature capture.
 *
 * Typed name plus an explicit confirmation that the signer is authorised. That
 * is the whole legal weight of this: there is no drawn signature, and pretending
 * a checkbox is a wet ink signature would be worse than being honest about what
 * it is. The name, the date and the IP are stored so there is a record of who
 * agreed to what.
 */
export function SignContract({
  contractId,
  contractTitle,
  reference,
  signerName,
  csrfToken,
}: {
  contractId: string;
  contractTitle: string;
  reference: string;
  signerName: string;
  csrfToken: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PortalActionResult | null, FormData>(
    signContractAction,
    null,
  );

  // Signed: pull the contract again so the page renders the signature block in
  // place of the sign button, rather than leaving a success message behind.
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rv-btn rv-btn-primary rv-btn-sm">
        <PenLine className="size-3.5" aria-hidden="true" />
        Sign contract
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sign this contract"
        eyebrow={reference}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="contract_id" value={contractId} />

          <p className="m-0 rounded-md border border-rhymvex-white/8 bg-rhymvex-black/30 p-3 text-[11px] leading-relaxed text-rhymvex-white/55">
            You are signing <span className="font-semibold text-rhymvex-white">{contractTitle}</span>.
            Read the full agreement above first — signing records your name, today&apos;s date, and
            the network address this came from, against this reference.
          </p>

          <div>
            <label htmlFor={`signer-${contractId}`} className="rv-label">
              Your full name
            </label>
            <input
              id={`signer-${contractId}`}
              name="signer_name"
              type="text"
              required
              autoComplete="name"
              defaultValue={signerName}
              className="rv-input"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rhymvex-white/10 p-3 text-[11px] leading-relaxed text-rhymvex-white/65 transition-colors has-[:checked]:border-rhymvex-volt/40">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 size-3.5 shrink-0 accent-rhymvex-volt"
            />
            I confirm I am authorised to sign on behalf of my organisation, and that I have read the
            agreement.
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
              {pending ? "Signing…" : `Sign as ${signerName}`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rv-btn rv-btn-ghost rv-btn-sm">
              Not yet
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

