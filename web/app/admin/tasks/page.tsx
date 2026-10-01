import Link from "next/link";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listTasks } from "@/lib/data/workspace";
import { formatDate, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, taskStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, "idle" | "active" | "warn" | "done"> = {
  URGENT: "warn",
  HIGH: "warn",
  NORMAL: "idle",
  LOW: "idle",
};

export default async function TasksPage() {
  await requireStaffPermission("tasks.read");
  const tasks = await listTasks();

  const open = tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  const blocked = open.filter((t) => t.status === "BLOCKED");
  const overdue = open.filter(
    (t) => t.due_at && new Date(t.due_at).getTime() < Date.now(),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Team Tasks</h1>
          <p className="rv-page-sub">
            {open.length} open
            {overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
            {blocked.length > 0 ? ` · ${blocked.length} blocked` : ""}
          </p>
        </div>
      </header>

      <Panel flush>
        {tasks.length === 0 ? (
          <EmptyState>Nothing on the list.</EmptyState>
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
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const isOverdue =
                    task.due_at !== null &&
                    new Date(task.due_at).getTime() < Date.now() &&
                    !["DONE", "CANCELLED"].includes(task.status);

                  return (
                    <tr key={task.id}>
                      <td>
                        <p className="font-medium text-rhymvex-white">{task.title}</p>
                        {task.detail ? (
                          <p className="mt-0.5 max-w-md truncate text-[11px] text-rhymvex-white/35">
                            {task.detail}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <StatusPill
                          value={humanise(task.status)}
                          tone={taskStatusTone(task.status)}
                        />
                      </td>
                      <td>
                        <StatusPill
                          value={humanise(task.priority)}
                          tone={PRIORITY_TONE[task.priority] ?? "idle"}
                        />
                      </td>
                      <td className="whitespace-nowrap text-rhymvex-white/60">
                        {task.assignee_name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap text-rhymvex-white/50">
                        {task.project_name ?? task.client_name ?? "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap ${
                          isOverdue ? "text-rhymvex-ember" : "text-rhymvex-white/45"
                        }`}
                      >
                        {task.due_at ? formatDate(task.due_at) : "—"}
                      </td>
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
