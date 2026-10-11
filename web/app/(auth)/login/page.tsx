import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "../AuthShell";
import { CredentialForm } from "../CredentialForm";
import { signInAction } from "../actions";
import { getClientSession, getStaffSession } from "@/lib/auth/session";
import {
  resolveWorkspace,
  signInTarget,
  workspaceForPath,
  type Workspace,
} from "@/lib/auth/workspace";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; workspace?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;
  const invited = params?.invited;

  // A deep link already knows which workspace it belongs to, so it carries the
  // hint. Someone bounced off `/portal/invoices` should land back on the portal
  // rather than be auto-detected into staff when their address also happens to
  // be on the team. An explicit `workspace` still wins — it is a choice someone
  // made on purpose, and a stale link must not overrule it.
  const requested = params?.workspace ? resolveWorkspace(params.workspace) : null;
  const workspace: Workspace = requested ?? workspaceForPath(next) ?? "auto";

  const [staffSession, clientSession] = await Promise.all([getStaffSession(), getClientSession()]);

  // Already signed in somewhere. Send them to the workspace that owns the
  // session rather than showing them a form for one they cannot use — otherwise
  // signing in as a client and then hitting a staff link dead-ends on a page that
  // looks like a broken password field.
  const active = staffSession ? "staff" : clientSession ? "client" : null;
  if (active) {
    redirect(signInTarget(active, next));
  }

  return (
    <AuthShell
      workspace={workspace}
      nextUrl={next}
      eyebrow="Rhymvex Access"
      title="Sign in"
      intro="One set of credentials for the team workspace and the client portal. We'll take you to the right one."
      footer={
        <div className="space-y-2">
          {invited ? (
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
              Need portal access?{" "}
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@rhymvex.space"}`}
                className="text-rhymvex-volt underline underline-offset-4 hover:text-rhymvex-white"
              >
                Ask your account lead
              </a>{" "}
              for an invitation.
            </p>
          )}
          <p className="text-[11px] text-rhymvex-white/40">
            Lost access? Ask a workspace administrator to re-issue your invitation.
          </p>
        </div>
      }
    >
      <CredentialForm
        action={signInAction}
        submitLabel="Sign in"
        nextUrl={next}
        workspace={workspace}
      />
    </AuthShell>
  );
}