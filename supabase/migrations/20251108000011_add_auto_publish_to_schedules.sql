-- Add auto_publish field to ai_page_level_schedules table
ALTER TABLE ai_page_level_schedules 
ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN ai_page_level_schedules.auto_publish IS 'If true, automatically publish value finds after generation';

