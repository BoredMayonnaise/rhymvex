"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { taskSchema } from "@/lib/validation";
import type { ActionResult } from "./leads";

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("tasks.write")) {
    return { ok: false, error: "Your role cannot create tasks." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    detail: formData.get("detail") || "",
    status: formData.get("status") || "OPEN",
    priority: formData.get("priority") || "NORMAL",
    assignee_id: formData.get("assignee_id") || null,
    client_id: formData.get("client_id") || null,
    project_id: formData.get("project_id") || null,
    lead_id: formData.get("lead_id") || null,
    due_at: formData.get("due_at") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the task details." };
  }

  const meta = await requestMeta();
  const data = parsed.data;

  const task = await queryOne<{ id: string }>(
    `INSERT INTO tasks (title, detail, status, priority, assignee_id, client_id, project_id, lead_id, due_at, created_by)
     VALUES ($1, $2, $3::task_status, $4::task_priority, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      data.title,
      data.detail,
      data.status,
      data.priority,
      data.assignee_id ?? null,
      data.client_id ?? null,
      data.project_id ?? null,
      data.lead_id ?? null,
      data.due_at || null,
      session.staffId,
    ],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "task.created",
      entityType: "task",
      entityId: task?.id,
      metadata: { title: data.title, status: data.status, priority: data.priority },
      ...meta,
    },
  );

  revalidatePath("/admin/tasks");
  return { ok: true, message: "Task created." };
}

/** Statuses the update action will accept, mirroring the `task_status` enum. */
const STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

/**
 * Edit a task in place: status, priority, owner, due date and its relations.
 *
 * Only the fields actually present on the form are touched, so the inline
 * one-field forms (status button, assignee picker) stay partial updates rather
 * than blanking everything they did not submit.
 */
export async function updateTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("tasks.write")) {
    return { ok: false, error: "Your role cannot change tasks." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const taskId = String(formData.get("task_id") ?? "");
  if (!isRecordId(taskId)) return { ok: false, error: "Missing task reference." };

  const meta = await requestMeta();

  const task = await queryOne<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_at: Date | null;
    assignee_id: string | null;
    client_id: string | null;
    project_id: string | null;
    lead_id: string | null;
  }>(
    `SELECT id, title, status, priority, due_at, assignee_id, client_id, project_id, lead_id
       FROM tasks WHERE id = $1`,
    [taskId],
  );
  if (!task) return { ok: false, error: "Task not found." };

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  /** Queue one `column = $n` assignment, casting the enum columns explicitly. */
  const push = (column: string, value: unknown, cast?: string) => {
    params.push(value);
    updates.push(`${column} = $${idx}${cast ? `::${cast}` : ""}`);
    idx++;
  };

  const status = String(formData.get("status") ?? "");
  if (status && !STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  if (status && status !== task.status) {
    push("status", status, "task_status");
    // Stamped on the way into DONE and cleared on the way back out, so
    // completed_at never disagrees with status.
    push("completed_at", status === "DONE" ? new Date() : null);
  }

  const priority = String(formData.get("priority") ?? "");
  if (priority && !PRIORITIES.includes(priority)) {
    return { ok: false, error: "Invalid priority." };
  }
  if (priority && priority !== task.priority) {
    push("priority", priority, "task_priority");
  }

  if (formData.has("assignee_id")) {
    const value = nullableUuid(formData.get("assignee_id"));
    if (value !== undefined && value !== task.assignee_id) push("assignee_id", value);
  }
  for (const column of ["client_id", "project_id", "lead_id"] as const) {
    if (!formData.has(column)) continue;
    const value = nullableUuid(formData.get(column));
    if (value !== undefined && value !== task[column]) push(column, value);
  }

  if (formData.has("due_at")) {
    const raw = String(formData.get("due_at") ?? "").trim();
    const value = raw || null;
    const current = task.due_at ? task.due_at.toISOString().slice(0, 10) : null;
    const next = value ? value.slice(0, 10) : null;
    if (next !== current) push("due_at", value);
  }

  if (updates.length === 0) {
    return { ok: true, message: "Nothing to change." };
  }

  params.push(taskId);
  await query(
    `UPDATE tasks SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
    params,
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "task.updated",
      entityType: "task",
      entityId: taskId,
      metadata: { title: task.title, from: task.status, to: status || task.status },
      ...meta,
    },
  );

  revalidatePath("/admin/tasks");
  return {
    ok: true,
    message: status && status !== task.status
      ? `Task marked ${humanise(status).toLowerCase()}.`
      : "Task updated.",
  };
}

/**
 * Read a uuid-ish form field: empty means "clear it", a valid uuid is used, and
 * anything else is rejected outright rather than passed to Postgres as a 500.
 */
function nullableUuid(raw: FormDataEntryValue | null): string | null | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  return isRecordId(value) ? value : undefined;
}
