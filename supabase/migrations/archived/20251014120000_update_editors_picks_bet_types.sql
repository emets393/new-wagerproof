-- Remove the CHECK constraint on selected_bet_type to allow new bet type values
-- This allows us to store multiple bet types as comma-separated values
-- and support specific bet types like 'spread_away', 'spread_home', 'ml_away', 'ml_home', 'over', 'under'

-- First, drop the existing constraint
ALTER TABLE editors_picks 
DROP CONSTRAINT IF EXISTS editors_picks_selected_bet_type_check;

-- Optionally, add a comment to document the expected values
COMMENT ON COLUMN editors_picks.selected_bet_type IS 
'Comma-separated list of bet types. Valid individual values: spread, spread_away, spread_home, moneyline, ml_away, ml_home, over_under, over, under';

