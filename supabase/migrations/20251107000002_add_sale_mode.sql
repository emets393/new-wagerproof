-- Add a global settings table for app-wide configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert sale mode setting (default: false)
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('sale_mode', '{"enabled": false, "discount_percentage": 50}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
DROP POLICY IF EXISTS "Only admins can update app settings" ON app_settings;

-- Policy: Everyone can read settings
CREATE POLICY "Anyone can read app settings"
  ON app_settings
  FOR SELECT
  USING (true);

-- Policy: Only admins can update settings (using has_role function)
CREATE POLICY "Only admins can update app settings"
  ON app_settings
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin')
  );

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_sale_mode();
DROP FUNCTION IF EXISTS update_sale_mode(BOOLEAN, INTEGER);

-- Create function to get sale mode status
CREATE OR REPLACE FUNCTION get_sale_mode()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT setting_value 
  FROM app_settings 
  WHERE setting_key = 'sale_mode';
$$;

-- Create function to update sale mode (admin only, using has_role)
CREATE OR REPLACE FUNCTION update_sale_mode(enabled BOOLEAN, discount_pct INTEGER DEFAULT 50)
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
    RAISE EXCEPTION 'Only admins can update sale mode';
  END IF;
  
  -- Update sale mode
  UPDATE app_settings
  SET 
    setting_value = jsonb_build_object(
      'enabled', enabled,
      'discount_percentage', discount_pct
    ),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE setting_key = 'sale_mode'
  RETURNING setting_value INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON TABLE app_settings IS 'Global application settings';
COMMENT ON COLUMN app_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN app_settings.setting_value IS 'JSON value of the setting';
COMMENT ON FUNCTION get_sale_mode() IS 'Get current sale mode status (public function)';
COMMENT ON FUNCTION update_sale_mode(BOOLEAN, INTEGER) IS 'Update sale mode (admin only)';
