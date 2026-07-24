-- Nightly as-of recompute for mlb_analysis_base (SQL port of asof_features_mlb.py).
-- The daily refresh_mlb_analysis_base() rebuilds the table and NULLs every as-of
-- column; this function recomputes all 45 leak-safe features in-place and is
-- chained after it in cron job `mlb_analysis_base_refresh`.
-- Semantics (must match the python exactly — validated cell-by-cell 2026-07-24):
--   * season-to-date counts/rates/streaks = ENTERING each game (exclude current row)
--   * ordering: (game_date, time_et, game_pk) within (team, season) — DH-safe
--   * rows with a NULL outcome neither advance nor reset the matching streak
--   * h2h = most recent prior meeting vs that opponent, ANY season
--   * opp_* = the mirror row's own team_* values; opp_prev_* = mirror's prev_result/margin
CREATE OR REPLACE FUNCTION public.refresh_mlb_asof()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
CREATE TEMP TABLE _asof ON COMMIT DROP AS
WITH ord AS (
  SELECT game_pk, team_abbr, opponent_abbr, season, game_date, time_et,
         ml_won, rl_covered, ou_over, runs_scored, runs_allowed, margin,
         prev_result, prev_margin,
         row_number() OVER w AS rn
  FROM mlb_analysis_base
  WINDOW w AS (PARTITION BY team_abbr, season ORDER BY game_date, time_et, game_pk)
),
cum AS (
  SELECT o.*,
    count(*)          FILTER (WHERE ml_won IS NOT NULL)     OVER wp AS gp,
    count(*)          FILTER (WHERE ml_won = 1)             OVER wp AS wins,
    count(*)          FILTER (WHERE ml_won = 0)             OVER wp AS losses,
    count(*)          FILTER (WHERE rl_covered = 1)         OVER wp AS rl_wins,
    count(*)          FILTER (WHERE rl_covered IS NOT NULL) OVER wp AS rl_gp,
    count(*)          FILTER (WHERE ou_over = 1)            OVER wp AS over_ct,
    count(*)          FILTER (WHERE ou_over IS NOT NULL)    OVER wp AS ou_gp,
    sum(runs_scored)  FILTER (WHERE ml_won IS NOT NULL)     OVER wp AS rs,
    sum(runs_allowed) FILTER (WHERE ml_won IS NOT NULL)     OVER wp AS ra,
    -- index (within team-season) of the latest non-null-outcome row STRICTLY BEFORE
    -- this one, per outcome family — used to carry streaks across null-outcome rows
    count(ml_won)     OVER wp AS ml_k_prev,
    count(rl_covered) OVER wp AS rl_k_prev,
    count(ou_over)    OVER wp AS ou_k_prev
  FROM ord o
  WINDOW wp AS (PARTITION BY team_abbr, season ORDER BY game_date, time_et, game_pk
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
),
-- run lengths on the non-null subsequences (two-level gaps-and-islands: window
-- functions cannot nest, so island ids are computed in a lower level first)
mlseq AS (
  SELECT team_abbr, season, ml_won,
    row_number() OVER (PARTITION BY team_abbr, season ORDER BY game_date, time_et, game_pk) AS k,
    row_number() OVER (PARTITION BY team_abbr, season, ml_won ORDER BY game_date, time_et, game_pk) AS kr
  FROM ord WHERE ml_won IS NOT NULL
),
mlrun AS (
  SELECT team_abbr, season, ml_won, k,
    row_number() OVER (PARTITION BY team_abbr, season, ml_won, k - kr ORDER BY k) AS runlen
  FROM mlseq
),
rlseq AS (
  SELECT team_abbr, season, rl_covered,
    row_number() OVER (PARTITION BY team_abbr, season ORDER BY game_date, time_et, game_pk) AS k,
    row_number() OVER (PARTITION BY team_abbr, season, rl_covered ORDER BY game_date, time_et, game_pk) AS kr
  FROM ord WHERE rl_covered IS NOT NULL
),
rlrun AS (
  SELECT team_abbr, season, rl_covered, k,
    row_number() OVER (PARTITION BY team_abbr, season, rl_covered, k - kr ORDER BY k) AS runlen
  FROM rlseq
),
ouseq AS (
  SELECT team_abbr, season, ou_over,
    row_number() OVER (PARTITION BY team_abbr, season ORDER BY game_date, time_et, game_pk) AS k,
    row_number() OVER (PARTITION BY team_abbr, season, ou_over ORDER BY game_date, time_et, game_pk) AS kr
  FROM ord WHERE ou_over IS NOT NULL
),
ourun AS (
  SELECT team_abbr, season, ou_over, k,
    row_number() OVER (PARTITION BY team_abbr, season, ou_over, k - kr ORDER BY k) AS runlen
  FROM ouseq
),
pyr AS (
  SELECT team_abbr, season + 1 AS season,
    count(*) FILTER (WHERE ml_won = 1) AS prev_wins,
    (count(*) FILTER (WHERE ml_won = 1))::double precision
      / NULLIF(count(*) FILTER (WHERE ml_won IS NOT NULL), 0) AS prev_win_pct
  FROM mlb_analysis_base GROUP BY team_abbr, season
),
h2h AS (
  SELECT game_pk, team_abbr,
    lag(ml_won)  OVER wh AS h2h_last_win,
    lag(ou_over) OVER wh AS h2h_last_over,
    lag(margin)  OVER wh AS h2h_last_margin,
    lag(season)  OVER wh AS h2h_last_season
  FROM mlb_analysis_base
  WINDOW wh AS (PARTITION BY team_abbr, opponent_abbr ORDER BY game_date, time_et, game_pk)
),
teamvals AS (
  SELECT c.game_pk, c.team_abbr, c.opponent_abbr, c.season,
    c.gp, c.wins, c.losses,
    c.wins::double precision / NULLIF(c.gp, 0) AS win_pct,
    CASE WHEN m.ml_won = 1 THEN m.runlen ELSE 0 END AS win_streak,
    CASE WHEN m.ml_won = 0 THEN m.runlen ELSE 0 END AS loss_streak,
    c.rl_wins,
    c.rl_wins::double precision / NULLIF(c.rl_gp, 0) AS rl_cover_pct,
    CASE WHEN r.rl_covered = 1 THEN r.runlen ELSE 0 END AS rl_streak,
    c.over_ct, c.ou_gp,
    c.over_ct::double precision / NULLIF(c.ou_gp, 0) AS over_pct,
    CASE WHEN u.ou_over = 1 THEN u.runlen ELSE 0 END AS over_streak,
    CASE WHEN u.ou_over = 0 THEN u.runlen ELSE 0 END AS under_streak,
    c.rs::double precision / NULLIF(c.gp, 0) AS rpg,
    c.ra::double precision / NULLIF(c.gp, 0) AS rapg,
    (c.rs - c.ra)::double precision / NULLIF(c.gp, 0) AS run_diff_pg,
    p.prev_wins, p.prev_win_pct,
    h.h2h_last_win, h.h2h_last_over, h.h2h_last_margin, h.h2h_last_season,
    COALESCE(h.h2h_last_season = c.season, false) AS h2h_same_season,  -- python: NaN==x -> False
    c.prev_result AS own_prev_result, c.prev_margin AS own_prev_margin
  FROM cum c
  LEFT JOIN mlrun m ON m.team_abbr = c.team_abbr AND m.season = c.season AND m.k = c.ml_k_prev AND c.ml_k_prev > 0
  LEFT JOIN rlrun r ON r.team_abbr = c.team_abbr AND r.season = c.season AND r.k = c.rl_k_prev AND c.rl_k_prev > 0
  LEFT JOIN ourun u ON u.team_abbr = c.team_abbr AND u.season = c.season AND u.k = c.ou_k_prev AND c.ou_k_prev > 0
  LEFT JOIN pyr p   ON p.team_abbr = c.team_abbr AND p.season = c.season
  LEFT JOIN h2h h   ON h.game_pk = c.game_pk AND h.team_abbr = c.team_abbr
)
SELECT t.*,
  -- streak columns default to 0 when a team has no prior graded game (python: counters start at 0)
  o.gp AS opp_gp, o.wins AS opp_wins, o.losses AS opp_losses, o.win_pct AS opp_win_pct,
  o.win_streak AS opp_win_streak, o.loss_streak AS opp_loss_streak,
  o.rl_wins AS opp_rl_wins, o.rl_cover_pct AS opp_rl_cover_pct, o.rl_streak AS opp_rl_streak,
  o.over_ct AS opp_over_ct, o.ou_gp AS opp_ou_gp, o.over_pct AS opp_over_pct,
  o.over_streak AS opp_over_streak, o.under_streak AS opp_under_streak,
  o.rpg AS opp_rpg, o.rapg AS opp_rapg, o.run_diff_pg AS opp_run_diff_pg,
  o.prev_wins AS opp_prev_wins, o.prev_win_pct AS opp_prev_win_pct,
  o.own_prev_result AS opp_prev_result, o.own_prev_margin AS opp_prev_margin
FROM teamvals t
LEFT JOIN teamvals o ON o.game_pk = t.game_pk AND o.team_abbr = t.opponent_abbr;

UPDATE mlb_analysis_base b SET
  team_gp_s2d = a.gp, team_wins_s2d = a.wins, team_losses_s2d = a.losses,
  team_win_pct = a.win_pct,
  team_win_streak = COALESCE(a.win_streak, 0), team_loss_streak = COALESCE(a.loss_streak, 0),
  team_rl_wins_s2d = a.rl_wins, team_rl_cover_pct = a.rl_cover_pct,
  team_rl_streak = COALESCE(a.rl_streak, 0),
  team_over_count_s2d = a.over_ct, team_ou_games_s2d = a.ou_gp, team_over_pct = a.over_pct,
  team_over_streak = COALESCE(a.over_streak, 0), team_under_streak = COALESCE(a.under_streak, 0),
  team_rpg = a.rpg, team_rapg = a.rapg, team_run_diff_pg = a.run_diff_pg,
  team_prev_wins = a.prev_wins, team_prev_win_pct = a.prev_win_pct,
  h2h_last_win = a.h2h_last_win, h2h_last_over = a.h2h_last_over,
  h2h_last_margin = a.h2h_last_margin, h2h_last_season = a.h2h_last_season,
  h2h_same_season = a.h2h_same_season,
  opp_gp_s2d = a.opp_gp, opp_wins_s2d = a.opp_wins, opp_losses_s2d = a.opp_losses,
  opp_win_pct = a.opp_win_pct,
  opp_win_streak = CASE WHEN a.opp_gp IS NULL THEN NULL ELSE COALESCE(a.opp_win_streak, 0) END,
  opp_loss_streak = CASE WHEN a.opp_gp IS NULL THEN NULL ELSE COALESCE(a.opp_loss_streak, 0) END,
  opp_rl_wins_s2d = a.opp_rl_wins, opp_rl_cover_pct = a.opp_rl_cover_pct,
  opp_rl_streak = CASE WHEN a.opp_gp IS NULL THEN NULL ELSE COALESCE(a.opp_rl_streak, 0) END,
  opp_over_count_s2d = a.opp_over_ct, opp_ou_games_s2d = a.opp_ou_gp, opp_over_pct = a.opp_over_pct,
  opp_over_streak = CASE WHEN a.opp_gp IS NULL THEN NULL ELSE COALESCE(a.opp_over_streak, 0) END,
  opp_under_streak = CASE WHEN a.opp_gp IS NULL THEN NULL ELSE COALESCE(a.opp_under_streak, 0) END,
  opp_rpg = a.opp_rpg, opp_rapg = a.opp_rapg, opp_run_diff_pg = a.opp_run_diff_pg,
  opp_prev_wins = a.opp_prev_wins, opp_prev_win_pct = a.opp_prev_win_pct,
  opp_prev_result = a.opp_prev_result, opp_prev_margin = a.opp_prev_margin
FROM _asof a
WHERE b.game_pk = a.game_pk AND b.team_abbr = a.team_abbr;

DROP TABLE _asof;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_mlb_asof() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mlb_asof() TO service_role;
ALTER FUNCTION public.refresh_mlb_asof() SET statement_timeout TO '120s';
