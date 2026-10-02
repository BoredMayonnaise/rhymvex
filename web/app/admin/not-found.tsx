import Link from "next/link";

/**
 * Not-found boundary for the admin workspace.
 *
 * Present for the same reason as the portal one: the segment has an
 * `error.tsx`, and several admin pages call `notFound()` for a record that does
 * not exist or that this role may not see. Without this boundary those calls
 * land in the error boundary and answer 200, which reads as "the record is
 * there" to anything checking the status.
 */
export default function AdminNotFound() {
  return (
    <div className="rv-container flex flex-col items-start gap-6 py-16">
      <div className="rv-card w-full max-w-xl p-6 sm:p-8">
        <p className="rv-eyebrow">Not found</p>

        <h1 className="mt-3 font-display text-display-3 text-rhymvex-white">
          That record is not here.
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/70">
          It may have been deleted, or the link may be from an older export. If
          you expected to see something here, it is worth checking the workspace
          index for where it moved to.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/admin" className="rv-btn rv-btn-primary">
            Back to the workspace
          </Link>
          <Link href="/admin/clients" className="rv-btn rv-btn-ghost">
            All clients
          </Link>
        </div>
      </div>
    </div>
  );
}
