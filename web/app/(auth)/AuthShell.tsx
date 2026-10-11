import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { RvMark } from "@/components/RvMark";
import {
  SIGN_IN_PATH,
  workspaceHome,
  type Workspace,
  type WorkspaceScope,
} from "@/lib/auth/workspace";

/**
 * The switcher links carry `next` through, so picking a workspace does not throw
 * away the page someone was originally trying to reach. A `next` belonging to the
 * other workspace is dropped rather than carried: the sign-in page discards it
 * again on arrival, and carrying a destination that cannot be honoured only
 * produces a landing on the wrong side of the boundary.
 */
function workspaceTabHref(scope: WorkspaceScope, nextUrl?: string): string {
  const params = new URLSearchParams({ workspace: scope });
  if (nextUrl && nextUrl.startsWith(workspaceHome(scope))) {
    params.set("next", nextUrl);
  }
  return `${SIGN_IN_PATH}?${params.toString()}`;
}

function autoHref(nextUrl?: string): string {
  return nextUrl ? `${SIGN_IN_PATH}?${new URLSearchParams({ next: nextUrl }).toString()}` : SIGN_IN_PATH;
}

function WorkspaceTab({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
        active
          ? "border border-rhymvex-white/15 bg-rhymvex-white/10 font-semibold text-rhymvex-white shadow-sm"
          : "text-rhymvex-white/50 hover:text-rhymvex-white/80"
      }`}
    >
      <span
        className={`size-1.5 rounded-full transition-colors ${
          active ? "bg-rhymvex-volt" : "bg-transparent"
        }`}
        aria-hidden="true"
      />
      {label}
    </Link>
  );
}

/**
 * Auth shell.
 *
 * Visually consistent with the rest of the platform, including the invitation
 * pages, so accepting a client invitation feels like part of Rhymvex rather
 * than a third-party form.
 */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
  workspace,
  nextUrl,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Set to render the workspace switcher; omit on the invitation pages. */
  workspace?: Workspace;
  nextUrl?: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-rhymvex-black text-rhymvex-white">
      {/* Background grid texture */}
      <div className="rv-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />

      {/* Atmospheric radial glow behind the auth card */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-rhymvex-volt/[0.04] blur-[120px]"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-rhymvex-white/8">
        <div className="rv-container flex items-center justify-between py-4 sm:py-5">
          <Link href="/" className="group flex items-center gap-2.5">
            <RvMark label={null} className="size-7 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-display text-base font-semibold tracking-tight text-rhymvex-white">
              Rhymvex
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-rhymvex-white/50 transition-colors duration-200 hover:text-rhymvex-volt"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to site</span>
          </Link>
        </div>
      </header>

      {/* Main card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[440px]">
          {/* Workspace switcher. Reads as an override rather than a required
              choice: sign-in works without touching it. */}
          {workspace ? (
            <div className="mb-6">
              <div
                role="tablist"
                aria-label="Workspace to sign in to"
                className="grid grid-cols-2 gap-1 rounded-xl border border-rhymvex-white/10 bg-rhymvex-white/[0.03] p-1 text-xs"
              >
                <WorkspaceTab
                  active={workspace === "staff"}
                  href={workspaceTabHref("staff", nextUrl)}
                  label="Staff Team"
                />
                <WorkspaceTab
                  active={workspace === "client"}
                  href={workspaceTabHref("client", nextUrl)}
                  label="Client Portal"
                />
              </div>

              {workspace === "auto" ? (
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-rhymvex-white/45">
                  <Sparkles className="size-3 shrink-0 text-rhymvex-volt" aria-hidden="true" />
                  <span>
                    We&apos;ll send you to the right one automatically.
                  </span>
                </p>
              ) : (
                <p className="mt-2.5 text-center text-[11px] text-rhymvex-white/45">
                  Signing in to the {workspace === "staff" ? "staff workspace" : "client portal"} only.
                  {" "}
                  <Link
                    href={autoHref(nextUrl)}
                    className="text-rhymvex-volt underline underline-offset-4 hover:text-rhymvex-white"
                  >
                    Let us choose
                  </Link>
                </p>
              )}
            </div>
          ) : null}

          <div className="relative rounded-2xl border border-rhymvex-white/12 bg-rhymvex-slate/60 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-8">
            {/* Top hairline volt highlight */}
            <div
              className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-rhymvex-volt/40 to-transparent"
              aria-hidden="true"
            />

            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rhymvex-white/10 bg-rhymvex-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-rhymvex-volt">
                {eyebrow}
              </span>
              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-rhymvex-white sm:text-3xl">
                {title}
              </h1>
              {intro ? (
                <div className="mt-2 text-sm leading-relaxed text-rhymvex-white/60">{intro}</div>
              ) : null}
            </div>

            {children}
          </div>

          {footer ? (
            <div className="mt-6 text-center text-xs leading-relaxed text-rhymvex-white/50">{footer}</div>
          ) : null}
        </div>
      </main>

      {/* Subtle bottom rail */}
      <footer className="relative z-10 border-t border-rhymvex-white/5 py-4">
        <div className="rv-container flex flex-col items-center justify-between gap-2 text-[11px] text-rhymvex-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} Rhymvex. All rights reserved.</p>
          <p className="font-mono text-rhymvex-white/30">SECURE WORKSPACE ACCESS</p>
        </div>
      </footer>
    </div>
  );
}
