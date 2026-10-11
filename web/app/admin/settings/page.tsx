import { requireStaffPermission } from "@/lib/auth/guards";
import { getOrgSettings, getResponseSlaMinutes } from "@/lib/data/org";
import { describeSettings, EFFECT_LABEL, type EffectStatus } from "@/lib/org-setting-effects";
import { getStaffSession } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { formatDateTime, humanise, relativeTime } from "@/lib/format";
import { EmptyState, Panel, StatusPill } from "@/components/ui/primitives";
import { smtpConfigured } from "@/lib/mail/smtp";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

const EFFECT_TONE: Record<EffectStatus, "done" | "warn" | "idle"> = {
  live: "done",
  partial: "warn",
  unsafe: "warn",
  inert: "idle",
};

/**
 * Settings.
 *
 * The point of this page is not only to edit six values, but to say what each
 * one is worth. Three of them are inert — stored, audited, and read by nothing
 * — and a form that presents all six as equivalent is the kind of thing that
 * makes people stop trusting a settings screen.
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
  const effects = describeSettings(settings);

  /** The value as a person reads it, not as it is stored. */
  const display: Record<keyof typeof settings, string> = {
    response_sla_minutes: slaMinutes ? `${slaMinutes} min` : "None",
    currency: settings.currency,
    contact_email: settings.contact_email,
    notification_email: settings.notification_email,
    company_name: settings.company_name,
    timezone: settings.timezone,
  };

  const order: Array<keyof typeof settings> = [
    "company_name",
    "contact_email",
    "notification_email",
    "timezone",
    "currency",
    "response_sla_minutes",
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Settings</h1>
          <p className="rv-page-sub">Organisation details, and what each one actually changes</p>
        </div>
        {canWrite ? (
          <SettingsForm
            settings={settings}
            slaMinutes={slaMinutes}
            csrfToken={session.csrfToken}
            effects={effects}
          />
        ) : null}
      </header>

      <Panel title="What each setting changes">
        <ul className="flex flex-col">
          {order.map((key) => {
            const effect = effects[key];
            return (
              <li
                key={key}
                className="border-b border-rhymvex-white/5 py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] text-rhymvex-white/45">{key}</span>
                    <span className="text-sm font-medium text-rhymvex-white">
                      {display[key]}
                    </span>
                  </span>
                  <StatusPill
                    value={EFFECT_LABEL[effect.status]}
                    tone={EFFECT_TONE[effect.status]}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-rhymvex-white/55">
                  {effect.applies}
                </p>
                {effect.caveat ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-rhymvex-ember/70">
                    {effect.caveat}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-rhymvex-white/45">
          Three of these six are stored and read by nothing. They stay on the form rather than being
          hidden, because they are the ones most likely to be coming — but saving one changes no
          behaviour, and the audit trail is the only record of the attempt.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Response promise">
          <div className="flex flex-col gap-3">
            <div className="rv-stat">
              <p className="rv-stat-label">Configured SLA</p>
              <p className="rv-stat-value">{slaMinutes ? `${slaMinutes} min` : "None"}</p>
              <p className="rv-stat-meta">
                {slaMinutes
                  ? "The intake confirmation tells clients a person replies within this window."
                  : "No promise is made. The confirmation says a real person will be in touch, without saying when."}
              </p>
            </div>
            <p className="m-0 text-[11px] leading-relaxed text-rhymvex-white/50">
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
            <dt>Alerts are sent to</dt>
            <dd className="break-all font-mono text-[11px]">
              {process.env.INTERNAL_NOTIFICATION_EMAIL ??
                process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
                settings.notification_email}
            </dd>
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-rhymvex-white/50">
            Secrets are read from the environment only. SMTP_PASSWORD and SESSION_SECRET are
            never written to the database or displayed here.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-rhymvex-white/45">
            Addresses above come from the environment, not from this page&apos;s form. Values that
            are read at build time — the footer and sign-in contact address among them — change
            only when the site is rebuilt.
          </p>
        </Panel>
      </div>

      {!canWrite ? (
        <Panel title="Organisation">
          <p className="text-sm text-rhymvex-white/60">
            Your role can view settings but not change them.
          </p>
        </Panel>
      ) : null}

      <Panel title="Email outbox" flush>
        <p className="border-b border-rhymvex-white/5 px-4 py-2 text-[11px] text-rhymvex-white/50">
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
                  <span className="block truncate text-[10px] text-rhymvex-white/50">
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
                        : "border-rhymvex-white/15 text-rhymvex-white/50"
                  }`}
                >
                  {email.delivery === "dev" ? "outbox only" : email.delivery}
                </span>
                <span
                  className="shrink-0 text-[10px] text-rhymvex-white/50"
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