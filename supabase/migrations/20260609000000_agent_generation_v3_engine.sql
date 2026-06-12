-- ============================================================================
-- Agent Generation V3 — Engine routing, telemetry, queue + dispatch, breaker
--
-- V3 is a strictly-additive, opt-in sibling of V2 (process-agent-generation-job-v3).
-- This migration:
--   1. Adds engine_version + dry_run + V3 telemetry columns to agent_generation_runs
--   2. Adds a V3-scoped queue-scan index + the v3_circuit_state breaker table
--   3. Makes TWO inert edits to V2 (claim + dispatch get `engine_version='v2'`)
--      so a V2 worker never claims a V3 run (and vice-versa).
--   4. Adds claim_generation_runs_v3, dispatch_generation_workers_v3 (with the
--      circuit/spend/run-cap gate), enqueue_manual_generation_run_v3_engine, and
--      record_v3_run_telemetry (mark_*_v2 has a fixed param list, can't carry V3).
--   5. Schedules a v3-dispatch-workers cron + a daily circuit-reset cron.
--
-- mark_generation_run_{processing,succeeded,failed}_v2 and
-- requeue_expired_generation_leases_v2 are reused UNCHANGED by the V3 worker.
--
-- DEPLOYMENT PREREQUISITE:
--   supabase functions deploy process-agent-generation-job-v3
--   (and DEEPSEEK_API_KEY / OPENAI_API_KEY secret + INTERNAL_FUNCTION_SECRET as V2)
-- ============================================================================

-- ============================================================================
-- 1. Routing + telemetry columns (all additive; existing rows read 'v2')
-- ============================================================================
ALTER TABLE public.agent_generation_runs
  ADD COLUMN IF NOT EXISTS engine_version text NOT NULL DEFAULT 'v2'
    CHECK (engine_version IN ('v2', 'v3')),
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
  -- V3 run-level audit ("show your work") — see plan §"Pick auditing (V3)".
  ADD COLUMN IF NOT EXISTS v3_tool_call_count integer,
  ADD COLUMN IF NOT EXISTS v3_turn_count integer,
  ADD COLUMN IF NOT EXISTS v3_deep_fetch_count integer,
  ADD COLUMN IF NOT EXISTS v3_tool_trace jsonb,
  ADD COLUMN IF NOT EXISTS v3_reasoning_trace text,
  ADD COLUMN IF NOT EXISTS v3_engine_used text,      -- 'v3' | 'v2_fallback'
  ADD COLUMN IF NOT EXISTS v3_fallback_reason text,
  ADD COLUMN IF NOT EXISTS v3_circuit_tripped text;  -- governor trip reason or NULL

-- V3-scoped queue scan (mirrors the V2 partial index, engine-filtered).
CREATE INDEX IF NOT EXISTS idx_gen_runs_queue_scan_v3
  ON public.agent_generation_runs (next_attempt_at, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'failed_retryable') AND engine_version = 'v3';

-- ============================================================================
-- 2. v3_circuit_state — single-row global breaker + daily caps.
--    Rollback = `UPDATE public.v3_circuit_state SET enabled=false` (config flip,
--    no deploy). dispatch_generation_workers_v3 reads this every tick.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.v3_circuit_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),  -- enforces a single row
  enabled boolean NOT NULL DEFAULT true,
  daily_spend_cap_usd numeric(12,4) NOT NULL DEFAULT 25.0,
  daily_run_cap integer NOT NULL DEFAULT 500,
  -- Estimate for in-flight (leased/processing) runs whose cost isn't committed
  -- yet, so a burst of concurrent dispatches can't blow past the spend cap.
  assumed_cost_per_run_usd numeric(12,4) NOT NULL DEFAULT 0.05,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.v3_circuit_state (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.v3_circuit_state ENABLE ROW LEVEL SECURITY;
-- Internal table; service-role + SECURITY DEFINER only. No client policies.

-- ============================================================================
-- 3. INERT V2 EDIT #1 — claim_generation_runs_v2 only claims V2 runs.
--    Body is byte-identical to 20260303000002 except the `engine_version='v2'`
--    predicate in the claimable CTE.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_generation_runs_v2(
  p_worker_id text,
  p_limit integer DEFAULT 1,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.agent_generation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.agent_generation_runs
    WHERE status IN ('queued', 'failed_retryable')
      AND engine_version = 'v2'          -- V3 EDIT: never claim a V3 run
      AND next_attempt_at <= now()
      AND attempt_count < max_attempts
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.agent_generation_runs r
  SET
    status = 'leased',
    lease_owner = p_worker_id,
    lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
    attempt_count = attempt_count + 1,
    updated_at = now()
  FROM claimable c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

-- ============================================================================
-- 4. INERT V2 EDIT #2 — dispatch_generation_workers_v2 only counts V2 runs.
--    Body is byte-identical to 20260303000002 except the `engine_version='v2'`
--    predicate in the queue-depth count.
-- ============================================================================
-- NOTE: body reproduced from the LIVE definition (pg_get_functiondef), NOT the
-- original 20260303000002 migration — the live function had since gained the
-- internal-secret header and dropped SET search_path. Only change vs live: the
-- `engine_version='v2'` predicate.
CREATE OR REPLACE FUNCTION public.dispatch_generation_workers_v2(
  p_max_dispatches integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_depth integer;
  v_dispatches integer;
  v_i integer;
  v_url text;
  v_service_key text;
  v_internal_secret text;
BEGIN
  -- Check how many runs are ready
  SELECT COUNT(*)
  INTO v_queue_depth
  FROM public.agent_generation_runs
  WHERE status IN ('queued', 'failed_retryable')
    AND engine_version = 'v2'            -- V3 EDIT: don't dispatch V2 for V3 runs
    AND next_attempt_at <= now()
    AND attempt_count < max_attempts;
  IF v_queue_depth = 0 THEN
    RETURN 0;
  END IF;
  v_dispatches := LEAST(v_queue_depth, p_max_dispatches);
  -- Read service role key from config table
  SELECT value INTO v_service_key
  FROM public._internal_config
  WHERE key = 'service_role_key';
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING '[dispatch_v2] service_role_key not found in _internal_config';
    RETURN 0;
  END IF;
  -- Read internal function secret
  SELECT value INTO v_internal_secret
  FROM public._internal_config
  WHERE key = 'internal_function_secret';
  v_url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
  FOR v_i IN 1..v_dispatches LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/process-agent-generation-job-v2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key,
        'x-internal-secret', COALESCE(v_internal_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  END LOOP;
  RETURN v_dispatches;
END;
$$;

-- ============================================================================
-- 5. claim_generation_runs_v3 — clone of V2 claim, engine_version='v3'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_generation_runs_v3(
  p_worker_id text,
  p_limit integer DEFAULT 1,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.agent_generation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.agent_generation_runs
    WHERE status IN ('queued', 'failed_retryable')
      AND engine_version = 'v3'
      AND next_attempt_at <= now()
      AND attempt_count < max_attempts
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.agent_generation_runs r
  SET
    status = 'leased',
    lease_owner = p_worker_id,
    lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
    attempt_count = attempt_count + 1,
    updated_at = now()
  FROM claimable c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

-- ============================================================================
-- 6. dispatch_generation_workers_v3 — clone of V2 dispatch + breaker gate.
--    Gates BEFORE dispatching: global enable flag, per-day spend cap (committed
--    + estimated in-flight), per-day run cap. Posts to the V3 worker fn.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dispatch_generation_workers_v3(
  p_max_dispatches integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_depth integer;
  v_dispatches integer;
  v_i integer;
  v_url text;
  v_service_key text;
  v_internal_secret text;
  v_today date;
  v_state public.v3_circuit_state;
  v_committed_spend numeric;
  v_inflight_count integer;
  v_projected_spend numeric;
  v_run_count integer;
BEGIN
  SELECT * INTO v_state FROM public.v3_circuit_state WHERE id = true;

  -- Global kill switch (rollback = config flip, no deploy).
  IF v_state.id IS NULL OR NOT v_state.enabled THEN
    RAISE NOTICE '[dispatch_v3] circuit disabled — no dispatch';
    RETURN 0;
  END IF;

  v_today := (now() AT TIME ZONE 'America/New_York')::date;

  -- Per-day spend gate: committed cost of today's V3 runs + an estimate for any
  -- still in flight (cost only commits on success).
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  INTO v_committed_spend
  FROM public.agent_generation_runs
  WHERE engine_version = 'v3' AND target_date = v_today;

  SELECT COUNT(*)
  INTO v_inflight_count
  FROM public.agent_generation_runs
  WHERE engine_version = 'v3' AND target_date = v_today
    AND status IN ('leased', 'processing');

  v_projected_spend := v_committed_spend
    + (v_inflight_count * v_state.assumed_cost_per_run_usd);

  IF v_projected_spend >= v_state.daily_spend_cap_usd THEN
    RAISE WARNING '[dispatch_v3] daily spend cap reached: projected % >= cap %',
      v_projected_spend, v_state.daily_spend_cap_usd;
    RETURN 0;
  END IF;

  -- Per-day run cap (counts everything not canceled/terminal-failed).
  SELECT COUNT(*)
  INTO v_run_count
  FROM public.agent_generation_runs
  WHERE engine_version = 'v3' AND target_date = v_today
    AND status NOT IN ('canceled', 'failed_terminal');

  IF v_run_count >= v_state.daily_run_cap THEN
    RAISE WARNING '[dispatch_v3] daily run cap reached: % >= %',
      v_run_count, v_state.daily_run_cap;
    RETURN 0;
  END IF;

  -- Queue depth among V3-engine runs ready to run.
  SELECT COUNT(*)
  INTO v_queue_depth
  FROM public.agent_generation_runs
  WHERE status IN ('queued', 'failed_retryable')
    AND engine_version = 'v3'
    AND next_attempt_at <= now()
    AND attempt_count < max_attempts;

  IF v_queue_depth = 0 THEN
    RETURN 0;
  END IF;

  v_dispatches := LEAST(v_queue_depth, p_max_dispatches);

  SELECT value INTO v_service_key
  FROM public._internal_config
  WHERE key = 'service_role_key';

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING '[dispatch_v3] service_role_key not found in _internal_config';
    RETURN 0;
  END IF;

  SELECT value INTO v_internal_secret
  FROM public._internal_config
  WHERE key = 'internal_function_secret';

  v_url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co';

  FOR v_i IN 1..v_dispatches LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/process-agent-generation-job-v3',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key,
        'x-internal-secret', COALESCE(v_internal_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  END LOOP;

  RETURN v_dispatches;
END;
$$;

-- ============================================================================
-- 7. enqueue_manual_generation_run_v3_engine — clone of
--    enqueue_manual_generation_run_v3 (20260416103000) that writes
--    engine_version='v3' (+ optional dry_run / model_name). The 3/day manual
--    cap is SHARED across engines (no engine filter on the count, matching V2).
--    The existing enqueue_manual_generation_run_v3 is left untouched so old
--    clients still enqueue V2 runs byte-for-byte.
-- ============================================================================
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
    COALESCE(p_model_name, 'deepseek-reasoner')
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- ============================================================================
-- 8. record_v3_run_telemetry — additive UPDATE of the V3 audit columns.
--    Separate from mark_*_succeeded_v2 (fixed param list) so the worker can
--    record the loop trace regardless of success/fallback.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_v3_run_telemetry(
  p_run_id uuid,
  p_tool_call_count integer DEFAULT NULL,
  p_turn_count integer DEFAULT NULL,
  p_deep_fetch_count integer DEFAULT NULL,
  p_tool_trace jsonb DEFAULT NULL,
  p_reasoning_trace text DEFAULT NULL,
  p_engine_used text DEFAULT NULL,
  p_fallback_reason text DEFAULT NULL,
  p_circuit_tripped text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_generation_runs
  SET
    v3_tool_call_count = p_tool_call_count,
    v3_turn_count = p_turn_count,
    v3_deep_fetch_count = p_deep_fetch_count,
    v3_tool_trace = p_tool_trace,
    v3_reasoning_trace = p_reasoning_trace,
    v3_engine_used = p_engine_used,
    v3_fallback_reason = p_fallback_reason,
    v3_circuit_tripped = p_circuit_tripped,
    updated_at = now()
  WHERE id = p_run_id;
END;
$$;

-- ============================================================================
-- 9. Grants — internal-only, service role executes everything.
-- ============================================================================
REVOKE ALL ON FUNCTION public.claim_generation_runs_v3(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_generation_workers_v3(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_manual_generation_run_v3_engine(uuid, uuid, boolean, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_v3_run_telemetry(uuid, integer, integer, integer, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_generation_runs_v3(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_generation_workers_v3(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_manual_generation_run_v3_engine(uuid, uuid, boolean, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_v3_run_telemetry(uuid, integer, integer, integer, jsonb, text, text, text, text) TO service_role;

-- ============================================================================
-- 10. Crons — V3 dispatch (every minute) + daily breaker reset.
--     Enqueue + lease recovery are SHARED with V2 (lease recovery is
--     engine-agnostic; manual V3 runs are enqueued on-demand via the edge fn).
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN PERFORM cron.unschedule('v3-dispatch-workers'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'v3-dispatch-workers',
  '* * * * *',
  $$ SELECT public.dispatch_generation_workers_v3(5); $$
);

-- Daily auto-recovery: re-enable the breaker at the top of each ET day so a
-- spend/run-cap trip (or manual disable) doesn't wedge V3 permanently.
-- 05:05 UTC ≈ 00:05/01:05 ET.
DO $$ BEGIN PERFORM cron.unschedule('v3-circuit-daily-reset'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'v3-circuit-daily-reset',
  '5 5 * * *',
  $$ UPDATE public.v3_circuit_state SET enabled = true, updated_at = now() WHERE id = true; $$
);

-- ============================================================================
-- Rollback (run manually to disable V3 without a deploy):
--   UPDATE public.v3_circuit_state SET enabled = false WHERE id = true;
--   UPDATE cron.job SET active = false WHERE jobname = 'v3-dispatch-workers';
-- ============================================================================
