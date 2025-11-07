-- Add orientation_unique_id to distinguish between team orientations
-- This allows precise pattern matching while keeping unique_id for game grouping

-- Add orientation_unique_id column to saved_trend_patterns table
ALTER TABLE public.saved_trend_patterns 
ADD COLUMN IF NOT EXISTS orientation_unique_id TEXT;

-- Create new tables that duplicate the existing view data with orientation_unique_id added

-- Create input_values_team_format_with_orientation table
CREATE TABLE public.input_values_team_format_with_orientation AS
SELECT 
  *,
  CONCAT(primary_team, '|', opponent_team, '|', date) as orientation_unique_id
FROM public.input_values_team_format_view;

-- Create training_data_team_with_orientation table
CREATE TABLE public.training_data_team_with_orientation AS
SELECT 
  *,
  CONCAT(primary_team, '|', opponent_team, '|', date) as orientation_unique_id
FROM public.training_data_team_view;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_format_orientation_unique_id ON public.input_values_team_format_with_orientation(orientation_unique_id);
CREATE INDEX IF NOT EXISTS idx_training_data_orientation_unique_id ON public.training_data_team_with_orientation(orientation_unique_id);

-- Add indexes on other commonly queried columns
CREATE INDEX IF NOT EXISTS idx_team_format_date ON public.input_values_team_format_with_orientation(date);
CREATE INDEX IF NOT EXISTS idx_team_format_unique_id ON public.input_values_team_format_with_orientation(unique_id);
CREATE INDEX IF NOT EXISTS idx_training_data_date ON public.training_data_team_with_orientation(date);
CREATE INDEX IF NOT EXISTS idx_training_data_unique_id ON public.training_data_team_with_orientation(unique_id); 