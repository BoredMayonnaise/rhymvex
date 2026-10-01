/**
 * Migration runner.
 *
 *   npm run db:migrate
 *
 * Applies every .sql file in ./migrations that has not run yet, in filename
 * order, each inside its own transaction, recorded in schema_migrations.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "../env";
import { pool, tx } from "./client";

const MIGRATIONS_DIR = path.join(process.cwd(), "lib", "db", "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function main() {
  await ensureMigrationsTable();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const applied = await pool.query<{ filename: string; checksum: string }>(
    "SELECT filename, checksum FROM schema_migrations",
  );
  const appliedMap = new Map(applied.rows.map((r) => [r.filename, r.checksum]));

  let ran = 0;
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);
    const previous = appliedMap.get(file);

    if (previous) {
      if (previous !== checksum) {
        console.error(
          `\n  ✗ ${file} has changed since it was applied (checksum mismatch).\n` +
            `    Migrations are immutable. Add a new migration file instead.`,
        );
        process.exitCode = 1;
        return;
      }
      continue;
    }

    process.stdout.write(`  applying ${file} ... `);
    try {
      await tx(async (client) => {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [file, checksum],
        );
      });
    } catch (error) {
      console.log("failed");
      console.error(`\n  ${(error as Error).message}\n`);
      process.exitCode = 1;
      return;
    }
    console.log("ok");
    ran += 1;
  }

  console.log(ran === 0 ? "Database is already up to date." : `${ran} migration(s) applied.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
