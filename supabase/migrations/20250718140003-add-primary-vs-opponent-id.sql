-- Add primary_vs_opponent_id column to saved_trend_patterns table for orientation tracking
ALTER TABLE public.saved_trend_patterns 
ADD COLUMN IF NOT EXISTS primary_vs_opponent_id TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_saved_patterns_primary_vs_opponent_id ON public.saved_trend_patterns(primary_vs_opponent_id); 