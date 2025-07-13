-- Create trigger to automatically create user profiles when users sign up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
WHERE public.pattern_daily_matches.unique_id = tdv.unique_id
  AND public.pattern_daily_matches.primary_team = tdv.primary_team
  AND public.pattern_daily_matches.opponent_team = tdv.opponent_team;

-- Create ROI tracking table for saved patterns
CREATE TABLE public.pattern_roi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_pattern_id UUID REFERENCES public.saved_trend_patterns(id) ON DELETE CASCADE,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_bet_amount NUMERIC DEFAULT 0,
  total_payout NUMERIC DEFAULT 0,
  roi_percentage NUMERIC DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(saved_pattern_id)
);

-- Enable RLS on pattern_roi table
ALTER TABLE public.pattern_roi ENABLE ROW LEVEL SECURITY;

-- RLS policies for pattern_roi
CREATE POLICY "Users can view ROI for their own saved patterns" 
  ON public.pattern_roi 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trend_patterns stp 
      WHERE stp.id = pattern_roi.saved_pattern_id 
      AND stp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ROI for their own saved patterns" 
  ON public.pattern_roi 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_trend_patterns stp 
      WHERE stp.id = pattern_roi.saved_pattern_id 
      AND stp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ROI for their own saved patterns" 
  ON public.pattern_roi 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trend_patterns stp 
      WHERE stp.id = pattern_roi.saved_pattern_id 
      AND stp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ROI for their own saved patterns" 
  ON public.pattern_roi 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trend_patterns stp 
      WHERE stp.id = pattern_roi.saved_pattern_id 
      AND stp.user_id = auth.uid()
    )
  );