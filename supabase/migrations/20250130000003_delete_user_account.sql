-- Create RPC function to delete user account (admin only)
-- This function safely deletes a user account with proper cascade handling
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  current_user_id UUID;
  admin_count INTEGER;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT has_role(current_user_id, 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;
  
  -- Prevent self-deletion
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Check if this is the last admin (safety check)
  SELECT COUNT(*) INTO admin_count
  FROM user_roles
  WHERE role = 'admin' AND user_id != target_user_id;
  
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'Cannot delete the last admin account';
  END IF;
  
  -- Delete from profiles (cascades to related data via foreign keys)
  DELETE FROM profiles WHERE user_id = target_user_id;
  
  -- Note: auth.users deletion requires Supabase Admin API access
  -- This can be done via:
  -- 1. Supabase Dashboard (Settings > Authentication > Users)
  -- 2. Supabase Admin API with service role key (edge function)
  -- 3. Supabase Management API from backend service
  -- The profile deletion will cascade to most related data, but auth.users must be deleted separately
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting user account: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION delete_user_account(UUID) IS 'Delete a user account (admin only, prevents self-deletion and deleting last admin)';

