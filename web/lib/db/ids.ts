/** Postgres uuid, matched before an id is ever sent to it. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a value could be a record id at all.
 *
 * A hand-edited or malformed id is rejected here rather than being passed to
 * Postgres, where `invalid input syntax for type uuid` would surface as a 500.
 * Rejecting early keeps "not yours" and "does not exist" the same answer to the
 * caller, and avoids leaking anything about which ids are real.
 */
export function isRecordId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
