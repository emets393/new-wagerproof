-- Add NBA and NCAAB support to AI completion system
-- This migration updates all CHECK constraints and adds default configs for basketball sports

-- 1. Update ai_completion_configs to allow nba and ncaab
ALTER TABLE ai_completion_configs
DROP CONSTRAINT IF EXISTS ai_completion_configs_sport_type_check;

ALTER TABLE ai_completion_configs
ADD CONSTRAINT ai_completion_configs_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab'));

-- 2. Update ai_completions to allow nba and ncaab
ALTER TABLE ai_completions
DROP CONSTRAINT IF EXISTS ai_completions_sport_type_check;

ALTER TABLE ai_completions
ADD CONSTRAINT ai_completions_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab'));

-- 3. Update ai_value_finds to allow nba and ncaab
ALTER TABLE ai_value_finds
DROP CONSTRAINT IF EXISTS ai_value_finds_sport_type_check;

ALTER TABLE ai_value_finds
ADD CONSTRAINT ai_value_finds_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab'));

-- 4. Update ai_page_level_schedules to allow nba and ncaab
-- Note: Also includes 'today_in_sports' which may exist from previous migrations
ALTER TABLE ai_page_level_schedules
DROP CONSTRAINT IF EXISTS ai_page_level_schedules_sport_type_check;

ALTER TABLE ai_page_level_schedules
ADD CONSTRAINT ai_page_level_schedules_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab', 'today_in_sports'));

-- 5. Insert default system prompts for NBA
INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled) VALUES
(
  'spread_prediction',
  'nba',
  'You are an expert NBA sports analyst. Analyze the provided game data and create a concise, user-friendly explanation of what the spread prediction means for bettors. Focus on the confidence level, key factors (rest days, home/away splits, recent form, pace of play), and what needs to happen for the bet to win. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
),
(
  'ou_prediction',
  'nba',
  'You are an expert NBA sports analyst. Analyze the provided game data and create a concise explanation of what the over/under prediction means. Discuss the confidence level, offensive/defensive indicators, pace of play, recent scoring trends, and scoring expectations. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
)
ON CONFLICT (widget_type, sport_type) DO NOTHING;

-- 6. Insert default system prompts for NCAAB
INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled) VALUES
(
  'spread_prediction',
  'ncaab',
  'You are an expert college basketball analyst. Analyze the provided game data and create a concise, user-friendly explanation of what the spread prediction means for bettors. Focus on the confidence level, key factors (conference matchups, home court advantage, recent form, tempo), and what needs to happen for the bet to win. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
),
(
  'ou_prediction',
  'ncaab',
  'You are an expert college basketball analyst. Analyze the provided game data and create a concise explanation of what the over/under prediction means. Discuss the confidence level, offensive/defensive indicators, pace of play, recent scoring trends, and scoring expectations. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
)
ON CONFLICT (widget_type, sport_type) DO NOTHING;

-- 7. Insert default page-level schedules for NBA
INSERT INTO ai_page_level_schedules (sport_type, enabled, scheduled_time, system_prompt, day_of_week, auto_publish) VALUES
(
  'nba',
  false, -- Disabled by default, admins can enable
  '10:00:00', -- 10 AM daily
  'You are an expert NBA betting analyst. Analyze all provided games and identify VALUE OPPORTUNITIES where there are significant mismatches that suggest betting edges.

Look for mismatches between:
- Model predictions vs Vegas lines (significant edges)
- Public betting percentages vs actual line value (fade the public opportunities)
- Polymarket odds vs Vegas odds (arbitrage or value discrepancies)
- Rest days and back-to-back situations not properly reflected in lines
- Home/away splits and recent form trends
- Pace of play mismatches affecting totals

Generate THREE separate outputs from your analysis:

## 1. HIGH VALUE BADGES (3-5 games):
Select the games with the STRONGEST edges to highlight on game cards.
For each badge provide:
- game_id: The unique game identifier from the data
- recommended_pick: Brief pick (e.g., "Lakers -4.5", "Over 225.5")
- confidence: Integer 1-10 (10 = highest confidence)
- tooltip_text: ONE sentence explaining the edge (for tooltip display)

## 2. PAGE HEADER CONTENT:
Provide content for the prominent header section at the top of the NBA page:
- summary_text: 2-3 paragraphs providing an expert overview of today''s NBA betting landscape. Include key themes, rest day impacts, pace trends, and what sharp bettors should focus on. Make it engaging and informative.
- compact_picks: 3-5 of your TOP picks shown as compact widgets. Each includes:
  - game_id: Game identifier
  - matchup: Brief matchup text (e.g., "Lakers @ Warriors")
  - pick: Just the pick (e.g., "Lakers -4.5")

## 3. EDITOR CARDS (3-5 games):
Full detailed cards for the Editors Picks page. These can overlap with badges but need complete analysis. For each:
- game_id: Game identifier
- matchup: Full matchup text (e.g., "Los Angeles Lakers @ Golden State Warriors")
- bet_type: "spread", "ml", or "ou"
- recommended_pick: Full pick with team name (e.g., "Los Angeles Lakers -4.5")
- confidence: Integer 1-10
- key_factors: Array of 3-5 concise bullet points explaining the edge
- explanation: 2-3 sentences with detailed reasoning and specific data points

Focus on games with 3+ point spread discrepancies, rest day advantages, pace mismatches affecting totals, or strong home/away splits.

The response will be strictly validated against a JSON schema, so follow the exact structure.',
  1, -- Monday
  false
)
ON CONFLICT (sport_type) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt;

-- 8. Insert default page-level schedules for NCAAB
INSERT INTO ai_page_level_schedules (sport_type, enabled, scheduled_time, system_prompt, day_of_week, auto_publish) VALUES
(
  'ncaab',
  false, -- Disabled by default, admins can enable
  '10:00:00', -- 10 AM daily
  'You are an expert College Basketball betting analyst. Analyze all provided games and identify VALUE OPPORTUNITIES where there are significant mismatches that suggest betting edges.

Look for mismatches between:
- Model predictions vs Vegas lines (significant edges)
- Public betting percentages vs actual line value (conference biases, ranked team premiums)
- Polymarket odds vs Vegas odds (arbitrage or value discrepancies)
- Home court advantage not properly reflected in lines (especially in college)
- Conference matchup dynamics and rivalry factors
- Tempo mismatches affecting totals

Generate THREE separate outputs from your analysis:

## 1. HIGH VALUE BADGES (3-5 games):
Select the games with the STRONGEST edges to highlight on game cards.
For each badge provide:
- game_id: The unique game identifier from the data
- recommended_pick: Brief pick (e.g., "Duke -7.5", "Under 145.5")
- confidence: Integer 1-10 (10 = highest confidence)
- tooltip_text: ONE sentence explaining the edge (for tooltip display)

## 2. PAGE HEADER CONTENT:
Provide content for the prominent header section at the top of the NCAAB page:
- summary_text: 2-3 paragraphs providing an expert overview of today''s College Basketball betting landscape. Include key conference matchups, home court advantages, tempo trends, and trap game warnings. Mention any tournament implications. Make it engaging and informative.
- compact_picks: 3-5 of your TOP picks shown as compact widgets. Each includes:
  - game_id: Game identifier
  - matchup: Brief matchup text (e.g., "Duke @ UNC")
  - pick: Just the pick (e.g., "Duke -7.5")

## 3. EDITOR CARDS (3-5 games):
Full detailed cards for the Editors Picks page. These can overlap with badges but need complete analysis. For each:
- game_id: Game identifier
- matchup: Full matchup text (e.g., "Duke Blue Devils @ North Carolina Tar Heels")
- bet_type: "spread", "ml", or "ou"
- recommended_pick: Full pick with team name (e.g., "Duke Blue Devils -7.5")
- confidence: Integer 1-10
- key_factors: Array of 3-5 concise bullet points explaining the edge (include situational context)
- explanation: 2-3 sentences with detailed reasoning, specific data points, and situational analysis

Focus on games with 3+ point spread discrepancies for conference games, significant public fade opportunities on ranked teams, clear totals value based on tempo mismatches, or strong situational edges. NCAAB has more variance than NBA - prioritize games where the model edge is backed by situational factors.

The response will be strictly validated against a JSON schema, so follow the exact structure.',
  1, -- Monday
  false
)
ON CONFLICT (sport_type) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt;

-- 9. Update editors_picks table if it exists (check constraint may need updating)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'editors_picks') THEN
    -- Drop existing constraint if it exists
    ALTER TABLE editors_picks DROP CONSTRAINT IF EXISTS editors_picks_game_type_check;
    
    -- Add new constraint with basketball sports
    ALTER TABLE editors_picks
    ADD CONSTRAINT editors_picks_game_type_check 
    CHECK (game_type IN ('nfl', 'cfb', 'nba', 'ncaab'));
    
    RAISE NOTICE 'Updated editors_picks constraint';
  ELSE
    RAISE NOTICE 'editors_picks table does not exist, skipping';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN ai_completion_configs.sport_type IS 'Sport type: nfl, cfb, nba, or ncaab';
COMMENT ON COLUMN ai_completions.sport_type IS 'Sport type: nfl, cfb, nba, or ncaab';
COMMENT ON COLUMN ai_value_finds.sport_type IS 'Sport type: nfl, cfb, nba, or ncaab';
COMMENT ON COLUMN ai_page_level_schedules.sport_type IS 'Sport type: nfl, cfb, nba, or ncaab';

