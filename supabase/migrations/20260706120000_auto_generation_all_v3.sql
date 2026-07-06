-- ============================================================================
-- Route ALL auto-generation to the V3 engine (off the legacy V2 engine).
--
-- Previously enqueue_due_auto_generation_runs_v2 tagged only cross-family agents
-- as engine_version='v3' and left single-family agents on 'v2' (which has no
-- player-prop support and an older prompt/tool contract). Per product direction,
-- auto-generation should always use V3. This rebuilds the function verbatim from
-- 20260622000000 with the engine_version CASE collapsed to a constant 'v3'.
--
-- The V3 edge dispatch (dispatch_generation_workers_v3 / claim_generation_runs_v3)
-- already processes auto v3 rows, so no dispatch change is needed. Props/markets
-- support in the V3 edge worker is brought to parity alongside this change
-- (deriveSteeringProfile + submit gate + shared agentGameHelpers). See plan D2.
-- ============================================================================

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
    'v3'   -- was: CASE WHEN agent_family_count(...) > 1 THEN 'v3' ELSE 'v2' END
  FROM eligible e
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
