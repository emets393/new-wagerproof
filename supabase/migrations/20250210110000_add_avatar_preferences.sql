-- Add avatar preferences columns to user settings or create a new table
-- Using a separate table for flexibility

CREATE TABLE IF NOT EXISTS public.user_avatar_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_letter text CHECK (length(custom_letter) = 1),
  gradient_key text CHECK (gradient_key IN ('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_avatar_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own avatar preferences"
  ON public.user_avatar_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own avatar preferences"
  ON public.user_avatar_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own avatar preferences"
  ON public.user_avatar_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_avatar_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER avatar_preferences_updated_at
BEFORE UPDATE ON public.user_avatar_preferences
FOR EACH ROW
EXECUTE FUNCTION update_avatar_preferences_updated_at();

-- Add comment
COMMENT ON TABLE public.user_avatar_preferences IS 'User avatar customization preferences';

