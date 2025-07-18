-- Add dominant_side field to saved_trend_patterns table
ALTER TABLE public.saved_trend_patterns 
ADD COLUMN IF NOT EXISTS dominant_side TEXT DEFAULT 'primary';

-- Update existing records to have a default dominant_side based on win percentages
UPDATE public.saved_trend_patterns 
SET dominant_side = CASE 
  WHEN win_pct >= opponent_win_pct THEN 'primary' 
  ELSE 'opponent' 
END
WHERE dominant_side IS NULL OR dominant_side = 'primary'; 