"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileSignature,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Settings,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { RvMark } from "@/components/RvMark";

/**
 * Client portal navigation.
 *
 * Provides a responsive, dual-mode navigation experience:
 * - Desktop: Fixed/sticky 15rem sidebar rail with grouped nav and profile footer.
 * - Mobile (< 1024px):
 *   - Sticky top bar with client branding, current section title, action counter, and hamburger.
 *   - Ergonomic bottom navigation bar for one-thumb switching between Overview, Messages, Projects, Invoices, and More.
 *   - Smooth slide-over drawer that is completely hidden (invisible & pointer-events-none) when closed to eliminate shadow-bleeding and horizontal jitter.
 */

type NavItem = { href: string; label: string; icon: LucideIcon; countKey?: string };
type NavGroup = { label: string; items: NavItem[] };

export const PORTAL_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/portal", label: "Overview", icon: LayoutDashboard },
      { href: "/portal/messages", label: "Messages", icon: MessageSquare, countKey: "unreadMessages" },
      { href: "/portal/projects", label: "Projects", icon: FolderOpen },
      { href: "/portal/proposals", label: "Proposals", icon: FileText, countKey: "openProposals" },
      { href: "/portal/contracts", label: "Contracts", icon: FileSignature, countKey: "unsignedContracts" },
      { href: "/portal/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/portal/files", label: "Files", icon: Paperclip },
      { href: "/portal/invoices", label: "Invoices", icon: CreditCard, countKey: "unpaidInvoices" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portal/profile", label: "Profile", icon: User },
      { href: "/portal/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/portal") return pathname === "/portal";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getActiveSectionLabel(pathname: string): string | null {
  for (const group of PORTAL_NAV) {
    for (const item of group.items) {
      if (item.href !== "/portal" && (pathname === item.href || pathname.startsWith(`${item.href}/`))) {
        return item.label;
      }
    }
  }
  return null;
}

export function PortalNav({
  clientName,
  userName,
  counts,
  signOutAction,
}: {
  clientName: string;
  userName: string;
  counts: Record<string, number>;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open & handle Escape key
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

  const totalUnread =
    (counts.unreadMessages ?? 0) +
    (counts.openProposals ?? 0) +
    (counts.unsignedContracts ?? 0) +
    (counts.unpaidInvoices ?? 0);

  const activeSection = getActiveSectionLabel(pathname);

  // Render navigation links list
  const renderNavLinks = (onNavigate?: () => void) => (
    <nav aria-label="Portal Navigation" className="flex-1 overflow-y-auto pb-4">
      {PORTAL_NAV.map((group) => (
        <div key={group.label} className="rv-nav-group">
          <p className="rv-nav-label">{group.label}</p>
          <ul>
            {group.items.map((item) => {
              const Icon = item.icon;
              const count = item.countKey ? counts[item.countKey] : 0;
              const active = isItemActive(item, pathname);
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
      ))}
    </nav>
  );

  // Render user info & sign out card
  const renderProfileCard = () => (
    <div className="mx-4 mb-4 rounded-lg border border-rhymvex-white/8 bg-rhymvex-slate/40 p-3">
      <p className="truncate text-xs font-semibold text-rhymvex-white">{userName}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-rhymvex-white/50">
        Client Account
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
          href="/portal"
          className="flex items-center gap-2.5 min-w-0"
          aria-label="Portal overview"
        >
          <RvMark label={null} className="size-6 shrink-0" />
          <span className="flex flex-col leading-none min-w-0">
            <span className="truncate max-w-[160px] font-display text-sm font-bold tracking-tight text-rhymvex-white sm:max-w-[260px]">
              {clientName}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
              {activeSection ? `Portal · ${activeSection}` : "Client Portal"}
            </span>
          </span>
        </Link>

        {totalUnread > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full border border-rhymvex-volt/30 bg-rhymvex-volt/10 px-2.5 py-1 text-[11px] font-semibold text-rhymvex-volt shrink-0">
            <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" aria-hidden="true" />
            {totalUnread} attention
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
            aria-label="Client portal navigation"
          >
            <div className="flex items-center justify-between border-b border-rhymvex-white/8 px-4 py-3.5 shrink-0">
              <Link
                href="/portal"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <RvMark label={null} className="size-7 shrink-0" />
                <span className="flex flex-col leading-none min-w-0">
                  <span className="truncate max-w-[180px] font-display text-sm font-bold tracking-tight text-rhymvex-white">
                    {clientName}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
                    Client portal
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
        aria-label="Quick Navigation"
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-rhymvex-white/10 bg-rhymvex-black/95 px-1 py-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
      >
        {[
          { href: "/portal", label: "Overview", icon: LayoutDashboard },
          { href: "/portal/messages", label: "Messages", icon: MessageSquare, badge: counts.unreadMessages },
          { href: "/portal/projects", label: "Projects", icon: FolderOpen },
          { href: "/portal/invoices", label: "Invoices", icon: CreditCard, badge: counts.unpaidInvoices },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || (tab.href !== "/portal" && pathname.startsWith(`${tab.href}/`));
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
          aria-label={mobileOpen ? "Close navigation menu" : "Open full portal navigation"}
        >
          <div className="relative">
            {mobileOpen ? (
              <X className="size-5 shrink-0 text-rhymvex-volt" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="size-5 shrink-0" aria-hidden="true" />
            )}
            {(counts.openProposals || 0) + (counts.unsignedContracts || 0) > 0 ? (
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
            href="/portal"
            className="flex items-center gap-2.5 min-w-0"
            aria-label="Portal overview"
          >
            <RvMark label={null} className="size-7 shrink-0" />
            <span className="flex flex-col leading-none min-w-0">
              <span className="truncate font-display text-sm font-bold tracking-tight text-rhymvex-white">
                {clientName}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
                Client portal
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
