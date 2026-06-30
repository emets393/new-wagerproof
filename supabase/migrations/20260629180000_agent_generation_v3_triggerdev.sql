-- ============================================================================
-- Agent Generation V3 Trigger.dev path
--
-- Strictly additive parallel path for the native iOS client. Legacy V2/V3 queue
-- functions keep filtering engine_version='v2'/'v3', so rows with
-- engine_version='v3_trigger' are ledger rows only; Trigger.dev owns execution.
-- ============================================================================

ALTER TABLE public.agent_generation_runs
  DROP CONSTRAINT IF EXISTS agent_generation_runs_engine_version_check;

ALTER TABLE public.agent_generation_runs
  ADD CONSTRAINT agent_generation_runs_engine_version_check
  CHECK (engine_version IN ('v2', 'v3', 'v3_trigger'));

ALTER TABLE public.agent_generation_runs
  ADD COLUMN IF NOT EXISTS trigger_run_id text;

CREATE INDEX IF NOT EXISTS idx_gen_runs_v3_trigger_run_id
  ON public.agent_generation_runs (trigger_run_id)
  WHERE engine_version = 'v3_trigger' AND trigger_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_runs_v3_trigger_spend
  ON public.agent_generation_runs (target_date, status)
  WHERE engine_version = 'v3_trigger';

-- Create/reuse a manual Trigger.dev ledger row. This mirrors the V3 enqueue
-- gate (owner, entitlement, 3/day cap), but does NOT enqueue into Postgres.
CREATE OR REPLACE FUNCTION public.enqueue_manual_generation_run_v3_trigger(
  p_user_id uuid,
  p_avatar_id uuid,
  p_has_active_entitlement boolean DEFAULT false,
  p_idempotency_key text DEFAULT NULL,
  p_dry_run boolean DEFAULT false,
  p_model_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_target_date date;
  v_daily_count integer;
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL OR p_avatar_id IS NULL THEN
    RAISE EXCEPTION 'Missing user or avatar id'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT public.is_agent_owner(p_user_id, p_avatar_id) THEN
    RAISE EXCEPTION 'Not authorized to generate picks for this agent'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_is_admin := public.has_role(p_user_id, 'admin');

  IF NOT v_is_admin AND NOT COALESCE(p_has_active_entitlement, false) THEN
    RAISE EXCEPTION 'Not authorized to generate picks for this agent'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_target_date := (now() AT TIME ZONE 'America/New_York')::date;

  PERFORM 1 FROM public.avatar_profiles WHERE id = p_avatar_id FOR UPDATE;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_run_id
    FROM public.agent_generation_runs
    WHERE avatar_id = p_avatar_id
      AND request_idempotency_key = p_idempotency_key
      AND status NOT IN ('canceled', 'failed_terminal');

    IF v_run_id IS NOT NULL THEN
      RETURN v_run_id;
    END IF;
  END IF;

  -- 3/day manual cap counts all engines.
  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.agent_generation_runs
    WHERE avatar_id = p_avatar_id
      AND generation_type = 'manual'
      AND target_date = v_target_date
      AND status NOT IN ('canceled', 'failed_terminal');

    IF v_daily_count >= 3 THEN
      RAISE EXCEPTION 'Daily manual generation limit reached (3 per day)'
        USING ERRCODE = 'program_limit_exceeded';
    END IF;
  END IF;

  INSERT INTO public.agent_generation_runs (
    avatar_id,
    user_id,
    generation_type,
    target_date,
    requested_by,
    request_idempotency_key,
    priority,
    status,
    next_attempt_at,
    engine_version,
    dry_run,
    model_name
  )
  VALUES (
    p_avatar_id,
    p_user_id,
    'manual',
    v_target_date,
    p_user_id,
    p_idempotency_key,
    100,
    'queued',
    now(),
    'v3_trigger',
    COALESCE(p_dry_run, false),
    COALESCE(p_model_name, 'deepseek-v4-flash')
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- SELECT-only eligibility for Trigger.dev scheduled fan-out. It intentionally
-- does not insert/claim legacy queue rows.
CREATE OR REPLACE FUNCTION public.select_due_auto_avatars_v3_trigger(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 50
)
RETURNS TABLE(avatar_id uuid, user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT (p_now AT TIME ZONE 'America/New_York')::date AS target_date
  )
  SELECT ap.id AS avatar_id, ap.user_id
  FROM public.avatar_profiles ap
  JOIN public.profiles p ON p.user_id = ap.user_id
  CROSS JOIN target t
  WHERE ap.auto_generate = true
    AND ap.is_active = true
    AND public.can_use_agent_autopilot(ap.user_id)
    AND (ap.last_auto_generated_at IS NULL
         OR (ap.last_auto_generated_at AT TIME ZONE COALESCE(ap.auto_generate_timezone, 'America/New_York'))::date < t.target_date)
    AND ap.auto_generate_time <= (p_now AT TIME ZONE COALESCE(ap.auto_generate_timezone, 'America/New_York'))::time
    AND p.last_seen_at > p_now - interval '5 days'
    AND NOT EXISTS (
      SELECT 1
      FROM public.agent_generation_runs r
      WHERE r.avatar_id = ap.id
        AND r.generation_type = 'auto'
        AND r.target_date = t.target_date
        AND r.status NOT IN ('canceled', 'failed_terminal')
    )
  ORDER BY ap.last_auto_generated_at ASC NULLS FIRST, ap.id ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.enqueue_manual_generation_run_v3_trigger(uuid, uuid, boolean, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.select_due_auto_avatars_v3_trigger(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_manual_generation_run_v3_trigger(uuid, uuid, boolean, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.select_due_auto_avatars_v3_trigger(timestamptz, integer) TO service_role;
