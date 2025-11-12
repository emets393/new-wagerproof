-- Set default auto_publish to false for existing records
UPDATE ai_page_level_schedules 
SET auto_publish = false 
WHERE auto_publish IS NULL;

-- Create a master cron job that runs every hour to check schedules
-- This job will call the run-scheduled-value-finds function
-- Note: This assumes app.settings are configured with Supabase URL and service key

-- First, check if the master cron job exists and remove it if it does
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'value-finds-scheduler-master';
  
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule('value-finds-scheduler-master');
  END IF;
END $$;

-- Create the master scheduler cron job (runs every hour)
-- This will check all enabled schedules and run generation if it's time
SELECT cron.schedule(
  'value-finds-scheduler-master',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-scheduled-value-finds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Value Finds scheduler runs hourly to check and execute scheduled generations';

