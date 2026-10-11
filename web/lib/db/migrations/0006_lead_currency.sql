ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

UPDATE leads SET currency = 'USD' WHERE currency IS NULL;
