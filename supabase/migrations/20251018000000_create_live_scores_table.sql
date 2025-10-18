-- Create live_scores table for caching ESPN live game data
CREATE TABLE IF NOT EXISTS live_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text UNIQUE NOT NULL,
  league text NOT NULL,
  away_team text NOT NULL,
  away_abbr text NOT NULL,
  away_score integer NOT NULL,
  away_color text,
  home_team text NOT NULL,
  home_abbr text NOT NULL,
  home_score integer NOT NULL,
  home_color text,
  status text NOT NULL,
  period text,
  time_remaining text,
  is_live boolean DEFAULT true,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_live_scores_is_live ON live_scores(is_live);
CREATE INDEX IF NOT EXISTS idx_live_scores_league ON live_scores(league);
CREATE INDEX IF NOT EXISTS idx_live_scores_game_id ON live_scores(game_id);

-- Enable Row Level Security
ALTER TABLE live_scores ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (for authenticated and anonymous users)
CREATE POLICY "Allow public read access to live scores"
  ON live_scores
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role to manage live scores"
  ON live_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

