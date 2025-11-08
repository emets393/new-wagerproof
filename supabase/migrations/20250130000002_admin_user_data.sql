-- Create RPC function to get admin user data including email
-- This safely returns user data including email from auth.users
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
  
  -- Return user data with email from auth.users
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.display_name,
    au.email,
    p.created_at,
    p.revenuecat_customer_id,
    p.subscription_status,
    p.subscription_active,
    p.subscription_expires_at
  FROM profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_admin_user_data() IS 'Get all user data including email (admin only)';

