import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";
import { signOutAction } from "@/app/actions";
import { queryOne } from "@/lib/db/client";
import { countPendingInvitations, expireStaleInvitations } from "@/lib/auth/invitations";

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s — Rhymvex workspace" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The guard. Everything under /admin is behind this.
  const session = await requireStaff();

  // Reconcile expired invitations so the Staff & Access list shows the truth.
  // Expiry is enforced on read regardless; this only fixes the stored label.
  await expireStaleInvitations().catch(() => undefined);

  const [openLeads, newLeads, pendingInvites, openTasks, todayBookings] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM leads
        WHERE status = ANY($1::lead_status[])`,
      [["RECEIVED", "REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"]],
    ),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM leads WHERE status = 'RECEIVED'",
    ),
    countPendingInvitations("STAFF"),
    queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM tasks WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED')",
    ),
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM bookings
        WHERE scheduled_for >= date_trunc('day', now())
          AND scheduled_for < date_trunc('day', now()) + interval '1 day'
          AND status IN ('REQUESTED','CONFIRMED')`,
    ),
  ]);

  return (
    <div className="rv-app">
      <AdminNav
        permissions={session.permissions}
        counts={{
          openLeads: openLeads?.count ?? 0,
          newLeads: newLeads?.count ?? 0,
          pendingInvites,
          openTasks: openTasks?.count ?? 0,
          todayBookings: todayBookings?.count ?? 0,
        }}
        staffName={session.name}
        staffRole={session.role}
        signOutAction={signOutAction}
      />

      <div className="rv-app-main">
        <main id="main" className="rv-app-body">
          {children}
        </main>
      </div>
    </div>
  );
}
