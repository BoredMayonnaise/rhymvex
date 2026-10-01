import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { listClients } from "@/lib/data/workspace";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { EmptyState, Panel, StatusPill } from "@/components/ui/primitives";
import { getOrgSettings } from "@/lib/data/org";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "idle" | "active" | "warn" | "done"> = {
  PROSPECT: "warn",
  ACTIVE: "active",
  DORMANT: "idle",
  CHURNED: "idle",
};

export default async function ClientsPage() {
  await requireStaffPermission("clients.read");
  const [clients, settings] = await Promise.all([listClients(), getOrgSettings()]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Clients</h1>
          <p className="rv-page-sub">
            {clients.length} {clients.length === 1 ? "client" : "clients"} · a lead becomes a
            client when a person decides to work together
          </p>
        </div>
      </header>

      <Panel flush>
        {clients.length === 0 ? (
          <EmptyState>
            No clients yet. Convert a lead from the Leads view to start a client relationship.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="rv-table">
              <caption className="sr-only">Clients</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Account manager</th>
                  <th scope="col" className="text-right">Projects</th>
                  <th scope="col" className="text-right">Portal</th>
                  <th scope="col" className="text-right">Outstanding</th>
                  <th scope="col">Since</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-medium text-rhymvex-white hover:text-rhymvex-volt"
                      >
                        {client.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-rhymvex-white/30">
                        {client.reference}
                        {client.industry ? ` · ${client.industry}` : ""}
                      </p>
                    </td>
                    <td>
                      <StatusPill
                        value={humanise(client.status)}
                        tone={STATUS_TONE[client.status] ?? "idle"}
                      />
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/60">
                      {client.account_manager ?? "—"}
                    </td>
                    <td className="rv-table-num text-right text-rhymvex-white/70">
                      {client.project_count}
                    </td>
                    <td className="rv-table-num text-right text-rhymvex-white/70">
                      {client.portal_users || (
                        <span className="text-rhymvex-white/25">none</span>
                      )}
                    </td>
                    <td className="rv-table-num whitespace-nowrap text-right text-rhymvex-white/70">
                      {client.outstanding > 0
                        ? formatMoney(client.outstanding, settings.currency)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap text-rhymvex-white/45">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rhymvex-volt hover:underline"
                      >
                        Open
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
