-- Add 'mlb' to the avatar_picks.sport CHECK constraint
-- Required for MLB agent pick generation

ALTER TABLE public.avatar_picks
  DROP CONSTRAINT IF EXISTS avatar_picks_sport_check;

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_sport_check
  CHECK (sport IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb'));
