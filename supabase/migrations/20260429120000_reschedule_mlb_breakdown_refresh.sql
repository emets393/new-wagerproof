-- Move breakdown + alignment refreshes to AFTER mlb-morning-runner.
-- That GH Action runs at 10:45 UTC and finalizes mlb_predictions for
-- the prior day. Previously breakdown ran at 10:05 UTC — 40 min BEFORE
-- the upstream data was ready, so each morning the table was missing
-- yesterday's results until the next manual run. Symptom: Cleveland
-- Guardians stuck at 8-4 full_ml record on 4/29 even though they had
-- played and lost on 4/28 (model picked them).
--
-- New timing:
--   10:45 UTC — mlb-morning-runner starts (GH Action)
--   ~11:00     — typically finishes
--   11:30 UTC — refresh_mlb_model_breakdown_accuracy (45 min buffer)
--   11:45 UTC — refresh_mlb_pick_alignment (depends on breakdown)
--   13:00 UTC — first regression-report build that consumes both
SELECT cron.unschedule('refresh_mlb_model_breakdown_accuracy_daily');
SELECT cron.unschedule('refresh_mlb_pick_alignment_daily');

SELECT cron.schedule(
  'refresh_mlb_model_breakdown_accuracy_daily',
  '30 11 * * *',
  $cron$ SELECT public.refresh_mlb_model_breakdown_accuracy(); $cron$
);

SELECT cron.schedule(
  'refresh_mlb_pick_alignment_daily',
  '45 11 * * *',
  $cron$ SELECT public.refresh_mlb_pick_alignment(); $cron$
);
