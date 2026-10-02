import type { ReactNode } from "react";

/**
 * Failure surface for a workspace route.
 *
 * Every page under /admin and /portal is dynamic and runs several queries, so a
 * transient database error or a pool timeout is a normal occurrence, not an
 * exceptional one. Without a boundary Next replaces the whole route with its
 * generic crash screen: the navigation is gone, the workspace chrome is gone,
 * and the only way out is a full page load.
 *
 * This keeps the reader inside the workspace and gives them a way to retry
 * without reloading.
 *
 * The error's own message is deliberately not rendered. It reaches this
 * component only in development; in production Next replaces it with a digest.
 * Surfacing `error.message` would put whatever the driver or the pool said into
 * the page, which is the one thing the intake and sign-in handlers are careful
 * never to do. The digest is a hash, so it is safe to show and is what support
 * needs to find the entry in the server log.
 */
export function ErrorState({
  context,
  digest,
  reset,
  children,
}: {
  /** Which workspace, so the wording does not have to guess. */
  context: "admin" | "portal";
  digest?: string;
  reset: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rv-container flex flex-col items-start gap-6 py-16">
      <div className="rv-card w-full max-w-xl p-6 sm:p-8">
        {/* Ember is reserved for error states, which is exactly what this is. */}
        <p className="rv-eyebrow text-rhymvex-ember">Something went wrong</p>

        <h1 className="mt-3 font-display text-display-3 text-rhymvex-white">
          {context === "admin" ? "That page did not load." : "We could not load your portal."}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-rhymvex-white/70">
          This is usually temporary and nothing has been lost. Try again, and if it keeps
          happening, tell us what you were doing and we will look at it.
        </p>

        {children}

        {digest ? (
          <p className="mt-5 text-xs text-rhymvex-white/50">
            Reference <code className="font-mono">{digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => reset()} className="rv-btn rv-btn-primary">
            Try again
          </button>
          <a
            href={context === "admin" ? "/admin" : "/portal"}
            className="rv-btn rv-btn-ghost"
          >
            Back to {context === "admin" ? "the workspace" : "your overview"}
          </a>
        </div>
      </div>
    </div>
  );
}
