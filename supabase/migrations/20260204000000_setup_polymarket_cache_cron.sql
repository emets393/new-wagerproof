-- =========================================
-- Polymarket Cache CRON Job
-- Updates the polymarket_markets cache table every hour
-- =========================================

-- =========================================
-- Cron Job: Update Polymarket Cache (Hourly)
-- Runs at the top of every hour to keep cache fresh
-- =========================================
SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/update-polymarket-cache',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $$
);

-- =========================================
-- Comments for maintenance
-- =========================================
COMMENT ON COLUMN public.polymarket_markets.last_updated IS 'Last time this market data was refreshed by the hourly CRON job';

-- =========================================
-- Manual commands for managing this cron job:
-- =========================================
-- To list the job:
-- SELECT * FROM cron.job WHERE jobname = 'update-polymarket-cache-hourly';

-- To unschedule:
-- SELECT cron.unschedule('update-polymarket-cache-hourly');

-- To view recent runs:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'update-polymarket-cache-hourly')
-- ORDER BY start_time DESC LIMIT 20;
