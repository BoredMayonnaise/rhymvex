import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  FileSignature,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  Receipt,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/rbac";

/**
 * Admin workspace navigation.
 *
 * The permission on each entry is the single source of truth for both the
 * rendered nav and the page guard, so a link can never appear for someone the
 * page would refuse. Entries a role cannot use are omitted rather than
 * disabled: a nav full of dead ends is worse than a shorter nav.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** Show a count badge when non-zero. */
  countKey?: "openLeads" | "newLeads" | "pendingInvites" | "openTasks" | "todayBookings";
  /** Match nested routes too, so a detail page keeps its nav item lit. */
  matchPrefix?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: "leads.read" },
      { href: "/admin/leads", label: "Leads", icon: Inbox, permission: "leads.read", countKey: "openLeads", matchPrefix: true },
      { href: "/admin/clients", label: "Clients", icon: Users, permission: "clients.read", matchPrefix: true },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, permission: "bookings.read", countKey: "todayBookings" },
      { href: "/admin/proposals", label: "Proposals", icon: FileText, permission: "proposals.read", matchPrefix: true },
      { href: "/admin/contracts", label: "Contracts", icon: FileSignature, permission: "contracts.read", matchPrefix: true },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, permission: "projects.read", matchPrefix: true },
      { href: "/admin/tasks", label: "Team Tasks", icon: ListChecks, permission: "tasks.read", countKey: "openTasks" },
      { href: "/admin/accounting", label: "Accounting", icon: Receipt, permission: "accounting.read" },
      { href: "/admin/library", label: "Library", icon: BookOpen, permission: "library.read" },
      { href: "/admin/email", label: "Business Email", icon: Mail, permission: "email.read" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports.read" },
      { href: "/admin/staff", label: "Staff & Access", icon: Briefcase, permission: "staff.read" },
      { href: "/admin/security", label: "Security", icon: Shield, permission: "security.read" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.read" },
    ],
  },
];

/** Flatten to just the hrefs a role may reach, for middleware fast paths. */
export function permittedAdminPaths(permissions: Set<Permission>): string[] {
  return ADMIN_NAV.flatMap((group) =>
    group.items.filter((item) => permissions.has(item.permission)).map((item) => item.href),
  );
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  if (item.matchPrefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}
