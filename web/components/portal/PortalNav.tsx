"use client";

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
  MessageSquare,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import { RvMark } from "@/components/RvMark";

/**
 * Client portal navigation.
 *
 * Intentionally shorter and plainer than the admin workspace. A client is not
 * managing the business, they are trying to answer "what is happening with my
 * project?", so there is no pipeline, no pipeline value, no staff load and no
 * configuration to look at.
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
      { href: "/portal/files", label: "Files", icon: FolderOpen },
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

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/portal") return pathname === "/portal";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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

  return (
    <aside className="rv-app-rail">
      <div className="flex items-center gap-2.5 border-b border-rhymvex-white/8 px-4 py-4">
        <Link href="/portal" className="flex items-center gap-2.5" aria-label="Portal overview">
          <RvMark label={null} className="size-7" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-tight text-rhymvex-white">
              {clientName}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
              Client portal
            </span>
          </span>
        </Link>
      </div>

      <nav aria-label="Portal" className="pb-4">
        {PORTAL_NAV.map((group) => (
          <div key={group.label} className="rv-nav-group">
            <p className="rv-nav-label">{group.label}</p>
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = item.countKey ? counts[item.countKey] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="rv-nav-link"
                      data-active={isActive(item, pathname)}
                      aria-current={isActive(item, pathname) ? "page" : undefined}
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

      <div className="mx-4 mt-2 rounded-lg border border-rhymvex-white/8 p-3">
        <p className="truncate text-xs font-semibold text-rhymvex-white">{userName}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-rhymvex-white/50">
          Client
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
    </aside>
  );
}
