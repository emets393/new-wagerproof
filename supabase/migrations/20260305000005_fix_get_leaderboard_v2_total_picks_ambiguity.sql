-- ============================================================================
-- Migration: Fix get_leaderboard_v2 total_picks ambiguity
-- Description:
--   - Qualifies total_picks references in filtered CTE predicates to avoid
--     RETURNS TABLE variable ambiguity (SQLSTATE 42702)
-- ============================================================================

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
      FROM rows r
      WHERE (r.wins + r.losses) > 0
        AND (NOT p_exclude_under_10_picks OR r.total_picks >= 10)
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
      FROM rows r
      WHERE (r.wins + r.losses) > 0
      AND (NOT p_exclude_under_10_picks OR r.total_picks >= 10)
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

GRANT EXECUTE ON FUNCTION public.get_leaderboard_v2(integer, text, text, text, boolean, uuid) TO authenticated;
