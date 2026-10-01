import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { can } from "@/lib/auth/session";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { humanise } from "@/lib/format";
import { ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * The refusal page.
 *
 * Reached when a signed-in member opens something their role does not cover,
 * usually by typing a URL or following a stale link. It says three things: what
 * was refused, which role is holding them back, and where they can go instead.
 *
 * The links below are filtered against the member's own permissions, so this
 * page never becomes a directory of things they also cannot open.
 */
export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string; role?: string; purpose?: string }>;
}) {
  // Reaching this page still requires a real staff session.
  const session = await requireStaff();
  const params = await searchParams;

  const permission = (params.permission ?? "").slice(0, 60);
  const role = params.role && ROLES.includes(params.role as (typeof ROLES)[number])
    ? (params.role as (typeof ROLES)[number])
    : null;
  const purpose = (params.purpose ?? "do that").slice(0, 120);

  // Filtered against this member's own permissions, so the page never becomes
  // a directory of places that would only bounce them again.
  const reachable = ADMIN_NAV.flatMap((group) => group.items).filter((item) =>
    can(session, item.permission),
  );

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rhymvex-volt" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-rhymvex-white">
            This part of the workspace isn&apos;t open to you.
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-rhymvex-white/60">
            You&apos;re signed in as{" "}
            <span className="font-semibold text-rhymvex-white">
              {role ? humanise(role) : "a staff member"}
            </span>
            , and that role can&apos;t {purpose}.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-rhymvex-white/8 bg-rhymvex-slate/30 p-4">
        <p className="m-0 text-xs leading-relaxed text-rhymvex-white/45">
          This is a deliberate boundary, not a broken page. Roles are enforced on the server for
          every action, so a link being visible would not have gained you anything.
          {permission ? (
            <>
              {" "}
              Required permission:{" "}
              <code className="font-mono text-[11px] text-rhymvex-white/65">{permission}</code>
            </>
          ) : null}
        </p>
        {role ? (
          <p className="mt-2.5 mb-0 text-xs leading-relaxed text-rhymvex-white/45">
            If you need this as part of your work, ask an administrator to change your role in{" "}
            <span className="text-rhymvex-white/65">Staff &amp; Access</span>.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="rv-panel-title mb-2">Where you can go</p>
        {reachable.length === 0 ? (
          <p className="m-0 text-xs text-rhymvex-white/40">
            Your role has no sections open yet. An administrator needs to update your access.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {reachable.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block rounded-full border border-rhymvex-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-rhymvex-white/45 transition-colors hover:border-rhymvex-volt/45 hover:text-rhymvex-volt"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/admin"
        className="mt-6 inline-flex items-center gap-1.5 self-start text-xs text-rhymvex-white/45 transition-colors hover:text-rhymvex-volt"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to a page you can open
      </Link>
    </div>
  );
}
