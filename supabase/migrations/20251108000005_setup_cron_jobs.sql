-- Enable pg_cron extension (should already be enabled by default in Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================================
-- Cron Job 1: Check for missing completions (Morning)
-- Runs at 8:00 AM daily
-- =========================================
SELECT cron.schedule(
  'check-missing-completions-morning',
  '0 8 * * *', -- 8 AM daily
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-missing-completions',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- =========================================
-- Cron Job 2: Check for missing completions (Evening)
-- Runs at 6:00 PM daily
-- =========================================
SELECT cron.schedule(
  'check-missing-completions-evening',
  '0 18 * * *', -- 6 PM daily
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-missing-completions',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- =========================================
-- Create a table to track cron job runs
-- =========================================
CREATE TABLE IF NOT EXISTS ai_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'started')),
  details JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_cron_logs_job_name ON ai_cron_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_ai_cron_logs_run_at ON ai_cron_logs(run_at DESC);

-- Enable RLS
ALTER TABLE ai_cron_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view logs
CREATE POLICY "Admins can view cron logs"
ON ai_cron_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
);

-- =========================================
-- Comments for maintenance
-- =========================================
COMMENT ON TABLE ai_cron_logs IS 'Tracks AI cron job execution history';

-- =========================================
-- Manual commands for managing cron jobs:
-- =========================================
-- To list all cron jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('check-missing-completions-morning');
-- SELECT cron.unschedule('check-missing-completions-evening');

-- To view cron job history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To manually run a job:
-- SELECT cron.schedule('test-job', '* * * * *', $$ SELECT 1 $$);

