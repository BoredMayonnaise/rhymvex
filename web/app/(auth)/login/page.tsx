import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "../AuthShell";
import { CredentialForm } from "../CredentialForm";
import { staffSignInAction } from "../actions";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? No reason to show a form.
  const session = await getStaffSession();
  if (session) redirect("/admin");

  return (
    <AuthShell
      eyebrow="Rhymvex workspace"
      title="Sign in"
      intro="For the Rhymvex team. Clients use the portal instead."
      footer="Lost access? Ask whoever administers the workspace to re-issue your invitation."
    >
      <CredentialForm action={staffSignInAction} submitLabel="Sign in" />
    </AuthShell>
  );
}
