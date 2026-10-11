import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { getProject, listProjectFiles, listProjectMilestonesAdmin } from "@/lib/data/workspace";
import { UploadFileForm } from "@/app/admin/clients/[id]/UploadFileForm";
import { formatDate, formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill, Track, projectStatusTone } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPermission("projects.read");
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [milestones, files] = await Promise.all([listProjectMilestonesAdmin(project.id), listProjectFiles(project.id)]);
  const done = milestones.filter((m) => m.completed_at).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors hover:text-rhymvex-volt"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All projects
        </Link>
      </div>

      <header className="rv-page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={`/admin/clients/${project.client_id}`} className="text-[11px] text-rhymvex-white/50 hover:text-rhymvex-volt">
              {project.client_name}
            </Link>
            <h1 className="rv-page-title">{project.name}</h1>
            <StatusPill value={humanise(project.status)} tone={projectStatusTone(project.status)} />
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

          <Panel
            title="Files"
            flush
            action={
              <UploadFileForm
                clientId={project.client_id}
                projects={[]}
                csrfToken={session.csrfToken}
                fixedProjectId={project.id}
              />
            }
          >
            {files.length === 0 ? (
              <EmptyState>No files uploaded for this project yet.</EmptyState>
            ) : (
              <ul>
                {files.map((file) => (
                  <li key={file.id} className="flex items-start justify-between gap-2 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <a href={`/admin/files/${file.id}/download`} className="block truncate text-xs text-rhymvex-white/75 hover:text-rhymvex-volt">
                        {file.name}
                      </a>
                      <p className="truncate text-[10px] text-rhymvex-white/50">
                        {file.uploader_name ?? "Rhymvex"} · {relativeTime(file.uploaded_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                        file.client_visible
                          ? "border-rhymvex-volt/30 text-rhymvex-volt"
                          : "border-rhymvex-white/15 text-rhymvex-white/50"
                      }`}
                    >
                      {file.client_visible ? "Shared" : "Internal"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Progress">
            <div className="flex flex-col gap-4 px-4 py-4">
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
                <ol className="flex flex-col">
                  {milestones.map((milestone) => (
                    <li key={milestone.id} className="flex items-start gap-3 border-b border-rhymvex-white/5 py-2.5 last:border-b-0">
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          milestone.completed_at
                            ? "border-rhymvex-volt/50 bg-rhymvex-volt/15 text-rhymvex-volt"
                            : "border-rhymvex-white/15 text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="size-2.5" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs ${milestone.completed_at ? "text-rhymvex-white/50 line-through" : "text-rhymvex-white"}`}>
                          {milestone.title}
                          {!milestone.client_visible ? (
                            <span className="ml-2 rounded-full border border-rhymvex-white/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-rhymvex-white/50">Internal</span>
                          ) : null}
                        </p>
                        {milestone.detail ? (
                          <p className="mt-0.5 text-[11px] text-rhymvex-white/50">{milestone.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Details">
            <dl className="flex flex-col gap-2.5 px-4 py-4 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Step</dt>
                <dd className="text-rhymvex-white">{done} of {milestones.length} complete</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Owner</dt>
                <dd className="text-rhymvex-white">{project.lead_staff_name ?? "Unassigned"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Started</dt>
                <dd className="text-rhymvex-white">{project.start_date ? formatDate(project.start_date) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Target</dt>
                <dd className="text-rhymvex-white">{project.target_date ? formatDate(project.target_date) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Next step</dt>
                <dd className="text-right text-rhymvex-white">{project.next_step ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-rhymvex-white/50">Updated</dt>
                <dd className="text-rhymvex-white/70">{relativeTime(project.updated_at)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
