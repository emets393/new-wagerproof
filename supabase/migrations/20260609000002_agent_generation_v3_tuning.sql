-- V3 tuning support (2026-06-09):
-- 1. Per-run loop-limit overrides for tuning experiments / staged cap rollouts.
--    claim_generation_runs_v3 RETURNS SETOF agent_generation_runs, so the new
--    column reaches the worker with no RPC change. The worker hard-clamps every
--    value (resolveLimits in process-agent-generation-job-v3/index.ts).
-- 2. Default model bumped off the deepseek-reasoner alias, which DeepSeek
--    retires 2026-07-24 (it currently maps to deepseek-v4-flash thinking mode,
--    so this is a rename, not a behavior change).
--
-- Apply via: supabase db query --linked --file <this file>
-- (NOT db push — local/remote migration history is intentionally out of sync.)

ALTER TABLE public.agent_generation_runs
  ADD COLUMN IF NOT EXISTS v3_limit_overrides jsonb;

COMMENT ON COLUMN public.agent_generation_runs.v3_limit_overrides IS
  'Optional per-run V3 loop-limit overrides (maxTurns, maxDeepFetches, wallClockMs, …). Worker clamps all values; NULL = compiled defaults.';

-- Re-create enqueue with the V4 default model. Body otherwise identical to
-- 20260609000000_agent_generation_v3_engine.sql.
CREATE OR REPLACE FUNCTION public.enqueue_manual_generation_run_v3_engine(
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

  -- 3/day manual cap counts BOTH engines (a manual run is a manual run).
  IF NOT v_is_admin THEN
    SELECT COUNT(*)
    INTO v_daily_count
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

  INSERT INTO public.agent_generation_runs (
    avatar_id, user_id, generation_type, target_date,
    requested_by, request_idempotency_key,
    priority, status, next_attempt_at,
    engine_version, dry_run, model_name
  )
  VALUES (
    p_avatar_id, p_user_id, 'manual', v_target_date,
    p_user_id, p_idempotency_key,
    100, 'queued', now(),
    'v3', COALESCE(p_dry_run, false),
    COALESCE(p_model_name, 'deepseek-v4-flash')
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;
