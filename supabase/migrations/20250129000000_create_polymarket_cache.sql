-- Create table to cache Polymarket market data
CREATE TABLE IF NOT EXISTS public.polymarket_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key TEXT NOT NULL, -- e.g., "nfl_Baltimore_Miami" or "cfb_Ohio State_Michigan"
  league TEXT NOT NULL CHECK (league IN ('nfl', 'cfb')),
  away_team TEXT NOT NULL,
  home_team TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('moneyline', 'spread', 'total')),
  
  -- Price history data (stored as JSONB for flexibility)
  price_history JSONB NOT NULL,
  
  -- Current odds
  current_away_odds NUMERIC NOT NULL,
  current_home_odds NUMERIC NOT NULL,
  
  -- Market metadata
  token_id TEXT NOT NULL,
  question TEXT,
  
  -- Timestamps
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one row per game + market type
  UNIQUE(game_key, market_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_polymarket_markets_game_key ON public.polymarket_markets(game_key);
CREATE INDEX IF NOT EXISTS idx_polymarket_markets_last_updated ON public.polymarket_markets(last_updated);

-- Enable Row Level Security
ALTER TABLE public.polymarket_markets ENABLE ROW LEVEL SECURITY;

-- Allow public read access (data is public anyway)
CREATE POLICY "Allow public read access to polymarket_markets"
  ON public.polymarket_markets
  FOR SELECT
  TO public
  USING (true);

-- Only allow service role to write (cron job)
CREATE POLICY "Allow service role to insert/update polymarket_markets"
  ON public.polymarket_markets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.polymarket_markets IS 'Cached Polymarket betting line data, updated periodically by cron job';

