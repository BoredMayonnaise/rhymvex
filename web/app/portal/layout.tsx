import type { Metadata } from "next";
import { requireClientSession } from "@/lib/auth/guards";
import { PortalNav } from "@/components/portal/PortalNav";
import { signOutAction } from "@/app/actions";
import { getPortalOverview } from "@/lib/data/portal";

export const metadata: Metadata = {
  title: { default: "Your portal", template: "%s — Rhymvex" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Client portal shell.
 *
 * A separate workspace from the admin one, guarded by a different session type
 * and a different cookie. A portal cookie is never accepted by an admin route,
 * and an admin cookie is never accepted here.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // The guard. A portal session is required for every page beneath this layout.
  const session = await requireClientSession();

  const overview = await getPortalOverview(session);

  return (
    <div className="rv-app">
      <PortalNav
        clientName={session.clientName}
        userName={session.name}
        counts={{
          unreadMessages: overview.unreadMessages,
          openProposals: overview.openProposals,
          unsignedContracts: overview.unsignedContracts,
          unpaidInvoices: overview.unpaidInvoices,
        }}
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
