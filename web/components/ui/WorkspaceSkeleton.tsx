/**
 * Shared loading skeleton for the two workspaces.
 *
 * Why this is not a `loading.tsx` at `app/admin/` or `app/portal/`:
 * `loading.tsx` wraps its segment in a Suspense boundary, which streams the
 * response. Once the headers are flushed the status is already 200, so a
 * `notFound()` thrown further down can no longer set a 404 — the not-found page
 * renders, but with the wrong status. That silently breaks the tenant-isolation
 * contract these workspaces rely on: `/portal/projects/<another tenant's id>`
 * has to answer 404, not 200.
 *
 * So the skeleton is mounted per leaf route instead, on routes that have no
 * `notFound()` descendant. Each of those `loading.tsx` files is a one-line
 * re-export of this component.
 *
 * `animate-pulse` is a CSS animation and is clamped by the global
 * `prefers-reduced-motion` block in globals.css, like every other one here.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-rhymvex-white/10 ${className}`} />;
}

/**
 * `quiet` drops the stat-tile row. The client portal pages are mostly lists and
 * detail reads, so a row of fake metrics reads as an internal tool warming up
 * rather than as calm.
 */
export function WorkspaceSkeleton({ quiet = false }: { quiet?: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <header className="rv-page-head">
        <div>
          <Bar className="h-7 w-48" />
          <Bar className="mt-2.5 h-4 w-64" />
        </div>
      </header>

      {quiet ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rv-stat">
              <Bar className="h-3 w-20" />
              <Bar className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
      )}

      <section className="rv-panel">
        <div className="rv-panel-head">
          <Bar className="h-4 w-32" />
        </div>
        <div className="rv-panel-body flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </div>
      </section>

      {/* Announced once, rather than a live region chattering through each bar. */}
      <span className="sr-only">Loading.</span>
    </div>
  );
}
