import { requireStaffPermission } from "@/lib/auth/guards";
import { getOrgSettings, getResponseSlaMinutes } from "@/lib/data/org";
import { getStaffSession } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { smtpConfigured } from "@/lib/mail/smtp";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

/**
 * Settings.
 *
 * The response SLA here is the single thing that decides whether the public
 * success screen promises a timeframe. With it empty, the intake confirmation
 * deliberately says nothing about when, rather than inventing a number.
 */
export default async function SettingsPage() {
  const session = await requireStaffPermission("settings.read");
  const [settings, slaMinutes, outbox] = await Promise.all([
    getOrgSettings(),
    getResponseSlaMinutes(),
    query<{
      id: string;
      kind: string;
      to_address: string;
      subject: string;
      delivery: string;
      error_message: string | null;
      created_at: Date;
    }>(
      `SELECT id, kind, to_address, subject, delivery, error_message, created_at
         FROM email_outbox ORDER BY created_at DESC LIMIT 40`,
    ),
  ]);

  const canWrite = session.permissions.has("settings.write");

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Settings</h1>
          <p className="rv-page-sub">Organisation details, and the promise the site makes</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {canWrite ? (
          <SettingsForm settings={settings} slaMinutes={slaMinutes} csrfToken={session.csrfToken} />
        ) : (
          <Panel title="Organisation">
            <p className="text-sm text-rhymvex-white/60">Your role can view settings but not change them.</p>
          </Panel>
        )}

        <div className="flex flex-col gap-6">
          <Panel title="Response promise">
            <div className="flex flex-col gap-3">
              <div className="rv-stat">
                <p className="rv-stat-label">Configured SLA</p>
                <p className="rv-stat-value">
                  {slaMinutes ? `${slaMinutes} min` : "None"}
                </p>
                <p className="rv-stat-meta">
                  {slaMinutes
                    ? "The intake confirmation tells clients a person replies within this window."
                    : "No promise is made. The confirmation says a real person will be in touch, without saying when."}
                </p>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/35">
                Setting an SLA is a commitment. Leaving it empty is the honest default: the
                success screen will not invent a timeframe the team has not agreed to.
              </p>
            </div>
          </Panel>

          <Panel title="Environment">
            <dl className="rv-dl">
              <dt>Site origin</dt>
              <dd className="font-mono text-[11px]">{process.env.NEXT_PUBLIC_SITE_URL ?? "—"}</dd>
              <dt>SMTP</dt>
              <dd>
                {smtpConfigured()
                  ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587}`
                  : "Not configured"}
              </dd>
              <dt>From address</dt>
              <dd className="break-all font-mono text-[11px]">
                {process.env.SMTP_FROM ?? "—"}
              </dd>
              <dt>Internal alerts to</dt>
              <dd className="break-all font-mono text-[11px]">
                {process.env.INTERNAL_NOTIFICATION_EMAIL ?? settings.notification_email}
              </dd>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-rhymvex-white/30">
              Secrets are read from the environment only. SMTP_PASSWORD and SESSION_SECRET are
              never written to the database or displayed here.
            </p>
          </Panel>
        </div>
      </div>

      <Panel title="Email outbox" flush>
        <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/35">
          Every message the platform produced, whether delivered or written to the outbox because
          SMTP is unconfigured.
        </p>
        {outbox.length === 0 ? (
          <EmptyState>Nothing sent yet.</EmptyState>
        ) : (
          <ul className="max-h-[32rem] overflow-y-auto">
            {outbox.map((email) => (
              <li
                key={email.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-rhymvex-white/5 px-4 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-rhymvex-white/75">
                    {email.subject}
                  </span>
                  <span className="block truncate text-[10px] text-rhymvex-white/30">
                    {humanise(email.kind)} → {email.to_address}
                  </span>
                </span>
                {email.error_message ? (
                  <span className="text-[10px] text-rhymvex-ember">{email.error_message}</span>
                ) : null}
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                    email.delivery === "failed"
                      ? "border-rhymvex-ember/40 text-rhymvex-ember"
                      : email.delivery === "sent"
                        ? "border-rhymvex-volt/35 text-rhymvex-volt"
                        : "border-rhymvex-white/15 text-rhymvex-white/40"
                  }`}
                >
                  {email.delivery === "dev" ? "outbox only" : email.delivery}
                </span>
                <span
                  className="shrink-0 text-[10px] text-rhymvex-white/25"
                  title={formatDateTime(email.created_at)}
                >
                  {relativeTime(email.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
