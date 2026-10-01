import { Pool, types as pgTypes, type PoolClient, type QueryResultRow } from "pg";

/**
 * Single pooled Postgres connection for the app.
 *
 * Every query in the platform goes through `query`/`tx` so that connection
 * handling and transaction scope live in exactly one place.
 */

// Postgres returns int8 (bigint) as a string to avoid precision loss. Every
// bigint in this schema is a count or a byte size, well within the safe integer
// range, so parse it as a number. Done via setTypeParser rather than a Pool
// `types` override, because a partial getTypeParser replaces the whole lookup
// table and leaves undefined entries for every other OID.
pgTypes.setTypeParser(pgTypes.builtins.INT8, (value: string) => Number(value));

const globalForPg = globalThis as unknown as { rvPool?: Pool };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy web/.env.example to web/.env.local and start the database with `docker compose up -d`.",
    );
  }
  return url;
}

export const pool: Pool =
  globalForPg.rvPool ??
  new Pool({
    connectionString: connectionString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

// Next.js dev server reloads modules on every change; without this the pool
// would be recreated on each reload until Postgres refuses connections.
if (process.env.NODE_ENV !== "production") globalForPg.rvPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction, rolling back on any thrown error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // A rollback failure means the connection is already gone. The original
      // error is the one worth surfacing, so it is rethrown below.
    }
    throw error;
  } finally {
    client.release();
  }
}

export type { PoolClient };
