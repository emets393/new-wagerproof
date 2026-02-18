-- ============================================================================
-- Fix Polymarket Cache CRON Job Reliability
-- Ensures job exists, is active, and has enough timeout for heavy cache updates.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'update-polymarket-cache-hourly'
  ) THEN
    PERFORM cron.unschedule('update-polymarket-cache-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/update-polymarket-cache',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'apikey', current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    ) AS request_id;
  $$
);

-- Verification helpers:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'update-polymarket-cache-hourly';
-- SELECT *
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-polymarket-cache-hourly')
-- ORDER BY start_time DESC
-- LIMIT 20;
