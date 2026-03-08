-- =============================================================================
-- Phase 3: Backfill, Periodic Reconciliation, and Observability
-- =============================================================================

-- =============================================================================
-- 1. BATCH BACKFILL FUNCTION
-- Recalculates performance for all active avatars in batches.
-- Returns a summary of drift detected per avatar.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.backfill_avatar_performance(
  p_batch_size integer DEFAULT 50,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_avatar RECORD;
  v_old_net numeric;
  v_new_net numeric;
  v_processed integer := 0;
  v_drifted integer := 0;
  v_drift_details jsonb := '[]'::jsonb;
  v_batch_count integer := 0;
BEGIN
  FOR v_avatar IN
    SELECT ap.id as avatar_id
    FROM public.avatar_profiles ap
    WHERE ap.is_active = true
    ORDER BY ap.created_at ASC
  LOOP
    -- Capture before state
    SELECT COALESCE(net_units, 0) INTO v_old_net
    FROM public.avatar_performance_cache
    WHERE avatar_id = v_avatar.avatar_id;

    IF v_old_net IS NULL THEN
      v_old_net := 0;
    END IF;

    -- Recalculate
    IF NOT p_dry_run THEN
      PERFORM public.recalculate_avatar_performance(v_avatar.avatar_id);
    END IF;

    -- Capture after state
    SELECT COALESCE(net_units, 0) INTO v_new_net
    FROM public.avatar_performance_cache
    WHERE avatar_id = v_avatar.avatar_id;

    IF v_new_net IS NULL THEN
      v_new_net := 0;
    END IF;

    v_processed := v_processed + 1;

    -- Log drift if changed
    IF ABS(v_new_net - v_old_net) > 0.001 THEN
      v_drifted := v_drifted + 1;
      v_drift_details := v_drift_details || jsonb_build_object(
        'avatar_id', v_avatar.avatar_id,
        'old_net_units', v_old_net,
        'new_net_units', v_new_net,
        'drift', ROUND((v_new_net - v_old_net)::numeric, 2)
      );
    END IF;

    -- Batch pacing: after each batch, commit advisory lock release
    v_batch_count := v_batch_count + 1;
    IF v_batch_count >= p_batch_size THEN
      v_batch_count := 0;
      -- pg_sleep to avoid overwhelming the DB
      PERFORM pg_sleep(0.5);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'drifted', v_drifted,
    'dry_run', p_dry_run,
    'drift_details', v_drift_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.backfill_avatar_performance IS
  'Recalculates performance cache for all active avatars in batches. Returns drift report.';


-- =============================================================================
-- 2. PERIODIC RECONCILIATION FUNCTION
-- Lighter version: only recalculates avatars whose cache is stale
-- (last_calculated_at older than most recent pick grading).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_stale_avatar_performance(
  p_staleness_minutes integer DEFAULT 120
)
RETURNS jsonb AS $$
DECLARE
  v_avatar RECORD;
  v_reconciled integer := 0;
  v_drifted integer := 0;
  v_old_net numeric;
  v_new_net numeric;
  v_drift_details jsonb := '[]'::jsonb;
BEGIN
  -- Find avatars whose cache is potentially stale:
  -- They have picks graded more recently than their last cache calculation
  FOR v_avatar IN
    SELECT DISTINCT ap.avatar_id
    FROM public.avatar_picks ap
    JOIN public.avatar_performance_cache apc ON apc.avatar_id = ap.avatar_id
    WHERE ap.graded_at IS NOT NULL
      AND ap.graded_at > apc.last_calculated_at
    UNION
    -- Also include avatars with picks but NO cache entry
    SELECT DISTINCT ap2.avatar_id
    FROM public.avatar_picks ap2
    LEFT JOIN public.avatar_performance_cache apc2 ON apc2.avatar_id = ap2.avatar_id
    WHERE apc2.avatar_id IS NULL
      AND ap2.result IN ('won', 'lost', 'push')
  LOOP
    -- Capture before
    SELECT COALESCE(net_units, 0) INTO v_old_net
    FROM public.avatar_performance_cache
    WHERE avatar_id = v_avatar.avatar_id;
    v_old_net := COALESCE(v_old_net, 0);

    -- Recalculate
    PERFORM public.recalculate_avatar_performance(v_avatar.avatar_id);
    v_reconciled := v_reconciled + 1;

    -- Check drift
    SELECT COALESCE(net_units, 0) INTO v_new_net
    FROM public.avatar_performance_cache
    WHERE avatar_id = v_avatar.avatar_id;
    v_new_net := COALESCE(v_new_net, 0);

    IF ABS(v_new_net - v_old_net) > 0.001 THEN
      v_drifted := v_drifted + 1;
      v_drift_details := v_drift_details || jsonb_build_object(
        'avatar_id', v_avatar.avatar_id,
        'old_net_units', v_old_net,
        'new_net_units', v_new_net,
        'drift', ROUND((v_new_net - v_old_net)::numeric, 2)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'reconciled', v_reconciled,
    'drifted', v_drifted,
    'drift_details', v_drift_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reconcile_stale_avatar_performance IS
  'Recalculates performance only for avatars with stale caches. Returns drift report.';


-- =============================================================================
-- 3. OBSERVABILITY: Generation Pipeline Health View
-- Aggregates agent_generation_runs data for monitoring.
-- =============================================================================
CREATE OR REPLACE VIEW public.agent_generation_health AS
SELECT
  target_date,
  generation_type,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
  COUNT(*) FILTER (WHERE status = 'failed_terminal') as failed_terminal,
  COUNT(*) FILTER (WHERE status = 'failed_retryable') as failed_retryable,
  COUNT(*) FILTER (WHERE status IN ('queued', 'leased', 'processing')) as in_progress,
  COUNT(*) FILTER (WHERE status = 'canceled') as canceled,
  COUNT(*) FILTER (WHERE weak_slate = true) as weak_slates,
  COUNT(*) FILTER (WHERE no_games = true) as no_games,
  ROUND(AVG(picks_generated) FILTER (WHERE status = 'succeeded'), 1) as avg_picks_per_run,
  ROUND(SUM(estimated_cost_usd) FILTER (WHERE status = 'succeeded'), 4) as total_cost_usd,
  ROUND(AVG(input_tokens) FILTER (WHERE status = 'succeeded')) as avg_input_tokens,
  ROUND(AVG(output_tokens) FILTER (WHERE status = 'succeeded')) as avg_output_tokens,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'succeeded'), 1) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'succeeded') as max_duration_seconds
FROM public.agent_generation_runs
GROUP BY target_date, generation_type
ORDER BY target_date DESC, generation_type;

COMMENT ON VIEW public.agent_generation_health IS
  'Daily summary of agent generation pipeline health metrics.';


-- =============================================================================
-- 4. OBSERVABILITY: Error Distribution View
-- Shows most common error codes and messages.
-- =============================================================================
CREATE OR REPLACE VIEW public.agent_generation_errors AS
SELECT
  target_date,
  error_code,
  error_message,
  COUNT(*) as occurrences,
  array_agg(DISTINCT avatar_id::text) as affected_avatars
FROM public.agent_generation_runs
WHERE status IN ('failed_terminal', 'failed_retryable')
  AND error_code IS NOT NULL
  AND target_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY target_date, error_code, error_message
ORDER BY target_date DESC, occurrences DESC;

COMMENT ON VIEW public.agent_generation_errors IS
  'Error distribution for agent generation runs over the last 30 days.';


-- =============================================================================
-- 5. OBSERVABILITY: Grading Health View
-- Shows pick grading success rates and skip reasons.
-- =============================================================================
CREATE OR REPLACE VIEW public.agent_grading_health AS
SELECT
  game_date,
  sport,
  COUNT(*) as total_picks,
  COUNT(*) FILTER (WHERE result = 'won') as won,
  COUNT(*) FILTER (WHERE result = 'lost') as lost,
  COUNT(*) FILTER (WHERE result = 'push') as push,
  COUNT(*) FILTER (WHERE result = 'pending') as pending,
  COUNT(*) FILTER (WHERE grading_skip_reason IS NOT NULL) as skipped,
  jsonb_object_agg(
    COALESCE(grading_skip_reason, '_none'),
    skip_count
  ) FILTER (WHERE grading_skip_reason IS NOT NULL) as skip_reasons
FROM (
  SELECT
    game_date,
    sport,
    result,
    grading_skip_reason,
    COUNT(*) as skip_count
  FROM public.avatar_picks
  WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY game_date, sport, result, grading_skip_reason
) sub
GROUP BY game_date, sport
ORDER BY game_date DESC, sport;

COMMENT ON VIEW public.agent_grading_health IS
  'Daily grading health metrics by sport, including skip reason breakdown.';


-- =============================================================================
-- 6. OBSERVABILITY: Cache Staleness View
-- Shows avatars whose cache may be out of sync.
-- =============================================================================
CREATE OR REPLACE VIEW public.agent_cache_staleness AS
SELECT
  ap.avatar_id,
  prof.name as agent_name,
  prof.is_active,
  apc.last_calculated_at as cache_updated_at,
  MAX(ap.graded_at) as latest_grade_at,
  COUNT(*) FILTER (WHERE ap.result = 'pending') as pending_picks,
  COUNT(*) FILTER (WHERE ap.result IN ('won', 'lost', 'push')) as graded_picks,
  CASE
    WHEN apc.avatar_id IS NULL THEN 'no_cache'
    WHEN MAX(ap.graded_at) > apc.last_calculated_at THEN 'stale'
    ELSE 'fresh'
  END as cache_status
FROM public.avatar_picks ap
JOIN public.avatar_profiles prof ON prof.id = ap.avatar_id
LEFT JOIN public.avatar_performance_cache apc ON apc.avatar_id = ap.avatar_id
GROUP BY ap.avatar_id, prof.name, prof.is_active, apc.last_calculated_at, apc.avatar_id
HAVING
  -- Only show stale or missing caches
  apc.avatar_id IS NULL
  OR MAX(ap.graded_at) > apc.last_calculated_at
ORDER BY
  CASE WHEN apc.avatar_id IS NULL THEN 0 ELSE 1 END,
  MAX(ap.graded_at) DESC NULLS LAST;

COMMENT ON VIEW public.agent_cache_staleness IS
  'Shows agents with stale or missing performance caches.';


-- =============================================================================
-- 7. CRON JOB: Periodic Reconciliation
-- Runs daily at 3 AM ET (08:00 UTC) to catch any cache drift.
-- =============================================================================
SELECT cron.unschedule('reconcile-avatar-performance')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-avatar-performance');

SELECT cron.schedule(
  'reconcile-avatar-performance',
  '0 8 * * *',  -- 3 AM ET daily
  $$SELECT public.reconcile_stale_avatar_performance()$$
);
