-- ============================================================================
-- Migration: Agent Generation V2 - Phase A: Entitlement Enforcement
-- Description:
--   1. Helper functions for autopilot and manual generation entitlement
--   2. Trigger to silently coerce auto_generate=false for non-Pro users
--   3. Change auto_generate default to false for new agents
--   4. Cleanup function to disable autopilot for existing non-entitled users
--   5. V2 eligibility function that enforces entitlements
-- ============================================================================

-- ============================================================================
-- 1. HELPER: is_agent_owner(p_user_id, p_avatar_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_agent_owner(
  p_user_id uuid,
  p_avatar_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.avatar_profiles
    WHERE id = p_avatar_id
      AND user_id = p_user_id
  );
END;
$$;

-- ============================================================================
-- 2. HELPER: can_use_agent_autopilot(p_user_id)
--    Returns true only for Pro or Admin users.
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

-- ============================================================================
-- 3. HELPER: can_request_manual_agent_generation(p_user_id, p_avatar_id)
--    Pro/Admin + must own the agent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_request_manual_agent_generation(
  p_user_id uuid,
  p_avatar_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_agent_owner(p_user_id, p_avatar_id) THEN
    RETURN false;
  END IF;

  RETURN public.can_use_agent_autopilot(p_user_id);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_agent_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_agent_autopilot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_request_manual_agent_generation(uuid, uuid) TO authenticated;

-- ============================================================================
-- 4. TRIGGER: enforce_avatar_autogenerate_entitlement
--    On INSERT/UPDATE of avatar_profiles, silently coerce auto_generate=false
--    if the user is not Pro/Admin. Does NOT reject the request.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_avatar_autogenerate_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auto_generate = true AND NOT public.can_use_agent_autopilot(NEW.user_id) THEN
    NEW.auto_generate := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_autogenerate_entitlement ON public.avatar_profiles;
CREATE TRIGGER trg_enforce_autogenerate_entitlement
  BEFORE INSERT OR UPDATE OF auto_generate ON public.avatar_profiles
  FOR EACH ROW
  WHEN (NEW.auto_generate = true)
  EXECUTE FUNCTION public.enforce_avatar_autogenerate_entitlement();

-- ============================================================================
-- 5. Change default for auto_generate to false on new agents
--    Existing rows are NOT changed.
-- ============================================================================
ALTER TABLE public.avatar_profiles
  ALTER COLUMN auto_generate SET DEFAULT false;

-- ============================================================================
-- 6. FUNCTION: disable_autogenerate_for_non_entitled_users()
--    One-time cleanup + callable from admin/ops to sweep existing rows.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.disable_autogenerate_for_non_entitled_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH non_entitled AS (
    SELECT ap.id
    FROM public.avatar_profiles ap
    WHERE ap.auto_generate = true
      AND NOT public.can_use_agent_autopilot(ap.user_id)
  )
  UPDATE public.avatar_profiles
  SET auto_generate = false
  FROM non_entitled
  WHERE avatar_profiles.id = non_entitled.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Allow admins to re-run cleanup via RPC if needed
GRANT EXECUTE ON FUNCTION public.disable_autogenerate_for_non_entitled_users() TO authenticated;

-- Run the cleanup now to fix any existing free-user autopilot agents
SELECT public.disable_autogenerate_for_non_entitled_users();

-- ============================================================================
-- 7. V2 ELIGIBILITY: get_eligible_avatars_for_auto_generation_v2
--    Adds entitlement check (Pro/Admin only).
--    Does NOT modify V1 function.
--    Uses stable ordering for fair queue insertion.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_eligible_avatars_for_auto_generation_v2(
  p_target_date date DEFAULT CURRENT_DATE,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  avatar_id uuid,
  user_id uuid,
  name text,
  preferred_sports text[],
  personality_params jsonb,
  custom_insights jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id AS avatar_id,
    ap.user_id,
    ap.name,
    ap.preferred_sports,
    ap.personality_params,
    ap.custom_insights
  FROM public.avatar_profiles ap
  WHERE ap.auto_generate = true
    AND ap.is_active = true
    -- Entitlement: only Pro/Admin
    AND public.can_use_agent_autopilot(ap.user_id)
    -- Not yet generated for target date
    AND (ap.last_auto_generated_at IS NULL
         OR ap.last_auto_generated_at::date < p_target_date)
    -- Owner must be active within 5 days
    AND ap.owner_last_active_at > now() - interval '5 days'
  ORDER BY
    ap.last_auto_generated_at ASC NULLS FIRST,
    ap.id ASC
  LIMIT p_limit;
END;
$$;
