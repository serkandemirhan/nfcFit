-- Occurrence time remains in created_at; received_at tracks the later sync receipt.
-- Legacy activities retain their original time through COALESCE(received_at, created_at).
BEGIN;
ALTER TABLE console_activities ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;
COMMIT;
