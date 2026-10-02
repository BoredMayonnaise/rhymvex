import Link from "next/link";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listProjects } from "@/lib/data/workspace";
import { formatDate, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "PLANNING", label: "Planning" },
  { status: "DISCOVERY", label: "Discovery" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DELIVERED", label: "Delivered" },
];

export default async function ProjectsPage() {
  await requireStaffPermission("projects.read");
  const projects = await listProjects();

  const live = projects.filter((p) =>
    ["PLANNING", "DISCOVERY", "IN_PROGRESS", "IN_REVIEW"].includes(p.status),
  );
  const avgProgress =
    live.length > 0
      ? Math.round(live.reduce((sum, p) => sum + p.progress, 0) / live.length)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Projects</h1>
          <p className="rv-page-sub">
            {live.length} in delivery · average progress {avgProgress}%
          </p>
        </div>
      </header>

      {projects.length === 0 ? (
        <Panel>
          <EmptyState>
            No projects yet. Projects are created once a client relationship and an engagement exist.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article key={project.id} className="rv-panel flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/clients/${project.client_id}`}
                    className="text-[11px] text-rhymvex-white/50 hover:text-rhymvex-volt"
                  >
                    {project.client_name}
                  </Link>
                  <h2 className="mt-0.5 text-sm font-semibold text-rhymvex-white">{project.name}</h2>
                </div>
                <StatusPill
                  value={humanise(project.status)}
                  tone={projectStatusTone(project.status)}
                />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-rhymvex-white/50">
                    {project.phase ?? humanise(project.status)}
                  </span>
                  <span className="rv-table-num text-rhymvex-volt">{project.progress}%</span>
                </div>
                <Track percent={project.progress} label={`${project.name} progress`} />
              </div>

              {project.next_step ? (
                <p className="mt-3.5 text-[11px] leading-relaxed text-rhymvex-white/55">
                  <span className="font-semibold text-rhymvex-white/70">Next:</span>{" "}
                  {project.next_step}
                </p>
              ) : null}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-rhymvex-white/7 pt-3 text-[10px] text-rhymvex-white/50">
                <span>{project.lead_staff_name ?? "Unassigned"}</span>
                <span>{project.target_date ? `target ${formatDate(project.target_date)}` : "no target"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
