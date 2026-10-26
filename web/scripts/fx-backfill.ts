import "@/lib/env";
import { pool, query } from "@/lib/db/client";
import { convert, reportingCurrency } from "@/lib/fx";

/**
 * Backfill the per-document FX snapshot.
 *
 *   npm run fx:backfill
 *
 * Documents created before the reporting currency was switched on have no
 * snapshot, so they cannot contribute to a cross-currency total. This fills them
 * in at the rate for the date each document was created, which is the same rule
 * new documents follow.
 *
 * Idempotent and resumable: only rows with no snapshot are touched, so running
 * it twice is a no-op and a partial run can simply be repeated. Safe to run
 * against production; it only ever writes the four reporting columns.
 *
 * It does NOT invent a rate. A document whose currency has no published rate for
 * its date is left unconverted and reported at the end, because a guessed rate
 * is worse than an honest gap.
 */

type Doc = {
  id: string;
  reference: string;
  amount: number;
  currency: string | null;
  on: string | null;
};

const TARGETS: Array<{ table: string; amountCol: string; dateCol: string }> = [
  { table: "invoices", amountCol: "amount", dateCol: "coalesce(issued_at, created_at::date)" },
  { table: "proposals", amountCol: "investment", dateCol: "created_at::date" },
  { table: "contracts", amountCol: "value_total", dateCol: "created_at::date" },
];

async function main() {
  const to = await reportingCurrency();
  if (!to) {
    console.log(
      "\n  No reporting currency is set, so there is nothing to convert.\n" +
        "  Set one first:  UPDATE org_settings SET reporting_currency = 'EUR' WHERE id = true;\n" +
        "  Or use the Reporting currency field on the admin settings page.\n",
    );
    return;
  }

  console.log(`\n  Reporting currency: ${to}`);

  let convertedTotal = 0;
  const skipped: string[] = [];

  for (const target of TARGETS) {
    const docs = await query<Doc>(
      `SELECT id, reference,
              ${target.amountCol}::float AS amount,
              currency,
              ${target.dateCol}::text AS on
         FROM ${target.table}
        WHERE reporting_amount IS NULL
          AND ${target.amountCol} IS NOT NULL
          AND ${target.amountCol} > 0
        ORDER BY ${target.dateCol}`,
    );

    if (docs.length === 0) {
      console.log(`  ${target.table}: nothing to convert`);
      continue;
    }

    let done = 0;
    for (const doc of docs) {
      const result = await convert(doc.amount, doc.currency, to, doc.on);
      if (!result) {
        skipped.push(`${target.table} ${doc.reference} (${doc.currency ?? "no currency"})`);
        continue;
      }
      await query(
        `UPDATE ${target.table}
            SET reporting_currency = $2, reporting_amount = $3,
                fx_rate = $4, fx_rate_date = $5
          WHERE id = $1`,
        [doc.id, result.currency, result.amount, result.rate, result.rateDate],
      );
      done += 1;
    }
    convertedTotal += done;
    console.log(`  ${target.table}: converted ${done}/${docs.length}`);
  }

  console.log(`\n  ${convertedTotal} document(s) converted into ${to}`);

  if (skipped.length > 0) {
    console.log(
      `\n  ${skipped.length} left unconverted — no published rate for their date.\n` +
        "  These stay visible in their own currency and are excluded from the\n" +
        "  converted total rather than being guessed at:",
    );
    for (const ref of skipped.slice(0, 20)) console.log(`    ${ref}`);
    if (skipped.length > 20) console.log(`    ... and ${skipped.length - 20} more`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error(`\n  ${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
