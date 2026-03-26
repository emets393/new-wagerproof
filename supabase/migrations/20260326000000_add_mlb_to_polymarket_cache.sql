-- Add MLB support to polymarket_markets table
ALTER TABLE public.polymarket_markets
DROP CONSTRAINT IF EXISTS polymarket_markets_league_check;

ALTER TABLE public.polymarket_markets
ADD CONSTRAINT polymarket_markets_league_check
CHECK (league IN ('nfl', 'cfb', 'ncaab', 'nba', 'mlb'));

-- Add MLB support to polymarket_events table
ALTER TABLE public.polymarket_events
DROP CONSTRAINT IF EXISTS polymarket_events_league_check;

ALTER TABLE public.polymarket_events
ADD CONSTRAINT polymarket_events_league_check
CHECK (league IN ('nfl', 'cfb', 'ncaab', 'nba', 'mlb'));
