-- Add sandbox mode setting for testing with Stripe test cards
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('sandbox_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_sandbox_mode();
DROP FUNCTION IF EXISTS update_sandbox_mode(BOOLEAN);

-- Create function to get sandbox mode status
CREATE OR REPLACE FUNCTION get_sandbox_mode()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT setting_value 
  FROM app_settings 
  WHERE setting_key = 'sandbox_mode';
$$;

-- Create function to update sandbox mode (admin only)
CREATE OR REPLACE FUNCTION update_sandbox_mode(enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
  result JSONB;
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update sandbox mode';
  END IF;
  
  -- Update sandbox mode
  UPDATE app_settings
  SET 
    setting_value = jsonb_build_object('enabled', enabled),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE setting_key = 'sandbox_mode'
  RETURNING setting_value INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_sandbox_mode() IS 'Get current sandbox mode status (public function)';
COMMENT ON FUNCTION update_sandbox_mode(BOOLEAN) IS 'Update sandbox mode (admin only) - switches between production and sandbox RevenueCat keys';

