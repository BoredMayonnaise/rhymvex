/**
 * This module is imported by client components for formatting helpers, so it
 * must stay free of Node built-ins and database imports. Reference-code
 * generation lives in `lib/db/reference.ts` for the same reason.
 */

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FMT.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${DATETIME_FMT.format(date)} UTC`;
}

/**
 * Compact relative time for activity feeds. Deliberately coarse: this is a
 * glance, and exact timestamps are always one click away in the detail view.
 */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 31) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

/** "in 3 days" / "in 2 hours", for upcoming work. */
export function untilTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "USD",
): string {
  if (amount === null || amount === undefined) return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";

  // A malformed currency code makes `Intl` throw a RangeError, and this function
  // is called from every page that shows money. Relying on validation alone
  // would leave any value that predates the constraint, or arrives via a restored
  // backup, able to 500 a page that has nothing wrong with it. Degrade to the
  // same em dash used for other unrenderable values rather than inventing a
  // currency: on an accounting or invoice screen a wrong symbol is worse than a
  // missing one. `settingsSchema` and the `org_settings_currency_known` check
  // constraint are what actually keep the stored value valid.
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return "—";
  }
}

/**
 * A sum that is only ever valid inside one currency.
 *
 * Amounts are never converted here, so a total is meaningless unless it names
 * the currency it was taken in. Every aggregate returns these grouped, and a
 * caller picks the one it wants to lead with rather than adding across them.
 */
export type CurrencyTotal = { currency: string; total: number; count: number };

/**
 * Group a list of rows into per-currency totals.
 *
 * This is the only correct way to total money in this codebase, and it exists
 * so no page has to hand-roll a `reduce`. A plain `reduce` over mixed rows
 * silently adds pesos to pounds and labels the result with one symbol, which is
 * not a number at all — it is a number-shaped lie. Every aggregate here is
 * grouped, and the caller leads with one currency and names the rest.
 *
 * Rows with no currency of their own fall back to `fallback`, which is the org
 * setting. That matches how the same rows are rendered individually, so a
 * single-currency workspace totals to exactly what it always did.
 *
 * `value` returns null for a row that has no amount (an unset `investment`, for
 * instance); those rows are skipped rather than counted as zero, so a count
 * always means "rows that actually contributed money".
 */
export function sumByCurrency<T>(
  rows: readonly T[],
  value: (row: T) => number | null | undefined,
  currency: (row: T) => string | null | undefined,
  fallback: string,
): CurrencyTotal[] {
  const byCurrency = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const amount = value(row);
    if (amount === null || amount === undefined || !Number.isFinite(amount)) continue;
    const code = currency(row) || fallback;
    const entry = byCurrency.get(code) ?? { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    byCurrency.set(code, entry);
  }

  return [...byCurrency].map(([code, entry]) => ({
    currency: code,
    total: entry.total,
    count: entry.count,
  }));
}

/**
 * The totals ordered so the preferred currency leads.
 *
 * The preferred currency is the one already displayed elsewhere on the page,
 * so the headline figure agrees with the table beneath it. When nothing was
 * recorded in it, the largest total leads instead: showing zero because the
 * setting happens to differ from the data is worse than showing the biggest
 * real number with its own symbol.
 */
export function preferCurrencyTotals(
  totals: CurrencyTotal[],
  preferred: string,
): CurrencyTotal[] {
  return [...totals].sort((a, b) => {
    if (a.currency === preferred && b.currency !== preferred) return -1;
    if (b.currency === preferred && a.currency !== preferred) return 1;
    return b.total - a.total;
  });
}

/**
 * The single total to lead with, and whether the rest are worth naming.
 *
 * `others` is the sum of everything not led with, so a page can say "and X more
 * in other currencies" without pretending those amounts are the same money.
 */
export function leadTotal(
  totals: CurrencyTotal[],
  preferred: string,
): { primary: CurrencyTotal | null; others: CurrencyTotal[] } {
  const ordered = preferCurrencyTotals(totals, preferred);
  const primary = ordered[0] ?? null;
  return { primary, others: ordered.slice(1) };
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

/** "BRAND_SYSTEM" → "Brand system". Used wherever an enum meets a human. */
export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "—";
}
