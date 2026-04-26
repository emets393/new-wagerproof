-- =====================================================================
-- Live, season-rolling signal stats for mlb_game_signals
-- =====================================================================
-- Adds:
--   * mlb_signal_stats table (lifetime + L90 W/L/ROI per signal)
--   * refresh_mlb_signal_stats() function — recomputes from mlb_game_log
--   * pg_cron job to refresh nightly at 10:00 UTC (5am ET)
--
-- The view (mlb_game_signals) is rewritten in the next migration to consume
-- these stats and substitute the live numbers into each message string.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.mlb_signal_stats (
  signal_key TEXT PRIMARY KEY REFERENCES public.mlb_signal_definitions(signal_key) ON DELETE CASCADE,
  total_picks INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  pushes INT NOT NULL DEFAULT 0,
  units_won NUMERIC(8,2) NOT NULL DEFAULT 0,
  win_pct NUMERIC(5,1) NOT NULL DEFAULT 0,
  roi_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  l90_picks INT NOT NULL DEFAULT 0,
  l90_wins INT NOT NULL DEFAULT 0,
  l90_win_pct NUMERIC(5,1),
  l90_roi_pct NUMERIC(6,2),
  earliest_pick_date DATE,
  latest_pick_date DATE,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mlb_signal_stats IS
  'Per-signal performance stats refreshed nightly by refresh_mlb_signal_stats(). Lifetime + L90 win% and ROI%. Subject win pct = win rate of the team being signaled (low = clear FADE for negative signals).';

CREATE OR REPLACE FUNCTION public.refresh_mlb_signal_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  WITH ordered AS (
    SELECT
      official_date, won, closing_ml, margin, game_pk,
      team_abbr, opp_team_abbr, venue,
      LAG(official_date) OVER w AS prev_date,
      LAG(margin) OVER w AS prev_margin,
      LAG(closing_ml) OVER w AS prev_ml
    FROM public.mlb_game_log
    WHERE season >= 2023 AND runs_scored IS NOT NULL
    WINDOW w AS (PARTITION BY team_abbr, opp_team_abbr, venue ORDER BY official_date, game_pk)
  ),
  series_marked AS (
    SELECT *,
      SUM(CASE WHEN prev_date IS NULL OR (official_date - prev_date) > 6 THEN 1 ELSE 0 END)
        OVER (PARTITION BY team_abbr, opp_team_abbr, venue ORDER BY official_date, game_pk) AS series_id
    FROM ordered
  ),
  with_gnum AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY team_abbr, opp_team_abbr, venue, series_id ORDER BY official_date, game_pk) AS gnum
    FROM series_marked
  ),
  candidates AS (
    SELECT official_date, won, closing_ml,
      CASE WHEN gnum=2 AND prev_margin>=8 AND prev_ml BETWEEN -149 AND -110 THEN 'g2_blowout_sweet_spot' END AS s1,
      CASE WHEN gnum=2 AND prev_margin>=8 AND (prev_ml NOT BETWEEN -149 AND -110) AND (prev_ml NOT BETWEEN -109 AND 109) THEN 'g2_blowout_winner' END AS s2,
      CASE WHEN gnum=2 AND prev_margin>=8 AND prev_ml BETWEEN -109 AND 109 THEN 'g2_blowout_pick_em_trap' END AS s3,
      CASE WHEN gnum=2 AND prev_margin<=-8 THEN 'g2_blowout_loser' END AS s4,
      CASE WHEN gnum=2 AND prev_margin BETWEEN 5 AND 7 AND prev_ml BETWEEN -149 AND -110 THEN 'g2_modfav_5to7_fade' END AS s5,
      CASE WHEN gnum=3 AND prev_margin>=15 THEN 'g3_massive_blowout_regression' END AS s6,
      CASE WHEN gnum=3 AND prev_margin<=-15 THEN 'g3_blowout_recipient_bounce' END AS s7,
      CASE WHEN gnum=3 AND prev_margin BETWEEN 8 AND 14 AND prev_ml BETWEEN -149 AND -110 THEN 'g3_moderate_fav_regression' END AS s8,
      CASE WHEN gnum=3 AND prev_margin BETWEEN 8 AND 14 AND prev_ml<=-150 THEN 'g3_heavy_fav_carryover' END AS s9
    FROM with_gnum
    WHERE closing_ml IS NOT NULL AND prev_ml IS NOT NULL
  ),
  fires AS (
    SELECT x.signal_key, c.official_date, c.won, c.closing_ml
    FROM candidates c,
      LATERAL unnest(ARRAY[c.s1,c.s2,c.s3,c.s4,c.s5,c.s6,c.s7,c.s8,c.s9]) AS x(signal_key)
    WHERE x.signal_key IS NOT NULL
  ),
  agg AS (
    SELECT signal_key,
      COUNT(*)::int AS total_picks,
      SUM(CASE WHEN won THEN 1 ELSE 0 END)::int AS wins,
      SUM(CASE WHEN won THEN 0 ELSE 1 END)::int AS losses,
      SUM(CASE WHEN won THEN
            CASE WHEN closing_ml > 0 THEN closing_ml/100.0 ELSE 100.0/ABS(closing_ml) END
          ELSE -1 END)::numeric(8,2) AS units_won,
      MIN(official_date) AS earliest_pick_date,
      MAX(official_date) AS latest_pick_date,
      COUNT(*) FILTER (WHERE official_date >= CURRENT_DATE - 90)::int AS l90_picks,
      SUM(CASE WHEN won AND official_date >= CURRENT_DATE - 90 THEN 1 ELSE 0 END)::int AS l90_wins,
      SUM(CASE WHEN official_date >= CURRENT_DATE - 90 THEN
            CASE WHEN won THEN
              CASE WHEN closing_ml > 0 THEN closing_ml/100.0 ELSE 100.0/ABS(closing_ml) END
            ELSE -1 END
          ELSE 0 END)::numeric(8,2) AS l90_units
    FROM fires
    GROUP BY signal_key
  )
  INSERT INTO public.mlb_signal_stats AS s
    (signal_key, total_picks, wins, losses, pushes, units_won, win_pct, roi_pct,
     l90_picks, l90_wins, l90_win_pct, l90_roi_pct,
     earliest_pick_date, latest_pick_date, last_calculated_at)
  SELECT a.signal_key,
    a.total_picks, a.wins, a.losses, 0, a.units_won,
    ROUND(100.0 * a.wins / NULLIF(a.total_picks,0)::numeric, 1),
    ROUND(100.0 * a.units_won / NULLIF(a.total_picks,0), 2),
    a.l90_picks, a.l90_wins,
    CASE WHEN a.l90_picks > 0 THEN ROUND(100.0 * a.l90_wins / a.l90_picks::numeric, 1) END,
    CASE WHEN a.l90_picks > 0 THEN ROUND(100.0 * a.l90_units / a.l90_picks, 2) END,
    a.earliest_pick_date, a.latest_pick_date, NOW()
  FROM agg a
  ON CONFLICT (signal_key) DO UPDATE SET
    total_picks         = EXCLUDED.total_picks,
    wins                = EXCLUDED.wins,
    losses              = EXCLUDED.losses,
    units_won           = EXCLUDED.units_won,
    win_pct             = EXCLUDED.win_pct,
    roi_pct             = EXCLUDED.roi_pct,
    l90_picks           = EXCLUDED.l90_picks,
    l90_wins            = EXCLUDED.l90_wins,
    l90_win_pct         = EXCLUDED.l90_win_pct,
    l90_roi_pct         = EXCLUDED.l90_roi_pct,
    earliest_pick_date  = EXCLUDED.earliest_pick_date,
    latest_pick_date    = EXCLUDED.latest_pick_date,
    last_calculated_at  = NOW();
END;
$func$;

COMMENT ON FUNCTION public.refresh_mlb_signal_stats() IS
  'Recomputes mlb_signal_stats lifetime + L90 stats from mlb_game_log. Run nightly after games settle.';

-- Populate immediately
SELECT public.refresh_mlb_signal_stats();

-- Schedule nightly at 10am UTC (5am ET)
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('refresh_mlb_signal_stats_daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

SELECT cron.schedule(
  'refresh_mlb_signal_stats_daily',
  '0 10 * * *',
  $$ SELECT public.refresh_mlb_signal_stats(); $$
);
