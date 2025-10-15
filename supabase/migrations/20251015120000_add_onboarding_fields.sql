-- Add onboarding_completed and onboarding_data columns to the profiles table
ALTER TABLE public.profiles
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN onboarding_data JSONB;

-- RLS policy to allow users to update their own profile
-- This assumes a policy for SELECT is already in place.
-- If you need to create a new policy from scratch for updates:
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable RLS on the table if it's not already enabled.
-- This is commented out because it's likely already enabled.
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
