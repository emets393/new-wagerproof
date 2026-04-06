-- ============================================================================
-- Migration: Entitlement Fail-Open for Paying Users
-- Description:
--   Modifies entitlement-checking SQL functions to fail OPEN when a user has
--   a revenuecat_customer_id but subscription_active is false/null. This
--   prevents paying users from being blocked when the Supabase profile hasn't
--   been synced yet (e.g., client sync failed, webhook hasn't arrived).
--
--   The principle: RevenueCat is the single source of truth. If a user has
--   a revenuecat_customer_id, they've interacted with RevenueCat (purchased
--   or restored). We optimistically grant access and let the webhook or
--   client sync correct it if they've actually lapsed.
-- ============================================================================

-- ============================================================================
-- 1. can_access_agent_picks — used in RLS for avatar_picks SELECT
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
  v_has_rc_id boolean := false;
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

  -- Fail open: if they have a RevenueCat customer ID, they've paid at some
  -- point. Grant access optimistically — webhook/client sync will correct
  -- subscription_active if they've actually lapsed.
  RETURN COALESCE(v_subscription_active, false) OR v_has_rc_id;
END;
$$;

-- ============================================================================
-- 2. can_create_agent — used in RLS for avatar_profiles INSERT
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
  v_has_rc_id boolean := false;
  v_agent_count integer := 0;
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

  -- Fail open: treat users with a RevenueCat customer ID as Pro
  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    RETURN true;
  END IF;

  -- Free user: enforce 1-agent limit
  SELECT COUNT(*)
  INTO v_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  RETURN v_agent_count < 1;
END;
$$;

-- ============================================================================
-- 3. can_use_agent_autopilot — used for autopilot and manual generation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_use_agent_autopilot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
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

  -- Fail open: RevenueCat customer ID means they've interacted with billing
  RETURN COALESCE(v_subscription_active, false) OR v_has_rc_id;
END;
$$;
