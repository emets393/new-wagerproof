-- Add day_of_week field to ai_page_level_schedules table
-- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
ALTER TABLE ai_page_level_schedules 
ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1 CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Update existing records to default to Monday (1)
UPDATE ai_page_level_schedules 
SET day_of_week = 1 
WHERE day_of_week IS NULL;

-- Add comment
COMMENT ON COLUMN ai_page_level_schedules.day_of_week IS 'Day of week for weekly schedule (0=Sunday, 1=Monday, ..., 6=Saturday)';

