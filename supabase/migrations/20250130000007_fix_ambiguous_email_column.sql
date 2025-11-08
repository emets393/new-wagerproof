-- Fix ambiguous email column reference
-- The issue is that both profiles and auth.users might have email columns
-- We need to explicitly qualify which email we're selecting

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
  subscription_expires_at TIMESTAMPTZ
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
    p.subscription_expires_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_admin_user_data() IS 'Get all user data including email (admin only) - fixed ambiguous column reference';

