-- Add new columns to ai_value_finds for three output formats
ALTER TABLE ai_value_finds 
ADD COLUMN IF NOT EXISTS high_value_badges JSONB,
ADD COLUMN IF NOT EXISTS page_header_data JSONB,
ADD COLUMN IF NOT EXISTS editor_cards JSONB;

-- Update RLS policy to only show published finds to non-admins
DROP POLICY IF EXISTS "Anyone can read value finds" ON ai_value_finds;

CREATE POLICY "Published value finds or admins"
  ON ai_value_finds FOR SELECT
  USING (
    published = true 
    OR has_role(auth.uid(), 'admin')
  );

-- Add comments for documentation
COMMENT ON COLUMN ai_value_finds.high_value_badges IS 'Array of badges to show on game cards: {game_id, recommended_pick, confidence, tooltip_text}';
COMMENT ON COLUMN ai_value_finds.page_header_data IS 'Data for page header section: {summary_text, compact_picks: [{game_id, matchup, pick}]}';
COMMENT ON COLUMN ai_value_finds.editor_cards IS 'Full card data for Editors Picks page: [{game_id, matchup, bet_type, recommended_pick, confidence, key_factors, explanation}]';

