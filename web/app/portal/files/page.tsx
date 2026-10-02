import { FileText } from "lucide-react";
import { requireClientSession } from "@/lib/auth/guards";
import { listPortalFiles } from "@/lib/data/portal";
import { formatDate, relativeTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

function readableSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export default async function PortalFilesPage() {
  const session = await requireClientSession();
  const files = await listPortalFiles(session);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Files</h1>
          <p className="rv-page-sub">
            {files.length === 0 ? "Nothing shared yet" : `${files.length} shared with you`}
          </p>
        </div>
      </header>

      <Panel flush>
        {files.length === 0 ? (
          <EmptyState>
            Files we share with you appear here. Ask your Rhymvex contact if you expected
            something.
          </EmptyState>
        ) : (
          <ul>
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-start gap-3 border-b border-rhymvex-white/5 px-4 py-3 last:border-b-0"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-rhymvex-white/50" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-rhymvex-white">{file.name}</p>
                  {file.description ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-rhymvex-white/55">
                      {file.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-rhymvex-white/50">
                    {readableSize(file.size_bytes)} · {relativeTime(file.uploaded_at)}
                    {file.project_name ? ` · ${file.project_name}` : ""}
                    {` · ${formatDate(file.uploaded_at)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
