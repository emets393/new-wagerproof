-- Add onboarding_completed field to get_admin_user_data function
-- This allows admins to see which users have completed onboarding

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS get_admin_user_data();

CREATE OR REPLACE FUNCTION get_admin_user_data()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  revenuecat_customer_id TEXT,
  subscription_status TEXT,
  subscription_active BOOLEAN,
  subscription_expires_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can access user data';
  END IF;
  
  -- Get email from auth.users using a subquery with explicit column qualification
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    COALESCE(
      (SELECT au.email FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      ''
    )::TEXT as email,
    p.created_at,
    p.revenuecat_customer_id,
    p.subscription_status,
    COALESCE(p.subscription_active, false) as subscription_active,
    p.subscription_expires_at,
    COALESCE(p.onboarding_completed, false) as onboarding_completed
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_admin_user_data() IS 'Get all user data including email and onboarding status (admin only)';

