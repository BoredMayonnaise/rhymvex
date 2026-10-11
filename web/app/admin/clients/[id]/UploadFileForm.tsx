"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
import { uploadClientFileAction, type ActionResult } from "@/app/admin/actions";

export function UploadFileForm({
  clientId,
  projects,
  csrfToken,
  fixedProjectId,
}: {
  clientId: string;
  projects: Array<{ id: string; name: string }>;
  csrfToken: string;
  /** When set, uploads are always linked to this project (no selector shown). */
  fixedProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    uploadClientFileAction,
    null,
  );

  return (
    <FormModal
      trigger={(open) => (
        <button type="button" onClick={open} className="rv-btn rv-btn-ghost rv-btn-sm">
          <Upload className="size-3.5" aria-hidden="true" />
          Upload file
        </button>
      )}
      title="Upload a file"
      eyebrow="Client files"
      success={state?.ok === true}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="client_id" value={clientId} />

        <div>
          <label htmlFor="file" className="rv-label">
              File
            </label>
          <input id="file" name="file" type="file" required className="rv-input" />
          <p className="mt-1 text-[10px] text-rhymvex-white/50">Up to 10 MB.</p>
        </div>

        <div>
          <label htmlFor="description" className="rv-label">
              Description (optional)
            </label>
          <input id="description" name="description" className="rv-input" />
        </div>

        {fixedProjectId ? (
          <input type="hidden" name="project_id" value={fixedProjectId} />
        ) : projects.length > 0 ? (
          <div>
            <label htmlFor="project_id" className="rv-label">
              Linked project (optional)
            </label>
            <select id="project_id" name="project_id" className="rv-select">
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 rounded border border-rhymvex-white/8 px-2.5 py-1.5 text-[11px] text-rhymvex-white/60">
          <input type="checkbox" name="client_visible" defaultChecked className="size-3.5 accent-rhymvex-volt" />
          Share with the client in their portal
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Upload
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
