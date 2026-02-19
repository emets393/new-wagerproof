-- ============================================================================
-- Migration: Setup CRON Jobs for Avatar Picks
-- Description: Schedules automatic pick generation and grading for AI agents
-- ============================================================================

-- Note: pg_cron should already be enabled in Supabase. If not:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Add is_auto_generated column to avatar_picks
-- Tracks whether a pick was auto-generated vs manually triggered
-- ============================================================================
ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false;

-- ============================================================================
-- CRON Job 1: Auto-Generate Avatar Picks (Morning - 9am ET / 14:00 UTC)
-- Generates daily picks for eligible avatars before most games start
-- ============================================================================
SELECT cron.schedule(
  'auto-generate-avatar-picks-morning',
  '0 14 * * *',  -- 9am ET = 14:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-generate-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- CRON Job 2: Auto-Generate Avatar Picks (Evening - 6pm ET / 23:00 UTC)
-- Catch-up generation for evening game slates
-- ============================================================================
SELECT cron.schedule(
  'auto-generate-avatar-picks-evening',
  '0 23 * * *',  -- 6pm ET = 23:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-generate-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- CRON Job 3: Grade Avatar Picks (Overnight - 10pm-2am ET / 03:00-07:00 UTC)
-- Grades picks hourly during the window when most games complete
-- Runs at 3am, 4am, 5am, 6am, 7am UTC (10pm, 11pm, 12am, 1am, 2am ET)
-- ============================================================================
SELECT cron.schedule(
  'grade-avatar-picks-overnight-03',
  '0 3 * * *',  -- 10pm ET = 03:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'grade-avatar-picks-overnight-04',
  '0 4 * * *',  -- 11pm ET = 04:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'grade-avatar-picks-overnight-05',
  '0 5 * * *',  -- 12am ET = 05:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'grade-avatar-picks-overnight-06',
  '0 6 * * *',  -- 1am ET = 06:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'grade-avatar-picks-overnight-07',
  '0 7 * * *',  -- 2am ET = 07:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- CRON Job 4: Grade Avatar Picks (Afternoon - 2pm ET / 19:00 UTC)
-- Catches day games that finish before evening slate
-- ============================================================================
SELECT cron.schedule(
  'grade-avatar-picks-afternoon',
  '0 19 * * *',  -- 2pm ET = 19:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/grade-avatar-picks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- CRON Log Table Extension
-- Add avatar-specific job types for tracking
-- ============================================================================
-- Note: ai_cron_logs table already exists from previous migration
-- This adds comments for the new job types

COMMENT ON TABLE public.ai_cron_logs IS 'Tracks cron job execution history including AI completions, avatar pick generation, and grading';

-- ============================================================================
-- Helpful Commands for Managing These Jobs
-- ============================================================================

-- To list all avatar-related cron jobs:
-- SELECT * FROM cron.job WHERE jobname LIKE '%avatar%';

-- To unschedule a specific job:
-- SELECT cron.unschedule('auto-generate-avatar-picks-morning');
-- SELECT cron.unschedule('auto-generate-avatar-picks-evening');
-- SELECT cron.unschedule('grade-avatar-picks-overnight-03');
-- SELECT cron.unschedule('grade-avatar-picks-overnight-04');
-- SELECT cron.unschedule('grade-avatar-picks-overnight-05');
-- SELECT cron.unschedule('grade-avatar-picks-overnight-06');
-- SELECT cron.unschedule('grade-avatar-picks-overnight-07');
-- SELECT cron.unschedule('grade-avatar-picks-afternoon');

-- To view recent cron job runs:
-- SELECT * FROM cron.job_run_details
-- WHERE jobname LIKE '%avatar%'
-- ORDER BY start_time DESC
-- LIMIT 20;

-- To manually trigger a job for testing:
-- SELECT net.http_post(
--   url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-generate-avatar-picks',
--   headers := jsonb_build_object(
--     'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
--     'Content-Type', 'application/json'
--   ),
--   body := '{}'::jsonb
-- );
