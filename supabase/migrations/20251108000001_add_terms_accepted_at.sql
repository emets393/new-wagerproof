-- Add terms acceptance timestamp to profiles table
-- This stores when users accepted the terms and conditions during onboarding

-- Add terms_accepted_at column to track when user accepted terms
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Create index for queries filtering by users who have accepted terms
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at 
ON profiles(terms_accepted_at) 
WHERE terms_accepted_at IS NOT NULL;

COMMENT ON COLUMN profiles.terms_accepted_at IS 'Timestamp when user accepted terms and conditions during onboarding';

