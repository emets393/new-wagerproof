-- ============================================================================
-- Migration: RevenueCat-verified auto-generation enqueue
-- Description:
--   1. Adds a service-role-only helper to find due auto-generation candidate
--      users without relying on cached entitlement flags.
--   2. Moves the active enqueue cron job from direct SQL to an Edge Function
--      that verifies RevenueCat live, syncs the cache, then enqueues.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_due_auto_generation_candidate_users_v3(
  p_now timestamptz DEFAULT now(),
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH candidate_avatars AS (
    SELECT
      ap.user_id,
      ap.last_auto_generated_at,
      ap.id
    FROM public.avatar_profiles ap
    JOIN public.profiles p ON p.user_id = ap.user_id
    WHERE ap.auto_generate = true
      AND ap.is_active = true
      AND (ap.last_auto_generated_at IS NULL
           OR ap.last_auto_generated_at::date < (p_now AT TIME ZONE 'America/New_York')::date)
      AND ap.auto_generate_time <= (p_now AT TIME ZONE ap.auto_generate_timezone)::time
      AND p.last_seen_at > p_now - interval '5 days'
    ORDER BY
      ap.last_auto_generated_at ASC NULLS FIRST,
      ap.id ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)
  )
  SELECT DISTINCT candidate_avatars.user_id
  FROM candidate_avatars;
$$;

REVOKE ALL ON FUNCTION public.get_due_auto_generation_candidate_users_v3(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_auto_generation_candidate_users_v3(timestamptz, integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('v2-enqueue-auto-generation');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'v2-enqueue-auto-generation',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/enqueue-auto-generation-runs-v3',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('limit', 50),
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);
