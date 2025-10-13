-- Add free_user role to app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'free_user') THEN
    ALTER TYPE app_role ADD VALUE 'free_user';
  END IF;
END $$;

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_mode boolean DEFAULT true,
  require_subscription boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO site_settings (launch_mode, require_subscription) 
VALUES (true, false)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can update settings
CREATE POLICY "Admins can manage site settings"
ON site_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Everyone can read settings
CREATE POLICY "Anyone can read site settings"
ON site_settings FOR SELECT
USING (true);

-- Update handle_new_user trigger to assign free_user role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign free_user role during launch
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create helper function for access control
CREATE OR REPLACE FUNCTION public.user_has_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  is_free_user boolean;
  launch_mode_active boolean;
BEGIN
  -- Admins always have access
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  ) INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- Check if launch mode is active
  SELECT COALESCE(launch_mode, false) INTO launch_mode_active FROM site_settings LIMIT 1;
  
  -- During launch mode, free_user role grants access
  IF launch_mode_active THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'free_user'
    ) INTO is_free_user;
    
    RETURN is_free_user;
  END IF;
  
  -- After launch mode ends, no access (until Stripe integration)
  RETURN false;
END;
$$;