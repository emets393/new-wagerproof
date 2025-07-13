-- Add columns to pattern_daily_matches for ROI calculation
ALTER TABLE public.pattern_daily_matches 
ADD COLUMN IF NOT EXISTS primary_ml NUMERIC,
ADD COLUMN IF NOT EXISTS primary_rl NUMERIC,
ADD COLUMN IF NOT EXISTS opponent_ml NUMERIC,
ADD COLUMN IF NOT EXISTS opponent_rl NUMERIC,
ADD COLUMN IF NOT EXISTS ou_result NUMERIC,
ADD COLUMN IF NOT EXISTS primary_win NUMERIC,
ADD COLUMN IF NOT EXISTS primary_runline_win NUMERIC;

-- Create index for better performance when joining with training_data_team_view
CREATE INDEX IF NOT EXISTS idx_pattern_matches_teams ON public.pattern_daily_matches(unique_id, primary_team, opponent_team);

-- Update existing records with data from training_data_team_view
UPDATE public.pattern_daily_matches 
SET 
  primary_ml = tdv.primary_ml,
  primary_rl = tdv.primary_rl,
  opponent_ml = tdv.opponent_ml,
  opponent_rl = tdv.opponent_rl,
  ou_result = tdv.ou_result,
  primary_win = tdv.primary_win,
  primary_runline_win = tdv.primary_runline_win
FROM public.training_data_team_view tdv
WHERE 
  pattern_daily_matches.unique_id = tdv.unique_id 
  AND pattern_daily_matches.primary_team = tdv.primary_team 
  AND pattern_daily_matches.opponent_team = tdv.opponent_team; 