-- ============================================================================
-- Fix Avatar Daily CRON Jobs
-- Ensures daily auto-generate + daily grade jobs exist and are active.
-- This migration is idempotent and safe to re-run.
-- ============================================================================

-- Optional safety if extensions were not enabled yet in the target project.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove legacy avatar jobs if they exist (old multi-run schedule + prior names).
DO $$
DECLARE
  v_job_name text;
  v_old_jobs text[] := ARRAY[
    'auto-generate-avatar-picks-morning',
    'auto-generate-avatar-picks-evening',
    'auto-generate-avatar-picks-daily',
    'grade-avatar-picks-overnight-03',
    'grade-avatar-picks-overnight-04',
    'grade-avatar-picks-overnight-05',
    'grade-avatar-picks-overnight-06',
    'grade-avatar-picks-overnight-07',
    'grade-avatar-picks-afternoon',
    'grade-avatar-picks-daily'
  ];
BEGIN
  FOREACH v_job_name IN ARRAY v_old_jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job_name) THEN
      PERFORM cron.unschedule(v_job_name);
    END IF;
  END LOOP;
END $$;

-- Job 1: Generate avatar picks once daily (9:00 AM ET = 14:00 UTC, standard-time aligned).
SELECT cron.schedule(
  'auto-generate-avatar-picks-daily',
  '0 14 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-generate-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    ) AS request_id;
  $$
);

-- Job 2: Grade avatar picks once daily overnight (2:00 AM ET = 07:00 UTC, standard-time aligned).
SELECT cron.schedule(
  'grade-avatar-picks-daily',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    ) AS request_id;
  $$
);

-- Verification helpers:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE '%avatar-picks%';
-- SELECT * FROM cron.job_run_details WHERE jobid IN (
--   SELECT jobid FROM cron.job WHERE jobname IN ('auto-generate-avatar-picks-daily', 'grade-avatar-picks-daily')
-- ) ORDER BY start_time DESC LIMIT 20;
