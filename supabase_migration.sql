-- Migration script to add missing columns to tasks table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add nextdueat column (for repeating tasks)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS nextdueat timestamptz;

-- Add lastcompletedat column (tracks when task was last completed)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS lastcompletedat timestamptz;

-- Add completionnotes column (notes added when completing a task)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS completionnotes text;

-- Add repeat_frequency column (how often task repeats)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS repeat_frequency integer;

-- Add repeat_unit column (unit for repeat: 'hours' or 'days')
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS repeat_unit text;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY column_name;
