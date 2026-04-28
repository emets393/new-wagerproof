-- =====================================================================
-- mlb_model_breakdown_accuracy — model accuracy/ROI by team and day-of-week
-- =====================================================================
-- New table that powers a "Day-of-Week & Team Breakdown" section under the
-- existing Model Accuracy Dashboard on the MLB Regression Report. Tracks
-- per-bet-type model performance sliced by:
--   * team — for ML: the team the model picked. For O/U: each team in the game.
--   * dow  — day of week (Sun..Sat)
--
-- Refreshed nightly at 10:05 UTC by refresh_mlb_model_breakdown_accuracy()
-- (5 minutes after refresh_mlb_signal_stats_daily so it runs sequentially).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.mlb_model_breakdown_accuracy (
  bet_type        TEXT NOT NULL,
  breakdown_type  TEXT NOT NULL,
  breakdown_value TEXT NOT NULL,
  games           INT NOT NULL DEFAULT 0,
  wins            INT NOT NULL DEFAULT 0,
  losses          INT NOT NULL DEFAULT 0,
  pushes          INT NOT NULL DEFAULT 0,
  units_won       NUMERIC(8,2) NOT NULL DEFAULT 0,
  win_pct         NUMERIC(5,1) NOT NULL DEFAULT 0,
  roi_pct         NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bet_type, breakdown_type, breakdown_value),
  CHECK (bet_type IN ('full_ml','full_ou','f5_ml','f5_ou')),
  CHECK (breakdown_type IN ('team','dow'))
);

CREATE INDEX IF NOT EXISTS mlb_model_breakdown_accuracy_filter_idx
  ON public.mlb_model_breakdown_accuracy (bet_type, breakdown_type);

COMMENT ON TABLE public.mlb_model_breakdown_accuracy IS
  'Model accuracy & ROI sliced by team and day-of-week, per bet type. Refreshed nightly. Picks use edge-based logic. ROI uses closing_ml for ML, assumed -110 juice for O/U, -115 for F5 ML.';

CREATE OR REPLACE FUNCTION public.refresh_mlb_model_breakdown_accuracy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  TRUNCATE public.mlb_model_breakdown_accuracy;

  WITH h AS (
    SELECT game_pk, team_abbr AS home_abbr, won AS home_won, closing_ml AS home_ml,
           runs_scored AS home_rs, runs_allowed AS home_ra, closing_total,
           f5_runs_scored AS home_f5_rs, f5_runs_allowed AS home_f5_ra,
           f5_total_line AS f5_total
    FROM public.mlb_game_log
    WHERE home_away = 'home' AND runs_scored IS NOT NULL
  ),
  a AS (
    SELECT game_pk, team_abbr AS away_abbr, won AS away_won, closing_ml AS away_ml
    FROM public.mlb_game_log
    WHERE home_away = 'away' AND runs_scored IS NOT NULL
  ),
  joined AS (
    SELECT p.game_pk, p.official_date,
           EXTRACT(DOW FROM p.official_date)::int AS dow_num,
           h.home_abbr, a.away_abbr,
           p.home_ml_edge_pct, p.away_ml_edge_pct,
           p.f5_home_ml_edge_pct, p.f5_away_ml_edge_pct,
           p.ou_direction, p.locked_total_line,
           p.f5_fair_total, p.locked_f5_total,
           h.home_won, a.away_won, h.home_ml, a.away_ml,
           h.home_rs, h.home_ra, h.closing_total,
           h.home_f5_rs, h.home_f5_ra, h.f5_total
    FROM public.mlb_predictions p
    JOIN h USING (game_pk) JOIN a USING (game_pk)
    WHERE p.is_final_prediction = TRUE
  ),
  full_ml_picks AS (
    SELECT official_date, dow_num,
      CASE WHEN home_ml_edge_pct >= away_ml_edge_pct AND home_ml_edge_pct > 0 THEN home_abbr
           WHEN away_ml_edge_pct >  home_ml_edge_pct AND away_ml_edge_pct > 0 THEN away_abbr END AS team,
      CASE WHEN home_ml_edge_pct >= away_ml_edge_pct AND home_ml_edge_pct > 0 THEN home_won
           WHEN away_ml_edge_pct >  home_ml_edge_pct AND away_ml_edge_pct > 0 THEN away_won END AS won,
      CASE WHEN home_ml_edge_pct >= away_ml_edge_pct AND home_ml_edge_pct > 0 THEN home_ml
           WHEN away_ml_edge_pct >  home_ml_edge_pct AND away_ml_edge_pct > 0 THEN away_ml END AS odds
    FROM joined
  ),
  full_ou_picks_per_team AS (
    SELECT official_date, dow_num, team,
      CASE
        WHEN closing_total IS NULL OR ou_direction IS NULL THEN NULL
        WHEN (home_rs+home_ra)::numeric = closing_total THEN 'PUSH'
        WHEN (ou_direction = 'OVER'  AND (home_rs+home_ra) >  closing_total)
          OR (ou_direction = 'UNDER' AND (home_rs+home_ra) <  closing_total) THEN 'WIN'
        ELSE 'LOSS' END AS result
    FROM (SELECT *, home_abbr AS team FROM joined UNION ALL SELECT *, away_abbr AS team FROM joined) t
  ),
  f5_ml_picks AS (
    SELECT official_date, dow_num,
      CASE WHEN f5_home_ml_edge_pct >= f5_away_ml_edge_pct AND f5_home_ml_edge_pct > 0 THEN home_abbr
           WHEN f5_away_ml_edge_pct >  f5_home_ml_edge_pct AND f5_away_ml_edge_pct > 0 THEN away_abbr END AS team,
      CASE
        WHEN home_f5_rs IS NULL OR home_f5_ra IS NULL THEN NULL
        WHEN home_f5_rs = home_f5_ra THEN 'PUSH'
        WHEN (f5_home_ml_edge_pct >= f5_away_ml_edge_pct AND f5_home_ml_edge_pct > 0 AND home_f5_rs > home_f5_ra)
          OR (f5_away_ml_edge_pct >  f5_home_ml_edge_pct AND f5_away_ml_edge_pct > 0 AND home_f5_rs < home_f5_ra) THEN 'WIN'
        WHEN (f5_home_ml_edge_pct IS NULL AND f5_away_ml_edge_pct IS NULL)
          OR (f5_home_ml_edge_pct <= 0 AND f5_away_ml_edge_pct <= 0) THEN NULL
        ELSE 'LOSS' END AS result
    FROM joined
  ),
  f5_ou_picks_per_team AS (
    SELECT official_date, dow_num, team,
      CASE
        WHEN f5_total IS NULL OR f5_fair_total IS NULL OR locked_f5_total IS NULL THEN NULL
        WHEN f5_fair_total = locked_f5_total THEN NULL
        WHEN (home_f5_rs+home_f5_ra)::numeric = f5_total THEN 'PUSH'
        WHEN (f5_fair_total > locked_f5_total AND (home_f5_rs+home_f5_ra) >  f5_total)
          OR (f5_fair_total < locked_f5_total AND (home_f5_rs+home_f5_ra) <  f5_total) THEN 'WIN'
        ELSE 'LOSS' END AS result
    FROM (SELECT *, home_abbr AS team FROM joined UNION ALL SELECT *, away_abbr AS team FROM joined) t
  ),
  full_ml_team AS (
    SELECT 'full_ml' AS bet_type, 'team' AS breakdown_type, team AS breakdown_value,
      COUNT(*)::int AS games, SUM((won)::int)::int AS wins, SUM((NOT won)::int)::int AS losses, 0 AS pushes,
      SUM(CASE WHEN won THEN CASE WHEN odds > 0 THEN odds/100.0 ELSE 100.0/ABS(odds) END ELSE -1 END)::numeric(8,2) AS units_won
    FROM full_ml_picks WHERE team IS NOT NULL AND won IS NOT NULL AND odds IS NOT NULL GROUP BY team
  ),
  full_ml_dow AS (
    SELECT 'full_ml','dow', dow_num::text,
      COUNT(*)::int, SUM((won)::int)::int, SUM((NOT won)::int)::int, 0,
      SUM(CASE WHEN won THEN CASE WHEN odds > 0 THEN odds/100.0 ELSE 100.0/ABS(odds) END ELSE -1 END)::numeric(8,2)
    FROM full_ml_picks WHERE team IS NOT NULL AND won IS NOT NULL AND odds IS NOT NULL GROUP BY dow_num
  ),
  full_ou_team AS (
    SELECT 'full_ou','team', team,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/110 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM full_ou_picks_per_team WHERE team IS NOT NULL GROUP BY team
  ),
  full_ou_dow AS (
    SELECT 'full_ou','dow', dow_num::text,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/110 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM (SELECT DISTINCT ON (official_date, team) * FROM full_ou_picks_per_team) one_per_team_day
    GROUP BY dow_num
  ),
  f5_ml_team AS (
    SELECT 'f5_ml','team', team,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/115 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM f5_ml_picks WHERE team IS NOT NULL GROUP BY team
  ),
  f5_ml_dow AS (
    SELECT 'f5_ml','dow', dow_num::text,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/115 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM f5_ml_picks WHERE team IS NOT NULL GROUP BY dow_num
  ),
  f5_ou_team AS (
    SELECT 'f5_ou','team', team,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/110 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM f5_ou_picks_per_team WHERE team IS NOT NULL GROUP BY team
  ),
  f5_ou_dow AS (
    SELECT 'f5_ou','dow', dow_num::text,
      COUNT(*) FILTER (WHERE result IN ('WIN','LOSS','PUSH'))::int,
      SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='PUSH' THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN result='WIN' THEN 100.0/110 WHEN result='LOSS' THEN -1 ELSE 0 END)::numeric(8,2)
    FROM (SELECT DISTINCT ON (official_date, team) * FROM f5_ou_picks_per_team) one_per_team_day
    GROUP BY dow_num
  ),
  combined AS (
    SELECT * FROM full_ml_team UNION ALL SELECT * FROM full_ml_dow
    UNION ALL SELECT * FROM full_ou_team UNION ALL SELECT * FROM full_ou_dow
    UNION ALL SELECT * FROM f5_ml_team  UNION ALL SELECT * FROM f5_ml_dow
    UNION ALL SELECT * FROM f5_ou_team  UNION ALL SELECT * FROM f5_ou_dow
  )
  INSERT INTO public.mlb_model_breakdown_accuracy
    (bet_type, breakdown_type, breakdown_value, games, wins, losses, pushes, units_won, win_pct, roi_pct, updated_at)
  SELECT
    bet_type, breakdown_type,
    CASE WHEN breakdown_type='dow' THEN
      CASE breakdown_value WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue' WHEN '3' THEN 'Wed'
        WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' WHEN '6' THEN 'Sat' ELSE breakdown_value END
    ELSE breakdown_value END,
    games, wins, losses, pushes, units_won,
    ROUND(100.0 * wins / NULLIF(wins+losses, 0)::numeric, 1),
    ROUND(100.0 * units_won / NULLIF(wins+losses, 0), 2),
    NOW()
  FROM combined
  WHERE games > 0 AND (wins + losses) > 0;
END;
$func$;

COMMENT ON FUNCTION public.refresh_mlb_model_breakdown_accuracy() IS
  'Recomputes mlb_model_breakdown_accuracy from mlb_predictions × mlb_game_log. Run nightly after games settle.';

SELECT public.refresh_mlb_model_breakdown_accuracy();

DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('refresh_mlb_model_breakdown_accuracy_daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

SELECT cron.schedule(
  'refresh_mlb_model_breakdown_accuracy_daily',
  '5 10 * * *',
  $$ SELECT public.refresh_mlb_model_breakdown_accuracy(); $$
);
