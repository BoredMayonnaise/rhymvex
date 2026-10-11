-- Full-text-ish search acceleration for the inbox and lead search, which use
-- case-insensitive substring matches (ILIKE '%...%') that B-tree indexes can't
-- serve. pg_trgm GIN indexes make those scans use the index instead.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS email_messages_search_trgm_idx
  ON email_messages USING GIN (subject gin_trgm_ops, body_text gin_trgm_ops, from_address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS leads_search_trgm_idx
  ON leads USING GIN (name gin_trgm_ops, company gin_trgm_ops, email gin_trgm_ops, reference gin_trgm_ops);
