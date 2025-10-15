-- Add missing columns to saved_trend_patterns table for orientation matching
ALTER TABLE public.saved_trend_patterns 
ADD COLUMN IF NOT EXISTS dominant_side text,
ADD COLUMN IF NOT EXISTS primary_vs_opponent_id text;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_patterns_primary_vs_opponent_id ON public.saved_trend_patterns(primary_vs_opponent_id);
CREATE INDEX IF NOT EXISTS idx_saved_patterns_dominant_side ON public.saved_trend_patterns(dominant_side); 