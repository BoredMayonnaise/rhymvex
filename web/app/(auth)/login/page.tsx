import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { CredentialForm } from "../CredentialForm";
import { staffSignInAction } from "../actions";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;

  // Already signed in? Respect safe next redirect or head to workspace
  const session = await getStaffSession();
  if (session) {
    const safeTarget =
      next && next.startsWith("/admin") && !next.startsWith("//") && !next.includes("\\")
        ? next
        : "/admin";
    redirect(safeTarget);
  }

  return (
    <AuthShell
      mode="staff"
      eyebrow="Staff Workspace"
      title="Team Sign In"
      intro="For Rhymvex directors and staff members. Enter your team credentials to access the workspace."
      footer={
        <div className="space-y-2">
          <p>
            Looking for the client portal?{" "}
            <Link
              href={next?.startsWith("/portal") ? `/portal-sign-in?next=${encodeURIComponent(next)}` : "/portal-sign-in"}
              className="text-rhymvex-volt underline underline-offset-4 hover:text-rhymvex-white"
            >
              Sign in to Client Portal
            </Link>
          </p>
          <p className="text-[11px] text-rhymvex-white/40">
            Lost access? Ask a workspace administrator to re-issue your invitation.
          </p>
        </div>
      }
    >
      <CredentialForm action={staffSignInAction} submitLabel="Sign in to workspace" nextUrl={next} />
    </AuthShell>
  );
}
