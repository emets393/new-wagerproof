-- =========================================
-- Update Polymarket Cache CRON to US daytime hours only
-- Runs every 2 hours from 8am ET to 12am ET (midnight)
-- UTC hours: 13, 15, 17, 19, 21, 23, 1, 3, 5
-- =========================================

-- Remove existing job
DO $$
BEGIN
  PERFORM cron.unschedule('update-polymarket-cache-hourly');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job did not exist';
END $$;

-- Re-register with US daytime schedule
-- 8am ET = 13 UTC, 10am = 15, 12pm = 17, 2pm = 19, 4pm = 21, 6pm = 23, 8pm = 01, 10pm = 03, 12am = 05
SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 1,3,5,13,15,17,19,21,23 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/update-polymarket-cache',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $$
);
