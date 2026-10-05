-- =============================================================================
-- Rhymvex platform — initial schema
--
-- Design notes
--   * Leads and Clients are deliberately separate. A form submission is a Lead.
--     It becomes a Client only when a human establishes the relationship.
--   * Every client-visible record carries client_id. Portal reads are scoped by
--     the session's client_id, never by an id taken from the URL.
--   * audit_log is append-only, enforced by trigger, not by convention.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Enumerated states
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'RECEIVED', 'REVIEWING', 'QUALIFIED', 'CONSULTATION', 'PROPOSAL',
    'NEGOTIATION', 'WON', 'LOST', 'DECLINED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Engagement models, not purchasable products. Price is indicative until a
-- proposal exists, and a Custom engagement is always legitimate.
DO $$ BEGIN
  CREATE TYPE engagement_model AS ENUM (
    'BRAND_SPRINT', 'BRAND_SYSTEM', 'RHYTHM_RETAINER', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM (
    'ADMIN', 'OPERATIONS', 'ACCOUNT_MANAGER', 'PROJECT_MANAGER', 'DESIGNER', 'FINANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- What a token grants. A staff token creates a team account; a client token
-- creates a portal account bound to exactly one client.
DO $$ BEGIN
  CREATE TYPE invitation_kind AS ENUM ('STAFF', 'CLIENT_PORTAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'DRAFT', 'SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'ACTIVE', 'COMPLETED', 'TERMINATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'PLANNING', 'DISCOVERY', 'IN_PROGRESS', 'IN_REVIEW', 'DELIVERED', 'ON_HOLD', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'DRAFT', 'SENT', 'VIEWED', 'PART_PAID', 'PAID', 'OVERDUE', 'VOID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Email is a first-class business record tied to whatever it relates to, so the
-- Business Email view is a real inbox rather than a mailto link.
DO $$ BEGIN
  CREATE TYPE email_direction AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Organisation settings
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_settings (
  id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_name       text NOT NULL DEFAULT 'Rhymvex',
  contact_email      text NOT NULL DEFAULT 'support@rhymvex.space',
  notification_email text NOT NULL DEFAULT 'support@rhymvex.space',
  -- NULL means we make no response-time promise to clients. The success screen
  -- is driven off this value rather than hard-coding a number.
  response_sla_minutes integer CHECK (response_sla_minutes IS NULL OR response_sla_minutes > 0),
  timezone           text NOT NULL DEFAULT 'Europe/Lisbon',
  currency           text NOT NULL DEFAULT 'EUR',
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Staff (the Rhymvex team)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  name           text NOT NULL,
  role           staff_role NOT NULL DEFAULT 'DESIGNER',
  -- Explicit permission overrides, applied on top of the role grant. Stored as
  -- an array of permission keys so authorisation stays data-driven.
  extra_permissions text[] NOT NULL DEFAULT '{}',
  -- scrypt digest. Format: scrypt$N$r$p$salt$hash, all base64url.
  password_hash  text,
  title          text,
  active         boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_email_unique UNIQUE (email)
);

-- -----------------------------------------------------------------------------
-- Sessions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
  id           text PRIMARY KEY,
  staff_id     uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- Bound to the browser so a stolen cookie is less useful on its own.
  user_agent   text,
  ip_address   text,
  csrf_token   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_staff_idx ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

-- -----------------------------------------------------------------------------
-- Invitations (team and client portal share one lifecycle)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invitations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           invitation_kind NOT NULL,
  email          text NOT NULL,
  name           text,
  -- Staff only.
  role           staff_role,
  permissions    text[] NOT NULL DEFAULT '{}',
  -- CLIENT_PORTAL only. A client token is permanently bound to this client.
  client_id      uuid,
  -- Only the digest of the token is stored. The raw token exists solely in the
  -- invitation email, so database access cannot mint an account.
  token_hash     text NOT NULL UNIQUE,
  status         invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at     timestamptz NOT NULL,
  accepted_at    timestamptz,
  revoked_at     timestamptz,
  created_by     uuid REFERENCES staff(id) ON DELETE SET NULL,
  -- Rate-limit and abuse signals gathered at issue time.
  created_ip     text,
  last_sent_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_kind_shape CHECK (
    (kind = 'STAFF'       AND role IS NOT NULL AND client_id IS NULL) OR
    (kind = 'CLIENT_PORTAL' AND client_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations(status);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
-- An email may hold at most one live invitation per kind, so re-inviting
-- replaces rather than accumulates dangling tokens.
CREATE UNIQUE INDEX IF NOT EXISTS invitations_live_unique
  ON invitations (email, kind) WHERE status = 'PENDING';

-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL UNIQUE,
  name           text NOT NULL,
  legal_name     text,
  industry       text,
  website        text,
  phone          text,
  address        text,
  notes          text,
  status         text NOT NULL DEFAULT 'ACTIVE'
                 CHECK (status IN ('PROSPECT', 'ACTIVE', 'DORMANT', 'CHURNED')),
  -- lead_id is added by ALTER TABLE below: leads and clients reference each
  -- other, so the cycle can only be closed once both tables exist.
  account_manager uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name);

-- People at the client company. A contact is not a user; only client_users can log in.
CREATE TABLE IF NOT EXISTS client_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text,
  role_title   text,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_contacts_email_unique UNIQUE (client_id, email)
);
CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON client_contacts(client_id);

-- Portal login accounts. Always bound to exactly one client: this is the anchor
-- for tenant isolation.
CREATE TABLE IF NOT EXISTS client_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role_title    text,
  -- Portal users are not staff and hold no admin permissions whatsoever.
  is_admin      boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_users_client_idx ON client_users(client_id);

-- Leads (public intake). Never automatically a client.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-facing reference used in email and the UI, e.g. LEAD-8F3K2Q.
  reference       text NOT NULL UNIQUE,
  name            text NOT NULL,
  email           text NOT NULL,
  phone           text,
  company         text,
  role_title      text,
  website         text,
  -- What they're trying to solve, in their words.
  situation       text NOT NULL,
  message         text NOT NULL,
  budget_band     text,
  timeline        text,
  referral_source text,
  status          lead_status NOT NULL DEFAULT 'RECEIVED',
  assigned_to     uuid REFERENCES staff(id) ON DELETE SET NULL,
  -- Set when a human converts this lead into a client relationship.
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  -- Recommended engagement model, decided after understanding the situation.
  recommended_model engagement_model,
  estimated_value numeric(12,2),
  score           smallint CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  source          text NOT NULL DEFAULT 'website-intake',
  submission_ip   text,
  user_agent      text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_contacted_at timestamptz,
  lost_reason     text
);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_submitted_idx ON leads(submitted_at DESC);
CREATE INDEX IF NOT EXISTS leads_assigned_idx ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);

-- Internal notes. There is deliberately no client_id and no read path from the
-- portal data layer, so these cannot leak to a client.
CREATE TABLE IF NOT EXISTS lead_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES staff(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_notes_lead_idx ON lead_notes(lead_id, created_at DESC);

-- Close the leads <-> clients cycle. One lead produces at most one client, so
-- the uniqueness also stops a lead being converted twice.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_id uuid;

DO $$ BEGIN
  ALTER TABLE clients
    ADD CONSTRAINT clients_lead_unique UNIQUE (lead_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE clients
    ADD CONSTRAINT clients_lead_fk
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Portal sessions. Declared after client_users because it references it.

CREATE TABLE IF NOT EXISTS client_sessions (
  id           text PRIMARY KEY,
  client_user_id uuid NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
  user_agent   text,
  ip_address   text,
  csrf_token   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_sessions_user_idx ON client_sessions(client_user_id);
CREATE INDEX IF NOT EXISTS client_sessions_expiry_idx ON client_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- Engagements and projects
-- -----------------------------------------------------------------------------

-- The commercial shape of the work. Created when we agree how to help, which
-- may be long after the intake submission.
CREATE TABLE IF NOT EXISTS engagements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  model        engagement_model NOT NULL,
  name         text NOT NULL,
  summary      text,
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  start_date   date,
  end_date     date,
  -- Recurring for retainers, one-off for fixed scope.
  billing_cycle text CHECK (billing_cycle IS NULL OR billing_cycle IN ('ONE_OFF', 'MONTHLY', 'QUARTERLY')),
  value_total  numeric(12,2),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engagements_client_idx ON engagements(client_id);

CREATE TABLE IF NOT EXISTS projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  name          text NOT NULL,
  summary       text,
  status        project_status NOT NULL DEFAULT 'PLANNING',
  -- 0-100, surfaced in the portal as filled/empty dots.
  progress      smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  phase         text,
  next_step     text,
  next_step_due date,
  start_date    date,
  target_date   date,
  lead_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects(client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

-- Visible progress steps. These are what the client sees as their journey.
CREATE TABLE IF NOT EXISTS project_milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  detail     text,
  -- Client-safe steps only. Internal work tracking lives in tasks.
  client_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON project_milestones(project_id, sort_order);

-- -----------------------------------------------------------------------------
-- Proposals, contracts, bookings, invoices
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    text NOT NULL UNIQUE,
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  title        text NOT NULL,
  summary      text,
  model        engagement_model,
  scope        text,
  deliverables text[] NOT NULL DEFAULT '{}',
  exclusions   text[] NOT NULL DEFAULT '{}',
  timeline     text,
  investment   numeric(12,2),
  currency     text NOT NULL DEFAULT 'EUR',
  status       proposal_status NOT NULL DEFAULT 'DRAFT',
  sent_at      timestamptz,
  viewed_at    timestamptz,
  decided_at   timestamptz,
  created_by   uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_client_idx ON proposals(client_id);
CREATE INDEX IF NOT EXISTS proposals_lead_idx ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals(status);

CREATE TABLE IF NOT EXISTS contracts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  proposal_id   uuid REFERENCES proposals(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  title         text NOT NULL,
  body          text,
  status        contract_status NOT NULL DEFAULT 'DRAFT',
  value_total   numeric(12,2),
  currency      text NOT NULL DEFAULT 'EUR',
  sent_at       timestamptz,
  signed_at     timestamptz,
  signed_by_name text,
  signature_ip  text,
  created_by    uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_client_idx ON contracts(client_id);

CREATE TABLE IF NOT EXISTS bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'CONSULTATION'
                CHECK (kind IN ('DISCOVERY', 'CONSULTATION', 'REVIEW', 'WORKSHOP', 'CHECK_IN', 'OTHER')),
  status        booking_status NOT NULL DEFAULT 'REQUESTED',
  scheduled_for timestamptz NOT NULL,
  duration_mins integer NOT NULL DEFAULT 45 CHECK (duration_mins > 0),
  location      text,
  host_id       uuid REFERENCES staff(id) ON DELETE SET NULL,
  client_contact_id uuid REFERENCES client_contacts(id) ON DELETE SET NULL,
  agenda        text,
  outcome       text,
  created_by    uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_scheduled_idx ON bookings(scheduled_for);
CREATE INDEX IF NOT EXISTS bookings_client_idx ON bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_lead_idx ON bookings(lead_id);

CREATE TABLE IF NOT EXISTS invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  description   text NOT NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  amount_paid   numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  currency      text NOT NULL DEFAULT 'EUR',
  status        invoice_status NOT NULL DEFAULT 'DRAFT',
  issued_at     date,
  due_at        date,
  paid_at       timestamptz,
  paid_amount   numeric(12,2),
  payment_reference text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_paid_not_over CHECK (amount_paid <= amount)
);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);

-- -----------------------------------------------------------------------------
-- Files, messages, email
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  proposal_id  uuid REFERENCES proposals(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  -- Opaque storage key. Files live outside the database; this is the pointer.
  storage_key  text NOT NULL,
  mime_type    text,
  size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- Only client_visible files appear in the portal.
  client_visible boolean NOT NULL DEFAULT true,
  uploaded_by  uuid REFERENCES staff(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_client_idx ON files(client_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS files_project_idx ON files(project_id);

-- Portal message threads between a client and the Rhymvex team.
CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  -- Client-safe subject, not an internal note title.
  subject     text,
  body        text NOT NULL,
  from_staff  uuid REFERENCES staff(id) ON DELETE SET NULL,
  -- Set on client-authored rows, cleared when staff replies.
  from_client_user uuid REFERENCES client_users(id) ON DELETE SET NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_authored CHECK (from_staff IS NOT NULL OR from_client_user IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS messages_client_idx ON messages(client_id, created_at DESC);

-- Business email, tied to whichever entity it relates to. This is what makes
-- Business Email an inbox instead of a mailto link.
CREATE TABLE IF NOT EXISTS email_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction     email_direction NOT NULL,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  proposal_id   uuid REFERENCES proposals(id) ON DELETE CASCADE,
  booking_id    uuid REFERENCES bookings(id) ON DELETE SET NULL,
  from_address  text NOT NULL,
  from_name     text,
  to_addresses  text[] NOT NULL DEFAULT '{}',
  cc_addresses  text[] NOT NULL DEFAULT '{}',
  subject       text NOT NULL,
  body_text     text NOT NULL,
  body_html     text,
  status        email_status NOT NULL DEFAULT 'QUEUED',
  -- Never set for a client-authored email, so it can't be used as a spam relay.
  client_visible boolean NOT NULL DEFAULT true,
  error_message text,
  sent_at       timestamptz,
  created_by    uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_messages_client_idx ON email_messages(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_lead_idx ON email_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_created_idx ON email_messages(created_at DESC);

-- Every message the platform tried to send, whether or not SMTP was configured.
-- In development this is the readable record of what a client would receive.
CREATE TABLE IF NOT EXISTS email_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('CLIENT_CONFIRMATION', 'INTERNAL_NOTIFICATION', 'STAFF_INVITATION', 'PORTAL_INVITATION', 'OUTBOUND')),
  to_address    text NOT NULL,
  subject       text NOT NULL,
  body_text     text NOT NULL,
  body_html     text,
  related_type  text,
  related_id    uuid,
  -- 'sent' when handed to SMTP, 'dev' when written to the outbox instead.
  delivery      text NOT NULL CHECK (delivery IN ('sent', 'dev', 'failed')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS email_outbox_related_idx ON email_outbox(related_type, related_id);

-- -----------------------------------------------------------------------------
-- Team tasks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  detail       text,
  status       task_status NOT NULL DEFAULT 'OPEN',
  priority     task_priority NOT NULL DEFAULT 'NORMAL',
  assignee_id  uuid REFERENCES staff(id) ON DELETE SET NULL,
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id) ON DELETE CASCADE,
  due_at       timestamptz,
  completed_at timestamptz,
  created_by   uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(due_at);

-- -----------------------------------------------------------------------------
-- Library (reusable internal assets: frameworks, templates, brand files)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS library_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  kind         text NOT NULL DEFAULT 'DOCUMENT'
               CHECK (kind IN ('DOCUMENT', 'TEMPLATE', 'FRAMEWORK', 'BRAND_ASSET', 'REFERENCE')),
  description  text,
  body         text,
  tags         text[] NOT NULL DEFAULT '{}',
  storage_key  text,
  -- Optional link to the client it was created for.
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_items_kind_idx ON library_items(kind);

-- -----------------------------------------------------------------------------
-- Client-safe activity feed
-- -----------------------------------------------------------------------------
-- Distinct from audit_log on purpose. This is the sanitised, human-readable
-- history a client is allowed to see. The portal reads only from here.

CREATE TABLE IF NOT EXISTS client_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  detail      text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_activity_client_idx ON client_activity(client_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- Audit log — append only
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  -- 'staff' or 'client' or 'system'. Never trust a value supplied by a browser.
  actor_type  text NOT NULL CHECK (actor_type IN ('staff', 'client', 'system', 'anonymous')),
  actor_id    uuid,
  actor_label text,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_log(action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_log(actor_type, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_occurred_idx ON audit_log(occurred_at DESC);

-- Immutability, enforced by the database rather than by discipline. Corrections
-- are recorded as new entries instead.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- -----------------------------------------------------------------------------
-- Rate limiting for the public intake endpoint
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key  text PRIMARY KEY,
  count       integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_window_idx ON rate_limit_buckets(window_start);

-- -----------------------------------------------------------------------------
-- Submission guard: records when each IP was last seen, so a form filled in
-- implausibly fast can be treated as a bot.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS intake_timing (
  ip_address  text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
