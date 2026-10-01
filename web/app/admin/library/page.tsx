import { requireStaffPermission } from "@/lib/auth/guards";
import { listLibrary } from "@/lib/data/workspace";
import { humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * The internal library: frameworks, templates and brand assets.
 *
 * Shared, reusable material. Client-specific material lives on the client
 * record and in the portal, not here, so a client never has to be searched for
 * inside a general-purpose library.
 */
export default async function LibraryPage() {
  await requireStaffPermission("library.read");
  const items = await listLibrary();

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
      </header>

      {items.length === 0 ? (
        <Panel>
          <EmptyState>The library is empty.</EmptyState>
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
                      {item.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-rhymvex-white/10 px-2 py-0.5 text-[10px] text-rhymvex-white/40"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-rhymvex-white/25">
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
