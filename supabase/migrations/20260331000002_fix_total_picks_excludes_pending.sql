-- =============================================================================
-- Fix: total_picks should only count settled picks (won/lost/push), not pending
-- Bug: total_picks was COUNT(*) which included pending picks, making agents
-- appear to have more picks than graded results, distorting the W-L record.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_avatar_performance(p_avatar_id uuid)
RETURNS void AS $$
DECLARE
  v_picks RECORD;
  v_stats_by_sport jsonb := '{}'::jsonb;
  v_stats_by_bet_type jsonb := '{}'::jsonb;
  v_current_streak integer := 0;
  v_best_streak integer := 0;
  v_worst_streak integer := 0;
  v_prev_result text := null;
  v_streak_count integer := 0;
BEGIN
  -- Advisory lock prevents concurrent recalculation for the same avatar.
  PERFORM pg_advisory_xact_lock(('x' || left(replace(p_avatar_id::text, '-', ''), 16))::bit(64)::bigint);

  -- Aggregate sport stats
  SELECT jsonb_object_agg(sport, stats) INTO v_stats_by_sport
  FROM (
    SELECT
      sport,
      jsonb_build_object(
        'wins', COUNT(*) FILTER (WHERE result = 'won'),
        'losses', COUNT(*) FILTER (WHERE result = 'lost'),
        'pushes', COUNT(*) FILTER (WHERE result = 'push'),
        'total', COUNT(*) FILTER (WHERE result IN ('won', 'lost', 'push'))
      ) as stats
    FROM public.avatar_picks
    WHERE avatar_id = p_avatar_id AND result != 'pending'
    GROUP BY sport
  ) sport_stats;

  -- Aggregate bet type stats
  SELECT jsonb_object_agg(bet_type, stats) INTO v_stats_by_bet_type
  FROM (
    SELECT
      bet_type,
      jsonb_build_object(
        'wins', COUNT(*) FILTER (WHERE result = 'won'),
        'losses', COUNT(*) FILTER (WHERE result = 'lost'),
        'pushes', COUNT(*) FILTER (WHERE result = 'push'),
        'total', COUNT(*) FILTER (WHERE result IN ('won', 'lost', 'push'))
      ) as stats
    FROM public.avatar_picks
    WHERE avatar_id = p_avatar_id AND result != 'pending'
    GROUP BY bet_type
  ) bet_type_stats;

  -- Calculate streaks (iterate through picks in order)
  FOR v_picks IN
    SELECT result
    FROM public.avatar_picks
    WHERE avatar_id = p_avatar_id AND result IN ('won', 'lost')
    ORDER BY created_at ASC
  LOOP
    IF v_prev_result IS NULL OR v_picks.result = v_prev_result THEN
      IF v_picks.result = 'won' THEN
        v_streak_count := v_streak_count + 1;
      ELSE
        v_streak_count := v_streak_count - 1;
      END IF;
    ELSE
      IF v_streak_count > v_best_streak THEN
        v_best_streak := v_streak_count;
      END IF;
      IF v_streak_count < v_worst_streak THEN
        v_worst_streak := v_streak_count;
      END IF;
      IF v_picks.result = 'won' THEN
        v_streak_count := 1;
      ELSE
        v_streak_count := -1;
      END IF;
    END IF;
    v_prev_result := v_picks.result;
  END LOOP;

  -- Final streak check
  v_current_streak := v_streak_count;
  IF v_streak_count > v_best_streak THEN
    v_best_streak := v_streak_count;
  END IF;
  IF v_streak_count < v_worst_streak THEN
    v_worst_streak := v_streak_count;
  END IF;

  -- Upsert into performance cache
  INSERT INTO public.avatar_performance_cache (
    avatar_id,
    total_picks,
    wins,
    losses,
    pushes,
    pending,
    win_rate,
    net_units,
    current_streak,
    best_streak,
    worst_streak,
    stats_by_sport,
    stats_by_bet_type,
    last_calculated_at
  )
  SELECT
    p_avatar_id,
    ps.total_picks,
    ps.wins,
    ps.losses,
    ps.pushes,
    ps.pending,
    CASE
      WHEN (ps.wins + ps.losses) > 0
      THEN ROUND(ps.wins::numeric / (ps.wins + ps.losses), 4)
      ELSE NULL
    END,
    ROUND(ps.net_units::numeric, 2),
    v_current_streak,
    v_best_streak,
    v_worst_streak,
    COALESCE(v_stats_by_sport, '{}'::jsonb),
    COALESCE(v_stats_by_bet_type, '{}'::jsonb),
    now()
  FROM (
    SELECT
      -- FIX: total_picks only counts settled picks (won/lost/push), not pending
      COUNT(*) FILTER (WHERE result IN ('won', 'lost', 'push')) as total_picks,
      COUNT(*) FILTER (WHERE result = 'won') as wins,
      COUNT(*) FILTER (WHERE result = 'lost') as losses,
      COUNT(*) FILTER (WHERE result = 'push') as pushes,
      COUNT(*) FILTER (WHERE result = 'pending') as pending,
      COALESCE(SUM(
        CASE
          WHEN result = 'won' THEN
            CASE
              WHEN odds IS NOT NULL AND odds ~ '^[+-]?[0-9]+$' AND ABS(odds::integer) > 0 THEN
                CASE
                  WHEN (odds::integer) < 0 THEN units * (100.0 / ABS(odds::integer))
                  ELSE units * (odds::integer / 100.0)
                END
              ELSE units * 1.0
            END
          WHEN result = 'lost' THEN -units
          ELSE 0
        END
      ), 0) as net_units
    FROM public.avatar_picks
    WHERE avatar_id = p_avatar_id
  ) ps
  ON CONFLICT (avatar_id) DO UPDATE SET
    total_picks = EXCLUDED.total_picks,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    pushes = EXCLUDED.pushes,
    pending = EXCLUDED.pending,
    win_rate = EXCLUDED.win_rate,
    net_units = EXCLUDED.net_units,
    current_streak = EXCLUDED.current_streak,
    best_streak = EXCLUDED.best_streak,
    worst_streak = EXCLUDED.worst_streak,
    stats_by_sport = EXCLUDED.stats_by_sport,
    stats_by_bet_type = EXCLUDED.stats_by_bet_type,
    last_calculated_at = EXCLUDED.last_calculated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
