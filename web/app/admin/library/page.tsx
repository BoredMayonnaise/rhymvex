import { requireStaffPermission } from "@/lib/auth/guards";
import { listLibrary } from "@/lib/data/workspace";
import { humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { AddLibraryItemForm } from "./AddLibraryItemForm";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

const KINDS = ["DOCUMENT", "TEMPLATE", "FRAMEWORK", "BRAND_ASSET", "REFERENCE"];

/**
 * The internal library: frameworks, templates and brand assets.
 *
 * Shared, reusable material. Client-specific material lives on the client
 * record and in the portal, not here, so a client never has to be searched for
 * inside a general-purpose library.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const session = await requireStaffPermission("library.read");
  const params = await searchParams;
  const search = (params.q ?? "").slice(0, 80);
  const kind = KINDS.includes(params.kind ?? "") ? params.kind : undefined;

  const items = await listLibrary({ search: search || undefined, kind });

  const byKind = new Map<string, typeof items>();
  for (const item of items) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Library</h1>
          <p className="rv-page-sub">
            {items.length} {items.length === 1 ? "item" : "items"} · frameworks, templates and
            shared assets
          </p>
        </div>
        <AddLibraryItemForm csrfToken={session.csrfToken} canWrite={session.permissions.has("library.write")} />
      </header>

      {/* Filters are plain links/GET, so a filtered view is shareable and works without JS. */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-2">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-rhymvex-white/50" aria-hidden="true" />
            <input type="search" name="q" defaultValue={search} placeholder="Title, description or tag" aria-label="Search the library" className="rv-input w-56 pl-8" />
          </div>
          <button type="submit" className="rv-btn rv-btn-ghost rv-btn-sm">Search</button>
        </form>
        <a href="/admin/library" className={`rv-btn rv-btn-ghost rv-btn-sm ${!kind ? "pointer-events-none opacity-50" : ""}`}>All</a>
        {KINDS.map((k) => (
          <a key={k} href={`/admin/library?kind=${k}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className={`rv-btn rv-btn-ghost rv-btn-sm ${kind === k ? "text-rhymvex-volt" : ""}`}>
            {humanise(k)}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <Panel>
          <EmptyState>
            {search || kind
              ? "Nothing matches. Try a different search or clear the filter."
              : "The library is empty. Add the first framework or template above."}
          </EmptyState>
        </Panel>
      ) : (
        [...byKind.entries()].map(([kind, list]) => (
          <Panel key={kind} title={`${humanise(kind)} (${list.length})`} flush>
            <ul>
              {list.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-rhymvex-white/5 px-4 py-3.5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-rhymvex-white">{item.title}</p>
                      {item.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-rhymvex-white/50">
                          {item.description}
                        </p>
                      ) : null}
                      {item.body ? (
                        <details className="mt-2 text-xs text-rhymvex-white/60">
                          <summary className="cursor-pointer text-[11px] font-semibold text-rhymvex-volt">
                            Open content
                          </summary>
                          <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-rhymvex-white/8 bg-rhymvex-slate/40 p-3 font-sans leading-relaxed">
                            {item.body}
                          </pre>
                        </details>
                      ) : null}
                      {item.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <a
                              key={tag}
                              href={`/admin/library?q=${encodeURIComponent(tag)}`}
                              className="rounded-full border border-rhymvex-white/10 px-2 py-0.5 text-[10px] text-rhymvex-white/50 hover:border-rhymvex-volt/40 hover:text-rhymvex-volt"
                            >
                              {tag}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-rhymvex-white/50">
                      {item.client_name ? (
                        <p className="mb-0.5 text-rhymvex-volt">{item.client_name}</p>
                      ) : null}
                      <p>{relativeTime(item.updated_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
