-- ============================================================================
-- Migration: Enforce Agent Freemium Policies
-- Description:
--   - Non-pro users can create at most 1 active agent
--   - Only Pro/Admin users can read agent picks (own or public)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_agent_picks(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT COALESCE(subscription_active, false)
  INTO v_subscription_active
  FROM public.profiles
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_subscription_active, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_agent(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_agent_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT COALESCE(subscription_active, false)
  INTO v_subscription_active
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF COALESCE(v_subscription_active, false) THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
  INTO v_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  RETURN v_agent_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_agent_picks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_agent(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create own avatars" ON public.avatar_profiles;
CREATE POLICY "Users can create own avatars"
  ON public.avatar_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_agent(auth.uid())
  );

DROP POLICY IF EXISTS "Users can read own avatar picks" ON public.avatar_picks;
DROP POLICY IF EXISTS "Anyone can read public avatar picks" ON public.avatar_picks;

CREATE POLICY "Pro users can read own avatar picks"
  ON public.avatar_picks
  FOR SELECT
  USING (
    public.can_access_agent_picks(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Pro users can read public avatar picks"
  ON public.avatar_picks
  FOR SELECT
  USING (
    public.can_access_agent_picks(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.is_public = true
    )
  );
