-- ============================================================================
-- Agent Generation V2 — Cron Jobs
-- Phase E: Sets up the three cron jobs that drive V2's queue-based generation,
-- and disables the V1 daily auto-generate cron.
--
-- DEPLOYMENT PREREQUISITES:
--   1. Set INTERNAL_FUNCTION_SECRET as a Supabase Edge Function secret:
--        supabase secrets set INTERNAL_FUNCTION_SECRET=<random-secret>
--      Without this, the worker function will reject all dispatches with 500.
--
--   2. (Optional) Set the same value as a Postgres GUC for direct matching:
--        ALTER DATABASE postgres SET app.settings.internal_function_secret = '<same-secret>';
--      If not set, dispatch falls back to service role key for auth (still works).
--
--   3. Deploy the two new Edge Functions:
--        supabase functions deploy process-agent-generation-job-v2
--        supabase functions deploy request-avatar-picks-generation-v2
-- ============================================================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 1. Disable V1 auto-generate cron (keep the job for easy rollback)
-- ============================================================================
DO $$
BEGIN
  UPDATE cron.job
  SET active = false
  WHERE jobname = 'auto-generate-avatar-picks-daily';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'V1 auto-generate cron not found or already inactive: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. Cron Job: Enqueue eligible auto-generation runs (every 10 minutes)
--    Finds eligible avatars and inserts queued runs.
--    ON CONFLICT DO NOTHING prevents duplicate runs for the same avatar+date.
-- ============================================================================
DO $$
BEGIN
  -- Remove any existing version of this job
  PERFORM cron.unschedule('v2-enqueue-auto-generation');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'v2-enqueue-auto-generation',
  '*/10 * * * *',
  $$
  SELECT public.enqueue_due_auto_generation_runs_v2(
    now(),
    50
  );
  $$
);

-- ============================================================================
-- 3. Cron Job: Dispatch workers (every 1 minute)
--    Checks queue depth and fires pg_net HTTP POST to invoke V2 workers.
--    Max 5 concurrent dispatches per tick.
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('v2-dispatch-workers');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'v2-dispatch-workers',
  '* * * * *',
  $$
  SELECT public.dispatch_generation_workers_v2(5);
  $$
);

-- ============================================================================
-- 4. Cron Job: Recover expired leases (every 10 minutes)
--    Finds runs whose worker lease expired and either requeues them
--    (if attempts remain) or marks them failed_terminal.
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('v2-recover-expired-leases');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'v2-recover-expired-leases',
  '*/10 * * * *',
  $$
  SELECT public.requeue_expired_generation_leases_v2();
  $$
);

-- ============================================================================
-- Rollback instructions (run manually if V2 needs to be disabled):
-- ============================================================================
-- DO $$
-- BEGIN
--   -- Re-enable V1
--   UPDATE cron.job SET active = true WHERE jobname = 'auto-generate-avatar-picks-daily';
--   -- Disable V2
--   UPDATE cron.job SET active = false WHERE jobname = 'v2-enqueue-auto-generation';
--   UPDATE cron.job SET active = false WHERE jobname = 'v2-dispatch-workers';
--   UPDATE cron.job SET active = false WHERE jobname = 'v2-recover-expired-leases';
-- END $$;
