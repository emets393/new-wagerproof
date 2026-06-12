-- ============================================================================
-- Agent Generation V3 — Observability views (all scoped engine_version='v3').
-- Additive; no impact on V2. Used to validate the steering mapping (are
-- archetypes actually using different tools?), watch fallback/livelock rates,
-- and keep cost inside the breaker budget. See plan §"Cost / safety / observability".
-- ============================================================================

-- Per-avatar health: run outcomes, fallback rate, livelock signal (avg turns
-- vs accepted picks), cost + token rollup. fallback_rate too high => loop is
-- exiting unclean; investigate the steering/grounding for that avatar.
CREATE OR REPLACE VIEW public.agent_generation_health_v3 AS
SELECT
  r.avatar_id,
  COUNT(*)                                                            AS total_runs,
  COUNT(*) FILTER (WHERE r.status = 'succeeded')                      AS succeeded,
  COUNT(*) FILTER (WHERE r.status = 'failed_retryable')               AS failed_retryable,
  COUNT(*) FILTER (WHERE r.status = 'failed_terminal')                AS failed_terminal,
  COUNT(*) FILTER (WHERE r.v3_engine_used = 'v2_fallback')            AS fallbacks,
  COUNT(*) FILTER (WHERE r.v3_circuit_tripped IS NOT NULL)            AS circuit_trips,
  ROUND(
    COUNT(*) FILTER (WHERE r.v3_engine_used = 'v2_fallback')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.status = 'succeeded'), 0), 3)   AS fallback_rate,
  ROUND(AVG(r.v3_turn_count), 2)                                      AS avg_turns,
  ROUND(AVG(r.v3_tool_call_count), 2)                                 AS avg_tool_calls,
  ROUND(AVG(r.v3_deep_fetch_count), 2)                                AS avg_deep_fetches,
  ROUND(AVG(r.picks_generated), 2)                                    AS avg_picks,
  SUM(COALESCE(r.estimated_cost_usd, 0))                             AS total_cost_usd,
  MAX(r.created_at)                                                   AS last_run_at
FROM public.agent_generation_runs r
WHERE r.engine_version = 'v3'
GROUP BY r.avatar_id;

-- Daily cost breakdown — compare against v3_circuit_state.daily_spend_cap_usd.
CREATE OR REPLACE VIEW public.agent_v3_cost_breakdown AS
SELECT
  r.target_date,
  COUNT(*)                                  AS runs,
  SUM(COALESCE(r.input_tokens, 0))          AS input_tokens,
  SUM(COALESCE(r.output_tokens, 0))         AS output_tokens,
  SUM(COALESCE(r.estimated_cost_usd, 0))    AS total_cost_usd,
  ROUND(AVG(COALESCE(r.estimated_cost_usd, 0)), 6) AS avg_cost_per_run_usd
FROM public.agent_generation_runs r
WHERE r.engine_version = 'v3'
GROUP BY r.target_date
ORDER BY r.target_date DESC;

-- Tool usage from the run-level trace — validates that the personality→tool
-- steering actually differentiates agents (not every agent calling every tool).
CREATE OR REPLACE VIEW public.agent_v3_tool_usage AS
SELECT
  t.value ->> 'name'                                       AS tool_name,
  COUNT(*)                                                 AS call_count,
  COUNT(DISTINCT r.avatar_id)                              AS distinct_avatars,
  COUNT(*) FILTER (WHERE (t.value ->> 'ok')::boolean IS FALSE) AS error_calls,
  ROUND(AVG((t.value ->> 'ms')::numeric), 1)               AS avg_ms
FROM public.agent_generation_runs r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.v3_tool_trace, '[]'::jsonb)) AS t(value)
WHERE r.engine_version = 'v3'
  AND jsonb_typeof(r.v3_tool_trace) = 'array'
GROUP BY t.value ->> 'name'
ORDER BY call_count DESC;
