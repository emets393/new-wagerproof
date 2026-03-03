-- ============================================================================
-- Migration: Add per-agent timezone for auto-generation
-- ============================================================================

-- 1. Add timezone column to avatar_profiles
ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS auto_generate_timezone text NOT NULL DEFAULT 'America/New_York';

-- 2. Replace enqueue function to compare per-agent timezone
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
  -- Determine target date in ET (used for dedup, always ET-based)
  v_target_date := (p_now AT TIME ZONE 'America/New_York')::date;

  WITH eligible AS (
    SELECT
      ap.id AS avatar_id,
      ap.user_id,
      ap.auto_generate_time,
      ap.auto_generate_timezone
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
    scheduled_local_time, target_timezone
  )
  SELECT
    e.avatar_id, e.user_id, 'auto', v_target_date,
    50, 'queued', p_now,
    e.auto_generate_time, e.auto_generate_timezone
  FROM eligible e
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
