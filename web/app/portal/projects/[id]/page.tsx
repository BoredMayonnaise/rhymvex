import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { requireClientSession } from "@/lib/auth/guards";
import { getPortalProject, listProjectMilestones } from "@/lib/data/portal";
import { formatDate, humanise, untilTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * A single project.
 *
 * The id comes from the URL, but the query also requires the session's client
 * id. A project belonging to another client returns null and becomes a 404, so
 * there is no way to tell "not yours" apart from "does not exist".
 */
export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;

  const project = await getPortalProject(session, id);
  if (!project) notFound();

  const milestones = await listProjectMilestones(session, project.id);
  const done = milestones.filter((m) => m.completed_at).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/portal/projects"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All projects
        </Link>
      </div>

      <header className="rv-page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="rv-page-title">{project.name}</h1>
            <StatusPill
              value={humanise(project.status)}
              tone={projectStatusTone(project.status)}
            />
          </div>
          {project.phase ? <p className="rv-page-sub">Current stage: {project.phase}</p> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {project.summary ? (
            <Panel title="What we're doing">
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/70">
                {project.summary}
              </p>
            </Panel>
          ) : null}

          <Panel title="Progress">
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-rhymvex-white/55">Overall</span>
                  <span className="rv-table-num text-rhymvex-volt">{project.progress}%</span>
                </div>
                <Track percent={project.progress} label={`${project.name} progress`} />
              </div>

              {milestones.length === 0 ? (
                <EmptyState>The stage breakdown will appear here.</EmptyState>
              ) : (
                <ol className="flex flex-col gap-0">
                  {milestones.map((milestone, index) => {
                    const complete = Boolean(milestone.completed_at);
                    const isNext = !complete && milestones.slice(0, index).every((m) => m.completed_at);

                    return (
                      <li key={milestone.id} className="flex gap-3.5 pb-5 last:pb-0">
                        {/* Connector line, so the sequence reads as a journey. */}
                        <div className="flex flex-col items-center">
                          <span
                            className={`grid size-6 shrink-0 place-items-center rounded-full border text-[10px] ${
                              complete
                                ? "border-rhymvex-volt bg-rhymvex-volt text-rhymvex-black"
                                : isNext
                                  ? "border-rhymvex-volt text-rhymvex-volt"
                                  : "border-rhymvex-white/15 text-rhymvex-white/50"
                            }`}
                          >
                            {complete ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                          </span>
                          {index < milestones.length - 1 ? (
                            <span
                              className={`mt-1 w-px flex-1 ${
                                complete ? "bg-rhymvex-volt/50" : "bg-rhymvex-white/10"
                              }`}
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                          <p
                            className={`text-sm font-medium ${
                              isNext ? "text-rhymvex-volt" : "text-rhymvex-white"
                            }`}
                          >
                            {milestone.title}
                            {isNext ? (
                              <span className="ml-2 rounded-full border border-rhymvex-volt/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
                                Now
                              </span>
                            ) : null}
                          </p>
                          {milestone.detail ? (
                            <p className="mt-1 text-xs leading-relaxed text-rhymvex-white/50">
                              {milestone.detail}
                            </p>
                          ) : null}
                          {complete && milestone.completed_at ? (
                            <p className="mt-1 text-[10px] text-rhymvex-white/50">
                              Completed {formatDate(milestone.completed_at)}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {project.next_step ? (
            <Panel title="Next step">
              <p className="m-0 text-sm font-medium text-rhymvex-white">{project.next_step}</p>
              {project.next_step_due ? (
                <p className="mt-1.5 text-xs text-rhymvex-volt">
                  {formatDate(project.next_step_due)}
                  {new Date(project.next_step_due).getTime() > Date.now()
                    ? ` · ${untilTime(project.next_step_due)}`
                    : ""}
                </p>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Dates">
            <dl className="rv-dl">
              <dt>Started</dt>
              <dd>{formatDate(project.start_date)}</dd>
              <dt>Target</dt>
              <dd>{formatDate(project.target_date)}</dd>
              <dt>Stages</dt>
              <dd>
                {done} of {milestones.length} complete
              </dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
