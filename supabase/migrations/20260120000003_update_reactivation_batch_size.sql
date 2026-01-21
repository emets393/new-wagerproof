-- Update reactivation email cron job to use batch_size of 10

-- Remove the existing job
SELECT cron.unschedule('send-reactivation-events-daily');

-- Recreate with smaller batch size
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
        'batch_size', 10
      )
    ) as request_id;
  $$
);
