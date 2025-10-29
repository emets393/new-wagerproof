-- Create editors_picks table for admin curated game picks
CREATE TABLE IF NOT EXISTS editors_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('nfl', 'cfb')),
  editor_id uuid NOT NULL REFERENCES auth.users(id),
  selected_bet_type text NOT NULL CHECK (selected_bet_type IN ('spread', 'over_under', 'moneyline')),
  editors_notes text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE editors_picks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with editors picks
CREATE POLICY "Admins can manage all editors picks"
ON editors_picks FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- All users can read published picks, admins can see everything
CREATE POLICY "Anyone can read published picks"
ON editors_picks FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_editors_picks_game_id ON editors_picks(game_id);
CREATE INDEX idx_editors_picks_published ON editors_picks(is_published);
CREATE INDEX idx_editors_picks_editor_id ON editors_picks(editor_id);
CREATE INDEX idx_editors_picks_game_type ON editors_picks(game_type);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_editors_picks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER editors_picks_updated_at
BEFORE UPDATE ON editors_picks
FOR EACH ROW
EXECUTE FUNCTION update_editors_picks_updated_at();

