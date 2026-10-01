import Link from "next/link";
import { requireClientSession } from "@/lib/auth/guards";
import { getPortalOverview, listPortalProjects } from "@/lib/data/portal";
import { formatDate, humanise } from "@/lib/format";
import { Dots, EmptyState, Panel, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PortalProjectsPage() {
  const session = await requireClientSession();
  const [projects, overview] = await Promise.all([
    listPortalProjects(session),
    getPortalOverview(session),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Projects</h1>
          <p className="rv-page-sub">
            {projects.length === 0
              ? "No projects yet"
              : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
          </p>
        </div>
      </header>

      {projects.length === 0 ? (
        <Panel>
          <EmptyState>
            Nothing in progress yet. As soon as work starts, it appears here with its current
            stage and what comes next.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projects/${project.id}`}
              className="rv-panel flex flex-col p-5 transition-colors hover:border-rhymvex-volt/35"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-rhymvex-white">
                    {project.name}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-rhymvex-white/35">
                    {project.phase ?? humanise(project.status)}
                    {project.target_date ? ` · target ${formatDate(project.target_date)}` : ""}
                  </p>
                </div>
                <StatusPill
                  value={humanise(project.status)}
                  tone={projectStatusTone(project.status)}
                />
              </div>

              {project.summary ? (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-rhymvex-white/50">
                  {project.summary}
                </p>
              ) : null}

              <div className="mt-auto pt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-rhymvex-white/35">Progress</span>
                  <span className="rv-table-num text-rhymvex-volt">{project.progress}%</span>
                </div>
                <Track percent={project.progress} label={`${project.name} progress`} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
