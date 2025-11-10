-- Create game_tails table for users tailing specific game picks
CREATE TABLE IF NOT EXISTS public.game_tails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_unique_id text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('nfl', 'cfb', 'mlb', 'nba', 'ncaab')),
  team_selection text NOT NULL CHECK (team_selection IN ('home', 'away')),
  pick_type text NOT NULL CHECK (pick_type IN ('moneyline', 'spread', 'over_under')),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- One user can only tail one specific pick per game
  UNIQUE(user_id, game_unique_id, team_selection, pick_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_game_tails_game_unique_id ON public.game_tails(game_unique_id);
CREATE INDEX IF NOT EXISTS idx_game_tails_user_id ON public.game_tails(user_id);
CREATE INDEX IF NOT EXISTS idx_game_tails_sport ON public.game_tails(sport);

-- Enable RLS
ALTER TABLE public.game_tails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_tails
-- Anyone authenticated can view all tails
CREATE POLICY "Anyone can view game tails"
  ON public.game_tails
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can create their own tails
CREATE POLICY "Users can create their own tails"
  ON public.game_tails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tails
CREATE POLICY "Users can delete their own tails"
  ON public.game_tails
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.game_tails IS 'Users tailing specific picks on games';

