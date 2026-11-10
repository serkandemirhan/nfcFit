-- Existing PostgreSQL installations: preserve all tags and exercise assignments.
-- Also applied idempotently by initialize_console_schema on PostgreSQL startup.
BEGIN;
ALTER TABLE console_nfc_tags ALTER COLUMN exercise_id DROP NOT NULL;
COMMIT;
