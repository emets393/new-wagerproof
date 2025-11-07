-- Add team information to saved_trend_patterns table to track which teams the pattern was created with
ALTER TABLE public.saved_trend_patterns 
ADD COLUMN IF NOT EXISTS pattern_primary_team TEXT,
ADD COLUMN IF NOT EXISTS pattern_opponent_team TEXT; 