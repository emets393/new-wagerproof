-- Fix RLS policy for profiles table to ensure onboarding updates work properly
-- Drop existing policy and recreate with proper WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update their own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Also ensure there's a SELECT policy for users to read their own profile
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;

CREATE POLICY "Users can view their own profile."
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Make sure RLS is enabled on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
