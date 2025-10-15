
-- Create table for saved trend patterns
CREATE TABLE public.saved_trend_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,
  features TEXT[] NOT NULL,
  target TEXT NOT NULL,
  combo TEXT NOT NULL,
  win_pct NUMERIC NOT NULL,
  opponent_win_pct NUMERIC NOT NULL,
  games INTEGER NOT NULL,
  feature_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for tracking daily pattern matches
CREATE TABLE public.pattern_daily_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_pattern_id UUID REFERENCES public.saved_trend_patterns(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  unique_id TEXT NOT NULL,
  primary_team TEXT NOT NULL,
  opponent_team TEXT NOT NULL,
  is_home_game BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(saved_pattern_id, match_date, unique_id)
);

-- Enable RLS on both tables
ALTER TABLE public.saved_trend_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_daily_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_trend_patterns
CREATE POLICY "Users can view their own saved patterns" 
  ON public.saved_trend_patterns 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved patterns" 
  ON public.saved_trend_patterns 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved patterns" 
  ON public.saved_trend_patterns 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved patterns" 
  ON public.saved_trend_patterns 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS policies for pattern_daily_matches
CREATE POLICY "Users can view matches for their saved patterns" 
  ON public.pattern_daily_matches 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.saved_trend_patterns 
    WHERE id = saved_pattern_id AND user_id = auth.uid()
  ));

CREATE POLICY "System can insert pattern matches" 
  ON public.pattern_daily_matches 
  FOR INSERT 
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_saved_patterns_user_id ON public.saved_trend_patterns(user_id);
CREATE INDEX idx_pattern_matches_pattern_id ON public.pattern_daily_matches(saved_pattern_id);
CREATE INDEX idx_pattern_matches_date ON public.pattern_daily_matches(match_date);
