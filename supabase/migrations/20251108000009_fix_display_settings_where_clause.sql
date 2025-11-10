-- Fix update_display_settings function to include WHERE clause
-- This is required by PostgreSQL RLS policies

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
  settings_id UUID;
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update display settings';
  END IF;
  
  -- Get the first (and typically only) site_settings row ID
  SELECT id INTO settings_id FROM site_settings LIMIT 1;
  
  -- If no row exists, create one
  IF settings_id IS NULL THEN
    INSERT INTO site_settings (launch_mode, require_subscription, show_nfl_moneyline_pills, show_extra_value_suggestions)
    VALUES (true, false, true, true)
    RETURNING id INTO settings_id;
  END IF;
  
  -- Update display settings with WHERE clause
  UPDATE site_settings
  SET 
    show_nfl_moneyline_pills = show_moneyline,
    show_extra_value_suggestions = show_value_suggestions,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = settings_id
  RETURNING jsonb_build_object(
    'show_nfl_moneyline_pills', show_nfl_moneyline_pills,
    'show_extra_value_suggestions', show_extra_value_suggestions
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION update_display_settings(BOOLEAN, BOOLEAN) IS 'Update display settings (admin only) - fixed to include WHERE clause for RLS compliance';

