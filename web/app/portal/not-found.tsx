import Link from "next/link";

/**
 * Not-found boundary for the client portal.
 *
 * This exists because the segment also has an `error.tsx`, and without a
 * not-found boundary of its own `notFound()` is caught by the error boundary
 * and rendered as a 200. That matters more than it sounds: the portal's
 * cross-tenant checks call `notFound()` deliberately, and a 200 for a record
 * that does not exist for this client tells a caller the record does exist.
 *
 * Deliberately says nothing about whether the record exists. A client who
 * guesses another tenant's project id learns nothing from this page beyond what
 * they already learn from a genuinely missing id.
 */
export default function PortalNotFound() {
  return (
    <div className="rv-container flex flex-col items-start gap-6 py-16">
      <div className="rv-card w-full max-w-xl p-6 sm:p-8">
        <p className="rv-eyebrow">Not found</p>

        <h1 className="mt-3 font-display text-display-3 text-rhymvex-white">
          We could not find that.
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/70">
          The link may be out of date, or it may belong to a different account.
          Everything you have access to is listed in your portal.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/portal" className="rv-btn rv-btn-primary">
            Back to your portal
          </Link>
          <Link href="/portal/projects" className="rv-btn rv-btn-ghost">
            Your projects
          </Link>
        </div>
      </div>
    </div>
  );
}
