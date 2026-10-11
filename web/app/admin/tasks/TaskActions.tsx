"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { updateTaskAction, type ActionResult } from "@/app/admin/actions";
import type { TaskOption } from "@/lib/data/workspace";
import { InlineSelect } from "./InlineSelect";

/**
 * The status buttons on a task row.
 *
 * Only the transitions that make sense from the current status are offered, so
 * the row stays a single line of controls. BLOCKED is reachable from anywhere
 * still open, because "stuck" is the thing people most need to record quickly.
 */
export function TaskStatusActions({
  taskId,
  currentStatus,
  csrfToken,
}: {
  taskId: string;
  currentStatus: string;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateTaskAction,
    null,
  );

  const closed = currentStatus === "DONE" || currentStatus === "CANCELLED";
  const nextStatus =
    currentStatus === "OPEN"
      ? "IN_PROGRESS"
      : currentStatus === "IN_PROGRESS"
        ? "DONE"
        : currentStatus === "BLOCKED"
          ? "IN_PROGRESS"
          : null;
  const nextLabel =
    nextStatus === "DONE" ? "Mark done" : nextStatus ? "Start working" : null;

  return (
    <div className="flex items-center gap-1">
      <form action={formAction} className="contents">
        <input type="hidden" name="csrf" value={csrfToken} />
        <input type="hidden" name="task_id" value={taskId} />

        {nextStatus ? (
          <button
            type="submit"
            name="status"
            value={nextStatus}
            disabled={pending}
            className="inline-flex size-6 items-center justify-center rounded text-rhymvex-white/40 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-volt disabled:opacity-50"
            title={nextLabel ?? undefined}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : nextStatus === "DONE" ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <PlayCircle className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">{nextLabel}</span>
          </button>
        ) : null}

        {!closed && currentStatus !== "BLOCKED" ? (
          <button
            type="submit"
            name="status"
            value="BLOCKED"
            disabled={pending}
            className="inline-flex size-6 items-center justify-center rounded text-rhymvex-white/40 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-ember disabled:opacity-50"
            title="Mark blocked"
          >
            <PauseCircle className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Mark blocked</span>
          </button>
        ) : null}

        {!closed ? (
          <button
            type="submit"
            name="status"
            value="CANCELLED"
            disabled={pending}
            className="inline-flex size-6 items-center justify-center rounded text-rhymvex-white/30 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-ember disabled:opacity-50"
            title="Cancel task"
          >
            <XCircle className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Cancel task</span>
          </button>
        ) : null}
      </form>

      {state && !state.ok ? (
        <span role="alert" className="text-[10px] text-rhymvex-ember">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Quick-assign picker within a task row.
 *
 * Submits on change so picking someone reassigns the task immediately — there
 * is no save button to miss. The displayed value is owned by the server: a
 * pending pick is shown optimistically, but the moment the action settles —
 * accepted or rejected — control goes back to the row's real assignee. Without
 * that hand-back a failed write leaves the row showing someone the database
 * never accepted.
 */
export function TaskAssignForm({
  taskId,
  taskTitle,
  currentAssignee,
  staff,
  csrfToken,
  disabled,
}: {
  taskId: string;
  taskTitle: string;
  currentAssignee: string | null;
  staff: TaskOption[];
  csrfToken: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server owns the real value. This only drops the optimistic pick once
  // the row's confirmed assignee moves on — another teammate reassigned it,
  // or this row is now a different task.
  useEffect(() => {
    setChoice(null);
  }, [currentAssignee, taskId]);

  const value = choice ?? currentAssignee ?? "";

  /**
   * Called directly rather than through a form submit.
   *
   * The select is controlled, so serialising it at submit time would race the
   * state update and can post the value the user just moved away from. Sending
   * an explicit FormData also means the action receives exactly the one field
   * that changed and leaves the rest of the task alone.
   */
  function assign(next: string) {
    if (next === (currentAssignee ?? "")) return;
    setChoice(next);
    setError(null);

    const body = new FormData();
    body.set("csrf", csrfToken);
    body.set("task_id", taskId);
    body.set("assignee_id", next);

    startTransition(async () => {
      try {
        const result = await updateTaskAction(null, body);
        if (!result.ok) {
          setError(result.error);
          setChoice(null);
        }
      } catch {
        // The action never came back at all — offline, session death, a 500.
        // The write certainly did not land, so the row must not go on showing
        // an assignee the database does not have.
        setError("Could not save. Check your connection and try again.");
        setChoice(null);
      }
    });
  }

  return (
    <InlineSelect
      value={value}
      options={staff}
      onChange={assign}
      label={`Assign “${taskTitle}” to`}
      disabled={pending || disabled}
      error={error}
    />
  );
}
