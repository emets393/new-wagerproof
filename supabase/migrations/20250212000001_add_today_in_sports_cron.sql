-- Add cron job to generate Today in Sports completion at 10 AM CST
-- 10 AM CST = 4 PM UTC (Standard Time) or 3 PM UTC (Daylight Time)
-- Using 3 PM UTC to cover DST period (most of the year)

SELECT cron.schedule(
  'generate-today-in-sports-daily',
  '0 15 * * *', -- 3 PM UTC = 10 AM CDT (Daylight Time)
  $$ 
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-today-in-sports-completion',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Today in Sports completion generates daily at 10 AM CST and sends to Discord';

