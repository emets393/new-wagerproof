-- Update handle_new_user function to ensure onboarding_completed is FALSE for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for new user with onboarding_completed set to FALSE
  INSERT INTO public.profiles (user_id, username, display_name, onboarding_completed)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    FALSE  -- Explicitly set onboarding_completed to FALSE for new users
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign free_user role during launch
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;
