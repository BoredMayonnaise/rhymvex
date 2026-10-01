import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "../AuthShell";
import { CredentialForm } from "../CredentialForm";
import { clientSignInAction } from "../actions";
import { getClientSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Client portal sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const params = await searchParams;
  const session = await getClientSession();
  if (session) redirect("/portal");

  return (
    <AuthShell
      eyebrow="Client portal"
      title="Sign in"
      intro="Your projects, proposals, contracts and invoices, in one place."
      footer={
        params.invited ? (
          <>
            Invited but can&apos;t find the link?{" "}
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@rhymvex.com"}`}
              className="text-rhymvex-volt underline underline-offset-4"
            >
              Email the Rhymvex team
            </a>{" "}
            and they&apos;ll send a new one.
          </>
        ) : (
          "Need access? Ask your Rhymvex contact to invite you to the portal."
        )
      }
    >
      <CredentialForm action={clientSignInAction} submitLabel="Sign in to the portal" />
    </AuthShell>
  );
}
