-- Constrain org_settings.currency to the currencies the catalogue defines.
--
-- `Intl.NumberFormat` throws a RangeError on a malformed currency code, and
-- `formatMoney` is called from every admin and portal page. An unvalidated
-- settings write could therefore take down both workspaces at once rather than
-- failing the form that caused it. The application now rejects unknown codes in
-- `settingsSchema`; this makes the database agree, so a direct write, a future
-- script or a restored backup cannot reintroduce the same outage.
--
-- The list is the catalogue in content/currencies.json rather than a loose
-- `^[A-Z]{3}$` pattern: Intl accepts any well-formed three letters, including
-- codes with no budget bands behind them, so a pattern check would not stop the
-- inconsistent-money problem, only the crash.

DO $$
BEGIN
  -- Normalise before constraining. A value already stored from before this
  -- migration would otherwise make the ADD CONSTRAINT fail and block the deploy,
  -- which is the wrong outcome for a hardening change.
  UPDATE org_settings
     SET currency = 'EUR'
   WHERE currency IS NOT NULL
     AND currency <> ALL (ARRAY[
       'EUR','GBP','USD','JPY','AUD','CAD','CHF','SGD','AED','SAR',
       'INR','CNY','KRW','THB','MYR','PHP','ZAR','NGN'
     ]);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_settings_currency_known'
  ) THEN
    ALTER TABLE org_settings
      ADD CONSTRAINT org_settings_currency_known
      CHECK (currency = ANY (ARRAY[
        'EUR','GBP','USD','JPY','AUD','CAD','CHF','SGD','AED','SAR',
        'INR','CNY','KRW','THB','MYR','PHP','ZAR','NGN'
      ]));
  END IF;
END
$$;
