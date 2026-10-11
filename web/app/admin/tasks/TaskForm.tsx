"use client";

import { useActionState, useId, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { FormModal } from "@/components/ui/Modal";
import {
  createTaskAction,
  updateTaskAction,
  type ActionResult,
} from "@/app/admin/actions";
import { humanise } from "@/lib/format";
import type { TaskOption, TaskProjectOption } from "@/lib/data/workspace";

const STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type { TaskOption, TaskProjectOption };

export type TaskFormOptions = {
  staff: TaskOption[];
  clients: TaskOption[];
  projects: TaskProjectOption[];
  leads: TaskOption[];
};

/** The fields an existing task carries, used to pre-fill the edit form. */
export type TaskDraft = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  assignee_id: string | null;
  client_id: string | null;
  project_id: string | null;
  lead_id: string | null;
};

type Props = TaskFormOptions & {
  csrfToken: string;
  task?: TaskDraft;
};

/** `YYYY-MM-DD` for a `<input type="date">`, or empty when there is no date. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * The create / edit task dialog.
 *
 * One component for both, because a task is described by the same fields either
 * way — the only difference is whether an id is submitted. Relations matter
 * here: a task with no client, project or lead attached is very hard to place
 * later, so each picker is offered up front rather than being an afterthought.
 */
export function TaskForm({ csrfToken, task, staff, clients, projects, leads }: Props) {
  const editing = Boolean(task);
  const uid = useId().replace(/:/g, "");
  const [projectId, setProjectId] = useState(task?.project_id ?? "");

  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(
    createTaskAction,
    null,
  );
  const [updateState, updateAction, updating] = useActionState<ActionResult | null, FormData>(
    updateTaskAction,
    null,
  );

  const pending = editing ? updating : creating;
  const state = editing ? updateState : createState;

  // A project always belongs to a client, so pre-selecting one fills the
  // client picker in too rather than leaving the two links contradictory.
  const projectOwnerId = projects.find((p) => p.id === projectId)?.clientId ?? null;

  return (
    <FormModal
      trigger={(open) =>
        editing ? (
          <button
            type="button"
            onClick={open}
            aria-label={`Edit ${task!.title}`}
            className="inline-flex size-6 items-center justify-center rounded text-rhymvex-white/40 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-volt"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={open} className="rv-btn rv-btn-primary rv-btn-sm">
            <Plus className="size-3.5" aria-hidden="true" />
            New task
          </button>
        )
      }
      title={editing ? "Edit task" : "New task"}
      eyebrow="Team tasks"
      success={state?.ok === true}
    >
      <form
        action={editing ? updateAction : createAction}
        className="flex flex-col gap-3"
        key={uid}
      >
        <input type="hidden" name="csrf" value={csrfToken} />
        {editing ? <input type="hidden" name="task_id" value={task!.id} /> : null}

        <div>
          <label htmlFor={`t-title-${uid}`} className="rv-label">
            Title
          </label>
          <input
            id={`t-title-${uid}`}
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title ?? ""}
            className="rv-input"
            placeholder="What needs doing?"
          />
        </div>

        <div>
          <label htmlFor={`t-detail-${uid}`} className="rv-label">
            Detail
          </label>
          <textarea
            id={`t-detail-${uid}`}
            name="detail"
            rows={3}
            maxLength={4000}
            defaultValue={task?.detail ?? ""}
            className="rv-textarea"
            placeholder="Context, links, acceptance criteria…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`t-status-${uid}`} className="rv-label">
              Status
            </label>
            <select
              id={`t-status-${uid}`}
              name="status"
              defaultValue={task?.status ?? "OPEN"}
              className="rv-select"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`t-priority-${uid}`} className="rv-label">
              Priority
            </label>
            <select
              id={`t-priority-${uid}`}
              name="priority"
              defaultValue={task?.priority ?? "NORMAL"}
              className="rv-select"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanise(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`t-due-${uid}`} className="rv-label">
              Due
            </label>
            <input
              id={`t-due-${uid}`}
              type="date"
              name="due_at"
              defaultValue={toDateInput(task?.due_at ?? null)}
              className="rv-input"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`t-assignee-${uid}`} className="rv-label">
              Assignee
            </label>
            <select
              id={`t-assignee-${uid}`}
              name="assignee_id"
              defaultValue={task?.assignee_id ?? ""}
              className="rv-select"
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`t-lead-${uid}`} className="rv-label">
              Lead
            </label>
            <select
              id={`t-lead-${uid}`}
              name="lead_id"
              defaultValue={task?.lead_id ?? ""}
              className="rv-select"
            >
              <option value="">Not linked</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                  {l.sub ? ` — ${l.sub}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`t-client-${uid}`} className="rv-label">
              Client
            </label>
            <select
              id={`t-client-${uid}`}
              name="client_id"
              defaultValue={task?.client_id ?? projectOwnerId ?? ""}
              className="rv-select"
            >
              <option value="">Not linked</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`t-project-${uid}`} className="rv-label">
              Project
            </label>
            <select
              id={`t-project-${uid}`}
              name="project_id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rv-select"
            >
              <option value="">Not linked</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.sub ? ` — ${p.sub}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {editing ? "Save changes" : "Create task"}
          </button>
          {state ? (
            <p
              role="status"
              className={`text-[11px] ${state.ok ? "text-rhymvex-volt" : "text-rhymvex-ember"}`}
            >
              {state.ok ? state.message : state.error}
            </p>
          ) : null}
        </div>
      </form>
    </FormModal>
  );
}
