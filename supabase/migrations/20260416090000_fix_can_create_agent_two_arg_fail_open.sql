-- ============================================================================
-- Migration: Fix fail-open logic for can_create_agent(uuid, boolean)
-- Description:
--   Align the 2-argument can_create_agent function (used by avatar_profiles
--   INSERT policy) with fail-open entitlement handling. Paying users with a
--   RevenueCat customer id should not be blocked when subscription_active is
--   temporarily stale.
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
  v_has_rc_id boolean := false;
  v_total_agent_count integer := 0;
  v_active_agent_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
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

  -- Paid path: explicit active subscription OR fail-open RevenueCat identity.
  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    IF v_total_agent_count >= 30 THEN
      RETURN false;
    END IF;

    IF COALESCE(p_target_is_active, true) = false THEN
      RETURN true;
    END IF;

    RETURN v_active_agent_count < 10;
  END IF;

  -- Free path: one total active agent.
  RETURN v_active_agent_count < 1 AND v_total_agent_count < 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_create_agent(uuid, boolean) TO authenticated;
