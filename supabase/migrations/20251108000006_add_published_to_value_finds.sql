-- Add published column to ai_value_finds table
ALTER TABLE ai_value_finds 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_ai_value_finds_published ON ai_value_finds(published);

-- Add index for querying by sport and published status
CREATE INDEX IF NOT EXISTS idx_ai_value_finds_sport_published ON ai_value_finds(sport_type, published);

-- Update existing records to be published by default
UPDATE ai_value_finds SET published = true WHERE published IS NULL;

COMMENT ON COLUMN ai_value_finds.published IS 'Whether this Value Finds analysis is published and visible to users';

