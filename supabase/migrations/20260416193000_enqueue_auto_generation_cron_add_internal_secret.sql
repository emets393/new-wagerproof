-- ============================================================================
-- Migration: Send x-internal-secret on v2-enqueue-auto-generation cron
-- Description:
--   The pg_net HTTP Bearer-only call to `enqueue-auto-generation-runs-v3`
--   fails auth in some edge-runtime configurations where the runtime's
--   `SUPABASE_SERVICE_ROLE_KEY` env does not match the project JWT stored in
--   `_internal_config.service_role_key`. Mirror the pattern already used by
--   internal workers: include the `x-internal-secret` header sourced from
--   `_internal_config.internal_function_secret`. The edge function accepts
--   either form, so this is a no-op when both match and a correctness fix
--   when they do not.
-- ============================================================================

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
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/enqueue-auto-generation-runs-v3',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM public._internal_config WHERE key = 'service_role_key'),
      'x-internal-secret', (SELECT value FROM public._internal_config WHERE key = 'internal_function_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('limit', 50),
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);
