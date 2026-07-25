-- HOTFIX 2026-07-25: DeepSeek account returned HTTP 402 Insufficient Balance,
-- which made essentially all V3 Trigger.dev generations fail terminal with
-- "Generation failed… Please try again" on web/iOS/Android.
--
-- Route default V3 generation onto OpenAI gpt-4.1-mini (accepts max_tokens +
-- tools; gpt-5-mini requires max_completion_tokens which the deployed V3 loop
-- does not send yet). A BEFORE INSERT rewrite also covers Trigger.dev auto-gen
-- inserts that still hardcode deepseek-v4-flash in deployed task code.

CREATE OR REPLACE FUNCTION public.hotfix_remap_deepseek_model_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.model_name IS NULL
     OR NEW.model_name LIKE 'deepseek%'
     OR NEW.model_name = 'gpt-5-mini' THEN
    NEW.model_name := 'gpt-4.1-mini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotfix_remap_deepseek_model_on_insert ON public.agent_generation_runs;
CREATE TRIGGER trg_hotfix_remap_deepseek_model_on_insert
BEFORE INSERT ON public.agent_generation_runs
FOR EACH ROW
EXECUTE FUNCTION public.hotfix_remap_deepseek_model_on_insert();

-- Keep RPC defaults aligned so the rewrite is belt-and-suspenders, not the
-- only source of truth once Trigger.dev is redeployed with gpt-4.1-mini.
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
    COALESCE(p_model_name, 'gpt-4.1-mini'),
    'daily'
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

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
    COALESCE(p_model_name, 'gpt-4.1-mini'),
    'weekly',
    v_week_key
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;
