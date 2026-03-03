-- ============================================================================
-- Migration: Allow manual agent creation beyond live-agent limit
-- Description:
--   - Pro users can create additional agents in manual mode once the live
--     agent cap is reached, up to the total agent cap.
--   - Admin behavior remains unchanged.
--   - Free users remain limited to one agent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_agent(
  p_user_id uuid,
  p_target_is_active boolean DEFAULT true
)
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
    IF v_total_agent_count >= 30 THEN
      RETURN false;
    END IF;

    IF COALESCE(p_target_is_active, true) = false THEN
      RETURN true;
    END IF;

    RETURN v_active_agent_count < 10;
  END IF;

  RETURN v_active_agent_count < 1 AND v_total_agent_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_create_agent(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Users can create own avatars" ON public.avatar_profiles;
CREATE POLICY "Users can create own avatars"
  ON public.avatar_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_agent(auth.uid(), COALESCE(is_active, true))
    AND (
      public.can_create_public_agent(auth.uid())
      OR COALESCE(is_public, false) = false
    )
  );
