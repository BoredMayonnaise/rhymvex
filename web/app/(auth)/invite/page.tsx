import type { Metadata } from "next";
import { loadInvitation } from "../actions";
import { AcceptInvitationForm } from "./AcceptInvitationForm";

export const metadata: Metadata = {
  title: "Accept your invitation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  OPERATIONS: "Operations",
  ACCOUNT_MANAGER: "Account Manager",
  PROJECT_MANAGER: "Project Manager",
  DESIGNER: "Designer",
  FINANCE: "Finance",
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // No token at all is the same outcome as a dead one: nothing to act on.
  if (!token) {
    return (
      <AcceptInvitationForm
        token=""
        kind="STAFF"
        email=""
        invitedName={null}
        clientName={null}
        roleName={null}
        expiresAt={new Date().toISOString()}
        invalid
        invalidMessage="This page needs a valid invitation link."
      />
    );
  }

  const result = await loadInvitation(token);

  if (!result.ok) {
    return (
      <AcceptInvitationForm
        token={token}
        kind="STAFF"
        email=""
        invitedName={null}
        clientName={null}
        roleName={null}
        expiresAt={new Date().toISOString()}
        invalid
        invalidMessage={result.message}
      />
    );
  }

  const { invitation } = result;

  return (
    <AcceptInvitationForm
      token={token}
      kind={invitation.kind}
      email={invitation.email}
      invitedName={invitation.name}
      clientName={invitation.clientName}
      roleName={invitation.role ? (ROLE_LABELS[invitation.role] ?? invitation.role) : null}
      expiresAt={invitation.expiresAt}
      invalid={false}
      invalidMessage={null}
    />
  );
}
