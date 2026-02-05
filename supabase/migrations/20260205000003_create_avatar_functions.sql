-- ============================================================================
-- Migration: Create Avatar Database Functions
-- Description: Helper functions and triggers for agent feature
-- ============================================================================

-- ============================================================================
-- FUNCTION: update_updated_at()
-- Trigger function to automatically update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to avatar_profiles
DROP TRIGGER IF EXISTS avatar_profiles_updated_at ON public.avatar_profiles;
CREATE TRIGGER avatar_profiles_updated_at
  BEFORE UPDATE ON public.avatar_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- FUNCTION: recalculate_avatar_performance(p_avatar_id uuid)
-- Recalculates cached performance stats for an avatar
-- Called after picks are graded
-- ============================================================================
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
  -- Calculate overall stats and by-category stats
  WITH pick_stats AS (
    SELECT
      COUNT(*) as total_picks,
      COUNT(*) FILTER (WHERE result = 'won') as wins,
      COUNT(*) FILTER (WHERE result = 'lost') as losses,
      COUNT(*) FILTER (WHERE result = 'push') as pushes,
      COUNT(*) FILTER (WHERE result = 'pending') as pending,
      -- Net units calculation (simplified: +1 for win, -1 for loss)
      COALESCE(SUM(
        CASE
          WHEN result = 'won' THEN
            CASE
              WHEN odds IS NOT NULL AND odds ~ '^[+-]?[0-9]+$' THEN
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
  ),
  sport_stats AS (
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
  ),
  bet_type_stats AS (
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
  )
  SELECT
    jsonb_object_agg(sport, stats) INTO v_stats_by_sport
  FROM sport_stats;

  SELECT
    jsonb_object_agg(bet_type, stats) INTO v_stats_by_bet_type
  FROM bet_type_stats;

  -- Calculate streaks (iterate through picks in order)
  FOR v_picks IN
    SELECT result
    FROM public.avatar_picks
    WHERE avatar_id = p_avatar_id AND result IN ('won', 'lost')
    ORDER BY created_at ASC
  LOOP
    IF v_prev_result IS NULL OR v_picks.result = v_prev_result THEN
      -- Continue streak
      IF v_picks.result = 'won' THEN
        v_streak_count := v_streak_count + 1;
      ELSE
        v_streak_count := v_streak_count - 1;
      END IF;
    ELSE
      -- Streak broken, record and reset
      IF v_streak_count > v_best_streak THEN
        v_best_streak := v_streak_count;
      END IF;
      IF v_streak_count < v_worst_streak THEN
        v_worst_streak := v_streak_count;
      END IF;

      -- Start new streak
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
      THEN ps.wins::numeric / (ps.wins + ps.losses)
      ELSE NULL
    END,
    ps.net_units,
    v_current_streak,
    v_best_streak,
    v_worst_streak,
    COALESCE(v_stats_by_sport, '{}'::jsonb),
    COALESCE(v_stats_by_bet_type, '{}'::jsonb),
    now()
  FROM (
    SELECT
      COUNT(*) as total_picks,
      COUNT(*) FILTER (WHERE result = 'won') as wins,
      COUNT(*) FILTER (WHERE result = 'lost') as losses,
      COUNT(*) FILTER (WHERE result = 'push') as pushes,
      COUNT(*) FILTER (WHERE result = 'pending') as pending,
      COALESCE(SUM(
        CASE
          WHEN result = 'won' THEN
            CASE
              WHEN odds IS NOT NULL AND odds ~ '^[+-]?[0-9]+$' THEN
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

-- ============================================================================
-- FUNCTION: update_owner_activity(p_user_id uuid)
-- Updates the owner_last_active_at for all avatars owned by a user
-- Called when user opens the app
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_owner_activity(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.avatar_profiles
  SET owner_last_active_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_owner_activity(uuid) TO authenticated;

-- ============================================================================
-- FUNCTION: get_eligible_avatars_for_auto_generation()
-- Returns avatars that should receive auto-generated picks today
-- Used by the auto-generation cron job
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_eligible_avatars_for_auto_generation()
RETURNS TABLE (
  avatar_id uuid,
  user_id uuid,
  name text,
  preferred_sports text[],
  personality_params jsonb,
  custom_insights jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id as avatar_id,
    ap.user_id,
    ap.name,
    ap.preferred_sports,
    ap.personality_params,
    ap.custom_insights
  FROM public.avatar_profiles ap
  WHERE ap.auto_generate = true
    AND ap.is_active = true
    AND (ap.last_auto_generated_at IS NULL OR ap.last_auto_generated_at::date < CURRENT_DATE)
    AND ap.owner_last_active_at > now() - interval '5 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
