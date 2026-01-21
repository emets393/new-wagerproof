-- Reactivation Email Cron Job
-- Runs daily at 2pm UTC to send reactivation events to Loops.so for inactive users

-- =========================================
-- Cron Job: Send reactivation events daily
-- Runs at 2:00 PM UTC (14:00)
-- =========================================
SELECT cron.schedule(
  'send-reactivation-events-daily',
  '0 14 * * *', -- 2pm UTC daily
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-reactivation-events',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'batch_size', 150
      )
    ) as request_id;
  $$
);

-- =========================================
-- Manual commands for managing this cron job:
-- =========================================
-- To list all cron jobs:
-- SELECT * FROM cron.job;

-- To view this specific job:
-- SELECT * FROM cron.job WHERE jobname = 'send-reactivation-events-daily';

-- To unschedule/disable this job:
-- SELECT cron.unschedule('send-reactivation-events-daily');

-- To re-enable with different schedule (e.g., 3pm UTC):
-- SELECT cron.schedule(
--   'send-reactivation-events-daily',
--   '0 15 * * *',
--   $$ ... same body ... $$
-- );

-- To manually trigger the job:
-- SELECT
--   net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/send-reactivation-events',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := jsonb_build_object('batch_size', 5)
--   );

-- To view cron job execution history:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-reactivation-events-daily')
-- ORDER BY start_time DESC LIMIT 10;

-- To view reactivation email logs:
-- SELECT * FROM reactivation_email_logs ORDER BY run_at DESC LIMIT 10;
