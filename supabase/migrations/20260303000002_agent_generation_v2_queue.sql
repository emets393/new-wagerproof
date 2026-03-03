-- ============================================================================
-- Migration: Agent Generation V2 - Phase C: Queue Infrastructure
-- Description:
--   1. agent_generation_runs table (durable queue)
--   2. Indexes and constraints (dedup, idempotency, queue scan)
--   3. SQL lifecycle functions: enqueue, claim, mark, recover, dispatch
-- ============================================================================

-- ============================================================================
-- 1. TABLE: agent_generation_runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id uuid NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  generation_type text NOT NULL CHECK (generation_type IN ('auto', 'manual')),
  target_date date NOT NULL,
  target_timezone text,
  scheduled_local_date date,
  scheduled_local_time time,

  -- Request metadata
  requested_by uuid,
  request_idempotency_key text,
  priority integer NOT NULL DEFAULT 50,

  -- Queue state
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'processing', 'succeeded',
                      'failed_retryable', 'failed_terminal', 'canceled')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  lease_owner text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,

  -- Result metadata
  weak_slate boolean,
  no_games boolean,
  picks_generated integer,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12,6),
  model_name text,
  error_code text,
  error_message text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apply updated_at trigger (reusing existing function from avatar tables)
DROP TRIGGER IF EXISTS agent_generation_runs_updated_at ON public.agent_generation_runs;
CREATE TRIGGER agent_generation_runs_updated_at
  BEFORE UPDATE ON public.agent_generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 2. INDEXES AND CONSTRAINTS
-- ============================================================================

-- Queue scan: claim query uses next_attempt_at + priority + created_at
-- status is in the partial WHERE clause so not needed as a column
CREATE INDEX IF NOT EXISTS idx_gen_runs_queue_scan
  ON public.agent_generation_runs (next_attempt_at, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'failed_retryable');

-- Avatar/day/type lookup
CREATE INDEX IF NOT EXISTS idx_gen_runs_avatar_date_type
  ON public.agent_generation_runs (avatar_id, target_date, generation_type);

-- Unique auto dedupe: only one auto run per avatar per day in non-canceled states
CREATE UNIQUE INDEX IF NOT EXISTS idx_gen_runs_auto_dedupe
  ON public.agent_generation_runs (avatar_id, target_date, generation_type)
  WHERE generation_type = 'auto'
    AND status IN ('queued', 'leased', 'processing', 'succeeded',
                   'failed_retryable', 'failed_terminal');

-- Manual idempotency: unique per avatar + idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS idx_gen_runs_manual_idempotency
  ON public.agent_generation_runs (avatar_id, request_idempotency_key)
  WHERE request_idempotency_key IS NOT NULL;

-- User/date reporting
CREATE INDEX IF NOT EXISTS idx_gen_runs_user_created
  ON public.agent_generation_runs (user_id, created_at DESC);

-- Lease expiry scan for recovery
CREATE INDEX IF NOT EXISTS idx_gen_runs_lease_expiry
  ON public.agent_generation_runs (lease_expires_at)
  WHERE status IN ('leased', 'processing');

-- ============================================================================
-- 3. FUNCTION: enqueue_due_auto_generation_runs_v2
--    Finds due, entitled, active agents and inserts queued auto runs.
--    Returns count of newly inserted runs.
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
  -- Determine target date in ET
  v_target_date := (p_now AT TIME ZONE 'America/New_York')::date;

  WITH eligible AS (
    SELECT
      ap.id AS avatar_id,
      ap.user_id
    FROM public.avatar_profiles ap
    JOIN public.profiles p ON p.user_id = ap.user_id
    WHERE ap.auto_generate = true
      AND ap.is_active = true
      AND public.can_use_agent_autopilot(ap.user_id)
      AND (ap.last_auto_generated_at IS NULL
           OR ap.last_auto_generated_at::date < v_target_date)
      AND p.last_seen_at > p_now - interval '5 days'
    ORDER BY
      ap.last_auto_generated_at ASC NULLS FIRST,
      ap.id ASC
    LIMIT p_limit
  )
  INSERT INTO public.agent_generation_runs (
    avatar_id, user_id, generation_type, target_date,
    priority, status, next_attempt_at
  )
  SELECT
    e.avatar_id, e.user_id, 'auto', v_target_date,
    50, 'queued', p_now
  FROM eligible e
  ON CONFLICT DO NOTHING; -- dedupe index prevents duplicates

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 4. FUNCTION: enqueue_manual_generation_run_v2
--    Validates entitlement/ownership, inserts manual run, returns run_id.
--    Returns existing run_id on idempotency conflict.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_manual_generation_run_v2(
  p_user_id uuid,
  p_avatar_id uuid,
  p_idempotency_key text DEFAULT NULL
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
  -- Validate ownership + entitlement
  IF NOT public.can_request_manual_agent_generation(p_user_id, p_avatar_id) THEN
    RAISE EXCEPTION 'Not authorized to generate picks for this agent'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_is_admin := public.has_role(p_user_id, 'admin');
  v_target_date := (now() AT TIME ZONE 'America/New_York')::date;

  -- Lock the avatar row to serialize concurrent manual enqueue calls
  PERFORM 1 FROM public.avatar_profiles WHERE id = p_avatar_id FOR UPDATE;

  -- Check manual budget: max 3 per agent per ET day (non-admin)
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

  -- Handle idempotency: return existing active run
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

  -- Insert new run
  INSERT INTO public.agent_generation_runs (
    avatar_id, user_id, generation_type, target_date,
    requested_by, request_idempotency_key,
    priority, status, next_attempt_at
  )
  VALUES (
    p_avatar_id, p_user_id, 'manual', v_target_date,
    p_user_id, p_idempotency_key,
    100, 'queued', now()
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- ============================================================================
-- 5. FUNCTION: claim_generation_runs_v2
--    Claims up to p_limit ready runs using FOR UPDATE SKIP LOCKED.
--    Returns claimed rows.
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
-- 6. FUNCTION: mark_generation_run_processing_v2
--    Transitions leased -> processing, sets started_at.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_generation_run_processing_v2(
  p_run_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_generation_runs
  SET
    status = 'processing',
    started_at = COALESCE(started_at, now()),
    updated_at = now()
  WHERE id = p_run_id
    AND status = 'leased';
END;
$$;

-- ============================================================================
-- 7. FUNCTION: mark_generation_run_succeeded_v2
--    Records success metrics and updates avatar timestamps.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_generation_run_succeeded_v2(
  p_run_id uuid,
  p_picks_generated integer DEFAULT 0,
  p_prompt_version text DEFAULT NULL,
  p_input_tokens integer DEFAULT NULL,
  p_output_tokens integer DEFAULT NULL,
  p_estimated_cost_usd numeric DEFAULT NULL,
  p_model_name text DEFAULT NULL,
  p_weak_slate boolean DEFAULT false,
  p_no_games boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_generation_runs;
BEGIN
  UPDATE public.agent_generation_runs
  SET
    status = 'succeeded',
    completed_at = now(),
    picks_generated = p_picks_generated,
    prompt_version = p_prompt_version,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    estimated_cost_usd = p_estimated_cost_usd,
    model_name = p_model_name,
    weak_slate = p_weak_slate,
    no_games = p_no_games,
    updated_at = now()
  WHERE id = p_run_id
    AND status = 'processing'
  RETURNING * INTO v_run;

  -- Update avatar timestamps based on generation type
  IF v_run.id IS NOT NULL THEN
    IF v_run.generation_type = 'auto' THEN
      UPDATE public.avatar_profiles
      SET last_auto_generated_at = now()
      WHERE id = v_run.avatar_id;
    ELSE
      UPDATE public.avatar_profiles
      SET last_generated_at = now()
      WHERE id = v_run.avatar_id;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 8. FUNCTION: mark_generation_run_failed_v2
--    Handles retryable and terminal failures with backoff.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_generation_run_failed_v2(
  p_run_id uuid,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_retryable boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt integer;
  v_max integer;
  v_backoff interval;
BEGIN
  -- Get current attempt info (only for runs in active states)
  SELECT attempt_count, max_attempts
  INTO v_attempt, v_max
  FROM public.agent_generation_runs
  WHERE id = p_run_id
    AND status IN ('leased', 'processing');

  -- Bail if run not found or already in terminal state
  IF v_attempt IS NULL THEN
    RETURN;
  END IF;

  -- Determine backoff: 5m, 15m, 60m
  v_backoff := CASE v_attempt
    WHEN 1 THEN interval '5 minutes'
    WHEN 2 THEN interval '15 minutes'
    ELSE interval '60 minutes'
  END;

  IF p_retryable AND v_attempt < v_max THEN
    UPDATE public.agent_generation_runs
    SET
      status = 'failed_retryable',
      error_code = p_error_code,
      error_message = p_error_message,
      next_attempt_at = now() + v_backoff,
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = now()
    WHERE id = p_run_id
      AND status IN ('leased', 'processing');
  ELSE
    UPDATE public.agent_generation_runs
    SET
      status = 'failed_terminal',
      error_code = p_error_code,
      error_message = p_error_message,
      completed_at = now(),
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = now()
    WHERE id = p_run_id
      AND status IN ('leased', 'processing');
  END IF;
END;
$$;

-- ============================================================================
-- 9. FUNCTION: requeue_expired_generation_leases_v2
--    Finds leased/processing runs with expired leases and requeues or fails.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.requeue_expired_generation_leases_v2()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_run RECORD;
BEGIN
  FOR v_run IN
    SELECT id, attempt_count, max_attempts
    FROM public.agent_generation_runs
    WHERE status IN ('leased', 'processing')
      AND lease_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_run.attempt_count < v_run.max_attempts THEN
      UPDATE public.agent_generation_runs
      SET
        status = 'failed_retryable',
        error_code = 'LEASE_EXPIRED',
        error_message = 'Worker lease expired before completion',
        next_attempt_at = now() + interval '5 minutes',
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
      WHERE id = v_run.id;
    ELSE
      UPDATE public.agent_generation_runs
      SET
        status = 'failed_terminal',
        error_code = 'LEASE_EXPIRED',
        error_message = 'Worker lease expired and max attempts reached',
        completed_at = now(),
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
      WHERE id = v_run.id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 10. FUNCTION: dispatch_generation_workers_v2
--     Dispatches up to p_max workers via pg_net HTTP POST calls.
--     Each worker processes exactly one job.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dispatch_generation_workers_v2(
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
BEGIN
  -- Check how many runs are ready
  SELECT COUNT(*)
  INTO v_queue_depth
  FROM public.agent_generation_runs
  WHERE status IN ('queued', 'failed_retryable')
    AND next_attempt_at <= now()
    AND attempt_count < max_attempts;

  IF v_queue_depth = 0 THEN
    RETURN 0;
  END IF;

  -- Dispatch min(queue_depth, p_max_dispatches) workers
  v_dispatches := LEAST(v_queue_depth, p_max_dispatches);

  -- Read service role key from config table (accessible in all contexts)
  SELECT value INTO v_service_key
  FROM public._internal_config
  WHERE key = 'service_role_key';

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING '[dispatch_v2] service_role_key not found in _internal_config';
    RETURN 0;
  END IF;

  v_url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co';

  FOR v_i IN 1..v_dispatches LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/process-agent-generation-job-v2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  END LOOP;

  RETURN v_dispatches;
END;
$$;

-- ============================================================================
-- RLS: Runs table is internal. No client RLS policies.
-- Service role and SECURITY DEFINER functions handle all access.
-- ============================================================================
ALTER TABLE public.agent_generation_runs ENABLE ROW LEVEL SECURITY;

-- Admin read-only policy for monitoring
CREATE POLICY "Admins can view generation runs"
  ON public.agent_generation_runs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own runs (for polling status)
CREATE POLICY "Users can view own generation runs"
  ON public.agent_generation_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- GRANT EXECUTE: client-facing + service role functions
-- ============================================================================

-- Client-facing: manual enqueue called via supabase.rpc() from app
GRANT EXECUTE ON FUNCTION public.enqueue_manual_generation_run_v2(uuid, uuid, text) TO authenticated;
