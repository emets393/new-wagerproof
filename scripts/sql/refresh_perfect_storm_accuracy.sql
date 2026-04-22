-- =====================================================================
-- Aggregate perfect-storm picks from mlb_graded_picks into a single row
-- on mlb_model_bucket_accuracy so the website + app can read the
-- historical hit rate the same way they read other bucket accuracy.
--
-- Safe to re-run — the DELETE+INSERT inside a transaction guarantees
-- the row stays consistent with whatever's currently graded.
--
-- After the Python ETL that maintains mlb_model_bucket_accuracy is
-- updated to include this aggregation, this script becomes a one-off.
-- Until then, schedule it (cron / pg_cron / manual) whenever picks grade.
-- =====================================================================

BEGIN;

DELETE FROM mlb_model_bucket_accuracy WHERE bet_type = 'perfect_storm';

INSERT INTO mlb_model_bucket_accuracy (
  bet_type, bucket, side, fav_dog, direction,
  games, wins, losses, pushes,
  units_won, win_pct, roi_pct, updated_at
)
SELECT
  'perfect_storm'                                                           AS bet_type,
  ''                                                                        AS bucket,
  ''                                                                        AS side,
  ''                                                                        AS fav_dog,
  ''                                                                        AS direction,
  COUNT(*)                                                                  AS games,
  COUNT(*) FILTER (WHERE result = 'won')                                    AS wins,
  COUNT(*) FILTER (WHERE result = 'lost')                                   AS losses,
  COUNT(*) FILTER (WHERE result = 'push')                                   AS pushes,
  COALESCE(SUM(units_won), 0)::numeric                                      AS units_won,
  ROUND(
    COUNT(*) FILTER (WHERE result = 'won')::numeric * 100.0
      / NULLIF(COUNT(*), 0),
    1
  )                                                                         AS win_pct,
  ROUND(
    COALESCE(SUM(units_won), 0)::numeric * 100.0
      / NULLIF(COUNT(*), 0),
    1
  )                                                                         AS roi_pct,
  NOW()                                                                     AS updated_at
FROM mlb_graded_picks
WHERE is_perfect_storm = true
  AND result IS NOT NULL;

COMMIT;

-- Sanity check: inspect the row you just wrote.
SELECT bet_type, games, wins, losses, pushes, win_pct, roi_pct, updated_at
FROM mlb_model_bucket_accuracy
WHERE bet_type = 'perfect_storm';
