-- ============================================================================
-- Migration: Update Agent Limits for Pro Users
-- Description:
--   - Free users: max 1 active agent
--   - Pro users: max 10 active agents, max 30 total agents
--   - Admins: unlimited
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_agent(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_total_agent_count integer := 0;
  v_active_agent_count integer := 0;
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

  SELECT COUNT(*)
  INTO v_total_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_active_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  IF COALESCE(v_subscription_active, false) THEN
    RETURN v_active_agent_count < 10 AND v_total_agent_count < 30;
  END IF;

  RETURN v_active_agent_count < 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_set_agent_active(
  p_user_id uuid,
  p_avatar_id uuid,
  p_target_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_current_is_active boolean := false;
  v_active_agent_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  -- Deactivating is always allowed for owner.
  IF p_target_is_active = false THEN
    RETURN true;
  END IF;

  SELECT COALESCE(subscription_active, false)
  INTO v_subscription_active
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COALESCE(is_active, false)
  INTO v_current_is_active
  FROM public.avatar_profiles
  WHERE id = p_avatar_id
    AND user_id = p_user_id;

  -- No-op activation update.
  IF v_current_is_active THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
  INTO v_active_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  IF COALESCE(v_subscription_active, false) THEN
    RETURN v_active_agent_count < 10;
  END IF;

  RETURN v_active_agent_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_create_agent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_set_agent_active(uuid, uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Users can update own avatars" ON public.avatar_profiles;
CREATE POLICY "Users can update own avatars"
  ON public.avatar_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_set_agent_active(auth.uid(), id, is_active)
  );
