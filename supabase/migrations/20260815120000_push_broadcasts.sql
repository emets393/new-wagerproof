-- =============================================================================
-- Admin push broadcasts: campaign table, per-user ledger, RPCs, cron.
-- Does NOT alter sent_push_notifications (run_id is NOT NULL + unique-on-null
-- would make every broadcast row unique against every other).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Preference + token columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS broadcast boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS apns_env text CHECK (apns_env IN ('sandbox', 'production'));

CREATE INDEX IF NOT EXISTS idx_push_tokens_platform_active
  ON public.user_push_tokens (platform, user_id)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 65),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  deep_link_route text NOT NULL DEFAULT 'feed'
    CHECK (deep_link_route IN ('feed', 'agents', 'outliers')),
  extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_platforms text[] NOT NULL DEFAULT ARRAY['ios', 'android']::text[]
    CHECK (
      target_platforms <@ ARRAY['ios', 'android']::text[]
      AND cardinality(target_platforms) >= 1
    ),
  target_subscription text NOT NULL DEFAULT 'all'
    CHECK (target_subscription IN ('all', 'pro', 'free')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'sent', 'canceled', 'failed')),
  scheduled_for timestamptz,
  recipients_total integer,
  last_test_at timestamptz,
  last_test_result jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_requires_time CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_push_broadcasts_due_scheduled
  ON public.push_broadcasts (scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_push_broadcasts_active
  ON public.push_broadcasts (status, updated_at DESC)
  WHERE status IN ('queued', 'sending', 'scheduled');

DROP TRIGGER IF EXISTS push_broadcasts_updated_at ON public.push_broadcasts;
CREATE TRIGGER push_broadcasts_updated_at
  BEFORE UPDATE ON public.push_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Ledger / work queue (one row per user per campaign)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.push_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'sent', 'skipped', 'failed', 'failed_retryable')),
  skip_reason text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  tokens_attempted integer NOT NULL DEFAULT 0,
  tokens_succeeded integer NOT NULL DEFAULT 0,
  tokens_failed integer NOT NULL DEFAULT 0,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_broadcast_recipients_claim
  ON public.push_broadcast_recipients (broadcast_id, status, next_attempt_at)
  WHERE status IN ('pending', 'failed_retryable');

CREATE INDEX IF NOT EXISTS idx_push_broadcast_recipients_lease
  ON public.push_broadcast_recipients (lease_expires_at)
  WHERE status = 'leased';

CREATE INDEX IF NOT EXISTS idx_push_broadcast_recipients_status
  ON public.push_broadcast_recipients (broadcast_id, status);

DROP TRIGGER IF EXISTS push_broadcast_recipients_updated_at ON public.push_broadcast_recipients;
CREATE TRIGGER push_broadcast_recipients_updated_at
  BEFORE UPDATE ON public.push_broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.push_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage push broadcasts" ON public.push_broadcasts;
CREATE POLICY "Admins manage push broadcasts"
  ON public.push_broadcasts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read push broadcast recipients" ON public.push_broadcast_recipients;
CREATE POLICY "Admins read push broadcast recipients"
  ON public.push_broadcast_recipients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Client updates cannot change status or mutate frozen campaigns. SECURITY
-- DEFINER RPCs run as the function owner, so current_user is not
-- 'authenticated' and they are allowed through.
CREATE OR REPLACE FUNCTION public.guard_push_broadcast_client_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.sent_by IS DISTINCT FROM OLD.sent_by
       OR NEW.recipients_total IS DISTINCT FROM OLD.recipients_total
       OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for THEN
      RAISE EXCEPTION 'push broadcast status transitions must go through RPCs'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.status <> 'draft' THEN
      IF NEW.title IS DISTINCT FROM OLD.title
         OR NEW.body IS DISTINCT FROM OLD.body
         OR NEW.deep_link_route IS DISTINCT FROM OLD.deep_link_route
         OR NEW.extra_data IS DISTINCT FROM OLD.extra_data
         OR NEW.target_platforms IS DISTINCT FROM OLD.target_platforms
         OR NEW.target_subscription IS DISTINCT FROM OLD.target_subscription THEN
        RAISE EXCEPTION 'push broadcast content is frozen once it leaves draft'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_push_broadcast_client_updates ON public.push_broadcasts;
CREATE TRIGGER guard_push_broadcast_client_updates
  BEFORE UPDATE ON public.push_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.guard_push_broadcast_client_updates();

-- ---------------------------------------------------------------------------
-- Audience helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_broadcast_require_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_broadcast_audience(
  p_platforms text[] DEFAULT NULL,
  p_subscription text DEFAULT 'all'
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT t.user_id
  FROM public.user_push_tokens t
  LEFT JOIN public.user_notification_preferences np ON np.user_id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.is_active
    AND (
      p_platforms IS NULL
      OR cardinality(p_platforms) = 0
      OR t.platform = ANY (p_platforms)
    )
    AND COALESCE(np.broadcast, true)
    AND (
      COALESCE(p_subscription, 'all') = 'all'
      OR (p_subscription = 'pro' AND COALESCE(p.subscription_active, false))
      OR (p_subscription = 'free' AND NOT COALESCE(p.subscription_active, false))
    );
$$;

CREATE OR REPLACE FUNCTION public.count_push_broadcast_audience(
  p_platforms text[] DEFAULT NULL,
  p_subscription text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public._push_broadcast_require_admin();

  SELECT jsonb_build_object(
    'users', COUNT(DISTINCT t.user_id) FILTER (
      WHERE COALESCE(np.broadcast, true)
        AND (
          p_platforms IS NULL
          OR cardinality(p_platforms) = 0
          OR t.platform = ANY (p_platforms)
        )
        AND (
          COALESCE(p_subscription, 'all') = 'all'
          OR (p_subscription = 'pro' AND COALESCE(p.subscription_active, false))
          OR (p_subscription = 'free' AND NOT COALESCE(p.subscription_active, false))
        )
    ),
    'ios_users', COUNT(DISTINCT t.user_id) FILTER (
      WHERE COALESCE(np.broadcast, true)
        AND t.platform = 'ios'
        AND (p_platforms IS NULL OR cardinality(p_platforms) = 0 OR 'ios' = ANY (p_platforms))
        AND (
          COALESCE(p_subscription, 'all') = 'all'
          OR (p_subscription = 'pro' AND COALESCE(p.subscription_active, false))
          OR (p_subscription = 'free' AND NOT COALESCE(p.subscription_active, false))
        )
    ),
    'android_users', COUNT(DISTINCT t.user_id) FILTER (
      WHERE COALESCE(np.broadcast, true)
        AND t.platform = 'android'
        AND (p_platforms IS NULL OR cardinality(p_platforms) = 0 OR 'android' = ANY (p_platforms))
        AND (
          COALESCE(p_subscription, 'all') = 'all'
          OR (p_subscription = 'pro' AND COALESCE(p.subscription_active, false))
          OR (p_subscription = 'free' AND NOT COALESCE(p.subscription_active, false))
        )
    ),
    'tokens', COUNT(*) FILTER (
      WHERE COALESCE(np.broadcast, true)
        AND (
          p_platforms IS NULL
          OR cardinality(p_platforms) = 0
          OR t.platform = ANY (p_platforms)
        )
        AND (
          COALESCE(p_subscription, 'all') = 'all'
          OR (p_subscription = 'pro' AND COALESCE(p.subscription_active, false))
          OR (p_subscription = 'free' AND NOT COALESCE(p.subscription_active, false))
        )
    ),
    'opted_out', COUNT(DISTINCT t.user_id) FILTER (WHERE np.broadcast IS FALSE)
  )
  INTO v_result
  FROM public.user_push_tokens t
  LEFT JOIN public.user_notification_preferences np ON np.user_id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.is_active;

  RETURN COALESCE(v_result, jsonb_build_object(
    'users', 0, 'ios_users', 0, 'android_users', 0, 'tokens', 0, 'opted_out', 0
  ));
END;
$$;

-- ---------------------------------------------------------------------------
-- Materialize / claim / reaper / finalize
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_push_broadcast_recipients(p_broadcast_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.push_broadcasts%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_campaign
  FROM public.push_broadcasts
  WHERE id = p_broadcast_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'broadcast not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_campaign.status NOT IN ('queued', 'sending') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.push_broadcast_recipients (broadcast_id, user_id, status)
  SELECT p_broadcast_id, a.user_id, 'pending'
  FROM public.push_broadcast_audience(v_campaign.target_platforms, v_campaign.target_subscription) a
  ON CONFLICT (broadcast_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE public.push_broadcasts
  SET
    recipients_total = (
      SELECT COUNT(*) FROM public.push_broadcast_recipients WHERE broadcast_id = p_broadcast_id
    ),
    status = 'sending'
  WHERE id = p_broadcast_id;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_push_broadcast_recipients(
  p_worker_id text,
  p_limit integer DEFAULT 200,
  p_lease_seconds integer DEFAULT 120,
  p_broadcast_id uuid DEFAULT NULL
)
RETURNS SETOF public.push_broadcast_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT r.id
    FROM public.push_broadcast_recipients r
    WHERE r.status IN ('pending', 'failed_retryable')
      AND r.next_attempt_at <= now()
      AND r.attempt_count < r.max_attempts
      AND (p_broadcast_id IS NULL OR r.broadcast_id = p_broadcast_id)
    ORDER BY r.next_attempt_at ASC, r.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_broadcast_recipients r
  SET
    status = 'leased',
    lease_owner = p_worker_id,
    lease_expires_at = now() + (GREATEST(30, LEAST(COALESCE(p_lease_seconds, 120), 600)) || ' seconds')::interval,
    attempt_count = r.attempt_count + 1,
    updated_at = now()
  FROM claimable c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_expired_push_broadcast_leases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.push_broadcast_recipients
  SET
    status = CASE
      WHEN attempt_count >= max_attempts THEN 'failed'
      ELSE 'failed_retryable'
    END,
    skip_reason = CASE
      WHEN attempt_count >= max_attempts THEN COALESCE(skip_reason, 'max_attempts')
      ELSE 'lease_expired'
    END,
    next_attempt_at = now() + make_interval(secs => LEAST(600, POWER(4, GREATEST(attempt_count, 1))::int)::double precision),
    lease_owner = NULL,
    lease_expires_at = NULL
  WHERE status = 'leased'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_push_broadcasts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.push_broadcasts b
  SET status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.push_broadcast_recipients r
      WHERE r.broadcast_id = b.id AND r.status = 'sent'
    ) AND EXISTS (
      SELECT 1 FROM public.push_broadcast_recipients r
      WHERE r.broadcast_id = b.id AND r.status = 'failed'
    ) THEN 'failed'
    ELSE 'sent'
  END
  WHERE b.status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_broadcast_recipients r
      WHERE r.broadcast_id = b.id
        AND r.status IN ('pending', 'leased', 'failed_retryable')
    )
    AND EXISTS (
      SELECT 1 FROM public.push_broadcast_recipients r
      WHERE r.broadcast_id = b.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.tick_push_broadcasts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted integer := 0;
  v_materialized integer := 0;
  v_requeued integer := 0;
  v_finalized integer := 0;
  v_row record;
  v_one integer;
BEGIN
  UPDATE public.push_broadcasts
  SET status = 'queued'
  WHERE status = 'scheduled'
    AND scheduled_for IS NOT NULL
    AND scheduled_for <= now();
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  FOR v_row IN
    SELECT id FROM public.push_broadcasts WHERE status = 'queued'
  LOOP
    v_one := public.materialize_push_broadcast_recipients(v_row.id);
    v_materialized := v_materialized + v_one;
  END LOOP;

  v_requeued := public.requeue_expired_push_broadcast_leases();
  v_finalized := public.finalize_push_broadcasts();

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'materialized', v_materialized,
    'requeued', v_requeued,
    'finalized', v_finalized
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin state transitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_push_broadcast_now(p_broadcast_id uuid)
RETURNS public.push_broadcasts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_row public.push_broadcasts;
BEGIN
  PERFORM public._push_broadcast_require_admin();

  UPDATE public.push_broadcasts
  SET
    status = 'queued',
    sent_by = auth.uid(),
    scheduled_for = NULL
  WHERE id = p_broadcast_id
    AND status IN ('draft', 'scheduled');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'broadcast is not sendable'
      USING ERRCODE = '55000';
  END IF;

  PERFORM public.materialize_push_broadcast_recipients(p_broadcast_id);

  SELECT * INTO v_row FROM public.push_broadcasts WHERE id = p_broadcast_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_push_broadcast(p_broadcast_id uuid, p_when timestamptz)
RETURNS public.push_broadcasts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.push_broadcasts;
  v_updated integer;
BEGIN
  PERFORM public._push_broadcast_require_admin();

  IF p_when IS NULL OR p_when <= now() THEN
    RAISE EXCEPTION 'scheduled time must be in the future'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.push_broadcasts
  SET
    status = 'scheduled',
    scheduled_for = p_when
  WHERE id = p_broadcast_id
    AND status IN ('draft', 'scheduled');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'broadcast is not schedulable'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_row FROM public.push_broadcasts WHERE id = p_broadcast_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_push_broadcast(p_broadcast_id uuid)
RETURNS public.push_broadcasts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.push_broadcasts;
  v_updated integer;
BEGIN
  PERFORM public._push_broadcast_require_admin();

  UPDATE public.push_broadcasts
  SET status = 'canceled'
  WHERE id = p_broadcast_id
    AND status IN ('draft', 'scheduled', 'queued', 'sending');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'broadcast cannot be canceled'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.push_broadcast_recipients
  SET
    status = 'skipped',
    skip_reason = 'canceled',
    lease_owner = NULL,
    lease_expires_at = NULL
  WHERE broadcast_id = p_broadcast_id
    AND status IN ('pending', 'leased', 'failed_retryable');

  SELECT * INTO v_row FROM public.push_broadcasts WHERE id = p_broadcast_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_push_broadcast_test(
  p_broadcast_id uuid,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._push_broadcast_require_admin();
  UPDATE public.push_broadcasts
  SET last_test_at = now(), last_test_result = p_result
  WHERE id = p_broadcast_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Status view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.push_broadcast_status_v
WITH (security_invoker = true) AS
SELECT
  b.id,
  b.title,
  b.body,
  b.deep_link_route,
  b.extra_data,
  b.target_platforms,
  b.target_subscription,
  b.status,
  b.scheduled_for,
  b.recipients_total,
  b.last_test_at,
  b.last_test_result,
  b.created_by,
  b.sent_by,
  b.created_at,
  b.updated_at,
  COALESCE(s.pending_count, 0) AS pending_count,
  COALESCE(s.leased_count, 0) AS leased_count,
  COALESCE(s.sent_count, 0) AS sent_count,
  COALESCE(s.skipped_count, 0) AS skipped_count,
  COALESCE(s.failed_count, 0) AS failed_count,
  COALESCE(s.retryable_count, 0) AS retryable_count,
  COALESCE(s.tokens_attempted, 0) AS tokens_attempted,
  COALESCE(s.tokens_succeeded, 0) AS tokens_succeeded,
  COALESCE(s.tokens_failed, 0) AS tokens_failed
FROM public.push_broadcasts b
LEFT JOIN (
  SELECT
    broadcast_id,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'leased') AS leased_count,
    COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
    COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    COUNT(*) FILTER (WHERE status = 'failed_retryable') AS retryable_count,
    COALESCE(SUM(tokens_attempted), 0) AS tokens_attempted,
    COALESCE(SUM(tokens_succeeded), 0) AS tokens_succeeded,
    COALESCE(SUM(tokens_failed), 0) AS tokens_failed
  FROM public.push_broadcast_recipients
  GROUP BY broadcast_id
) s ON s.broadcast_id = b.id;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_broadcasts TO authenticated;
GRANT SELECT ON public.push_broadcast_recipients TO authenticated;
GRANT SELECT ON public.push_broadcast_status_v TO authenticated;

GRANT EXECUTE ON FUNCTION public.count_push_broadcast_audience(text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_push_broadcast_now(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_push_broadcast(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_push_broadcast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_push_broadcast_test(uuid, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.push_broadcast_audience(text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_push_broadcast_recipients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_broadcast_recipients(text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_expired_push_broadcast_leases() TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_push_broadcasts() TO service_role;
GRANT EXECUTE ON FUNCTION public.tick_push_broadcasts() TO service_role;

-- send_now materializes via the user JWT path
GRANT EXECUTE ON FUNCTION public.materialize_push_broadcast_recipients(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cron: tick in SQL + drain the worker only when there is work
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('push-broadcast-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('push-broadcast-drain');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'push-broadcast-tick',
  '* * * * *',
  $$SELECT public.tick_push_broadcasts();$$
);

SELECT cron.schedule(
  'push-broadcast-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/process-push-broadcast',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM public._internal_config WHERE key = 'service_role_key'),
      'x-internal-secret', (SELECT value FROM public._internal_config WHERE key = 'internal_function_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('limit', 200),
    timeout_milliseconds := 60000
  ) AS request_id
  WHERE EXISTS (
    SELECT 1
    FROM public.push_broadcast_recipients
    WHERE status IN ('pending', 'failed_retryable', 'leased')
       OR (status = 'leased' AND lease_expires_at < now())
  );
  $$
);
