-- Create today_in_sports_completions table
CREATE TABLE IF NOT EXISTS public.today_in_sports_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_date date NOT NULL UNIQUE,
  completion_text text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  published boolean NOT NULL DEFAULT true,
  sent_to_discord boolean NOT NULL DEFAULT false,
  discord_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster date lookups
CREATE INDEX IF NOT EXISTS idx_today_in_sports_completion_date 
  ON public.today_in_sports_completions(completion_date DESC);

-- Enable RLS
ALTER TABLE public.today_in_sports_completions ENABLE ROW LEVEL SECURITY;

-- Anyone can read published completions
CREATE POLICY "Anyone can view published today in sports completions"
  ON public.today_in_sports_completions
  FOR SELECT
  USING (published = true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage today in sports completions"
  ON public.today_in_sports_completions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- First, alter the ai_page_level_schedules table to allow 'today_in_sports' as a sport_type
ALTER TABLE public.ai_page_level_schedules 
DROP CONSTRAINT IF EXISTS ai_page_level_schedules_sport_type_check;

ALTER TABLE public.ai_page_level_schedules
ADD CONSTRAINT ai_page_level_schedules_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'today_in_sports'));

-- Add today_in_sports schedule to ai_page_level_schedules
INSERT INTO public.ai_page_level_schedules (
  sport_type,
  enabled,
  scheduled_time,
  system_prompt
) VALUES (
  'today_in_sports',
  true,
  '10:00:00',
  'You are a sports news analyst providing a concise daily briefing for sports bettors. Generate a compelling summary of the most important sports news, betting storylines, and developments from the past 24 hours across NFL and College Football.

Focus on:
- Breaking news and injury updates that impact betting lines
- Major coaching decisions or roster changes
- Notable line movements and betting trends
- Weather conditions affecting games
- Key matchups and storylines for today''s games

Keep it concise (200-300 words), engaging, and focused on actionable betting intelligence. Use a confident, knowledgeable tone. Do not use markdown headers. Write in short, punchy paragraphs.'
) ON CONFLICT (sport_type) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.today_in_sports_completions IS 'Daily AI-generated sports news completions for Today in Sports page';

