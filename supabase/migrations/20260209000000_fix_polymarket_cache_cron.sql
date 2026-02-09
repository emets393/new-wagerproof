-- =========================================
-- Fix Polymarket Cache CRON Job
-- Re-registers the cron job to ensure it's active
-- =========================================

-- Step 1: Remove existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('update-polymarket-cache-hourly');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job update-polymarket-cache-hourly did not exist, creating fresh';
END $$;

-- Step 2: Re-register the cron job (every 2 hours during US daytime)
-- Runs at 13, 15, 17, 19, 21, 23, 01, 03, 05 UTC = 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm, 12am ET
-- Covers 8am ET through 12am ET (midnight) to span all US time zones
SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 13,15,17,19,21,23,1,3,5 * * *', -- Every 2 hours, 8am-12am ET
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
