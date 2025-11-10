-- Add display toggle fields to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS show_nfl_moneyline_pills BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_extra_value_suggestions BOOLEAN DEFAULT true;

-- Update existing row to have both settings as true (show by default)
UPDATE site_settings 
SET 
  show_nfl_moneyline_pills = true,
  show_extra_value_suggestions = true
WHERE show_nfl_moneyline_pills IS NULL OR show_extra_value_suggestions IS NULL;

-- Create function to get display settings (public)
CREATE OR REPLACE FUNCTION get_display_settings()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'show_nfl_moneyline_pills', COALESCE(show_nfl_moneyline_pills, true),
    'show_extra_value_suggestions', COALESCE(show_extra_value_suggestions, true)
  )
  FROM site_settings 
  LIMIT 1;
$$;

-- Create function to update display settings (admin only)
CREATE OR REPLACE FUNCTION update_display_settings(
  show_moneyline BOOLEAN,
  show_value_suggestions BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  result JSONB;
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update display settings';
  END IF;
  
  -- Update display settings
  UPDATE site_settings
  SET 
    show_nfl_moneyline_pills = show_moneyline,
    show_extra_value_suggestions = show_value_suggestions,
    updated_at = NOW(),
    updated_by = auth.uid()
  RETURNING jsonb_build_object(
    'show_nfl_moneyline_pills', show_nfl_moneyline_pills,
    'show_extra_value_suggestions', show_extra_value_suggestions
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON COLUMN site_settings.show_nfl_moneyline_pills IS 'Controls whether NFL moneyline values are displayed in the card view';
COMMENT ON COLUMN site_settings.show_extra_value_suggestions IS 'Controls whether Extra value suggestions are shown in Editors Picks';
COMMENT ON FUNCTION get_display_settings() IS 'Get current display settings (public function)';
COMMENT ON FUNCTION update_display_settings(BOOLEAN, BOOLEAN) IS 'Update display settings (admin only)';

