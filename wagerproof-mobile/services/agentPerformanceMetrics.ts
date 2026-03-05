import { trackEvent } from '@/services/analytics';

export type AgentTimingMetric =
  | 'leaderboard_time_to_content_ms'
  | 'top_picks_time_to_content_ms'
  | 'agent_detail_time_to_content_ms'
  | 'agent_history_page_load_ms';

export function trackAgentTiming(
  metric: AgentTimingMetric,
  durationMs: number,
  props?: Record<string, unknown>,
) {
  trackEvent('Agent Performance Timing', {
    metric,
    duration_ms: Math.max(0, Math.round(durationMs)),
    ...props,
  });
}

export function trackAgentParity(
  path: 'leaderboard' | 'top_picks' | 'agent_detail',
  mismatchType: string,
  props?: Record<string, unknown>,
) {
  trackEvent('Agent V2 Shadow Mismatch', {
    path,
    mismatch_type: mismatchType,
    ...props,
  });
}
