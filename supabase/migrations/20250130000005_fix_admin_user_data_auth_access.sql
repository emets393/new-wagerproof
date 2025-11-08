-- Fix get_admin_user_data function to properly access auth.users
-- The issue is that auth.users might not be accessible directly
-- We'll use a different approach that works with Supabase's security model

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
SET search_path = public, auth
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can access user data';
  END IF;
  
  -- Return user data with email from auth.users
  -- Using explicit schema reference
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    COALESCE(au.email, '')::TEXT as email,
    p.created_at,
    p.revenuecat_customer_id,
    p.subscription_status,
    COALESCE(p.subscription_active, false) as subscription_active,
    p.subscription_expires_at
  FROM profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_admin_user_data() IS 'Get all user data including email (admin only) - fixed auth.users access';

