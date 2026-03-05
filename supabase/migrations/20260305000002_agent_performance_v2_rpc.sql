-- ============================================================================
-- Migration: Agent Performance V2 RPCs + Indexes + Feature Flags
-- Description:
--   - Adds server-side ranked/paginated RPCs for agent performance paths
--   - Adds supporting indexes for leaderboard/feed/detail performance
--   - Seeds remote feature flags with safe defaults (disabled)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Feature flags (safe default: disabled)
-- ---------------------------------------------------------------------------
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('agents_v2_leaderboard_enabled', jsonb_build_object('enabled', false)),
  ('agents_v2_top_picks_enabled', jsonb_build_object('enabled', false)),
  ('agents_v2_agent_detail_enabled', jsonb_build_object('enabled', false)),
  ('agents_v2_shadow_compare_enabled', jsonb_build_object('enabled', false))
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_avatar_profiles_public_sports
  ON public.avatar_profiles (is_public, preferred_sports)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_avatar_performance_cache_avatar_id
  ON public.avatar_performance_cache (avatar_id);

CREATE INDEX IF NOT EXISTS idx_avatar_picks_avatar_date_created_result
  ON public.avatar_picks (avatar_id, game_date DESC, created_at DESC, result);

CREATE INDEX IF NOT EXISTS idx_avatar_picks_pick_lookup
  ON public.avatar_picks (game_id, bet_type, pick_selection, avatar_id);

-- ---------------------------------------------------------------------------
-- RPC: get_leaderboard_v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard_v2(
  p_limit integer DEFAULT 100,
  p_sport text DEFAULT NULL,
  p_sort_mode text DEFAULT 'overall',
  p_timeframe text DEFAULT 'all_time',
  p_exclude_under_10_picks boolean DEFAULT false,
  p_viewer_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  api_version text,
  avatar_id uuid,
  name text,
  avatar_emoji text,
  avatar_color text,
  user_id uuid,
  preferred_sports text[],
  total_picks integer,
  wins integer,
  losses integer,
  pushes integer,
  win_rate numeric,
  net_units numeric,
  current_streak integer,
  best_streak integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
  v_sort_mode text := COALESCE(p_sort_mode, 'overall');
  v_timeframe text := COALESCE(p_timeframe, 'all_time');
  v_cutoff date;
BEGIN
  IF v_timeframe NOT IN ('all_time', 'last_7_days', 'last_30_days') THEN
    v_timeframe := 'all_time';
  END IF;

  IF v_sort_mode NOT IN ('overall', 'recent_run', 'longest_streak', 'bottom_100') THEN
    v_sort_mode := 'overall';
  END IF;

  IF v_timeframe = 'all_time' THEN
    WITH rows AS (
      SELECT
        ap.id AS avatar_id,
        ap.name,
        ap.avatar_emoji,
        ap.avatar_color,
        ap.user_id,
        ap.preferred_sports,
        COALESCE(pc.total_picks, 0)::integer AS total_picks,
        COALESCE(pc.wins, 0)::integer AS wins,
        COALESCE(pc.losses, 0)::integer AS losses,
        COALESCE(pc.pushes, 0)::integer AS pushes,
        pc.win_rate,
        COALESCE(pc.net_units, 0)::numeric AS net_units,
        COALESCE(pc.current_streak, 0)::integer AS current_streak,
        COALESCE(pc.best_streak, 0)::integer AS best_streak
      FROM public.avatar_profiles ap
      LEFT JOIN public.avatar_performance_cache pc ON pc.avatar_id = ap.id
      WHERE ap.is_public = true
        AND (p_sport IS NULL OR ap.preferred_sports @> ARRAY[p_sport])
    ), filtered AS (
      SELECT *
      FROM rows
      WHERE (wins + losses) > 0
        AND (NOT p_exclude_under_10_picks OR total_picks >= 10)
    )
    SELECT
      'v2'::text,
      f.avatar_id,
      f.name,
      f.avatar_emoji,
      f.avatar_color,
      f.user_id,
      f.preferred_sports,
      f.total_picks,
      f.wins,
      f.losses,
      f.pushes,
      f.win_rate,
      f.net_units,
      f.current_streak,
      f.best_streak
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort_mode = 'overall' THEN f.net_units END DESC,
      CASE WHEN v_sort_mode = 'overall' THEN COALESCE(f.win_rate, 0) END DESC,
      CASE WHEN v_sort_mode = 'overall' THEN f.current_streak END DESC,
      CASE WHEN v_sort_mode = 'recent_run' THEN f.current_streak END DESC,
      CASE WHEN v_sort_mode = 'recent_run' THEN f.net_units END DESC,
      CASE WHEN v_sort_mode = 'recent_run' THEN COALESCE(f.win_rate, 0) END DESC,
      CASE WHEN v_sort_mode = 'longest_streak' THEN f.best_streak END DESC,
      CASE WHEN v_sort_mode = 'longest_streak' THEN f.current_streak END DESC,
      CASE WHEN v_sort_mode = 'longest_streak' THEN f.net_units END DESC,
      CASE WHEN v_sort_mode = 'bottom_100' THEN f.net_units END ASC,
      CASE WHEN v_sort_mode = 'bottom_100' THEN COALESCE(f.win_rate, 0) END ASC,
      CASE WHEN v_sort_mode = 'bottom_100' THEN f.current_streak END ASC,
      f.avatar_id
    LIMIT v_limit;

    RETURN;
  END IF;

  v_cutoff := CASE
    WHEN v_timeframe = 'last_7_days' THEN (CURRENT_DATE - INTERVAL '7 days')::date
    ELSE (CURRENT_DATE - INTERVAL '30 days')::date
  END;

  RETURN QUERY
  WITH public_agents AS (
    SELECT
      ap.id,
      ap.name,
      ap.avatar_emoji,
      ap.avatar_color,
      ap.user_id,
      ap.preferred_sports
    FROM public.avatar_profiles ap
    WHERE ap.is_public = true
      AND (p_sport IS NULL OR ap.preferred_sports @> ARRAY[p_sport])
  ), settled_picks AS (
    SELECT
      p.avatar_id,
      p.result,
      p.odds,
      p.units,
      p.created_at
    FROM public.avatar_picks p
    INNER JOIN public_agents pa ON pa.id = p.avatar_id
    WHERE p.result IN ('won', 'lost', 'push')
      AND p.game_date >= v_cutoff
  ), agg AS (
    SELECT
      sp.avatar_id,
      COUNT(*)::integer AS total_picks,
      COUNT(*) FILTER (WHERE sp.result = 'won')::integer AS wins,
      COUNT(*) FILTER (WHERE sp.result = 'lost')::integer AS losses,
      COUNT(*) FILTER (WHERE sp.result = 'push')::integer AS pushes,
      CASE
        WHEN (COUNT(*) FILTER (WHERE sp.result IN ('won', 'lost'))) > 0
        THEN (COUNT(*) FILTER (WHERE sp.result = 'won'))::numeric
             / (COUNT(*) FILTER (WHERE sp.result IN ('won', 'lost')))::numeric
        ELSE NULL
      END AS win_rate,
      COALESCE(SUM(
        CASE
          WHEN sp.result = 'lost' THEN -sp.units
          WHEN sp.result = 'won' THEN
            CASE
              WHEN sp.odds IS NOT NULL AND sp.odds ~ '^[+-]?[0-9]+$' THEN
                CASE
                  WHEN (sp.odds::integer) < 0 THEN sp.units * (100.0 / ABS(sp.odds::integer))
                  ELSE sp.units * ((sp.odds::integer) / 100.0)
                END
              ELSE sp.units
            END
          ELSE 0
        END
      ), 0)::numeric AS net_units
    FROM settled_picks sp
    GROUP BY sp.avatar_id
  ), streak_base AS (
    SELECT
      sp.avatar_id,
      sp.result,
      sp.created_at,
      SUM(
        CASE
          WHEN LAG(sp.result) OVER (PARTITION BY sp.avatar_id ORDER BY sp.created_at) IS DISTINCT FROM sp.result
          THEN 1
          ELSE 0
        END
      ) OVER (PARTITION BY sp.avatar_id ORDER BY sp.created_at ROWS UNBOUNDED PRECEDING) AS grp
    FROM settled_picks sp
    WHERE sp.result IN ('won', 'lost')
  ), streak_runs AS (
    SELECT
      sb.avatar_id,
      sb.grp,
      MIN(sb.result) AS result,
      COUNT(*)::integer AS run_len,
      MAX(sb.created_at) AS last_at
    FROM streak_base sb
    GROUP BY sb.avatar_id, sb.grp
  ), streaks AS (
    SELECT
      sr.avatar_id,
      COALESCE(MAX(CASE WHEN sr.result = 'won' THEN sr.run_len ELSE 0 END), 0)::integer AS best_streak,
      COALESCE((
        SELECT
          CASE WHEN sr2.result = 'won' THEN sr2.run_len ELSE -sr2.run_len END
        FROM streak_runs sr2
        WHERE sr2.avatar_id = sr.avatar_id
        ORDER BY sr2.last_at DESC
        LIMIT 1
      ), 0)::integer AS current_streak
    FROM streak_runs sr
    GROUP BY sr.avatar_id
  ), rows AS (
    SELECT
      pa.id AS avatar_id,
      pa.name,
      pa.avatar_emoji,
      pa.avatar_color,
      pa.user_id,
      pa.preferred_sports,
      COALESCE(a.total_picks, 0)::integer AS total_picks,
      COALESCE(a.wins, 0)::integer AS wins,
      COALESCE(a.losses, 0)::integer AS losses,
      COALESCE(a.pushes, 0)::integer AS pushes,
      a.win_rate,
      COALESCE(a.net_units, 0)::numeric AS net_units,
      COALESCE(s.current_streak, 0)::integer AS current_streak,
      COALESCE(s.best_streak, 0)::integer AS best_streak
    FROM public_agents pa
    LEFT JOIN agg a ON a.avatar_id = pa.id
    LEFT JOIN streaks s ON s.avatar_id = pa.id
  ), filtered AS (
    SELECT *
    FROM rows
    WHERE (wins + losses) > 0
      AND (NOT p_exclude_under_10_picks OR total_picks >= 10)
  )
  SELECT
    'v2'::text,
    f.avatar_id,
    f.name,
    f.avatar_emoji,
    f.avatar_color,
    f.user_id,
    f.preferred_sports,
    f.total_picks,
    f.wins,
    f.losses,
    f.pushes,
    f.win_rate,
    f.net_units,
    f.current_streak,
    f.best_streak
  FROM filtered f
  ORDER BY
    CASE WHEN v_sort_mode = 'overall' THEN f.net_units END DESC,
    CASE WHEN v_sort_mode = 'overall' THEN COALESCE(f.win_rate, 0) END DESC,
    CASE WHEN v_sort_mode = 'overall' THEN f.current_streak END DESC,
    CASE WHEN v_sort_mode = 'recent_run' THEN f.current_streak END DESC,
    CASE WHEN v_sort_mode = 'recent_run' THEN f.net_units END DESC,
    CASE WHEN v_sort_mode = 'recent_run' THEN COALESCE(f.win_rate, 0) END DESC,
    CASE WHEN v_sort_mode = 'longest_streak' THEN f.best_streak END DESC,
    CASE WHEN v_sort_mode = 'longest_streak' THEN f.current_streak END DESC,
    CASE WHEN v_sort_mode = 'longest_streak' THEN f.net_units END DESC,
    CASE WHEN v_sort_mode = 'bottom_100' THEN f.net_units END ASC,
    CASE WHEN v_sort_mode = 'bottom_100' THEN COALESCE(f.win_rate, 0) END ASC,
    CASE WHEN v_sort_mode = 'bottom_100' THEN f.current_streak END ASC,
    f.avatar_id
  LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_top_agent_picks_feed_v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_agent_picks_feed_v2(
  p_filter_mode text DEFAULT 'top10',
  p_viewer_user_id uuid DEFAULT NULL,
  p_search_text text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  api_version text,
  id uuid,
  avatar_id uuid,
  game_id text,
  sport text,
  matchup text,
  game_date date,
  bet_type text,
  pick_selection text,
  odds text,
  units numeric,
  confidence integer,
  reasoning_text text,
  key_factors jsonb,
  archived_game_data jsonb,
  archived_personality jsonb,
  result text,
  actual_result text,
  graded_at timestamptz,
  created_at timestamptz,
  agent_name text,
  agent_avatar_emoji text,
  agent_avatar_color text,
  agent_wins integer,
  agent_losses integer,
  agent_pushes integer,
  agent_net_units numeric,
  agent_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_filter text := COALESCE(p_filter_mode, 'top10');
  v_viewer uuid := COALESCE(auth.uid(), p_viewer_user_id);
BEGIN
  IF v_filter NOT IN ('top10', 'following', 'favorites') THEN
    v_filter := 'top10';
  END IF;

  RETURN QUERY
  WITH ranked_public AS (
    SELECT
      ap.id AS avatar_id,
      ap.name,
      ap.avatar_emoji,
      ap.avatar_color,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(pc.net_units, 0) DESC,
          COALESCE(pc.win_rate, 0) DESC,
          COALESCE(pc.current_streak, 0) DESC,
          ap.id
      )::integer AS rank,
      COALESCE(pc.wins, 0)::integer AS wins,
      COALESCE(pc.losses, 0)::integer AS losses,
      COALESCE(pc.pushes, 0)::integer AS pushes,
      COALESCE(pc.net_units, 0)::numeric AS net_units
    FROM public.avatar_profiles ap
    LEFT JOIN public.avatar_performance_cache pc ON pc.avatar_id = ap.id
    WHERE ap.is_public = true
  ), candidate_agents AS (
    SELECT rp.avatar_id
    FROM ranked_public rp
    WHERE v_filter = 'top10' AND rp.rank <= 50

    UNION

    SELECT uaf.avatar_id
    FROM public.user_avatar_follows uaf
    INNER JOIN ranked_public rp ON rp.avatar_id = uaf.avatar_id
    WHERE v_filter = 'following'
      AND v_viewer IS NOT NULL
      AND uaf.user_id = v_viewer

    UNION

    SELECT ap.id AS avatar_id
    FROM public.avatar_profiles ap
    INNER JOIN ranked_public rp ON rp.avatar_id = ap.id
    WHERE v_filter = 'favorites'
      AND v_viewer IS NOT NULL
      AND ap.user_id = v_viewer
      AND ap.is_widget_favorite = true

    UNION

    SELECT uaf.avatar_id
    FROM public.user_avatar_follows uaf
    INNER JOIN ranked_public rp ON rp.avatar_id = uaf.avatar_id
    WHERE v_filter = 'favorites'
      AND v_viewer IS NOT NULL
      AND uaf.user_id = v_viewer
      AND COALESCE(uaf.is_favorite, false) = true
  )
  SELECT
    'v2'::text,
    p.id,
    p.avatar_id,
    p.game_id,
    p.sport,
    p.matchup,
    p.game_date,
    p.bet_type,
    p.pick_selection,
    p.odds,
    p.units,
    p.confidence,
    p.reasoning_text,
    p.key_factors,
    p.archived_game_data,
    p.archived_personality,
    p.result,
    p.actual_result,
    p.graded_at,
    p.created_at,
    rp.name,
    rp.avatar_emoji,
    rp.avatar_color,
    rp.wins,
    rp.losses,
    rp.pushes,
    rp.net_units,
    rp.rank
  FROM public.avatar_picks p
  INNER JOIN candidate_agents ca ON ca.avatar_id = p.avatar_id
  INNER JOIN ranked_public rp ON rp.avatar_id = p.avatar_id
  WHERE p.game_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')::date
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
    AND (
      p_search_text IS NULL
      OR p_search_text = ''
      OR LOWER(p.matchup) LIKE '%' || LOWER(p_search_text) || '%'
      OR LOWER(p.pick_selection) LIKE '%' || LOWER(p_search_text) || '%'
      OR LOWER(rp.name) LIKE '%' || LOWER(p_search_text) || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_agent_detail_snapshot_v2
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
        AND game_date = CURRENT_DATE
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
        AND target_date = CURRENT_DATE
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
    'can_view_agent_picks', v_can_view_picks
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_agent_picks_page_v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_picks_page_v2(
  p_agent_id uuid,
  p_viewer_user_id uuid DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_page_size integer DEFAULT 20,
  p_cursor timestamptz DEFAULT NULL,
  p_include_overlap boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := COALESCE(auth.uid(), p_viewer_user_id);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_filter text := COALESCE(p_filter, 'all');
  v_can_view_picks boolean := false;
  v_is_readable boolean := false;
  v_next_cursor timestamptz := NULL;
  v_has_more boolean := false;
  v_picks jsonb := '[]'::jsonb;
BEGIN
  IF v_filter NOT IN ('all', 'won', 'lost', 'pending', 'push') THEN
    v_filter := 'all';
  END IF;

  SELECT (ap.is_public = true OR (v_viewer IS NOT NULL AND ap.user_id = v_viewer))
  INTO v_is_readable
  FROM public.avatar_profiles ap
  WHERE ap.id = p_agent_id;

  IF COALESCE(v_is_readable, false) = false THEN
    RETURN jsonb_build_object('api_version', 'v2', 'picks', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  IF v_viewer IS NOT NULL THEN
    v_can_view_picks := public.can_access_agent_picks(v_viewer);
  END IF;

  IF NOT v_can_view_picks THEN
    RETURN jsonb_build_object('api_version', 'v2', 'picks', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  WITH base AS (
    SELECT p.*
    FROM public.avatar_picks p
    WHERE p.avatar_id = p_agent_id
      AND (v_filter = 'all' OR p.result = v_filter)
      AND (p_cursor IS NULL OR p.created_at < p_cursor)
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT (v_page_size + 1)
  ), page AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC, id DESC
    LIMIT v_page_size
  ), has_more_cte AS (
    SELECT (COUNT(*) > v_page_size) AS has_more
    FROM base
  ), next_cursor_cte AS (
    SELECT b.created_at AS next_cursor
    FROM base b
    ORDER BY b.created_at DESC, b.id DESC
    OFFSET v_page_size
    LIMIT 1
  )
  SELECT
    COALESCE(jsonb_agg(
      CASE
        WHEN p_include_overlap THEN
          jsonb_set(
            to_jsonb(pg),
            '{overlap}',
            jsonb_build_object(
              'totalCount', COALESCE(ov.total_count, 0),
              'agents', COALESCE(ov.agents, '[]'::jsonb)
            ),
            true
          )
        ELSE to_jsonb(pg)
      END
      ORDER BY pg.created_at DESC, pg.id DESC
    ), '[]'::jsonb),
    COALESCE((SELECT has_more FROM has_more_cte), false),
    (SELECT next_cursor FROM next_cursor_cte)
  INTO v_picks, v_has_more, v_next_cursor
  FROM page pg
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS total_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'avatar_id', x.avatar_id,
            'name', x.name,
            'avatar_emoji', x.avatar_emoji,
            'avatar_color', x.avatar_color
          )
        ),
        '[]'::jsonb
      ) AS agents
    FROM (
      SELECT DISTINCT
        ap2.avatar_id,
        prof.name,
        prof.avatar_emoji,
        prof.avatar_color
      FROM public.avatar_picks ap2
      INNER JOIN public.avatar_profiles prof ON prof.id = ap2.avatar_id
      WHERE ap2.game_id = pg.game_id
        AND ap2.bet_type = pg.bet_type
        AND ap2.pick_selection = pg.pick_selection
        AND ap2.avatar_id <> pg.avatar_id
        AND prof.is_public = true
      LIMIT 5
    ) x
  ) ov ON p_include_overlap = true;

  RETURN jsonb_build_object(
    'api_version', 'v2',
    'picks', COALESCE(v_picks, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_v2(integer, text, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_agent_picks_feed_v2(text, uuid, text, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_detail_snapshot_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_picks_page_v2(uuid, uuid, text, integer, timestamptz, boolean) TO authenticated;
