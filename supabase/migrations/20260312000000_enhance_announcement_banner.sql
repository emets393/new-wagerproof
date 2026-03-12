-- Add title, image URL, and link fields to announcement banner in site_settings
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_image_url TEXT,
ADD COLUMN IF NOT EXISTS announcement_link_url TEXT,
ADD COLUMN IF NOT EXISTS announcement_link_text TEXT DEFAULT 'Learn More';

-- Update get_announcement_banner to return new fields
CREATE OR REPLACE FUNCTION get_announcement_banner()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'title', announcement_title,
    'message', announcement_message,
    'published', COALESCE(announcement_published, false),
    'image_url', announcement_image_url,
    'link_url', announcement_link_url,
    'link_text', COALESCE(announcement_link_text, 'Learn More'),
    'updated_at', announcement_updated_at
  )
  FROM site_settings
  LIMIT 1;
$$;

-- Update update_announcement_banner to accept new fields
CREATE OR REPLACE FUNCTION update_announcement_banner(
  p_title TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_published BOOLEAN DEFAULT false,
  p_image_url TEXT DEFAULT NULL,
  p_link_url TEXT DEFAULT NULL,
  p_link_text TEXT DEFAULT 'Learn More'
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
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update announcement banner';
  END IF;

  SELECT id INTO settings_id FROM site_settings LIMIT 1;

  IF settings_id IS NULL THEN
    INSERT INTO site_settings (launch_mode, require_subscription)
    VALUES (true, false)
    RETURNING id INTO settings_id;
  END IF;

  UPDATE site_settings
  SET
    announcement_title = p_title,
    announcement_message = p_message,
    announcement_published = p_published,
    announcement_image_url = p_image_url,
    announcement_link_url = p_link_url,
    announcement_link_text = p_link_text,
    announcement_updated_at = NOW(),
    announcement_updated_by = auth.uid()
  WHERE id = settings_id
  RETURNING jsonb_build_object(
    'title', announcement_title,
    'message', announcement_message,
    'published', announcement_published,
    'image_url', announcement_image_url,
    'link_url', announcement_link_url,
    'link_text', announcement_link_text,
    'updated_at', announcement_updated_at
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON COLUMN site_settings.announcement_title IS 'Optional title for the announcement banner';
COMMENT ON COLUMN site_settings.announcement_image_url IS 'Optional background image URL for the announcement banner';
COMMENT ON COLUMN site_settings.announcement_link_url IS 'Optional CTA link URL for the announcement banner';
COMMENT ON COLUMN site_settings.announcement_link_text IS 'CTA button text (defaults to Learn More)';
