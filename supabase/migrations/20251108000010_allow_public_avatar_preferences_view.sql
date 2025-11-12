-- Allow authenticated users to view all avatar preferences
-- This enables displaying other users' avatar customizations (colors/letters)
-- while keeping INSERT/UPDATE restricted to the user themselves

CREATE POLICY "Authenticated users can view all avatar preferences"
  ON public.user_avatar_preferences
  FOR SELECT
  USING (auth.role() = 'authenticated');

