"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
import { addLibraryItemAction, type ActionResult } from "@/app/admin/actions";
import { humanise } from "@/lib/format";

const KINDS = ["DOCUMENT", "TEMPLATE", "FRAMEWORK", "BRAND_ASSET", "REFERENCE"] as const;

export function AddLibraryItemForm({ csrfToken, canWrite }: { csrfToken: string; canWrite: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addLibraryItemAction,
    null,
  );

  if (!canWrite) return null;

  return (
    <FormModal
      trigger={(open) => (
        <button type="button" onClick={open} className="rv-btn rv-btn-primary rv-btn-sm">
          <Plus className="size-3.5" aria-hidden="true" />
          Add item
        </button>
      )}
      title="Add a library item"
      eyebrow="Library"
      success={state?.ok === true}
    >
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="csrf" value={csrfToken} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lib-title" className="rv-label">
              Title
            </label>
              <input id="lib-title" name="title" required className="rv-input" />
            </div>
            <div>
              <label htmlFor="lib-kind" className="rv-label">
              Kind
            </label>
              <select id="lib-kind" name="kind" className="rv-select">
                {KINDS.map((k) => (
                  <option key={k} value={k}>{humanise(k)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="lib-desc" className="rv-label">
              Description
            </label>
            <textarea id="lib-desc" name="description" rows={2} className="rv-textarea" />
          </div>
          <div>
            <label htmlFor="lib-body" className="rv-label">
              Content / notes
            </label>
            <textarea id="lib-body" name="body" rows={5} className="rv-textarea" placeholder="Paste the framework, template text or reference notes…" />
          </div>
          <div>
            <label htmlFor="lib-tags" className="rv-label">
              Tags (comma separated)
            </label>
            <input id="lib-tags" name="tags" className="rv-input" placeholder="brand, onboarding, deck" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              Save to library
            </button>
            {state ? (
              <p role="status" className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}>
                {state.ok ? state.message : state.error}
              </p>
            ) : null}
          </div>
        </form>
    </FormModal>
  );
}
