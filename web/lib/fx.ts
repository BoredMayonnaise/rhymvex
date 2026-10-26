import { query, queryOne } from "@/lib/db/client";
import { isCurrency } from "@/lib/currency";

/**
 * Exchange rates.
 *
 * Money in this platform is stored in the currency it was agreed in and is never
 * rewritten. A total across currencies is therefore only meaningful if each
 * amount is converted at a rate somebody can point at, so this module does two
 * things and refuses to do a third:
 *
 *   1. Fetch published rates for a date and cache them in `fx_rates`.
 *   2. Convert one amount, returning the rate and the date alongside it.
 *
 * It does not convert at render time from a live rate. A report recomputed with
 * today's rate silently changes every time it is opened, which makes last
 * quarter's revenue a different number each day and leaves an auditor with
 * nothing to check. Rates are fetched once, stored with the date they apply to,
 * and a document keeps the rate it was converted at.
 *
 * Every failure path returns null rather than throwing. An FX outage must not
 * take down a page that shows money: the caller renders the per-currency groups
 * it already has, which is exactly the behaviour this feature improves on and
 * never replaces.
 */

/** Which provider answered, recorded on every stored rate. */
const SOURCE = "open.er-api.com";

/** How long a fetched set of rates is trusted before it is refetched. */
const MEMO_MS = 60 * 60 * 1000;

/** The last published day is reused when today has no rate yet. */
const MAX_BACKFILL_DAYS = 7;

type MemoEntry = { at: number; rates: Map<string, number> };
const memo = new Map<string, MemoEntry>();

/** Today in UTC, which is the date rates are published against. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch every rate for one base currency from the provider.
 *
 * Returns a map of quote currency to units-per-one-base. Empty on any failure,
 * including a well-formed response that simply omits a currency.
 */
async function fetchRates(base: string): Promise<Map<string, number>> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
    signal: AbortSignal.timeout(5000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) return new Map();

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) return new Map();
  const rates = (body as { rates?: unknown }).rates;
  if (typeof rates !== "object" || rates === null) return new Map();

  const out = new Map<string, number>();
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    if (!isCurrency(code)) continue;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out.set(code, value);
    }
  }
  return out;
}

/**
 * The rates for one base currency on one date, from cache when possible.
 *
 * The whole set for a date is stored on first use rather than one pair at a
 * time, so a report covering eight currencies costs one fetch, not eight. Rates
 * for a weekend or a holiday are walked back to the last published day, because
 * a document created on a Sunday still has to convert.
 */
async function ratesFor(base: string, asOf: string): Promise<Map<string, number>> {
  const key = `${base}:${asOf}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.rates;

  // Already in the database for this date: no network at all.
  const stored = await query<{ quote: string; rate: number }>(
    "SELECT quote, rate::float AS rate FROM fx_rates WHERE base = $1 AND as_of = $2",
    [base, asOf],
  ).catch(() => []);
  if (stored.length > 0) {
    const rates = new Map(stored.map((r) => [r.quote, r.rate]));
    memo.set(key, { at: Date.now(), rates });
    return rates;
  }

  const fetched = await fetchRates(base);
  if (fetched.size === 0) return new Map();

  // One statement for the whole set. A failure here is not fatal: the rates are
  // still usable for this render, they just will not be cached.
  await query(
    `INSERT INTO fx_rates (as_of, base, quote, rate, source)
     SELECT $1, $2, code, value, $3
       FROM unnest($4::text[], $5::numeric[]) AS t(code, value)
     ON CONFLICT (as_of, base, quote) DO UPDATE
       SET rate = EXCLUDED.rate, source = EXCLUDED.source, fetched_at = now()`,
    [asOf, base, SOURCE, [...fetched.keys()], [...fetched.values()]],
  ).catch(() => undefined);

  memo.set(key, { at: Date.now(), rates: fetched });
  return fetched;
}

export type Conversion = {
  amount: number;
  currency: string;
  rate: number;
  rateDate: string;
};

/**
 * Convert an amount into the reporting currency at the rate for a given date.
 *
 * `on` should be the date the document was created, not today. Returns null when
 * there is nothing to convert (same currency, no amount), when the rate is
 * unavailable, or when either code is not in the catalogue. A null result is the
 * caller's signal to leave the reporting columns unset and show the document in
 * its own currency, which is always a truthful thing to show.
 */
export async function convert(
  amount: number | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  on?: string | null,
): Promise<Conversion | null> {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  if (!isCurrency(from) || !isCurrency(to)) return null;

  // Same currency is not a conversion. Recorded as a real conversion at parity
  // so a reporting roll-up can treat every row identically and the 1:1 is
  // explicit in the data rather than implied by a missing value.
  if (from === to) {
    return { amount, currency: to, rate: 1, rateDate: on ?? today() };
  }

  let date = on ?? today();
  let rates = await ratesFor(to, date);

  // Walk back to the last published day: a weekend or holiday document still
  // has to convert, and the rate that applied is the last one published.
  let attempts = 0;
  while (!rates.has(from) && attempts < MAX_BACKFILL_DAYS) {
    date = shiftDays(date, -1);
    rates = await ratesFor(to, date);
    attempts += 1;
  }

  const rate = rates.get(from);
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;

  // Rates are quote-per-one-base, so with `to` as the base an amount in `from`
  // divides. Rounded to cents here rather than left as a float, because this is
  // the figure that gets summed and displayed.
  const converted = Math.round((amount / rate) * 100) / 100;
  return { amount: converted, currency: to, rate, rateDate: date };
}

/**
 * The reporting currency, or null when conversion is switched off.
 *
 * Read straight from org_settings rather than through `getOrgSettings`, because
 * this is called from scripts and reporting helpers that run outside a render.
 */
export async function reportingCurrency(): Promise<string | null> {
  const row = await queryOne<{ reporting_currency: string | null }>(
    "SELECT reporting_currency FROM org_settings WHERE id = true",
  ).catch(() => null);
  const code = row?.reporting_currency ?? null;
  return isCurrency(code) ? code : null;
}
