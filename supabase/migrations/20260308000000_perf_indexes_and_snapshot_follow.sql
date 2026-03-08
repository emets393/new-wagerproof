-- ============================================================================
-- Migration: Performance Indexes + Snapshot Follow Status
-- Description:
--   - Adds composite index for timeframe-based leaderboard queries
--   - Adds index for follow status lookups
--   - Updates get_agent_detail_snapshot_v2 to include is_following field
--     (eliminates a separate client-side query per detail screen load)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Additional Indexes for Performance
-- ---------------------------------------------------------------------------

-- Composite index for timeframe-based leaderboard queries
-- Covers: WHERE result IN ('won','lost','push') AND game_date >= cutoff
CREATE INDEX IF NOT EXISTS idx_avatar_picks_game_date_result
  ON public.avatar_picks (game_date, avatar_id, result)
  WHERE result IN ('won', 'lost', 'push');

-- Index for follow status lookups (user checking if they follow an agent)
CREATE INDEX IF NOT EXISTS idx_user_avatar_follows_user_avatar
  ON public.user_avatar_follows (user_id, avatar_id);

-- Index for created_at DESC pagination (widget service, pick feeds)
CREATE INDEX IF NOT EXISTS idx_avatar_picks_created_desc
  ON public.avatar_picks (created_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- Updated RPC: get_agent_detail_snapshot_v2
-- Now includes is_following field to eliminate separate follow-status query
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_detail_snapshot_v2(
  p_agent_id uuid,
  p_viewer_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := COALESCE(auth.uid(), p_viewer_user_id);
  v_can_view_picks boolean := false;
  v_is_readable boolean := false;
  v_is_following boolean := false;
  v_agent jsonb := '{}'::jsonb;
  v_performance jsonb := null;
  v_todays_picks jsonb := '[]'::jsonb;
  v_todays_run jsonb := null;
BEGIN
  IF p_agent_id IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v2', 'error', 'invalid_agent_id');
  END IF;

  SELECT to_jsonb(ap),
         (ap.is_public = true OR (v_viewer IS NOT NULL AND ap.user_id = v_viewer))
  INTO v_agent, v_is_readable
  FROM public.avatar_profiles ap
  WHERE ap.id = p_agent_id;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v2', 'error', 'not_found');
  END IF;

  IF NOT v_is_readable THEN
    RETURN jsonb_build_object('api_version', 'v2', 'error', 'forbidden');
  END IF;

  IF v_viewer IS NOT NULL THEN
    v_can_view_picks := public.can_access_agent_picks(v_viewer);

    -- Check follow status (eliminates separate client-side query)
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
  END IF;

  RETURN jsonb_build_object(
    'api_version', 'v2',
    'agent', COALESCE(v_agent, '{}'::jsonb),
    'performance', v_performance,
    'todays_picks', COALESCE(v_todays_picks, '[]'::jsonb),
    'todays_generation_run', v_todays_run,
    'can_view_agent_picks', v_can_view_picks,
    'is_following', v_is_following
  );
END;
$$;
