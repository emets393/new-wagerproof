-- ============================================================================
-- Migration: Agent Generation V2 - Phase B: Fix Activity Tracking
-- Description:
--   1. Add profiles.last_seen_at as canonical activity column
--   2. Backfill from avatar_profiles.owner_last_active_at
--   3. Throttled touch RPC (writes at most once per 12 hours)
--   4. Dual-write to both profiles.last_seen_at and avatar_profiles.owner_last_active_at
-- ============================================================================

-- ============================================================================
-- 1. Add canonical activity column to profiles
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON public.profiles(last_seen_at)
  WHERE last_seen_at IS NOT NULL;

-- ============================================================================
-- 2. Backfill from existing avatar activity data
--    Uses the most recent owner_last_active_at across all avatars for each user.
-- ============================================================================
UPDATE public.profiles p
SET last_seen_at = sub.max_active
FROM (
  SELECT user_id, MAX(owner_last_active_at) AS max_active
  FROM public.avatar_profiles
  WHERE owner_last_active_at IS NOT NULL
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
  AND p.last_seen_at IS NULL;

-- Backfill remaining NULLs (users with no avatars) using profile created_at
UPDATE public.profiles
SET last_seen_at = COALESCE(created_at, now())
WHERE last_seen_at IS NULL;

-- ============================================================================
-- 3. Throttled touch function
--    Writes profiles.last_seen_at only if stale (older than p_min_interval).
--    Dual-writes avatar_profiles.owner_last_active_at for V1 compatibility.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_owner_activity_if_stale(
  p_user_id uuid,
  p_min_interval interval DEFAULT interval '12 hours'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_last_seen timestamptz;
BEGIN
  -- Auth check: only the authenticated user can touch their own activity
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN;
  END IF;

  -- Check current value
  SELECT last_seen_at
  INTO v_current_last_seen
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Only update if stale or never set
  IF v_current_last_seen IS NULL
     OR v_current_last_seen < (now() - p_min_interval) THEN

    -- Update canonical field
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE user_id = p_user_id;

    -- Dual-write for V1 compatibility (avatar_profiles.owner_last_active_at)
    UPDATE public.avatar_profiles
    SET owner_last_active_at = now()
    WHERE user_id = p_user_id
      AND is_active = true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_owner_activity_if_stale(uuid, interval) TO authenticated;

-- ============================================================================
-- 4. Update V2 eligibility to use profiles.last_seen_at
--    Replace the owner_last_active_at check with canonical source.
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
  JOIN public.profiles p ON p.user_id = ap.user_id
  WHERE ap.auto_generate = true
    AND ap.is_active = true
    -- Entitlement: only Pro/Admin
    AND public.can_use_agent_autopilot(ap.user_id)
    -- Not yet generated for target date
    AND (ap.last_auto_generated_at IS NULL
         OR ap.last_auto_generated_at::date < p_target_date)
    -- Owner must be active within 5 days (canonical source)
    AND p.last_seen_at > now() - interval '5 days'
  ORDER BY
    ap.last_auto_generated_at ASC NULLS FIRST,
    ap.id ASC
  LIMIT p_limit;
END;
$$;
