import { requireClientSession } from "@/lib/auth/guards";
import { getPortalProfile } from "@/lib/data/portal";
import { formatDate, relativeTime } from "@/lib/format";
import { Field, Panel } from "@/components/ui/primitives";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const session = await requireClientSession();
  const profile = await getPortalProfile(session);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Profile</h1>
          <p className="rv-page-sub">Your details, as we hold them</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {profile ? (
          <ProfileForm
            name={profile.name}
            email={profile.email}
            roleTitle={profile.role_title}
            csrfToken={session.csrfToken}
          />
        ) : null}

        <Panel title="Account">
          <dl className="rv-dl">
            <Field label="Email">
              <span className="break-all">{profile?.email ?? session.email}</span>
            </Field>
            <Field label="Company">{profile?.client_name ?? session.clientName}</Field>
            <Field label="Member since">{formatDate(profile?.created_at)}</Field>
            <Field label="Last sign-in">
              {profile?.last_login_at ? relativeTime(profile.last_login_at) : "This is your first session"}
            </Field>
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-rhymvex-white/50">
            Your email address is what we use to send your confirmations and project updates. To
            change it, ask your Rhymvex contact.
          </p>
        </Panel>
      </div>
    </div>
  );
}
