-- Supporter access development/test schema.
-- Review and apply only to an isolated development/test PostgreSQL database.
-- This file is additive and does not alter or delete existing application rows.
-- Production rollout additionally requires an external-auth migration review and
-- SUPPORTER_AUTH_MIGRATION_READY=true; do not set that flag from this script.

ALTER TABLE logs ADD COLUMN IF NOT EXISTS actor_account_id integer;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS supporter_account_id integer;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS supporter_grant_id integer;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS care_source text;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS recorder_display_name text;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS deleted_at timestamp;

CREATE TABLE IF NOT EXISTS supporter_accounts (
  id serial PRIMARY KEY,
  user_id integer UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  invite_address text NOT NULL UNIQUE,
  public_code varchar(80) NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'ぶどうの木',
  kind text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT supporter_accounts_kind_check CHECK (kind IN ('facility', 'relative', 'sitter'))
);

CREATE TABLE IF NOT EXISTS parent_access (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  family_id text NOT NULL,
  role text NOT NULL,
  verified_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT parent_access_user_family_unique UNIQUE (user_id, family_id),
  CONSTRAINT parent_access_role_check CHECK (role IN ('papa', 'mama'))
);

CREATE TABLE IF NOT EXISTS supporter_grants (
  id serial PRIMARY KEY,
  family_id text NOT NULL,
  child_id integer NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
  supporter_account_id integer NOT NULL REFERENCES supporter_accounts(id) ON DELETE RESTRICT,
  invited_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  accepted_at timestamp,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT supporter_grants_valid_period CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS supporter_grants_account_child_idx
  ON supporter_grants (supporter_account_id, child_id);
CREATE INDEX IF NOT EXISTS supporter_grants_family_idx ON supporter_grants (family_id);

CREATE TABLE IF NOT EXISTS supporter_idempotency (
  id serial PRIMARY KEY,
  supporter_account_id integer NOT NULL REFERENCES supporter_accounts(id) ON DELETE RESTRICT,
  action text NOT NULL,
  request_id varchar(128) NOT NULL,
  payload_fingerprint varchar(128) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT supporter_idempotency_account_action_request_unique
    UNIQUE (supporter_account_id, action, request_id)
);

CREATE TABLE IF NOT EXISTS supporter_audit_logs (
  id serial PRIMARY KEY,
  actor_account_id integer REFERENCES users(id) ON DELETE RESTRICT,
  supporter_account_id integer REFERENCES supporter_accounts(id) ON DELETE RESTRICT,
  supporter_grant_id integer REFERENCES supporter_grants(id) ON DELETE RESTRICT,
  action text NOT NULL,
  request_id varchar(128),
  before jsonb,
  after jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Account provisioning uses the admin-only existing-user binding UI. invite_address and
-- public_code are non-secret matching identifiers, never passwords/tokens:
-- INSERT INTO supporter_accounts
--   (user_id, invite_address, public_code, display_name, kind)
-- VALUES
--   (<existing users.id>, 'BUDOUNOKI-001', 'BUDOUNOKI-001',
--    'ぶどうの木', 'facility');
--
-- Parent authority is intentionally explicit. Do not derive it from
-- users.family_id, users.role, browser storage, or a family invite code:
-- INSERT INTO parent_access (user_id, family_id, role, verified_at)
-- VALUES (<existing users.id>, '<family-id>', 'mama', now());