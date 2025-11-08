-- Fix update_announcement_banner function to include WHERE clause
-- This is required by PostgreSQL RLS policies

CREATE OR REPLACE FUNCTION update_announcement_banner(
  message TEXT,
  published BOOLEAN
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
    RAISE EXCEPTION 'Only admins can update announcement banner';
  END IF;
  
  -- Get the first (and typically only) site_settings row ID
  SELECT id INTO settings_id FROM site_settings LIMIT 1;
  
  -- If no row exists, create one
  IF settings_id IS NULL THEN
    INSERT INTO site_settings (launch_mode, require_subscription)
    VALUES (true, false)
    RETURNING id INTO settings_id;
  END IF;
  
  -- Update announcement banner with WHERE clause
  UPDATE site_settings
  SET 
    announcement_message = message,
    announcement_published = published,
    announcement_updated_at = NOW(),
    announcement_updated_by = auth.uid()
  WHERE id = settings_id
  RETURNING jsonb_build_object(
    'message', announcement_message,
    'published', announcement_published,
    'updated_at', announcement_updated_at
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION update_announcement_banner(TEXT, BOOLEAN) IS 'Update announcement banner (admin only) - fixed to include WHERE clause for RLS compliance';

