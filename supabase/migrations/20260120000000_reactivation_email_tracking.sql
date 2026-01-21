-- Reactivation Email Tracking System
-- This migration creates the infrastructure for automated reactivation emails via Loops.so

-- =========================================
-- Add tracking columns to profiles table
-- =========================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS reactivation_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reactivation_cohort TEXT; -- For A/B testing

-- Create index for efficient queries on reactivation tracking
CREATE INDEX IF NOT EXISTS idx_profiles_reactivation_email_sent_at
ON profiles(reactivation_email_sent_at);

-- =========================================
-- Create logging table for reactivation email runs
-- =========================================
CREATE TABLE IF NOT EXISTS reactivation_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  users_processed INT DEFAULT 0,
  users_succeeded INT DEFAULT 0,
  users_failed INT DEFAULT 0,
  error_message TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_reactivation_email_logs_run_at
ON reactivation_email_logs(run_at DESC);

-- Enable RLS
ALTER TABLE reactivation_email_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view logs
CREATE POLICY "Admins can view reactivation email logs"
ON reactivation_email_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
);

-- =========================================
-- PostgreSQL Function to get inactive users
-- =========================================
CREATE OR REPLACE FUNCTION get_inactive_users_for_email(
  batch_size INT DEFAULT 150,
  inactivity_days INT DEFAULT 30
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  username TEXT,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    au.email,
    p.display_name,
    p.username,
    au.last_sign_in_at
  FROM profiles p
  INNER JOIN auth.users au ON p.user_id = au.id
  WHERE
    -- Never received reactivation email
    p.reactivation_email_sent_at IS NULL
    -- Inactive for X days (using auth.users.last_sign_in_at)
    AND au.last_sign_in_at < NOW() - (inactivity_days || ' days')::INTERVAL
    -- Has completed onboarding (real user)
    AND p.onboarding_completed = true
    -- Has an email
    AND au.email IS NOT NULL
  ORDER BY RANDOM()
  LIMIT batch_size;
END;
$$;

-- =========================================
-- Comments for documentation
-- =========================================
COMMENT ON TABLE reactivation_email_logs IS 'Tracks reactivation email cron job execution history';
COMMENT ON COLUMN profiles.reactivation_email_sent_at IS 'Timestamp when reactivation email event was sent to Loops.so';
COMMENT ON COLUMN profiles.reactivation_cohort IS 'A/B testing cohort assignment for reactivation campaigns';
COMMENT ON FUNCTION get_inactive_users_for_email IS 'Returns batch of inactive users who have not received reactivation emails';
