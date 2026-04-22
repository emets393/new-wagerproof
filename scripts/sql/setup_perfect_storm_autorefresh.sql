-- =====================================================================
-- Set up a pg_cron job to auto-refresh the perfect_storm aggregate row
-- on mlb_model_bucket_accuracy every 5 minutes.
--
-- Needed because the external Python ETL that populates the rest of
-- mlb_model_bucket_accuracy wipes unknown bet_types on each run, which
-- would otherwise clear our perfect_storm aggregate.
--
-- Idempotent: safe to re-run. Replaces the function and reschedules the
-- cron job cleanly.
-- =====================================================================

-- 1) Function that recomputes the perfect_storm row from mlb_graded_picks.
CREATE OR REPLACE FUNCTION public.refresh_perfect_storm_accuracy()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM mlb_model_bucket_accuracy WHERE bet_type = 'perfect_storm';

  INSERT INTO mlb_model_bucket_accuracy (
    bet_type, bucket, side, fav_dog, direction,
    games, wins, losses, pushes,
    units_won, win_pct, roi_pct, updated_at
  )
  SELECT
    'perfect_storm', '', '', '', '',
    COUNT(*),
    COUNT(*) FILTER (WHERE result = 'won'),
    COUNT(*) FILTER (WHERE result = 'lost'),
    COUNT(*) FILTER (WHERE result = 'push'),
    COALESCE(SUM(units_won), 0)::numeric,
    ROUND(COUNT(*) FILTER (WHERE result = 'won')::numeric * 100.0 / NULLIF(COUNT(*), 0), 1),
    ROUND(COALESCE(SUM(units_won), 0)::numeric * 100.0 / NULLIF(COUNT(*), 0), 1),
    NOW()
  FROM mlb_graded_picks
  WHERE is_perfect_storm = true AND result IS NOT NULL;
$$;

-- 2) Drop any prior schedule with this name (idempotent re-run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-perfect-storm-accuracy') THEN
    PERFORM cron.unschedule('refresh-perfect-storm-accuracy');
  END IF;
END $$;

-- 3) Schedule every 5 minutes.
SELECT cron.schedule(
  'refresh-perfect-storm-accuracy',
  '*/5 * * * *',
  'SELECT public.refresh_perfect_storm_accuracy();'
);

-- 4) Run once immediately so the row is present without waiting a tick.
SELECT public.refresh_perfect_storm_accuracy();

-- 5) Verify.
SELECT bet_type, games, wins, losses, pushes, win_pct, roi_pct, updated_at
FROM mlb_model_bucket_accuracy
WHERE bet_type = 'perfect_storm';
