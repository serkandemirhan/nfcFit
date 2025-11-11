-- Normalize task status values from Turkish to English
-- Run this in Supabase SQL Editor

-- Update Turkish status values to English equivalents
UPDATE tasks
SET status = CASE
    WHEN LOWER(status) IN ('yapılacak', 'yapilacak') THEN 'not_started'
    WHEN LOWER(status) IN ('devam ediyor', 'devam ediyor', 'in_progress') THEN 'in_progress'
    WHEN LOWER(status) IN ('tamamlandı', 'tamamlandi', 'completed') THEN 'completed'
    WHEN LOWER(status) IN ('iptal', 'canceled', 'cancelled') THEN 'canceled'
    ELSE status
END
WHERE LOWER(status) IN (
    'yapılacak', 'yapilacak',
    'devam ediyor', 'devam ediyor',
    'tamamlandı', 'tamamlandi',
    'iptal'
);

-- Verify the update
SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
WHERE active IS NULL OR active = true
GROUP BY status
ORDER BY count DESC;

-- Optional: Create a constraint to ensure only valid statuses
-- ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
-- ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
--     CHECK (status IN ('not_started', 'in_progress', 'completed', 'canceled'));

-- Add comment for documentation
COMMENT ON COLUMN tasks.status IS 'Task status: not_started, in_progress, completed, canceled';
