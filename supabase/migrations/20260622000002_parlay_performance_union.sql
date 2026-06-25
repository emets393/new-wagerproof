-- =============================================================================
-- Parlay-aware avatar performance: UNION parlay tickets into the avatar's
-- totals WITHOUT double-counting.
--
-- Why a union (and not reusing the straight-pick aggregate): a parlay is ONE
-- staked ticket (avatar_parlays.units), not the sum of its legs. The existing
-- per-row aggregate sums avatar_picks; if parlay legs lived there it would
-- count each leg's stake. So parlays stay in their own tables and we add their
-- ticket-level result to the same cache fields here.
--
-- This REPLACES recalculate_avatar_performance from
-- 20260331000002_fix_total_picks_excludes_pending.sql. All existing
-- straight-pick logic (sport stats, bet-type stats, streaks, net-units math,
-- the "settled-only total_picks" fix, the div-by-zero odds guard, the advisory
-- lock) is preserved verbatim; only the parlay union is layered on top.
--
-- Parlay net units (mirrors the grader's drop & re-price in
-- supabase/functions/grade-avatar-picks/index.ts):
--   won  → units * (settled_combined_decimal - 1)
--   lost → -units
--   push → 0
-- settled_combined_decimal is the re-priced product the grader stored in
-- ai_audit_payload.settled_decimal (push legs already dropped out). If it's
-- missing/invalid on a won ticket we fall back to combined_odds (American →
-- decimal), then to even money (units * 1.0) — never silently zero a win.
--
-- See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md (Part B — grading & payout).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_avatar_performance(p_avatar_id uuid)
RETURNS void AS $$
DECLARE
  v_picks RECORD;
  v_stats_by_sport jsonb := '{}'::jsonb;
  v_stats_by_bet_type jsonb := '{}'::jsonb;
  v_parlay_bet_type_stats jsonb;
  v_current_streak integer := 0;
  v_best_streak integer := 0;
  v_worst_streak integer := 0;
  v_prev_result text := null;
  v_streak_count integer := 0;
BEGIN
  -- Advisory lock prevents concurrent recalculation for the same avatar.
  PERFORM pg_advisory_xact_lock(('x' || left(replace(p_avatar_id::text, '-', ''), 16))::bit(64)::bigint);

  -- Aggregate sport stats (straight picks only — parlays are ticket-level and
  -- can be multi-sport; they roll into stats_by_bet_type['parlay'], not here).
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

  -- Aggregate bet type stats (straight picks).
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

  -- Parlay tickets contribute a single 'parlay' bet-type bucket (one row per
  -- ticket, NOT per leg). Built separately and merged into stats_by_bet_type.
  SELECT jsonb_build_object(
    'wins', COUNT(*) FILTER (WHERE result = 'won'),
    'losses', COUNT(*) FILTER (WHERE result = 'lost'),
    'pushes', COUNT(*) FILTER (WHERE result = 'push'),
    'total', COUNT(*) FILTER (WHERE result IN ('won', 'lost', 'push'))
  ) INTO v_parlay_bet_type_stats
  FROM public.avatar_parlays
  WHERE avatar_id = p_avatar_id AND result != 'pending';

  IF v_parlay_bet_type_stats IS NOT NULL
     AND (v_parlay_bet_type_stats->>'total')::int > 0 THEN
    v_stats_by_bet_type := COALESCE(v_stats_by_bet_type, '{}'::jsonb)
      || jsonb_build_object('parlay', v_parlay_bet_type_stats);
  END IF;

  -- Streaks: straight picks only, in chronological order. Parlays are not
  -- merged into the streak (no defined cross-source ordering; out of scope).
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

  -- Upsert into performance cache. total_picks / wins / losses / pushes /
  -- pending / net_units are the UNION of straight picks (ps.*) and parlay
  -- tickets (pl.*).
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
    ps.total_picks + pl.total_picks,
    ps.wins + pl.wins,
    ps.losses + pl.losses,
    ps.pushes + pl.pushes,
    ps.pending + pl.pending,
    CASE
      WHEN ((ps.wins + pl.wins) + (ps.losses + pl.losses)) > 0
      THEN ROUND((ps.wins + pl.wins)::numeric / ((ps.wins + pl.wins) + (ps.losses + pl.losses)), 4)
      ELSE NULL
    END,
    ROUND((ps.net_units + pl.net_units)::numeric, 2),
    v_current_streak,
    v_best_streak,
    v_worst_streak,
    COALESCE(v_stats_by_sport, '{}'::jsonb),
    COALESCE(v_stats_by_bet_type, '{}'::jsonb),
    now()
  FROM (
    -- Straight picks aggregate (UNCHANGED from 20260331000002).
    SELECT
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
  CROSS JOIN (
    -- Parlay tickets aggregate. One row per ticket. Net units uses the
    -- re-priced settled_decimal (push legs already dropped at grade time);
    -- falls back to combined_odds (American→decimal), then even money.
    SELECT
      COUNT(*) FILTER (WHERE result IN ('won', 'lost', 'push')) as total_picks,
      COUNT(*) FILTER (WHERE result = 'won') as wins,
      COUNT(*) FILTER (WHERE result = 'lost') as losses,
      COUNT(*) FILTER (WHERE result = 'push') as pushes,
      COUNT(*) FILTER (WHERE result = 'pending') as pending,
      COALESCE(SUM(
        CASE
          WHEN result = 'won' THEN
            units * (
              CASE
                -- 1) re-priced decimal from the grader (preferred)
                WHEN (ai_audit_payload->>'settled_decimal') ~ '^[0-9]+(\.[0-9]+)?$'
                     AND (ai_audit_payload->>'settled_decimal')::numeric > 1
                  THEN (ai_audit_payload->>'settled_decimal')::numeric - 1
                -- 2) fall back to combined_odds (American → decimal)
                WHEN combined_odds ~ '^[+-]?[0-9]+$' AND ABS(combined_odds::integer) > 0
                  THEN CASE
                         WHEN (combined_odds::integer) < 0 THEN (100.0 / ABS(combined_odds::integer))
                         ELSE (combined_odds::integer / 100.0)
                       END
                -- 3) last resort: even money (never silently zero a win)
                ELSE 1.0
              END
            )
          WHEN result = 'lost' THEN -units
          ELSE 0   -- push (or all-push ticket): stake returned, 0 net
        END
      ), 0) as net_units
    FROM public.avatar_parlays
    WHERE avatar_id = p_avatar_id
  ) pl
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

COMMENT ON FUNCTION public.recalculate_avatar_performance(uuid) IS
  'Recalculates avatar_performance_cache as the UNION of straight picks (avatar_picks) and parlay tickets (avatar_parlays). Parlays are counted per-ticket, never per-leg. Parlay net units: won → units*(settled_decimal-1), lost → -units, push → 0.';
