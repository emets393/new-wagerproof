-- Add schedule_frequency field to ai_page_level_schedules table
-- Allows choosing between 'daily' and 'weekly' runs
ALTER TABLE ai_page_level_schedules 
ADD COLUMN IF NOT EXISTS schedule_frequency TEXT DEFAULT 'weekly' CHECK (schedule_frequency IN ('daily', 'weekly'));

-- Update existing records to default to weekly
UPDATE ai_page_level_schedules 
SET schedule_frequency = 'weekly' 
WHERE schedule_frequency IS NULL;

-- Add comment
COMMENT ON COLUMN ai_page_level_schedules.schedule_frequency IS 'Schedule frequency: daily (runs every day at scheduled_time) or weekly (runs once per week on day_of_week at scheduled_time)';

