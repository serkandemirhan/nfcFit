-- Additive, safe to reapply. Existing plans/workout timestamps are unchanged.
BEGIN;
ALTER TABLE public.console_wellness_preferences
ADD COLUMN IF NOT EXISTS timezone varchar(80) NOT NULL DEFAULT 'Europe/Istanbul';
COMMIT;
