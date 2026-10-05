import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { CredentialForm } from "../CredentialForm";
import { clientSignInAction } from "../actions";
import { getClientSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Client Portal Sign In",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ invited?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;

  // Already signed in? Respect safe next redirect or head to portal
  const session = await getClientSession();
  if (session) {
    const safeTarget =
      next && next.startsWith("/portal") && !next.startsWith("//") && !next.includes("\\")
        ? next
        : "/portal";
    redirect(safeTarget);
  }

  return (
    <AuthShell
      mode="client"
      eyebrow="Client Portal"
      title="Client Sign In"
      intro="Access your deliverables, contracts, active projects, and invoices in one secure space."
      footer={
        <div className="space-y-2">
          {params?.invited ? (
            <p>
              Invited but can&apos;t find the link?{" "}
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@rhymvex.space"}`}
                className="text-rhymvex-volt underline underline-offset-4 hover:text-rhymvex-white"
              >
                Email the Rhymvex team
              </a>{" "}
              and they&apos;ll send a new one.
            </p>
          ) : (
            <p>
              Need access? Ask your Rhymvex account lead to invite you to the portal.
            </p>
          )}
          <p className="text-[11px] text-rhymvex-white/40">
            Rhymvex staff member?{" "}
            <Link
              href={next?.startsWith("/admin") ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="text-rhymvex-volt underline underline-offset-4 hover:text-rhymvex-white"
            >
              Sign in to Staff Workspace
            </Link>
          </p>
        </div>
      }
    >
      <CredentialForm action={clientSignInAction} submitLabel="Sign in to the portal" nextUrl={next} />
    </AuthShell>
  );
}
