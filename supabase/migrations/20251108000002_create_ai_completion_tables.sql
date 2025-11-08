-- AI Completion System Tables
-- This migration creates the tables needed for AI-powered game analysis

-- Table: ai_completion_configs
-- Stores admin-configurable system prompts for different widget types
CREATE TABLE IF NOT EXISTS ai_completion_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_type TEXT NOT NULL,
  sport_type TEXT NOT NULL CHECK (sport_type IN ('nfl', 'cfb')),
  system_prompt TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(widget_type, sport_type)
);

-- Table: ai_completions
-- Stores generated AI completions for game widgets
CREATE TABLE IF NOT EXISTS ai_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  sport_type TEXT NOT NULL CHECK (sport_type IN ('nfl', 'cfb')),
  widget_type TEXT NOT NULL,
  completion_text TEXT NOT NULL,
  data_payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT DEFAULT 'gpt-4.1-mini',
  UNIQUE(game_id, sport_type, widget_type)
);

-- Table: ai_value_finds
-- Stores page-level value analysis
CREATE TABLE IF NOT EXISTS ai_value_finds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_type TEXT NOT NULL CHECK (sport_type IN ('nfl', 'cfb')),
  analysis_date DATE NOT NULL,
  value_picks JSONB NOT NULL,
  analysis_json JSONB NOT NULL,
  summary_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  UNIQUE(sport_type, analysis_date, generated_at)
);

-- Table: ai_page_level_schedules
-- Stores scheduling config for automatic page-level analysis
CREATE TABLE IF NOT EXISTS ai_page_level_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_type TEXT NOT NULL CHECK (sport_type IN ('nfl', 'cfb')),
  enabled BOOLEAN DEFAULT false,
  scheduled_time TIME NOT NULL,
  system_prompt TEXT NOT NULL,
  last_run_at TIMESTAMPTZ,
  UNIQUE(sport_type)
);

-- Enable RLS
ALTER TABLE ai_completion_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_value_finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_page_level_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_completion_configs
CREATE POLICY "Admins can manage completion configs"
  ON ai_completion_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read completion configs"
  ON ai_completion_configs FOR SELECT
  USING (true);

-- RLS Policies for ai_completions
CREATE POLICY "Anyone can read completions"
  ON ai_completions FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert completions"
  ON ai_completions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete completions"
  ON ai_completions FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_value_finds
CREATE POLICY "Anyone can read value finds"
  ON ai_value_finds FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage value finds"
  ON ai_value_finds FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_page_level_schedules
CREATE POLICY "Anyone can read schedules"
  ON ai_page_level_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage schedules"
  ON ai_page_level_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_ai_completions_game_id ON ai_completions(game_id);
CREATE INDEX idx_ai_completions_sport_type ON ai_completions(sport_type);
CREATE INDEX idx_ai_completions_widget_type ON ai_completions(widget_type);
CREATE INDEX idx_ai_value_finds_sport_date ON ai_value_finds(sport_type, analysis_date);
CREATE INDEX idx_ai_value_finds_generated_at ON ai_value_finds(generated_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_completion_configs
CREATE TRIGGER ai_completion_configs_updated_at
BEFORE UPDATE ON ai_completion_configs
FOR EACH ROW
EXECUTE FUNCTION update_ai_config_updated_at();

-- Insert default system prompts for NFL
INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled) VALUES
(
  'spread_prediction',
  'nfl',
  'You are an expert NFL sports analyst. Analyze the provided game data and create a concise, user-friendly explanation of what the spread prediction means for bettors. Focus on the confidence level, key factors (weather, public betting, polymarket odds), and what needs to happen for the bet to win. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
),
(
  'ou_prediction',
  'nfl',
  'You are an expert NFL sports analyst. Analyze the provided game data and create a concise explanation of what the over/under prediction means. Discuss the confidence level, offensive/defensive indicators, weather impacts, and scoring expectations. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
);

-- Insert default system prompts for CFB
INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled) VALUES
(
  'spread_prediction',
  'cfb',
  'You are an expert college football analyst. Analyze the provided game data and create a concise, user-friendly explanation of what the spread prediction means for bettors. Focus on the confidence level, key factors (weather, public betting, polymarket odds), and what needs to happen for the bet to win. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
),
(
  'ou_prediction',
  'cfb',
  'You are an expert college football analyst. Analyze the provided game data and create a concise explanation of what the over/under prediction means. Discuss the confidence level, offensive/defensive indicators, weather impacts, and scoring expectations. Keep it under 100 words. Return your response as JSON with a single field "explanation".',
  true
);

-- Insert default page-level schedules
INSERT INTO ai_page_level_schedules (sport_type, enabled, scheduled_time, system_prompt) VALUES
(
  'nfl',
  false,
  '10:00:00',
  'You are an expert NFL analyst identifying value betting opportunities. Analyze all provided game data and completions. Look for mismatches between: 1) Model predictions vs Vegas lines, 2) Public betting splits vs actual odds, 3) Polymarket sentiment vs traditional markets. Return JSON with: {"value_picks": [{"game_id": "...", "reason": "...", "key_data": ["...", "..."]}], "summary": "Overall analysis text explaining the value opportunities and real-world context."}'
),
(
  'cfb',
  false,
  '10:00:00',
  'You are an expert college football analyst identifying value betting opportunities. Analyze all provided game data and completions. Look for mismatches between: 1) Model predictions vs Vegas lines, 2) Public betting splits vs actual odds, 3) Polymarket sentiment vs traditional markets. Return JSON with: {"value_picks": [{"game_id": "...", "reason": "...", "key_data": ["...", "..."]}], "summary": "Overall analysis text explaining the value opportunities and real-world context."}'
);

COMMENT ON TABLE ai_completion_configs IS 'Admin-configurable system prompts for AI widget completions';
COMMENT ON TABLE ai_completions IS 'Generated AI completions for game card widgets';
COMMENT ON TABLE ai_value_finds IS 'Page-level AI analysis identifying value betting opportunities';
COMMENT ON TABLE ai_page_level_schedules IS 'Scheduling configuration for automatic page-level analysis';

