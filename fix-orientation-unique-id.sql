-- Orientation-specific matching implementation
-- Note: Database schema changes have already been made by the user

-- Create indexes for better performance (if not already created)
CREATE INDEX IF NOT EXISTS idx_team_format_orientation_unique_id ON public.input_values_team_format_with_orientation(orientation_unique_id);
CREATE INDEX IF NOT EXISTS idx_team_format_primary_vs_opponent_id ON public.input_values_team_format_with_orientation(primary_vs_opponent_id);
CREATE INDEX IF NOT EXISTS idx_training_data_orientation_unique_id ON public.training_data_team_with_orientation(orientation_unique_id);

-- Add indexes on other commonly queried columns (if not already created)
CREATE INDEX IF NOT EXISTS idx_team_format_date ON public.input_values_team_format_with_orientation(date);
CREATE INDEX IF NOT EXISTS idx_team_format_unique_id ON public.input_values_team_format_with_orientation(unique_id);
CREATE INDEX IF NOT EXISTS idx_training_data_date ON public.training_data_team_with_orientation(date);
CREATE INDEX IF NOT EXISTS idx_training_data_unique_id ON public.training_data_team_with_orientation(unique_id); 