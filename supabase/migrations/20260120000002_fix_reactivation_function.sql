-- Fix get_inactive_users_for_email function with explicit type casting
-- The auth.users.email column is varchar, needs explicit cast to TEXT

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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    au.email::TEXT,
    p.display_name::TEXT,
    p.username::TEXT,
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
