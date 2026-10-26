import { query, queryOne } from "@/lib/db/client";
import type { CurrencyTotal } from "@/lib/format";

/**
 * Reporting totals across currencies.
 *
 * Two figures are produced for every aggregate, and they answer different
 * questions:
 *
 *   `groups`     what is actually owed or earned, per currency. Always correct,
 *                never depends on a rate, and is what a client-facing page shows.
 *   `converted`  the same money expressed in one reporting currency, for the
 *                admin who needs a single number. Null when conversion is off or
 *                no rate was available.
 *
 * `unconverted` is the part that could not be expressed in the reporting
 * currency. It is reported rather than hidden because a converted total that
 * quietly omits part of the money is worse than one that admits the gap: the
 * admin can see that the figure is incomplete and go and look.
 *
 * The amounts come from the per-document snapshot columns, not from a live rate,
 * so a period's total is the same number every time it is opened.
 */

export type ReportingTotal = {
  /** The reporting currency, or null when conversion is switched off. */
  currency: string | null;
  /** Sum of converted documents, in the reporting currency. Null when none. */
  converted: number | null;
  /** Documents that could not be converted, grouped in their own currencies. */
  unconverted: CurrencyTotal[];
  /** Per-currency groups of everything included, converted or not. */
  groups: CurrencyTotal[];
  /** How many documents contributed a converted amount. */
  convertedCount: number;
  /** The distinct rate dates used, newest first. Named so a figure is auditable. */
  rateDates: string[];
};

type Row = { currency: string | null; amount: number | null; reporting_amount: number | null; reporting_currency: string | null; fx_rate_date: string | null };

/**
 * Build a reporting total from rows that carry the snapshot columns.
 *
 * Written to take already-fetched rows rather than issuing its own query, so a
 * page that is already listing the documents does not pay for a second read.
 */
export function reportingTotal(
  rows: readonly Row[],
  value: (row: Row) => number | null,
  currency: (row: Row) => string | null,
  reporting: string | null,
): ReportingTotal {
  const groups = new Map<string, { total: number; count: number }>();
  const unconverted = new Map<string, { total: number; count: number }>();
  const rateDates = new Set<string>();
  let converted: number | null = null;
  let convertedCount = 0;

  for (const row of rows) {
    const amount = value(row);
    if (amount === null || !Number.isFinite(amount)) continue;

    const code = currency(row) ?? "—";
    const group = groups.get(code) ?? { total: 0, count: 0 };
    group.total += amount;
    group.count += 1;
    groups.set(code, group);

    if (row.reporting_amount !== null && row.reporting_amount !== undefined) {
      converted = (converted ?? 0) + row.reporting_amount;
      convertedCount += 1;
      if (row.fx_rate_date) rateDates.add(row.fx_rate_date);
    } else {
      const gap = unconverted.get(code) ?? { total: 0, count: 0 };
      gap.total += amount;
      gap.count += 1;
      unconverted.set(code, gap);
    }
  }

  const toArray = (m: Map<string, { total: number; count: number }>): CurrencyTotal[] =>
    [...m].map(([c, e]) => ({ currency: c, total: e.total, count: e.count }));

  return {
    currency: reporting,
    converted: converted === null ? null : Math.round(converted * 100) / 100,
    unconverted: toArray(unconverted),
    groups: toArray(groups),
    convertedCount,
    rateDates: [...rateDates].sort().reverse(),
  };
}

/**
 * A reporting total taken in SQL, for aggregates that are never listed on screen.
 *
 * Kept alongside the in-memory version because a dashboard total should not have
 * to fetch every row to add up. The grouping rule is the same; only the place
 * the arithmetic happens differs.
 */
export async function reportingTotalQuery(
  table: string,
  amountCol: string,
  currencyCol: string,
  where: string,
  params: unknown[],
  reporting: string | null,
): Promise<ReportingTotal> {
  const rows = await query<Row>(
    `SELECT coalesce(${currencyCol}, '—') AS currency,
            sum(${amountCol})::float AS amount,
            sum(reporting_amount)::float AS reporting_amount,
            min(reporting_currency) AS reporting_currency,
            max(fx_rate_date)::text AS fx_rate_date
       FROM ${table}
      WHERE ${where} AND ${amountCol} IS NOT NULL
      GROUP BY coalesce(${currencyCol}, '—')`,
    params,
  );

  // Each grouped row stands for one currency, so the per-row shape the shared
  // helper expects is reconstructed here with the group total as the amount.
  return reportingTotal(
    rows.map((r) => ({ ...r, amount: r.amount })),
    (r) => r.amount,
    (r) => r.currency,
    reporting,
  );
}

/** The reporting currency from org_settings, or null when conversion is off. */
export async function getReportingCurrency(): Promise<string | null> {
  const row = await queryOne<{ reporting_currency: string | null }>(
    "SELECT reporting_currency FROM org_settings WHERE id = true",
  ).catch(() => null);
  return row?.reporting_currency ?? null;
}
