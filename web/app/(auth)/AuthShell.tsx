import type { ReactNode } from "react";
import Link from "next/link";
import { RvMark } from "@/components/RvMark";

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
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-rhymvex-black">
      <div className="rv-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />

      <header className="relative border-b border-rhymvex-white/8">
        <div className="rv-container flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <RvMark label={null} className="size-7" />
            <span className="font-display text-base font-semibold tracking-tight text-rhymvex-white">
              Rhymvex
            </span>
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <p className="rv-eyebrow mb-3">{eyebrow}</p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-rhymvex-white">
            {title}
          </h1>
          {intro ? (
            <div className="mt-3 text-sm leading-relaxed text-rhymvex-white/55">{intro}</div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-rhymvex-white/10 bg-rhymvex-slate/40 p-6 sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-6 text-center text-xs text-rhymvex-white/35">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
