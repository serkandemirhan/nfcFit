-- Apply as database owner before deploying the planning workspace.
-- Lifecycle and rest dates are additive fields in immutable version content JSON;
-- legacy content defaults to published with no explicit rest dates.
BEGIN;
CREATE TABLE IF NOT EXISTS console_workout_templates (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES console_tenants(id),
  owner_id VARCHAR(36) NOT NULL REFERENCES console_accounts(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  content JSON NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_console_workout_templates_tenant_id ON console_workout_templates(tenant_id);
CREATE INDEX IF NOT EXISTS ix_console_workout_templates_owner_id ON console_workout_templates(owner_id);
ALTER TABLE console_workout_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON console_workout_templates FROM anon, authenticated;
COMMIT;
