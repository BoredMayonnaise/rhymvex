import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  mode,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  mode?: "staff" | "client";
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
          {/* Workspace switcher tabs if mode is specified */}
          {mode ? (
            <div
              role="tablist"
              aria-label="Workspace sign-in type"
              className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-rhymvex-white/10 bg-rhymvex-white/[0.03] p-1 text-xs"
            >
              <Link
                href="/login"
                role="tab"
                aria-selected={mode === "staff"}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
                  mode === "staff"
                    ? "border border-rhymvex-white/15 bg-rhymvex-white/10 font-semibold text-rhymvex-white shadow-sm"
                    : "text-rhymvex-white/50 hover:text-rhymvex-white/80"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full transition-colors ${
                    mode === "staff" ? "bg-rhymvex-volt" : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
                Staff Team
              </Link>
              <Link
                href="/portal-sign-in"
                role="tab"
                aria-selected={mode === "client"}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
                  mode === "client"
                    ? "border border-rhymvex-white/15 bg-rhymvex-white/10 font-semibold text-rhymvex-white shadow-sm"
                    : "text-rhymvex-white/50 hover:text-rhymvex-white/80"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full transition-colors ${
                    mode === "client" ? "bg-rhymvex-volt" : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
                Client Portal
              </Link>
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
