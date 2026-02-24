-- ============================================================================
-- Expand grade-avatar-picks cron windows
-- Why:
--   A single 07:00 UTC run (2:00 AM ET) misses many late NBA/NCAAB finals.
--   This migration adds multiple grading passes to reduce daily skipped backlog.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  -- Remove any known grade-avatar-picks schedules before re-creating.
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-early'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-mid'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-late'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('grade-avatar-picks-afternoon'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 02:00 AM ET (07:00 UTC) - initial pass.
SELECT cron.schedule(
  'grade-avatar-picks-early',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/grade-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- 04:00 AM ET (09:00 UTC) - catches late finishes.
SELECT cron.schedule(
  'grade-avatar-picks-mid',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/grade-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- 06:00 AM ET (11:00 UTC) - final overnight pass.
SELECT cron.schedule(
  'grade-avatar-picks-late',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/grade-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- 01:00 PM ET (18:00 UTC) - same-day cleanup for delayed stat/result ingestion.
SELECT cron.schedule(
  'grade-avatar-picks-afternoon',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/grade-avatar-picks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- Verification helpers:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'grade-avatar-picks%';
-- SELECT * FROM cron.job_run_details WHERE jobid IN (
--   SELECT jobid FROM cron.job WHERE jobname LIKE 'grade-avatar-picks%'
-- ) ORDER BY start_time DESC LIMIT 30;
