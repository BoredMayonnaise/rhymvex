import type { ReactNode } from "react";

/**
 * Status pill.
 *
 * A dot plus a text label, so state is never carried by colour alone. `tone` is
 * derived from the value by the caller, which keeps the mapping in one place
 * per domain rather than spreading colour decisions across the UI.
 */
export function StatusPill({
  value,
  tone = "idle",
}: {
  value: string;
  tone?: "idle" | "active" | "warn" | "done";
}) {
  return (
    <span className="rv-status" data-tone={tone}>
      <span className="rv-status-dot" aria-hidden="true" />
      {value}
    </span>
  );
}

/** Map a lead status to a tone. Open work reads active, closed reads done. */
export function leadStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "RECEIVED") return "warn";
  if (["REVIEWING", "QUALIFIED", "CONSULTATION", "PROPOSAL", "NEGOTIATION"].includes(status)) {
    return "active";
  }
  if (status === "WON") return "done";
  if (["LOST", "DECLINED", "ARCHIVED"].includes(status)) return "idle";
  return "idle";
}

export function projectStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "ON_HOLD" || status === "CANCELLED") return "warn";
  if (status === "DELIVERED") return "done";
  if (["DISCOVERY", "IN_PROGRESS", "IN_REVIEW"].includes(status)) return "active";
  return "idle";
}

export function bookingStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "REQUESTED") return "warn";
  if (status === "CONFIRMED") return "active";
  if (status === "COMPLETED") return "done";
  return "idle";
}

export function proposalStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "DRAFT") return "idle";
  if (["SENT", "VIEWED"].includes(status)) return "active";
  if (status === "ACCEPTED") return "done";
  if (["DECLINED", "WITHDRAWN"].includes(status)) return "warn";
  return "idle";
}

export function contractStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (["SIGNED", "ACTIVE", "COMPLETED"].includes(status)) return "done";
  if (["SENT", "AWAITING_SIGNATURE"].includes(status)) return "active";
  if (status === "TERMINATED") return "warn";
  return "idle";
}

export function invoiceStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "PAID") return "done";
  if (status === "OVERDUE") return "warn";
  if (["SENT", "VIEWED", "PART_PAID"].includes(status)) return "active";
  return "idle";
}

export function taskStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "DONE") return "done";
  if (status === "BLOCKED") return "warn";
  if (status === "IN_PROGRESS") return "active";
  return "idle";
}

export function invitationStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "PENDING") return "warn";
  if (status === "ACCEPTED") return "done";
  return "idle";
}

export function emailStatusTone(status: string): "idle" | "active" | "warn" | "done" {
  if (status === "SENT" || status === "DELIVERED") return "done";
  if (status === "FAILED" || status === "BOUNCED") return "warn";
  if (status === "QUEUED") return "active";
  return "idle";
}

/** Panel: the standard container in both workspaces. */
export function Panel({
  title,
  action,
  children,
  flush = false,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`rv-panel ${className}`}>
      {title ? (
        <header className="rv-panel-head">
          <h2 className="rv-panel-title">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={flush ? "rv-panel-body-flush" : "rv-panel-body"}>{children}</div>
    </section>
  );
}

/** Key metric tile for the overview row. */
export function Stat({
  label,
  value,
  meta,
  href,
}: {
  label: string;
  value: string;
  meta?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="rv-stat-label">{label}</p>
      <p className="rv-stat-value">{value}</p>
      {meta ? <p className="rv-stat-meta">{meta}</p> : null}
    </>
  );
  if (href) {
    return (
      <a href={href} className="rv-stat block transition-colors hover:border-rhymvex-volt/40">
        {body}
      </a>
    );
  }
  return <div className="rv-stat">{body}</div>;
}

/** Empty state. Always says what would appear here and what to do next. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rv-empty">{children}</p>;
}

/** Progress bar with an accessible value. */
export function Track({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="rv-track"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div className="rv-track-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/**
 * Dot sequence. Reads "n of total" to a screen reader, because five identical
 * circles convey nothing on their own.
 */
export function Dots({
  total,
  filled,
  label,
}: {
  total: number;
  filled: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(total, filled));
  return (
    <span
      className="rv-dots"
      role="img"
      aria-label={label ?? `${clamped} of ${total} steps complete`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="rv-dot" data-on={i < clamped} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Label/value pair, for record detail panels. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
