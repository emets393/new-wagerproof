-- Add new columns to editors_picks table for enhanced pick creation
-- Includes pick details, game data archiving, and free pick flag

-- Pick details
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS pick_value text,
ADD COLUMN IF NOT EXISTS best_price text,
ADD COLUMN IF NOT EXISTS sportsbook text,
ADD COLUMN IF NOT EXISTS units numeric(2,1) CHECK (units IS NULL OR (units >= 0.5 AND units <= 5)),
ADD COLUMN IF NOT EXISTS is_free_pick boolean DEFAULT false;

-- Archived game data (snapshot at time of pick creation for historical preservation)
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS archived_game_data jsonb DEFAULT NULL;

-- Add comments to document the columns
COMMENT ON COLUMN editors_picks.pick_value IS 'The actual pick text, e.g., "49ers -3.5", "Over 47.5"';
COMMENT ON COLUMN editors_picks.best_price IS 'Best price found for the pick, e.g., "-110", "+120"';
COMMENT ON COLUMN editors_picks.sportsbook IS 'Sportsbook where best price was found, e.g., "FanDuel", "DraftKings"';
COMMENT ON COLUMN editors_picks.units IS 'Bet size from 0.5 to 5 in 0.5 increments';
COMMENT ON COLUMN editors_picks.is_free_pick IS 'Flag to indicate if this is a free pick visible to all users';
COMMENT ON COLUMN editors_picks.archived_game_data IS 'Snapshot of game data at pick creation time - includes teams, odds, logos, colors, etc.';

-- Create index for free picks
CREATE INDEX IF NOT EXISTS idx_editors_picks_is_free_pick ON editors_picks(is_free_pick) WHERE is_free_pick = true;
