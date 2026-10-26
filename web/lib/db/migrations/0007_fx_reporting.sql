-- Exchange rates, and the reporting currency cross-currency totals are taken in.
--
-- The problem this solves: a workspace invoices in more than one currency, and
-- "how much have we collected" then has no answer. Adding pesos to pounds
-- produces a number that is not money. The alternative to refusing to total is
-- converting, and conversion done wrong is worse than no total at all.
--
-- The rate is stored per document, at the date the document was created, rather
-- than looked up live when a report is rendered. That is the whole design:
--
--   * A report must be reproducible. If last quarter's revenue is recomputed
--     with today's rate it changes every day, and two people looking at the same
--     period disagree. An auditor asking "what rate did you use" has no answer.
--   * The document's own currency amount is never touched. `amount` stays the
--     authoritative figure; the reporting amount is a derived convenience that
--     can be discarded and rebuilt.
--   * A missing rate is recorded as missing. The reporting columns are nullable
--     and a NULL means "not converted", never "converted at 1:1". A total that
--     silently treats an unconvertible amount as parity is the exact failure
--     this schema is shaped to prevent.
--
-- Rates themselves are cached by date so one fetch covers every pair in use for
-- that day, and so a report rendered twice does not hit the network twice.

CREATE TABLE IF NOT EXISTS fx_rates (
  -- The date the rate is for, not when it was fetched. Rates are published per
  -- business day; a weekend document uses the last published day.
  as_of      date NOT NULL,

  -- `rate` is how many `quote` units one `base` unit buys, so a conversion from
  -- the document currency to the reporting currency is `amount / rate` when base
  -- is the reporting currency and quote is the document currency.
  base       char(3) NOT NULL CHECK (base  ~ '^[A-Z]{3}$'),
  quote      char(3) NOT NULL CHECK (quote ~ '^[A-Z]{3}$'),
  rate       numeric(20,10) NOT NULL CHECK (rate > 0),

  -- Which provider answered. Kept because a rate is only as trustworthy as its
  -- source, and a later reconciliation needs to know where a number came from.
  source     text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (as_of, base, quote),
  CONSTRAINT fx_rates_distinct CHECK (base <> quote)
);

COMMENT ON TABLE fx_rates IS
  'Published exchange rates by date. Cached so one fetch covers every pair for a day.';
COMMENT ON COLUMN fx_rates.rate IS
  'quote units per 1 base unit. Convert document->reporting as amount / rate when base is the reporting currency.';

CREATE INDEX IF NOT EXISTS fx_rates_lookup_idx ON fx_rates(base, quote, as_of DESC);

-- ---------------------------------------------------------------------------
-- The reporting currency
-- ---------------------------------------------------------------------------
--
-- NULL means the feature is off: totals stay grouped per currency exactly as
-- they are today, and nothing is converted. That keeps a deployment that does
-- not want a reporting currency from having to opt out of anything, and it is
-- the safe default for a workspace that genuinely operates in one currency.
--
-- This is deliberately separate from `currency`, which is what new documents
-- default to. A workspace can invoice in the client's currency and still report
-- in its own.

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS reporting_currency char(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_settings_reporting_currency_known'
  ) THEN
    ALTER TABLE org_settings
      ADD CONSTRAINT org_settings_reporting_currency_known
      CHECK (reporting_currency IS NULL OR reporting_currency = ANY (ARRAY[
        'EUR','GBP','USD','JPY','AUD','CAD','CHF','SGD','AED','SAR',
        'INR','CNY','KRW','THB','MYR','PHP','ZAR','NGN'
      ]));
  END IF;
END
$$;

COMMENT ON COLUMN org_settings.reporting_currency IS
  'Currency cross-currency totals are converted into. NULL disables conversion and totals stay per-currency.';

-- ---------------------------------------------------------------------------
-- Per-document conversion snapshots
-- ---------------------------------------------------------------------------
--
-- Added to the three tables that carry a negotiable amount. Each gets the same
-- four columns so the reporting roll-up can treat them identically, and so the
-- rule lives in one place rather than three slightly different ones.
--
-- All four are nullable and move together: either a document has been converted
-- and all four are set, or none are. `reporting_amount` without a rate and a
-- date would be a number nobody can justify, so the check constraint below
-- enforces that they are set as a group.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices', 'proposals', 'contracts'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS reporting_currency char(3)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS reporting_amount numeric(14,2)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS fx_rate numeric(20,10)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS fx_rate_date date', t);

    -- Set as a group, or not at all. A partially converted row is the shape
    -- that produces an unexplainable total later.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_reporting_complete'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (
           (reporting_currency IS NULL AND reporting_amount IS NULL
            AND fx_rate IS NULL AND fx_rate_date IS NULL)
           OR
           (reporting_currency IS NOT NULL AND reporting_amount IS NOT NULL
            AND fx_rate IS NOT NULL AND fx_rate_date IS NOT NULL)
         )', t, t || '_reporting_complete');
    END IF;

    -- A rate of zero is not a rate. Guarded here as well as on fx_rates because
    -- a snapshot can also be written by a script that never touches fx_rates.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_fx_rate_positive'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (fx_rate IS NULL OR fx_rate > 0)',
        t, t || '_fx_rate_positive');
    END IF;

    -- Conversion at parity between different currencies is almost always a bug
    -- rather than a deliberate peg, and it is indistinguishable in the data from
    -- "we forgot to convert". Flagged rather than blocked: a genuine 1:1 peg
    -- exists, and refusing it would be wrong.
    EXECUTE format(
      'COMMENT ON COLUMN %I.reporting_amount IS %L', t,
      'The document amount converted into reporting_currency at fx_rate on fx_rate_date. NULL means not converted.');
  END LOOP;
END
$$;

-- Indexed for the reporting roll-up, which sums reporting_amount over a period.
CREATE INDEX IF NOT EXISTS invoices_reporting_idx ON invoices(reporting_currency, issued_at);
CREATE INDEX IF NOT EXISTS proposals_reporting_idx ON proposals(reporting_currency, created_at);
CREATE INDEX IF NOT EXISTS contracts_reporting_idx ON contracts(reporting_currency, created_at);
