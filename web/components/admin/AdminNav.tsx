"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ADMIN_NAV, isNavActive, type NavItem } from "@/lib/admin-nav";
import { RvMark } from "@/components/RvMark";
import type { Permission } from "@/lib/auth/rbac";

/**
 * Workspace rail.
 *
 * Rendered from the permission set the server already resolved, so an item is
 * only present if the page behind it would let this person through. This is
 * convenience, not enforcement: the page guards are the boundary.
 */
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

  return (
    <aside className="rv-app-rail">
      <div className="flex items-center gap-2.5 border-b border-rhymvex-white/8 px-4 py-4">
        <Link href="/admin" className="flex items-center gap-2.5" aria-label="Rhymvex workspace overview">
          <RvMark label={null} className="size-7" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-tight text-rhymvex-white">
              Rhymvex
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/30">
              Workspace
            </span>
          </span>
        </Link>
      </div>

      <nav aria-label="Workspace" className="pb-4">
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
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="rv-nav-link"
                        data-active={isNavActive(item, pathname)}
                        aria-current={isNavActive(item, pathname) ? "page" : undefined}
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

      <div className="mx-4 mt-2 rounded-lg border border-rhymvex-white/8 p-3">
        <p className="truncate text-xs font-semibold text-rhymvex-white">{staffName}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-rhymvex-white/35">
          {staffRole.replace(/_/g, " ")}
        </p>
        <form action={signOutAction} className="mt-2.5">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-[11px] text-rhymvex-white/45 transition-colors hover:text-rhymvex-volt"
          >
            <LogOut className="size-3" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
