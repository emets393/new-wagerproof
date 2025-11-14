-- Create table to cache Polymarket events/games list
CREATE TABLE IF NOT EXISTS public.polymarket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league TEXT NOT NULL CHECK (league IN ('nfl', 'cfb', 'ncaab', 'nba')),
  tag_id TEXT NOT NULL,
  
  -- Event data (stored as JSONB array for flexibility)
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  event_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one row per league
  UNIQUE(league)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_polymarket_events_league ON public.polymarket_events(league);
CREATE INDEX IF NOT EXISTS idx_polymarket_events_last_updated ON public.polymarket_events(last_updated);

-- Enable Row Level Security
ALTER TABLE public.polymarket_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access (data is public anyway)
CREATE POLICY "Allow public read access to polymarket_events"
  ON public.polymarket_events
  FOR SELECT
  TO public
  USING (true);

-- Only allow service role to write (cron job)
CREATE POLICY "Allow service role to insert/update polymarket_events"
  ON public.polymarket_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.polymarket_events IS 'Cached Polymarket events list, updated daily by cron job';

-- Update polymarket_markets table to support ncaab and nba
ALTER TABLE public.polymarket_markets 
DROP CONSTRAINT IF EXISTS polymarket_markets_league_check;

ALTER TABLE public.polymarket_markets 
ADD CONSTRAINT polymarket_markets_league_check 
CHECK (league IN ('nfl', 'cfb', 'ncaab', 'nba'));

