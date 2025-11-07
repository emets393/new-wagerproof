-- Add access_restricted field to site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS access_restricted BOOLEAN DEFAULT true;

-- Update existing row to have access_restricted as true
UPDATE site_settings SET access_restricted = true WHERE access_restricted IS NULL;

-- Create function to get access_restricted status
CREATE OR REPLACE FUNCTION get_access_restricted()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT access_restricted 
  FROM site_settings 
  LIMIT 1;
$$;

-- Create function to update access_restricted status (admin only)
CREATE OR REPLACE FUNCTION update_access_restricted(restricted BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
  result BOOLEAN;
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update access restricted setting';
  END IF;
  
  -- Update access_restricted
  UPDATE site_settings
  SET 
    access_restricted = restricted,
    updated_at = NOW(),
    updated_by = auth.uid()
  RETURNING access_restricted INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_access_restricted() IS 'Get current access restricted overlay status (public function)';
COMMENT ON FUNCTION update_access_restricted(BOOLEAN) IS 'Update access restricted overlay toggle (admin only) - enables/disables the password overlay on login page';

