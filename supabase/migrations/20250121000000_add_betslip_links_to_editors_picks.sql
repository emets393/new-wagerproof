-- Add betslip_links column to editors_picks table
-- Stores betslip links as JSONB: { "draftkings": "url", "fanduel": "url", ... }
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS betslip_links JSONB DEFAULT NULL;

-- Add comment to document the structure
COMMENT ON COLUMN editors_picks.betslip_links IS 
'JSONB object storing betslip links for each sportsbook. Format: {"draftkings": "url", "fanduel": "url", ...}';

-- Add index for faster queries when checking if links exist
CREATE INDEX IF NOT EXISTS idx_editors_picks_betslip_links 
ON editors_picks USING GIN (betslip_links) 
WHERE betslip_links IS NOT NULL;

