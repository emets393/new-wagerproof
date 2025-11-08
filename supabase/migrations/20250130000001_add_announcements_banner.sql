-- Add announcements banner fields to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS announcement_message TEXT,
ADD COLUMN IF NOT EXISTS announcement_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS announcement_updated_by UUID REFERENCES auth.users(id);

-- Create function to get announcement banner (public)
CREATE OR REPLACE FUNCTION get_announcement_banner()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'message', announcement_message,
    'published', COALESCE(announcement_published, false),
    'updated_at', announcement_updated_at
  )
  FROM site_settings 
  LIMIT 1;
$$;

-- Create function to update announcement banner (admin only)
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
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update announcement banner';
  END IF;
  
  -- Update announcement banner
  UPDATE site_settings
  SET 
    announcement_message = message,
    announcement_published = published,
    announcement_updated_at = NOW(),
    announcement_updated_by = auth.uid()
  RETURNING jsonb_build_object(
    'message', announcement_message,
    'published', announcement_published,
    'updated_at', announcement_updated_at
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON COLUMN site_settings.announcement_message IS 'The banner message content displayed to all users';
COMMENT ON COLUMN site_settings.announcement_published IS 'Whether the banner is currently visible to users';
COMMENT ON FUNCTION get_announcement_banner() IS 'Get current announcement banner (public function)';
COMMENT ON FUNCTION update_announcement_banner(TEXT, BOOLEAN) IS 'Update announcement banner (admin only)';

