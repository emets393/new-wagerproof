-- Surface the avatar's LIVE generation run (queued/processing v3_trigger row,
-- started in the last ~12 min) in the detail snapshot as 'active_generation_run'
-- (incl. trigger_run_id). Without it, leaving the detail page mid-run and coming
-- back showed an idle screen — the user would re-trigger and race the in-flight
-- run. The client resumes polling this run instead; trigger-v3-run coalesces
-- duplicate triggers onto it server-side.
--
-- Body copied from 20260701000000_agent_parlays_read_rpcs.sql with ONLY the
-- v_active_run block + return key added.

CREATE OR REPLACE FUNCTION public.get_agent_detail_snapshot_v3(
  p_agent_id uuid,
  p_viewer_user_id uuid DEFAULT NULL,
  p_viewer_has_active_entitlement boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := p_viewer_user_id;
  v_can_view_picks boolean := false;
  v_is_readable boolean := false;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_is_following boolean := false;
  v_agent jsonb := '{}'::jsonb;
  v_performance jsonb := null;
  v_todays_picks jsonb := '[]'::jsonb;
  v_todays_parlays jsonb := '[]'::jsonb;
  v_todays_run jsonb := null;
  v_active_run jsonb := null;
BEGIN
  IF p_agent_id IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'invalid_agent_id');
  END IF;

  SELECT to_jsonb(ap),
         (ap.is_public = true OR (v_viewer IS NOT NULL AND ap.user_id = v_viewer)),
         (v_viewer IS NOT NULL AND ap.user_id = v_viewer)
  INTO v_agent, v_is_readable, v_is_owner
  FROM public.avatar_profiles ap
  WHERE ap.id = p_agent_id;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'not_found');
  END IF;

  IF NOT v_is_readable THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'forbidden');
  END IF;

  IF v_viewer IS NOT NULL THEN
    v_is_admin := public.has_role(v_viewer, 'admin');
    v_can_view_picks := v_is_admin
      OR v_is_owner
      OR COALESCE(p_viewer_has_active_entitlement, false);

    SELECT EXISTS(
      SELECT 1
      FROM public.user_avatar_follows
      WHERE user_id = v_viewer
        AND avatar_id = p_agent_id
    ) INTO v_is_following;
  END IF;

  SELECT to_jsonb(pc)
  INTO v_performance
  FROM public.avatar_performance_cache pc
  WHERE pc.avatar_id = p_agent_id;

  IF v_can_view_picks THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_todays_picks
    FROM (
      SELECT *
      FROM public.avatar_picks
      WHERE avatar_id = p_agent_id
        AND game_date = (now() AT TIME ZONE 'America/New_York')::date
      ORDER BY created_at DESC
      LIMIT 25
    ) p;

    -- Today's parlay tickets, legs embedded under a 'legs' key (matches the
    -- PostgREST alias `legs:avatar_parlay_legs(*)` used by direct client reads,
    -- so both paths decode identically).
    SELECT COALESCE(jsonb_agg(sub.parlay_row ORDER BY sub.created_at DESC), '[]'::jsonb)
    INTO v_todays_parlays
    FROM (
      SELECT
        jsonb_set(
          to_jsonb(pl),
          '{legs}',
          COALESCE((
            SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at ASC, l.id ASC)
            FROM public.avatar_parlay_legs l
            WHERE l.parlay_id = pl.id
          ), '[]'::jsonb),
          true
        ) AS parlay_row,
        pl.created_at
      FROM public.avatar_parlays pl
      WHERE pl.avatar_id = p_agent_id
        AND pl.target_date = (now() AT TIME ZONE 'America/New_York')::date
      ORDER BY pl.created_at DESC
      LIMIT 25
    ) sub;

    SELECT to_jsonb(r)
    INTO v_todays_run
    FROM (
      SELECT
        id,
        avatar_id,
        generation_type,
        target_date,
        status,
        weak_slate,
        no_games,
        picks_generated,
        completed_at,
        created_at
      FROM public.agent_generation_runs
      WHERE avatar_id = p_agent_id
        AND target_date = (now() AT TIME ZONE 'America/New_York')::date
        AND status = 'succeeded'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) r;

    -- The LIVE run, if one is in flight: lets a client that left mid-run come
    -- back, see "generating", and resume polling instead of re-triggering.
    -- Bounded to ~12 min (task ceiling 600s + slack) so a crashed row that was
    -- never finalized can't pin the UI in a generating state forever.
    SELECT to_jsonb(r)
    INTO v_active_run
    FROM (
      SELECT
        id,
        avatar_id,
        generation_type,
        target_date,
        status,
        trigger_run_id,
        created_at
      FROM public.agent_generation_runs
      WHERE avatar_id = p_agent_id
        AND engine_version = 'v3_trigger'
        AND status IN ('queued', 'processing')
        AND created_at > now() - interval '12 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'api_version', 'v3',
    'agent', COALESCE(v_agent, '{}'::jsonb),
    'performance', v_performance,
    'todays_picks', COALESCE(v_todays_picks, '[]'::jsonb),
    'todays_parlays', COALESCE(v_todays_parlays, '[]'::jsonb),
    'todays_generation_run', v_todays_run,
    'active_generation_run', v_active_run,
    'can_view_agent_picks', v_can_view_picks,
    'is_following', v_is_following
  );
END;
$$;
