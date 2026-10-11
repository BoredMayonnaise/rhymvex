import Link from "next/link";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listTaskOptions, listTasks, type TaskSummary } from "@/lib/data/workspace";
import { formatDate, humanise } from "@/lib/format";
import { isRecordId } from "@/lib/db/ids";
import { EmptyState, Panel, StatusPill, taskStatusTone } from "@/components/ui/primitives";
import { Search } from "lucide-react";
import { TaskAssignForm, TaskStatusActions } from "./TaskActions";
import { TaskForm } from "./TaskForm";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, "idle" | "active" | "warn" | "done"> = {
  URGENT: "warn",
  HIGH: "warn",
  NORMAL: "idle",
  LOW: "idle",
};

/** Status filter chips. `OPEN` covers every status that is not closed. */
const STATUS_FILTERS = [
  { key: "active", label: "Active", statuses: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
  { key: "OPEN", label: "Open", statuses: ["OPEN"] },
  { key: "IN_PROGRESS", label: "In progress", statuses: ["IN_PROGRESS"] },
  { key: "BLOCKED", label: "Blocked", statuses: ["BLOCKED"] },
  { key: "DONE", label: "Done", statuses: ["DONE"] },
  { key: "CANCELLED", label: "Cancelled", statuses: ["CANCELLED"] },
] as const;

const CLOSED = ["DONE", "CANCELLED"];

/** `?status=active` expands to the three open statuses; anything else passes through. */
function resolveStatus(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  const match = STATUS_FILTERS.find((s) => s.key === key);
  return [...(match?.statuses ?? [])];
}

/**
 * Everything a task can hang off, in one cell.
 *
 * Project beats client beats lead, but they are not mutually exclusive — a task
 * raised against an inbound lead has no project yet, and that is exactly the
 * case the old single-value cell rendered as an em dash. Each is its own link so
 * one click lands on the record, not on a list filtered by it.
 */
function RelatedCell({ task }: { task: TaskSummary }) {
  const links: Array<{ href: string; label: string; kind: string }> = [];

  if (task.project_id && task.project_name) {
    links.push({ href: `/admin/projects/${task.project_id}`, label: task.project_name, kind: "Project" });
  }
  if (task.client_id && task.client_name) {
    links.push({ href: `/admin/clients/${task.client_id}`, label: task.client_name, kind: "Client" });
  }
  if (task.lead_id && task.lead_name) {
    links.push({ href: `/admin/leads/${task.lead_id}`, label: task.lead_name, kind: "Lead" });
  }

  if (links.length === 0) {
    return <span className="text-rhymvex-white/30">—</span>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {links.map((link) => (
        <li key={link.href} className="truncate">
          <Link
            href={link.href}
            className="text-[11px] text-rhymvex-volt/80 underline-offset-2 hover:text-rhymvex-volt hover:underline"
            title={`${link.kind}: ${link.label}`}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; assignee?: string; client?: string }>;
}) {
  const session = await requireStaffPermission("tasks.read");
  const params = await searchParams;

  const search = (params.q ?? "").slice(0, 80);
  const statusKey = STATUS_FILTERS.some((s) => s.key === params.status) ? params.status! : undefined;
  const statuses = resolveStatus(statusKey);

  // "mine" and "unassigned" are resolved against the signed-in staff member;
  // a raw uuid in the URL is not trusted, only checked for shape.
  const assigneeParam = params.assignee;
  const assigneeId =
    assigneeParam && assigneeParam !== "unassigned" && isRecordId(assigneeParam)
      ? assigneeParam
      : undefined;
  const mine = assigneeParam === "mine";
  const unassignedOnly = assigneeParam === "unassigned";

  const [options, tasks] = await Promise.all([
    listTaskOptions(),
    listTasks({
      search: search || undefined,
      status: statuses,
      assigneeId: mine ? session.staffId : assigneeId,
      unassignedOnly,
      clientId: isRecordId(params.client ?? "") ? params.client! : undefined,
    }),
  ]);

  const canWrite = session.permissions.has("tasks.write");

  const open = tasks.filter((t) => !CLOSED.includes(t.status));
  const blocked = open.filter((t) => t.status === "BLOCKED");
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const unassigned = open.filter((t) => !t.assignee_id);

  const filtered = Boolean(search || statusKey || assigneeParam || params.client);

  /** Rebuild the query string with one key changed, so chips stay shareable. */
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q: search || undefined,
      status: statusKey,
      assignee: assigneeParam,
      client: params.client,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/tasks?${qs}` : "/admin/tasks";
  };

  const chipClass = (active: boolean) =>
    `rv-btn rv-btn-ghost rv-btn-sm ${active ? "text-rhymvex-volt" : ""}`;

  const taskOptions = {
    staff: options.staff,
    clients: options.clients,
    projects: options.projects,
    leads: options.leads,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Team Tasks</h1>
          <p className="rv-page-sub">
            {open.length} open
            {overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
            {blocked.length > 0 ? ` · ${blocked.length} blocked` : ""}
            {unassigned.length > 0 ? ` · ${unassigned.length} unassigned` : ""}
          </p>
        </div>
        {canWrite ? <TaskForm csrfToken={session.csrfToken} {...taskOptions} /> : null}
      </header>

      {/* Filters are plain links and a GET form, so a filtered view is shareable and works without JS. */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap items-center gap-2">
          {statusKey ? <input type="hidden" name="status" value={statusKey} /> : null}
          {params.client ? <input type="hidden" name="client" value={params.client} /> : null}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-rhymvex-white/50"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Title, detail or owner"
              aria-label="Search tasks"
              className="rv-input w-56 pl-8"
            />
          </div>
          {/* A select rather than one chip per person: the chip row stops being
              readable somewhere around six teammates. */}
          <select
            name="assignee"
            defaultValue={assigneeParam ?? ""}
            aria-label="Filter by assignee"
            className="rv-select w-auto"
          >
            <option value="">Anyone</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Unassigned</option>
            {options.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rv-btn rv-btn-ghost rv-btn-sm">
            Apply
          </button>
        </form>

        <Link
          href={href({ assignee: "mine" })}
          className={chipClass(assigneeParam === "mine")}
          aria-current={assigneeParam === "mine" ? "page" : undefined}
        >
          Mine
        </Link>
        <Link
          href={href({ assignee: "unassigned" })}
          className={chipClass(assigneeParam === "unassigned")}
          aria-current={assigneeParam === "unassigned" ? "page" : undefined}
        >
          Unassigned
        </Link>

        <span className="mx-1 h-4 w-px bg-rhymvex-white/10" aria-hidden="true" />

        {STATUS_FILTERS.map((s) => (
          <Link
            key={s.key}
            href={href({ status: statusKey === s.key ? undefined : s.key })}
            className={chipClass(statusKey === s.key)}
            aria-current={statusKey === s.key ? "page" : undefined}
          >
            {s.label}
          </Link>
        ))}

        {filtered ? (
          <Link href="/admin/tasks" className="rv-btn rv-btn-ghost rv-btn-sm text-rhymvex-ember/80">
            Clear
          </Link>
        ) : null}
      </div>

      <Panel flush>
        {tasks.length === 0 ? (
          <EmptyState>
            {filtered
              ? "Nothing matches. Try a different filter, or clear it to see the whole list."
              : canWrite
                ? "Nothing on the list. Add the first task above."
                : "Nothing on the list."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Team tasks</caption>
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Related to</th>
                  <th scope="col">Due</th>
                  {canWrite ? (
                    <th scope="col" className="w-px">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const closed = CLOSED.includes(task.status);
                  const isOverdue =
                    task.due_at !== null &&
                    new Date(task.due_at).getTime() < Date.now() &&
                    !closed;

                  return (
                    <tr key={task.id} className={closed ? "opacity-60" : undefined}>
                      <td data-label="Task">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-rhymvex-white">{task.title}</p>
                            {task.detail ? (
                              <p className="mt-0.5 max-w-md truncate text-[11px] text-rhymvex-white/50">
                                {task.detail}
                              </p>
                            ) : null}
                          </div>
                          {canWrite ? (
                            <TaskForm
                              csrfToken={session.csrfToken}
                              {...taskOptions}
                              task={{
                                id: task.id,
                                title: task.title,
                                detail: task.detail,
                                status: task.status,
                                priority: task.priority,
                                due_at: task.due_at ? task.due_at.toISOString() : null,
                                assignee_id: task.assignee_id,
                                client_id: task.client_id,
                                project_id: task.project_id,
                                lead_id: task.lead_id,
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Status" className="justify-items-start">
                        <StatusPill value={humanise(task.status)} tone={taskStatusTone(task.status)} />
                      </td>
                      <td data-label="Priority" className="justify-items-start">
                        <StatusPill
                          value={humanise(task.priority)}
                          tone={PRIORITY_TONE[task.priority] ?? "idle"}
                        />
                      </td>
                      <td data-label="Assignee" className="whitespace-nowrap">
                        {canWrite ? (
                          <TaskAssignForm
                            taskId={task.id}
                            taskTitle={task.title}
                            currentAssignee={task.assignee_id}
                            staff={options.staff}
                            csrfToken={session.csrfToken}
                          />
                        ) : (
                          <span className="text-rhymvex-white/60">{task.assignee_name ?? "—"}</span>
                        )}
                      </td>
                      <td data-label="Related to" className="justify-items-start whitespace-nowrap">
                        <RelatedCell task={task} />
                      </td>
                      <td
                        data-label="Due"
                        className={`whitespace-nowrap ${
                          isOverdue ? "text-rhymvex-ember" : "text-rhymvex-white/55"
                        }`}
                      >
                        {task.due_at ? formatDate(task.due_at) : "—"}
                      </td>
                      {canWrite ? (
                        <td data-label="">
                          <TaskStatusActions
                            taskId={task.id}
                            currentStatus={task.status}
                            csrfToken={session.csrfToken}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
