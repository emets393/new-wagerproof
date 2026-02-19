-- ============================================================================
-- Recreate cron jobs without app.settings.supabase_url dependency.
-- Fixes runtime errors:
--   ERROR: unrecognized configuration parameter "app.settings.supabase_url"
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  -- Best-effort cleanup of known job names.
  BEGIN PERFORM cron.unschedule('check-missing-completions-morning'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('check-missing-completions-evening'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('value-finds-scheduler-master'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('send-reactivation-events-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('auto-generate-avatar-picks-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('update-polymarket-cache-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Check missing completions (morning)
SELECT cron.schedule(
  'check-missing-completions-morning',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/check-missing-completions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Check missing completions (evening)
SELECT cron.schedule(
  'check-missing-completions-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/check-missing-completions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Value-finds scheduler master (hourly)
SELECT cron.schedule(
  'value-finds-scheduler-master',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/run-scheduled-value-finds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Reactivation emails (daily)
SELECT cron.schedule(
  'send-reactivation-events-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/send-reactivation-events',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('batch_size', 10)
  ) AS request_id;
  $$
);

-- Auto-generate avatar picks (daily)
SELECT cron.schedule(
  'auto-generate-avatar-picks-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/auto-generate-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- Grade avatar picks (daily)
SELECT cron.schedule(
  'grade-avatar-picks-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/grade-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- Polymarket cache update (hourly)
SELECT cron.schedule(
  'update-polymarket-cache-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/update-polymarket-cache',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'apikey', coalesce(current_setting('app.settings.supabase_service_role_key', true), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) AS request_id;
  $$
);
