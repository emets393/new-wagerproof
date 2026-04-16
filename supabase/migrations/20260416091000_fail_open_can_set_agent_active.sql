-- ============================================================================
-- Migration: Fail-open entitlement logic for can_set_agent_active
-- Description:
--   Align activation gating with other fail-open entitlement checks so paying
--   users are not blocked when profiles.subscription_active is briefly stale.
-- ============================================================================

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
  v_has_rc_id boolean := false;
  v_current_is_active boolean := false;
  v_active_agent_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  IF p_target_is_active = false THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COALESCE(is_active, false)
  INTO v_current_is_active
  FROM public.avatar_profiles
  WHERE id = p_avatar_id
    AND user_id = p_user_id;

  IF v_current_is_active THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
  INTO v_active_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    RETURN v_active_agent_count < 10;
  END IF;

  RETURN v_active_agent_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_set_agent_active(uuid, uuid, boolean) TO authenticated;
