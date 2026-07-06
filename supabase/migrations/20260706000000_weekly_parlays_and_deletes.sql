-- ============================================================================
-- Week Long Parlays + additive regens + user pick/parlay deletes
--
-- 1. avatar_parlays gains scope ('daily'|'weekly') + week_key (ET Tuesday
--    anchoring the football week, Tue->Mon). Weekly tickets persist all week.
-- 2. agent_generation_runs gains run_scope + week_key so the weekly manual
--    budget (3 per football week) is tracked separately from the 3/day cap.
-- 3. New enqueue/eligibility RPCs for weekly runs; daily RPCs patched so the
--    two budgets never cross-contaminate.
-- 4. User-initiated deletes (swipe-to-trash): SECURITY DEFINER RPCs, hard
--    delete, pending-only. Regens are additive now (engine no longer deletes),
--    so the trash is how users curate what counts toward the record.
--
-- See .claude/docs/agents/16_PARLAY_AGENTS.md (week window design).
-- ============================================================================

-- Tuesday-anchored football week (Tue..Mon), matching the NFL's Tuesday
-- rollover. DOW: Sun=0..Sat=6; Tue=2 -> (dow+5)%7 = days since Tuesday.
CREATE OR REPLACE FUNCTION public.football_week_key(p_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_date - ((EXTRACT(DOW FROM p_date)::int + 5) % 7);
$$;

-- ----------------------------------------------------------------------------
-- avatar_parlays: scope + week_key
-- ----------------------------------------------------------------------------
ALTER TABLE public.avatar_parlays
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'daily'
    CONSTRAINT avatar_parlays_scope_check CHECK (scope IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS week_key date;

CREATE INDEX IF NOT EXISTS idx_avatar_parlays_weekly
  ON public.avatar_parlays (avatar_id, week_key)
  WHERE scope = 'weekly';

-- ----------------------------------------------------------------------------
-- agent_generation_runs: run_scope + week_key
-- ----------------------------------------------------------------------------
ALTER TABLE public.agent_generation_runs
  ADD COLUMN IF NOT EXISTS run_scope text NOT NULL DEFAULT 'daily'
    CONSTRAINT agent_generation_runs_run_scope_check CHECK (run_scope IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS week_key date;

CREATE INDEX IF NOT EXISTS idx_gen_runs_weekly_budget
  ON public.agent_generation_runs (avatar_id, week_key, generation_type)
  WHERE run_scope = 'weekly';

-- ----------------------------------------------------------------------------
-- Daily manual enqueue: budget count now excludes weekly runs. Body otherwise
-- identical to 20260629180000_agent_generation_v3_triggerdev.sql.
-- ----------------------------------------------------------------------------
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

  -- 3/day manual cap counts all engines — but only DAILY runs; weekly parlay
  -- runs have their own budget (enqueue_weekly_parlay_run_v3_trigger).
  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.agent_generation_runs
    WHERE avatar_id = p_avatar_id
      AND generation_type = 'manual'
      AND run_scope = 'daily'
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
    model_name,
    run_scope
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
    COALESCE(p_model_name, 'deepseek-v4-flash'),
    'daily'
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Weekly manual enqueue: mirror of the daily RPC with a per-football-week
-- budget (3) and an NFL/CFB sports gate. Ledger row is run_scope='weekly'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_weekly_parlay_run_v3_trigger(
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
  v_week_key date;
  v_week_count integer;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.avatar_profiles
    WHERE id = p_avatar_id
      AND preferred_sports && ARRAY['nfl', 'cfb']
  ) THEN
    RAISE EXCEPTION 'Weekly parlays require NFL or College Football'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_target_date := (now() AT TIME ZONE 'America/New_York')::date;
  v_week_key := public.football_week_key(v_target_date);

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

  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_week_count
    FROM public.agent_generation_runs
    WHERE avatar_id = p_avatar_id
      AND generation_type = 'manual'
      AND run_scope = 'weekly'
      AND week_key = v_week_key
      AND status NOT IN ('canceled', 'failed_terminal');

    IF v_week_count >= 3 THEN
      RAISE EXCEPTION 'Weekly parlay generation limit reached (3 per football week)'
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
    model_name,
    run_scope,
    week_key
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
    COALESCE(p_model_name, 'deepseek-v4-flash'),
    'weekly',
    v_week_key
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Daily autopilot eligibility: the not-yet-today check must ignore weekly
-- runs, or a Tuesday weekly-auto run would suppress that avatar's daily run.
-- Body otherwise identical to 20260629180000.
-- ----------------------------------------------------------------------------
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
        AND r.run_scope = 'daily'
        AND r.target_date = t.target_date
        AND r.status NOT IN ('canceled', 'failed_terminal')
    )
  ORDER BY ap.last_auto_generated_at ASC NULLS FIRST, ap.id ASC
  LIMIT p_limit;
$$;

-- ----------------------------------------------------------------------------
-- Weekly autopilot eligibility: agents with weekly_parlay_enabled + autopilot
-- + football coverage that don't yet have a weekly auto run this football week.
-- No auto_generate_time check — the weekly ticket lands whenever the Tue-Thu
-- cron first sees the avatar eligible.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.select_due_weekly_parlay_avatars_v3_trigger(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 50
)
RETURNS TABLE(avatar_id uuid, user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT public.football_week_key((p_now AT TIME ZONE 'America/New_York')::date) AS week_key
  )
  SELECT ap.id AS avatar_id, ap.user_id
  FROM public.avatar_profiles ap
  JOIN public.profiles p ON p.user_id = ap.user_id
  CROSS JOIN target t
  WHERE ap.auto_generate = true
    AND ap.is_active = true
    AND COALESCE((ap.personality_params->>'weekly_parlay_enabled')::boolean, false)
    AND ap.preferred_sports && ARRAY['nfl', 'cfb']
    AND public.can_use_agent_autopilot(ap.user_id)
    AND p.last_seen_at > p_now - interval '5 days'
    AND NOT EXISTS (
      SELECT 1
      FROM public.agent_generation_runs r
      WHERE r.avatar_id = ap.id
        AND r.generation_type = 'auto'
        AND r.run_scope = 'weekly'
        AND r.week_key = t.week_key
        AND r.status NOT IN ('canceled', 'failed_terminal')
    )
  ORDER BY ap.id ASC
  LIMIT p_limit;
$$;

-- ----------------------------------------------------------------------------
-- User-initiated deletes (swipe-to-trash). Hard delete, pending-only — a
-- graded ticket is on the record and can't be erased to game the leaderboard.
-- Called by agent-authorized-action-v1 with the service client; RLS on the
-- tables stays SELECT-only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_agent_pick(
  p_user_id uuid,
  p_pick_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avatar uuid;
  v_result text;
BEGIN
  IF p_user_id IS NULL OR p_pick_id IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  SELECT pk.avatar_id, pk.result INTO v_avatar, v_result
  FROM public.avatar_picks pk
  JOIN public.avatar_profiles ap ON ap.id = pk.avatar_id
  WHERE pk.id = p_pick_id
    AND ap.user_id = p_user_id
  FOR UPDATE OF pk;

  IF v_avatar IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  IF v_result IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'already_graded');
  END IF;

  DELETE FROM public.avatar_picks WHERE id = p_pick_id;

  -- Keeps the pending count in avatar_performance_cache honest.
  PERFORM public.recalculate_avatar_performance(v_avatar);

  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_agent_parlay(
  p_user_id uuid,
  p_parlay_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avatar uuid;
  v_result text;
BEGIN
  IF p_user_id IS NULL OR p_parlay_id IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  SELECT pl.avatar_id, pl.result INTO v_avatar, v_result
  FROM public.avatar_parlays pl
  JOIN public.avatar_profiles ap ON ap.id = pl.avatar_id
  WHERE pl.id = p_parlay_id
    AND ap.user_id = p_user_id
  FOR UPDATE OF pl;

  IF v_avatar IS NULL THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  IF v_result IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'already_graded');
  END IF;

  -- A ticket with any settled leg is mid-flight — deleting it would erase a
  -- partially-known outcome (anti-gaming guard).
  IF EXISTS (
    SELECT 1 FROM public.avatar_parlay_legs
    WHERE parlay_id = p_parlay_id
      AND leg_result IS DISTINCT FROM 'pending'
  ) THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'legs_in_progress');
  END IF;

  DELETE FROM public.avatar_parlays WHERE id = p_parlay_id;  -- legs cascade

  PERFORM public.recalculate_avatar_performance(v_avatar);

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_weekly_parlay_run_v3_trigger(uuid, uuid, boolean, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.select_due_weekly_parlay_avatars_v3_trigger(timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_agent_pick(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_agent_parlay(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_weekly_parlay_run_v3_trigger(uuid, uuid, boolean, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.select_due_weekly_parlay_avatars_v3_trigger(timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_agent_pick(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_agent_parlay(uuid, uuid) TO service_role;
