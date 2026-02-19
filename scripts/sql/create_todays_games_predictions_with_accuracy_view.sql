-- =============================================================================
-- View: Today's games + latest prediction + model predicted winners + accuracy
-- per pick (spread, over/under, moneyline) using edge_accuracy_by_bucket.
--
-- Run this on the CFB Supabase project (jpxnjuwglavsjbgbasnl) where
-- nba_input_values_view, v_cbb_input_values, nba/ncaab_predictions, and
-- nba/ncaab_edge_accuracy_by_bucket exist.
--
-- "Today" = CURRENT_DATE. If you need ET: use
--   (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
-- for the game date filter.
--
-- Bucket logic (must match run-agent-pick.mjs):
--   Spread: bucket = ROUND(ABS(vegas_spread - model_spread) * 2) / 2
--   O/U:    bucket = ROUND((pred_total - vegas_total) * 2) / 2
--   ML:     bucket = ROUND(GREATEST(home_win_prob, away_win_prob) * 20) / 20
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NBA: today's games, latest prediction, predicted winners, and accuracy
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW nba_todays_games_predictions_with_accuracy AS
WITH latest_run AS (
  SELECT run_id
  FROM nba_predictions
  ORDER BY run_id DESC
  LIMIT 1
),
today_games AS (
  SELECT g.game_id, g.away_team, g.home_team, g.game_date, g.tipoff_time_et,
         g.home_spread     AS vegas_home_spread,
         g.total_line      AS vegas_total,
         g.home_moneyline  AS vegas_home_ml
  FROM nba_input_values_view g
  WHERE g.game_date = CURRENT_DATE
),
preds AS (
  SELECT p.game_id, p.run_id,
         p.home_win_prob, p.away_win_prob,
         p.model_fair_home_spread, p.model_fair_total AS pred_total_points
  FROM nba_predictions p
  INNER JOIN latest_run l ON p.run_id = l.run_id
  INNER JOIN today_games t ON t.game_id = p.game_id
),
buckets AS (
  SELECT p.game_id,
         -- Spread bucket: |vegas - model| rounded to 0.5
         (ROUND((ABS(t.vegas_home_spread - p.model_fair_home_spread))::numeric * 2) / 2)::double precision AS spread_bucket,
         -- O/U bucket: pred_total - vegas_total rounded to 0.5
         (ROUND((p.pred_total_points - t.vegas_total)::numeric * 2) / 2)::double precision                AS ou_bucket,
         -- ML bucket: max win prob rounded to 0.05
         (ROUND((GREATEST(p.home_win_prob, p.away_win_prob))::numeric * 20) / 20)::double precision      AS ml_bucket
  FROM preds p
  INNER JOIN today_games t ON t.game_id = p.game_id
)
SELECT
  t.game_id,
  t.away_team,
  t.home_team,
  t.game_date,
  t.tipoff_time_et,
  t.vegas_home_spread,
  t.vegas_total,
  t.vegas_home_ml,
  -- Latest prediction
  p.run_id,
  p.home_win_prob,
  p.away_win_prob,
  p.model_fair_home_spread,
  p.pred_total_points,
  -- Model predicted spread winner (which side covers)
  CASE
    WHEN p.model_fair_home_spread IS NOT NULL AND t.vegas_home_spread IS NOT NULL THEN
      CASE WHEN p.model_fair_home_spread < t.vegas_home_spread THEN 'home' ELSE 'away' END
    ELSE NULL
  END AS model_spread_winner,
  -- Model predicted over/under winner
  CASE
    WHEN p.pred_total_points IS NOT NULL AND t.vegas_total IS NOT NULL THEN
      CASE WHEN p.pred_total_points > t.vegas_total THEN 'over' ELSE 'under' END
    ELSE NULL
  END AS model_ou_winner,
  -- Model predicted moneyline winner
  CASE
    WHEN p.home_win_prob IS NOT NULL AND p.away_win_prob IS NOT NULL THEN
      CASE WHEN p.home_win_prob >= 0.5 THEN 'home' ELSE 'away' END
    ELSE NULL
  END AS model_ml_winner,
  -- Bucket keys (for reference)
  b.spread_bucket,
  b.ou_bucket,
  b.ml_bucket,
  -- Model accuracy for each pick (from edge_accuracy_by_bucket)
  spread_acc.accuracy_pct AS spread_accuracy_pct,
  spread_acc.games        AS spread_bucket_games,
  ou_acc.accuracy_pct    AS ou_accuracy_pct,
  ou_acc.games            AS ou_bucket_games,
  ml_acc.accuracy_pct    AS ml_accuracy_pct,
  ml_acc.games            AS ml_bucket_games
FROM today_games t
INNER JOIN preds p   ON p.game_id = t.game_id
INNER JOIN buckets b ON b.game_id = t.game_id
LEFT JOIN nba_edge_accuracy_by_bucket spread_acc
  ON spread_acc.edge_type = 'SPREAD_EDGE' AND spread_acc.bucket = b.spread_bucket
LEFT JOIN nba_edge_accuracy_by_bucket ou_acc
  ON ou_acc.edge_type = 'OU_EDGE' AND ou_acc.bucket = b.ou_bucket
LEFT JOIN nba_edge_accuracy_by_bucket ml_acc
  ON ml_acc.edge_type = 'MONEYLINE_PROB' AND ml_acc.bucket = b.ml_bucket;


-- -----------------------------------------------------------------------------
-- NCAAB: today's games, latest prediction, predicted winners, and accuracy
-- Today = Eastern date. Latest prediction = per game, row with max as_of_ts_utc
-- (matches app logic in gameDataService fetchNCAABPredictions).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ncaab_todays_games_predictions_with_accuracy AS
WITH today_et AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date AS dt
),
today_games AS (
  SELECT g.game_id, g.away_team, g.home_team, g.game_date_et AS game_date, g.tipoff_time_et, g.start_utc,
         g.spread          AS vegas_home_spread,
         g.over_under      AS vegas_total,
         g."homeMoneyline" AS vegas_home_ml
  FROM v_cbb_input_values g
  CROSS JOIN today_et d
  WHERE (g.game_date_et)::date = d.dt
),
-- Per game: the prediction row with latest as_of_ts_utc (same as website)
preds AS (
  SELECT DISTINCT ON (p.game_id)
         p.game_id, p.run_id,
         p.home_win_prob, p.away_win_prob,
         p.model_fair_home_spread, p.pred_total_points
  FROM ncaab_predictions p
  INNER JOIN today_games t ON t.game_id = p.game_id
  ORDER BY p.game_id, p.as_of_ts_utc DESC NULLS LAST
),
buckets AS (
  SELECT p.game_id,
         (ROUND((ABS(t.vegas_home_spread - p.model_fair_home_spread))::numeric * 2) / 2)::double precision AS spread_bucket,
         (ROUND((p.pred_total_points - t.vegas_total)::numeric * 2) / 2)::double precision                AS ou_bucket,
         (ROUND((GREATEST(p.home_win_prob, p.away_win_prob))::numeric * 20) / 20)::double precision      AS ml_bucket
  FROM preds p
  INNER JOIN today_games t ON t.game_id = p.game_id
)
SELECT
  t.game_id,
  t.away_team,
  t.home_team,
  t.game_date,
  t.tipoff_time_et,
  t.start_utc,
  t.vegas_home_spread,
  t.vegas_total,
  t.vegas_home_ml,
  p.run_id,
  p.home_win_prob,
  p.away_win_prob,
  p.model_fair_home_spread,
  p.pred_total_points,
  CASE
    WHEN p.model_fair_home_spread IS NOT NULL AND t.vegas_home_spread IS NOT NULL THEN
      CASE WHEN p.model_fair_home_spread < t.vegas_home_spread THEN 'home' ELSE 'away' END
    ELSE NULL
  END AS model_spread_winner,
  CASE
    WHEN p.pred_total_points IS NOT NULL AND t.vegas_total IS NOT NULL THEN
      CASE WHEN p.pred_total_points > t.vegas_total THEN 'over' ELSE 'under' END
    ELSE NULL
  END AS model_ou_winner,
  CASE
    WHEN p.home_win_prob IS NOT NULL AND p.away_win_prob IS NOT NULL THEN
      CASE WHEN p.home_win_prob >= 0.5 THEN 'home' ELSE 'away' END
    ELSE NULL
  END AS model_ml_winner,
  b.spread_bucket,
  b.ou_bucket,
  b.ml_bucket,
  spread_acc.accuracy_pct AS spread_accuracy_pct,
  spread_acc.games        AS spread_bucket_games,
  ou_acc.accuracy_pct     AS ou_accuracy_pct,
  ou_acc.games            AS ou_bucket_games,
  ml_acc.accuracy_pct     AS ml_accuracy_pct,
  ml_acc.games            AS ml_bucket_games
FROM today_games t
LEFT JOIN preds p   ON p.game_id = t.game_id
LEFT JOIN buckets b ON b.game_id = t.game_id
LEFT JOIN ncaab_edge_accuracy_by_bucket spread_acc
  ON spread_acc.edge_type = 'SPREAD_EDGE' AND spread_acc.bucket = b.spread_bucket
LEFT JOIN ncaab_edge_accuracy_by_bucket ou_acc
  ON ou_acc.edge_type = 'OU_EDGE' AND ou_acc.bucket = b.ou_bucket
LEFT JOIN ncaab_edge_accuracy_by_bucket ml_acc
  ON ml_acc.edge_type = 'MONEYLINE_PROB' AND ml_acc.bucket = b.ml_bucket;
