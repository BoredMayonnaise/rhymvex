"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  Shield,
  Briefcase,
  Key,
  ExternalLink,
  ChevronDown,
  Bell,
  MailCheck,
} from "lucide-react";
import { testSmtpConnectionAction, type SmtpTestActionResult } from "@/app/admin/actions";
import type { ResolvedSmtpConfig } from "@/lib/mail/providers";

export function SmtpStatusPanel({
  csrfToken,
  businessConfig,
  systemConfig,
  notificationEmail,
}: {
  csrfToken: string;
  businessConfig: ResolvedSmtpConfig;
  systemConfig: ResolvedSmtpConfig;
  notificationEmail: string;
}) {
  const [businessState, businessAction, businessPending] = useActionState<SmtpTestActionResult | null, FormData>(
    testSmtpConnectionAction,
    null,
  );
  const [systemState, systemAction, systemPending] = useActionState<SmtpTestActionResult | null, FormData>(
    testSmtpConnectionAction,
    null,
  );

  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="rv-panel overflow-hidden">
      <header className="rv-panel-head">
        <div className="flex items-center gap-2.5">
          <Shield className="size-4 text-rhymvex-volt" aria-hidden="true" />
          <h2 className="rv-panel-title">Dual-Channel SMTP Engine</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="rv-btn rv-btn-ghost rv-btn-sm"
          >
            <Key className="size-3.5" aria-hidden="true" />
            <span>Setup & DNS Guide</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${showGuide ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div className="rv-panel-body flex flex-col gap-4">
        {/* Dual Channel Matrix */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Channel 1: Client-Facing Channel (Zoho) */}
          <div className="rounded-lg border border-rhymvex-white/10 bg-rhymvex-black/40 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-4 text-rhymvex-volt" aria-hidden="true" />
                  <h3 className="font-semibold text-sm text-rhymvex-white">Client Business Channel</h3>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                    businessConfig.isConfigured
                      ? "bg-rhymvex-volt/10 text-rhymvex-volt border border-rhymvex-volt/25"
                      : "bg-rhymvex-white/5 text-rhymvex-white/60 border border-rhymvex-white/10"
                  }`}
                >
                  {businessConfig.isConfigured ? "Zoho Live" : "Dev Outbox"}
                </span>
              </div>

              <p className="text-xs text-rhymvex-white/60 mb-3 leading-relaxed">
                Dedicated client communications: Intake "Thank You" confirmations, Client Portal invitations, and outbound proposals.
              </p>

              <div className="grid gap-2 text-[11px] font-mono bg-rhymvex-slate/40 p-2.5 rounded border border-rhymvex-white/5 mb-3">
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Provider:</span>
                  <span className="text-rhymvex-white/80">{businessConfig.providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Host & Port:</span>
                  <span className="text-rhymvex-white/80">{businessConfig.host}:{businessConfig.port} ({businessConfig.secure ? "SSL" : "TLS"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Sender (From):</span>
                  <span className="text-rhymvex-volt truncate max-w-[200px]" title={businessConfig.from}>{businessConfig.from}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Auth Account:</span>
                  <span className="text-rhymvex-white/80 truncate max-w-[200px]" title={businessConfig.user}>{businessConfig.user || "(not configured)"}</span>
                </div>
              </div>

              {businessState ? (
                businessState.ok ? (
                  <div className="flex items-start gap-2 rounded border border-rhymvex-volt/30 bg-rhymvex-volt/[0.08] p-2.5 text-xs text-rhymvex-white mb-3">
                    <CheckCircle2 className="size-3.5 shrink-0 text-rhymvex-volt mt-0.5" />
                    <div>
                      <strong className="text-rhymvex-volt font-medium block">Zoho Handshake Verified ({businessState.latencyMs}ms)</strong>
                      <span className="text-[11px] text-rhymvex-white/70">{businessState.message}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/[0.08] p-2.5 text-xs text-rhymvex-white mb-3">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong className="text-amber-400 font-medium block">Verification Failed</strong>
                      <span className="text-[11px] text-rhymvex-white/80 font-mono block">{businessState.message}</span>
                      {businessState.hint ? <p className="mt-1 text-[11px] text-amber-200/90">{businessState.hint}</p> : null}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <form action={businessAction}>
              <input type="hidden" name="csrf" value={csrfToken} />
              <input type="hidden" name="channel" value="business" />
              <button
                type="submit"
                disabled={businessPending}
                className="rv-btn rv-btn-secondary rv-btn-sm w-full"
              >
                {businessPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Verifying Zoho Handshake...</span>
                  </>
                ) : (
                  <>
                    <MailCheck className="size-3.5 text-rhymvex-volt" aria-hidden="true" />
                    <span>Test Zoho Channel</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Channel 2: System Channel (Gmail) */}
          <div className="rounded-lg border border-rhymvex-white/10 bg-rhymvex-black/40 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-rhymvex-volt" aria-hidden="true" />
                  <h3 className="font-semibold text-sm text-rhymvex-white">Internal System Channel</h3>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                    systemConfig.isConfigured
                      ? "bg-rhymvex-volt/10 text-rhymvex-volt border border-rhymvex-volt/25"
                      : "bg-rhymvex-white/5 text-rhymvex-white/60 border border-rhymvex-white/10"
                  }`}
                >
                  {systemConfig.isConfigured ? "Gmail Live" : "Dev Outbox"}
                </span>
              </div>

              <p className="text-xs text-rhymvex-white/60 mb-3 leading-relaxed">
                Background operations: Team invitations, real-time new lead inflow notices with pipeline metrics, and system error health alerts.
              </p>

              <div className="grid gap-2 text-[11px] font-mono bg-rhymvex-slate/40 p-2.5 rounded border border-rhymvex-white/5 mb-3">
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Provider:</span>
                  <span className="text-rhymvex-white/80">{systemConfig.providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Host & Port:</span>
                  <span className="text-rhymvex-white/80">{systemConfig.host}:{systemConfig.port} ({systemConfig.secure ? "SSL" : "TLS"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Alert Destination:</span>
                  <span className="text-rhymvex-volt truncate max-w-[200px]" title={notificationEmail}>{notificationEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rhymvex-white/40">Auth Account:</span>
                  <span className="text-rhymvex-white/80 truncate max-w-[200px]" title={systemConfig.user}>{systemConfig.user || "(not configured)"}</span>
                </div>
              </div>

              {systemState ? (
                systemState.ok ? (
                  <div className="flex items-start gap-2 rounded border border-rhymvex-volt/30 bg-rhymvex-volt/[0.08] p-2.5 text-xs text-rhymvex-white mb-3">
                    <CheckCircle2 className="size-3.5 shrink-0 text-rhymvex-volt mt-0.5" />
                    <div>
                      <strong className="text-rhymvex-volt font-medium block">Gmail Handshake Verified ({systemState.latencyMs}ms)</strong>
                      <span className="text-[11px] text-rhymvex-white/70">{systemState.message}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/[0.08] p-2.5 text-xs text-rhymvex-white mb-3">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong className="text-amber-400 font-medium block">Verification Failed</strong>
                      <span className="text-[11px] text-rhymvex-white/80 font-mono block">{systemState.message}</span>
                      {systemState.hint ? <p className="mt-1 text-[11px] text-amber-200/90">{systemState.hint}</p> : null}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <form action={systemAction}>
              <input type="hidden" name="csrf" value={csrfToken} />
              <input type="hidden" name="channel" value="system" />
              <button
                type="submit"
                disabled={systemPending}
                className="rv-btn rv-btn-secondary rv-btn-sm w-full"
              >
                {systemPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Verifying Gmail Handshake...</span>
                  </>
                ) : (
                  <>
                    <Terminal className="size-3.5 text-rhymvex-volt" aria-hidden="true" />
                    <span>Test Gmail Channel</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Expandable Setup Instructions */}
        {showGuide ? (
          <div className="rounded-lg border border-rhymvex-white/10 bg-rhymvex-black/60 p-4 text-xs">
            <h3 className="font-semibold text-rhymvex-white mb-3 text-sm">
              Dual-Channel Configuration Guide (Zoho Business & Gmail App Passwords)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-rhymvex-white/10 p-3 bg-rhymvex-slate/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-rhymvex-volt">1. Zoho Mail (Client Channel)</span>
                  <a
                    href="https://accounts.zoho.com/home#security/app_password"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-rhymvex-volt hover:underline"
                  >
                    Zoho App Passwords <ExternalLink className="size-2.5" />
                  </a>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-rhymvex-white/70 text-[11px] leading-relaxed">
                  <li>Log in to Zoho Accounts (<code className="text-rhymvex-white">accounts.zoho.com</code>).</li>
                  <li>Go to <strong>Security</strong> → <strong>Application-Specific Passwords</strong>.</li>
                  <li>Generate a password named <code className="text-rhymvex-volt">Rhymvex Client Mail</code>.</li>
                  <li>
                    Set <code className="text-rhymvex-white">ZOHO_SMTP_USER=support@rhymvex.space</code> and <code className="text-rhymvex-white">ZOHO_SMTP_PASSWORD</code>.
                  </li>
                  <li className="text-amber-300/90">
                    Zoho requires the sender address to match the account email to avoid relay rejection (Error 553).
                  </li>
                </ol>
              </div>

              <div className="rounded-md border border-rhymvex-white/10 p-3 bg-rhymvex-slate/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-rhymvex-volt">2. Google / Gmail (System Channel)</span>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-rhymvex-volt hover:underline"
                  >
                    Google App Passwords <ExternalLink className="size-2.5" />
                  </a>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-rhymvex-white/70 text-[11px] leading-relaxed">
                  <li>Ensure <strong>2-Step Verification</strong> is ON in your Google Account.</li>
                  <li>Visit <code className="text-rhymvex-white">myaccount.google.com/apppasswords</code>.</li>
                  <li>Create an App Password named <code className="text-rhymvex-volt">Rhymvex System Mail</code>.</li>
                  <li>Copy the 16-character code into <code className="text-rhymvex-white">GMAIL_SMTP_PASSWORD</code>.</li>
                  <li>
                    Set <code className="text-rhymvex-white">INTERNAL_NOTIFICATION_EMAIL</code> to the inbox where you want to receive lead alerts.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-rhymvex-white/10 flex items-center justify-between">
              <span className="text-rhymvex-white/50 text-[11px]">
                Interactive CLI Tool available in terminal:
              </span>
              <code className="text-rhymvex-volt bg-rhymvex-black px-2 py-1 rounded text-[11px] font-mono border border-rhymvex-white/10">
                npm run mail:app
              </code>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
