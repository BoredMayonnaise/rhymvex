import { requireClientSession } from "@/lib/auth/guards";
import { Panel } from "@/components/ui/primitives";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const session = await requireClientSession();

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Settings</h1>
          <p className="rv-page-sub">Your password, and how to reach us</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <PasswordForm csrfToken={session.csrfToken} />

        <Panel title="Need something else?">
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-rhymvex-white/60">
            <p className="m-0">
              Send a message from the{" "}
              <a href="/portal/messages" className="text-rhymvex-volt hover:underline">
                messages page
              </a>{" "}
              and it reaches your Rhymvex contact.
            </p>
            <p className="m-0">
              If something here looks wrong, or you need access for a colleague, ask your contact
              and they&apos;ll invite them from their side.
            </p>
            <p className="m-0 text-rhymvex-white/40">
              This portal shows only your records. Anything about how Rhymvex runs stays on our
              side.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
