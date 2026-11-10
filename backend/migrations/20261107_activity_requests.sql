BEGIN;
ALTER TABLE console_activities ADD COLUMN IF NOT EXISTS request_id VARCHAR(36);
ALTER TABLE console_activities ADD COLUMN IF NOT EXISTS request_payload_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_console_activity_account_request ON console_activities(account_id, request_id);
COMMIT;
