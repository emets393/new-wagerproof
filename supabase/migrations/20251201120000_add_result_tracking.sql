-- Comprehensive migration to add all missing columns to editors_picks table
-- This includes columns from multiple previous migrations that may not have been applied

-- Add pick details columns (from 20250601000000 migration)
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS pick_value TEXT,
ADD COLUMN IF NOT EXISTS best_price TEXT,
ADD COLUMN IF NOT EXISTS sportsbook TEXT,
ADD COLUMN IF NOT EXISTS units NUMERIC CHECK (units IS NULL OR (units >= 0.5 AND units <= 5 AND units * 2 = TRUNC(units * 2))),
ADD COLUMN IF NOT EXISTS is_free_pick BOOLEAN DEFAULT FALSE;

-- Add archived game data column (from 20250601000000 migration)
ALTER TABLE editors_picks 
ADD COLUMN IF NOT EXISTS archived_game_data JSONB DEFAULT NULL;

-- Add win/loss tracking columns (new in this migration)
ALTER TABLE editors_picks
ADD COLUMN IF NOT EXISTS bet_type TEXT CHECK (bet_type IN ('moneyline', 'spread', 'over_under', 'teaser', 'parlay')),
ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('won', 'lost', 'push', 'pending') OR result IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN editors_picks.pick_value IS 'The actual pick text, e.g., "49ers -3.5", "Over 47.5"';
COMMENT ON COLUMN editors_picks.best_price IS 'Best price found for the pick, e.g., "-110", "+120"';
COMMENT ON COLUMN editors_picks.sportsbook IS 'Sportsbook where best price was found, e.g., "FanDuel", "DraftKings"';
COMMENT ON COLUMN editors_picks.units IS 'Bet size from 0.5 to 5 in 0.5 increments';
COMMENT ON COLUMN editors_picks.is_free_pick IS 'Flag to indicate if this is a free pick visible to all users';
COMMENT ON COLUMN editors_picks.archived_game_data IS 'JSONB object storing a snapshot of game data at the time of pick creation/update';
COMMENT ON COLUMN editors_picks.bet_type IS 'Type of bet: moneyline, spread, over_under, teaser, or parlay';
COMMENT ON COLUMN editors_picks.result IS 'Result of the pick: won, lost, push, pending, or NULL (not yet graded)';

-- Create index for free picks
CREATE INDEX IF NOT EXISTS idx_editors_picks_is_free_pick ON editors_picks(is_free_pick) WHERE is_free_pick = true;

