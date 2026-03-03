-- ============================================================================
-- Migration: Fix dispatch_generation_workers_v2 auth for pg_cron context
--
-- Problem: The dispatch function used current_setting('app.settings.*') GUCs
-- which are not available in pg_cron's execution context, causing pg_net
-- requests to be sent with empty Authorization headers.
--
-- Fix: Use a private config table to store the service role key, readable
-- only by SECURITY DEFINER functions (not exposed via PostgREST).
-- ============================================================================

-- 1. Create private config table (not in API schemas, invisible to PostgREST)
CREATE TABLE IF NOT EXISTS public._internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Restrict access: only postgres/superuser and SECURITY DEFINER functions
REVOKE ALL ON public._internal_config FROM anon, authenticated;

-- 2. Upsert service role key
INSERT INTO public._internal_config (key, value)
VALUES ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTQwMzM5MywiZXhwIjoyMDY0OTc5MzkzfQ.RGi1Br_luWhexvBJJC1AaMSEMHJGl9Li_NUlwiUshsA')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Replace dispatch function to read from config table
CREATE OR REPLACE FUNCTION public.dispatch_generation_workers_v2(
  p_max_dispatches integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_depth integer;
  v_dispatches integer;
  v_i integer;
  v_url text;
  v_service_key text;
BEGIN
  -- Check how many runs are ready
  SELECT COUNT(*)
  INTO v_queue_depth
  FROM public.agent_generation_runs
  WHERE status IN ('queued', 'failed_retryable')
    AND next_attempt_at <= now()
    AND attempt_count < max_attempts;

  IF v_queue_depth = 0 THEN
    RETURN 0;
  END IF;

  v_dispatches := LEAST(v_queue_depth, p_max_dispatches);

  -- Read service role key from config table (accessible in all contexts)
  SELECT value INTO v_service_key
  FROM public._internal_config
  WHERE key = 'service_role_key';

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING '[dispatch_v2] service_role_key not found in _internal_config';
    RETURN 0;
  END IF;

  v_url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co';

  FOR v_i IN 1..v_dispatches LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/process-agent-generation-job-v2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  END LOOP;

  RETURN v_dispatches;
END;
$$;
