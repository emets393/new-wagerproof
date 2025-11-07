-- Fix handle_new_user function to prevent username conflicts
-- The issue: When users sign up with OAuth, their username from metadata is used directly
-- without a UUID suffix, which can cause conflicts. Also, ON CONFLICT only handles user_id,
-- not username conflicts.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  generated_username TEXT;
  username_exists BOOLEAN;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  -- Determine base username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  
  -- Always append UUID suffix to ensure uniqueness, even for OAuth usernames
  -- This prevents conflicts when multiple users have similar usernames
  generated_username := base_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  
  -- Check if username already exists and regenerate if needed (very unlikely but safe)
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = generated_username) INTO username_exists;
    EXIT WHEN NOT username_exists OR attempt >= max_attempts;
    generated_username := base_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    attempt := attempt + 1;
  END LOOP;
  
  -- Create profile for new user with onboarding_completed set to FALSE
  -- Handle both user_id conflicts (user already exists) and username conflicts (collision)
  BEGIN
    INSERT INTO public.profiles (user_id, username, display_name, onboarding_completed)
    VALUES (
      NEW.id, 
      generated_username,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
      FALSE  -- Explicitly set onboarding_completed to FALSE for new users
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- If username conflict occurs despite pre-check, regenerate and retry once
      generated_username := base_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      INSERT INTO public.profiles (user_id, username, display_name, onboarding_completed)
      VALUES (
        NEW.id, 
        generated_username,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
        FALSE
      )
      ON CONFLICT (user_id) DO NOTHING;
  END;
  
  -- Assign free_user role during launch
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

