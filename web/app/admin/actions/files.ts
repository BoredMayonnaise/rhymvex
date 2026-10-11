"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import type { ActionResult } from "./leads";

/* -------------------------------------------------------------------------- */
/* Files                                                                      */
/* -------------------------------------------------------------------------- */

const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = () => `${process.cwd()}/uploads`;

export async function uploadClientFileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("clients.write")) {
    return { ok: false, error: "Your role cannot upload files." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const clientId = String(formData.get("client_id") ?? "");
  const projectIdRaw = String(formData.get("project_id") ?? "");
  const projectId = projectIdRaw && isRecordId(projectIdRaw) ? projectIdRaw : null;
  const description = String(formData.get("description") ?? "").slice(0, 500);
  const clientVisible = formData.get("client_visible") === "on";
  if (!isRecordId(clientId)) return { ok: false, error: "Missing client." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > FILE_MAX_BYTES) {
    return { ok: false, error: "Files are limited to 10 MB." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "upload";
  const storageKey = `${crypto.randomUUID()}-${safeName}`;
  const meta = await requestMeta();

  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(UPLOAD_DIR(), { recursive: true });
    await writeFile(`${UPLOAD_DIR()}/${storageKey}`, Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "Could not store the file." };
  }

  await query(
    `INSERT INTO files (client_id, project_id, name, description, storage_key, mime_type, size_bytes, client_visible, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [clientId, projectId, file.name.slice(0, 200), description || null, storageKey, file.type || null, file.size, clientVisible, session.staffId],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "file.uploaded",
      entityType: "client",
      entityId: clientId,
      metadata: { name: file.name, size: file.size, client_visible: clientVisible },
      ...meta,
    },
  );

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "File uploaded." };
}
