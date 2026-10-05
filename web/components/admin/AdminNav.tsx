"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";
import { ADMIN_NAV, isNavActive, type NavItem } from "@/lib/admin-nav";
import { RvMark } from "@/components/RvMark";
import type { Permission } from "@/lib/auth/rbac";

/**
 * Workspace rail & mobile navigation for Staff.
 *
 * Provides a responsive, dual-mode navigation experience:
 * - Desktop: Fixed/sticky 15rem sidebar rail with grouped nav and profile footer.
 * - Mobile (< 1024px):
 *   - Sticky top bar with workspace branding, current section title, alert counter, and hamburger.
 *   - Ergonomic bottom navigation bar for one-thumb switching between Overview, Leads, Clients, Projects, and More.
 *   - Smooth slide-over drawer that is completely hidden (invisible & pointer-events-none) when closed to eliminate shadow-bleeding and horizontal jitter.
 */

function getActiveSectionLabel(pathname: string): string | null {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.href !== "/admin" && isNavActive(item, pathname)) {
        return item.label;
      }
    }
  }
  return null;
}

export function AdminNav({
  permissions,
  counts,
  staffName,
  staffRole,
  signOutAction,
}: {
  permissions: Set<Permission>;
  counts: Partial<Record<NonNullable<NavItem["countKey"]>, number>>;
  staffName: string;
  staffRole: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer whenever user navigates
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock scroll when mobile drawer is open & handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const activeSection = getActiveSectionLabel(pathname);

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav aria-label="Workspace Navigation" className="flex-1 overflow-y-auto pb-4">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => permissions.has(item.permission));
        if (items.length === 0) return null;

        return (
          <div key={group.label} className="rv-nav-group">
            <p className="rv-nav-label">{group.label}</p>
            <ul>
              {items.map((item) => {
                const Icon = item.icon;
                const count = item.countKey ? counts[item.countKey] : undefined;
                const active = isNavActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className="rv-nav-link"
                      data-active={active}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {count ? (
                        <span className="rv-nav-count" aria-label={`${count} needing attention`}>
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const renderProfileCard = () => (
    <div className="mx-4 mb-4 rounded-lg border border-rhymvex-white/8 bg-rhymvex-slate/40 p-3">
      <p className="truncate text-xs font-semibold text-rhymvex-white">{staffName}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-rhymvex-white/50">
        {staffRole.replace(/_/g, " ")}
      </p>
      <form action={signOutAction} className="mt-2.5">
        <button
          type="submit"
          className="flex items-center gap-1.5 text-[11px] text-rhymvex-white/55 transition-colors hover:text-rhymvex-volt"
        >
          <LogOut className="size-3" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* ------------------------------------------------------------------
          1. Mobile Sticky Top Header (< 1024px)
          ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rhymvex-white/8 bg-rhymvex-black/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 min-w-0"
          aria-label="Rhymvex workspace overview"
        >
          <RvMark label={null} className="size-6 shrink-0" />
          <span className="flex flex-col leading-none min-w-0">
            <span className="font-display text-sm font-bold tracking-tight text-rhymvex-white">
              Rhymvex
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
              {activeSection ? `Workspace · ${activeSection}` : "Workspace"}
            </span>
          </span>
        </Link>

        {counts.newLeads ? (
          <span className="flex items-center gap-1.5 rounded-full border border-rhymvex-volt/30 bg-rhymvex-volt/10 px-2.5 py-1 text-[11px] font-semibold text-rhymvex-volt shrink-0">
            <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" aria-hidden="true" />
            {counts.newLeads} new
          </span>
        ) : null}
      </header>

      {/* ------------------------------------------------------------------
          2. Mobile Slide-Over Drawer & Backdrop (< 1024px)
          ------------------------------------------------------------------ */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div
            className="fixed inset-y-0 start-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-e border-rhymvex-white/10 bg-[#0B0F14] shadow-2xl animate-in slide-in-from-left duration-200 lg:hidden"
            aria-modal="true"
            role="dialog"
            aria-label="Workspace navigation"
          >
            <div className="flex items-center justify-between border-b border-rhymvex-white/8 px-4 py-3.5 shrink-0">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <RvMark label={null} className="size-7 shrink-0" />
                <span className="flex flex-col leading-none min-w-0">
                  <span className="font-display text-sm font-bold tracking-tight text-rhymvex-white">
                    Rhymvex
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
                    Workspace
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-rhymvex-white/60 transition-colors hover:bg-rhymvex-white/10 hover:text-rhymvex-white active:scale-95"
                aria-label="Close navigation menu"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-20">
              {renderNavLinks(() => setMobileOpen(false))}
              {renderProfileCard()}
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------
          3. Mobile Bottom Tab Navigation (< 1024px)
          ------------------------------------------------------------------ */}
      <nav
        aria-label="Quick Workspace Navigation"
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-rhymvex-white/10 bg-rhymvex-black/95 px-1 py-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
      >
        {[
          { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: "leads.read" as Permission },
          { href: "/admin/leads", label: "Leads", icon: Inbox, badge: counts.newLeads || counts.openLeads, permission: "leads.read" as Permission },
          { href: "/admin/clients", label: "Clients", icon: Users, permission: "clients.read" as Permission },
          { href: "/admin/projects", label: "Projects", icon: FolderKanban, permission: "projects.read" as Permission },
        ]
          .filter((tab) => permissions.has(tab.permission))
          .map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href || (tab.href !== "/admin" && pathname.startsWith(`${tab.href}/`));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileOpen(false)}
                className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center py-1 transition-colors touch-manipulation active:scale-95 ${
                  active ? "text-rhymvex-volt" : "text-rhymvex-white/55 hover:text-rhymvex-white"
                }`}
              >
                <div className="relative">
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {tab.badge ? (
                    <span className="absolute -top-1 -right-1.5 flex size-4 items-center justify-center rounded-full bg-rhymvex-volt text-[9px] font-bold text-rhymvex-black">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 text-[10px] font-medium leading-none">{tab.label}</span>
                {active ? (
                  <span className="absolute bottom-0.5 size-1 rounded-full bg-rhymvex-volt" aria-hidden="true" />
                ) : null}
              </Link>
            );
          })}

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center py-1 transition-colors touch-manipulation active:scale-95 ${
            mobileOpen ? "text-rhymvex-volt" : "text-rhymvex-white/55 hover:text-rhymvex-white"
          }`}
          aria-label={mobileOpen ? "Close navigation menu" : "Open full workspace navigation"}
        >
          <div className="relative">
            {mobileOpen ? (
              <X className="size-5 shrink-0 text-rhymvex-volt" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="size-5 shrink-0" aria-hidden="true" />
            )}
            {(counts.openTasks || 0) + (counts.todayBookings || 0) > 0 ? (
              <span className="absolute -top-1 -right-1.5 size-2 rounded-full bg-rhymvex-volt animate-pulse" />
            ) : null}
          </div>
          <span className="mt-1 text-[10px] font-medium leading-none">
            {mobileOpen ? "Close" : "More"}
          </span>
          {mobileOpen ? (
            <span className="absolute bottom-0.5 size-1 rounded-full bg-rhymvex-volt" aria-hidden="true" />
          ) : null}
        </button>
      </nav>

      {/* ------------------------------------------------------------------
          4. Desktop Sidebar Rail (>= 1024px)
          ------------------------------------------------------------------ */}
      <aside className="hidden lg:flex lg:flex-col rv-app-rail w-60 shrink-0">
        <div className="flex items-center gap-2.5 border-b border-rhymvex-white/8 px-4 py-4 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 min-w-0"
            aria-label="Rhymvex workspace overview"
          >
            <RvMark label={null} className="size-7 shrink-0" />
            <span className="flex flex-col leading-none min-w-0">
              <span className="truncate font-display text-sm font-bold tracking-tight text-rhymvex-white">
                Rhymvex
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
                Workspace
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {renderNavLinks()}
          {renderProfileCard()}
        </div>
      </aside>
    </>
  );
}
