-- ============================================================================
-- Migration: Cross-family agent classifier + V3 engine gating (Part A)
--
-- Adds public.agent_family_count() and routes auto-generation runs for
-- cross-family agents (preferred_sports spanning >1 family) to the V3 engine.
-- V2's prompt router (resolvePromptSport -> null) + football wall would silently
-- drop a cross-family agent's non-primary-family games, so cross-family agents
-- MUST run on V3 (in-code prompt + on-demand tools, no family wall).
--
-- Mirrors isCrossFamily() in supabase/functions/shared/sportFamily.ts and
-- SPORT_FAMILIES in src/types/agent.ts -- keep all three in lockstep.
-- See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md (Part A).
-- ============================================================================

-- 1. Family classifier: number of DISTINCT sport-families in the array.
--    football={nfl,cfb}, basketball={nba,ncaab}, baseball={mlb}. >1 => cross-family.
--    IMMUTABLE -- pure function of its input, safe in generated/indexed exprs.
CREATE OR REPLACE FUNCTION public.agent_family_count(p_sports text[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COUNT(DISTINCT CASE
    WHEN s IN ('nfl', 'cfb')   THEN 'football'
    WHEN s IN ('nba', 'ncaab') THEN 'basketball'
    WHEN s = 'mlb'             THEN 'baseball'
    ELSE 'other'
  END)::integer
  FROM unnest(coalesce(p_sports, ARRAY[]::text[])) AS s;
$$;

COMMENT ON FUNCTION public.agent_family_count(text[]) IS
  'Distinct sport-family count over preferred_sports; >1 => cross-family => V3 engine. Lockstep with sportFamily.ts / SPORT_FAMILIES.';

-- 2. Auto-enqueue: tag cross-family runs as engine_version='v3'. Rebuilt from the
--    current (timezone-aware) definition in 20260304000001; the only additions are
--    ap.preferred_sports in `eligible` and the engine_version CASE in the INSERT.
--    Single-family agents resolve to 'v2' = unchanged behavior.
CREATE OR REPLACE FUNCTION public.enqueue_due_auto_generation_runs_v2(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_date date;
  v_count integer;
BEGIN
  v_target_date := (p_now AT TIME ZONE 'America/New_York')::date;

  WITH eligible AS (
    SELECT
      ap.id AS avatar_id,
      ap.user_id,
      ap.auto_generate_time,
      ap.auto_generate_timezone,
      ap.preferred_sports
    FROM public.avatar_profiles ap
    JOIN public.profiles p ON p.user_id = ap.user_id
    WHERE ap.auto_generate = true
      AND ap.is_active = true
      AND public.can_use_agent_autopilot(ap.user_id)
      AND (ap.last_auto_generated_at IS NULL
           OR ap.last_auto_generated_at::date < v_target_date)
      AND ap.auto_generate_time <= (p_now AT TIME ZONE ap.auto_generate_timezone)::time
      AND p.last_seen_at > p_now - interval '5 days'
    ORDER BY
      ap.last_auto_generated_at ASC NULLS FIRST,
      ap.id ASC
    LIMIT p_limit
  )
  INSERT INTO public.agent_generation_runs (
    avatar_id, user_id, generation_type, target_date,
    priority, status, next_attempt_at,
    scheduled_local_time, target_timezone,
    engine_version
  )
  SELECT
    e.avatar_id, e.user_id, 'auto', v_target_date,
    50, 'queued', p_now,
    e.auto_generate_time, e.auto_generate_timezone,
    CASE WHEN public.agent_family_count(e.preferred_sports) > 1 THEN 'v3' ELSE 'v2' END
  FROM eligible e
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
