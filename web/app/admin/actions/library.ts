"use server";

import { revalidatePath } from "next/cache";
import { queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { libraryItemSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./leads";

/* -------------------------------------------------------------------------- */
/* Library                                                                    */
/* -------------------------------------------------------------------------- */

export async function addLibraryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("library.write")) {
    return { ok: false, error: "Your role cannot add to the library." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const parsed = libraryItemSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind") ?? "DOCUMENT",
    description: formData.get("description") ?? "",
    body: formData.get("body") ?? "",
    tags,
    client_id: null,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the details and try again.", fields: fieldErrors(parsed.error) };
  }

  const meta = await requestMeta();
  const item = await queryOne<{ id: string }>(
    `INSERT INTO library_items (title, kind, description, body, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [parsed.data.title, parsed.data.kind, parsed.data.description, parsed.data.body, parsed.data.tags, session.staffId],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "library.item_added",
      entityType: "library_item",
      entityId: item?.id ?? null,
      metadata: { title: parsed.data.title, kind: parsed.data.kind },
      ...meta,
    },
  );

  revalidatePath("/admin/library");
  return { ok: true, message: "Added to the library." };
}
