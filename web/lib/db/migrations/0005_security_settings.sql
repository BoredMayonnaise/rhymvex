-- Security policy settings.
--
-- Every column is nullable and NULL means "use the built-in default". That keeps
-- the table holding *overrides* only: a fresh deployment, or one that deletes
-- this row, gets exactly the behaviour the code ships with, and the security
-- page can say which values have been overridden and which have not.
--
-- Secrets are deliberately NOT here. SMTP credentials and SESSION_SECRET stay
-- in the environment; a database dump should not yield working mail or let a
-- read-only breach mint session cookies. This table is policy — how long a
-- session lives, how strong a password must be, how hard sign-in is throttled
-- — and none of it is confidential.
--
-- The audit_log append-only triggers in 0001 are checked on the security page
-- by counting them in pg_trigger, so they are not restated here.

CREATE TABLE IF NOT EXISTS security_settings (
  id                     boolean PRIMARY KEY DEFAULT true,

  -- Session lifetimes. NULL falls back to the compiled-in default.
  staff_session_hours    integer CHECK (staff_session_hours   BETWEEN 1 AND 720),
  staff_remembered_days  integer CHECK (staff_remembered_days BETWEEN 1 AND 365),
  client_session_days    integer CHECK (client_session_days   BETWEEN 1 AND 365),
  client_remembered_days integer CHECK (client_remembered_days BETWEEN 1 AND 365),

  -- Lax or Strict. "None" is not offered: it only works with Secure, which
  -- this app only sets in production, and offering a choice that silently
  -- breaks sign-in in development would be worse than not offering it.
  cookie_samesite        text    CHECK (cookie_samesite IN ('lax', 'strict')),

  -- Password policy. The character-class requirements can be switched off, but
  -- the length bounds cannot: an unbounded minimum is how a workspace ends up
  -- accepting "a".
  password_min_length    integer CHECK (password_min_length BETWEEN 8 AND 128),
  password_max_length    integer CHECK (password_max_length BETWEEN 32 AND 512),
  password_require_lower boolean,
  password_require_upper boolean,
  password_require_digit boolean,

  -- scrypt cost. N must be a power of two; the check enforces that the editor
  -- cannot write a value scrypt will reject at the next sign-in.
  scrypt_n               integer CHECK (scrypt_n > 1 AND (scrypt_n & (scrypt_n - 1)) = 0),
  scrypt_r               integer CHECK (scrypt_r BETWEEN 1 AND 32),
  scrypt_p               integer CHECK (scrypt_p BETWEEN 1 AND 16),

  -- Sign-in throttling. The per-account bucket is the one that actually stops
  -- guessing, because it is keyed on the account rather than the caller.
  signin_ip_limit        integer CHECK (signin_ip_limit     BETWEEN 1 AND 10000),
  signin_account_limit   integer CHECK (signin_account_limit BETWEEN 1 AND 1000),
  signin_window_seconds  integer CHECK (signin_window_seconds BETWEEN 30 AND 86400),

  -- Public intake: submissions per window per IP, and how fast a submission
  -- may arrive after the form was rendered before it is treated as a script.
  intake_rate_limit      integer CHECK (intake_rate_limit   BETWEEN 1 AND 10000),
  intake_window_seconds  integer CHECK (intake_window_seconds BETWEEN 30 AND 86400),
  intake_min_seconds     integer CHECK (intake_min_seconds  BETWEEN 0 AND 300),

  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES staff(id) ON DELETE SET NULL,

  CONSTRAINT security_settings_singleton CHECK (id),
  CONSTRAINT security_settings_password_bounds
    CHECK (password_min_length IS NULL OR password_max_length IS NULL
           OR password_min_length <= password_max_length)
);

COMMENT ON TABLE security_settings IS
  'Security policy overrides. NULL columns fall back to the built-in default.';
COMMENT ON COLUMN security_settings.updated_by IS
  'Who last changed the policy. Separate from audit_log, which records the change but not who owns it.';