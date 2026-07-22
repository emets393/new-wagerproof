import { supabase } from '@/integrations/supabase/client';
import { AgentParlay, AgentPick, PickResult, Sport, GeneratePicksResponse, OverlapAgentSummary, AgentPickOverlap } from '@/types/agent';
import type { AgentGenerationProgress } from '@/components/agents/split/generationState';

export interface AgentPicksFilters {
  sport?: Sport;
  result?: PickResult;
}

export type TopAgentPicksFilter = 'top10' | 'following' | 'favorites';

export interface TopAgentPickFeedRow extends AgentPick {
  api_version: string;
  agent_name: string;
  agent_avatar_emoji: string;
  agent_avatar_color: string;
  agent_wins: number;
  agent_losses: number;
  agent_pushes: number;
  agent_net_units: number;
  agent_rank: number | null;
  agent_current_streak?: number;
}

export async function fetchTopAgentPicksFeed(
  filterMode: TopAgentPicksFilter,
  viewerUserId?: string,
  searchText?: string,
): Promise<TopAgentPickFeedRow[]> {
  const { data, error } = await (supabase as any).rpc('get_top_agent_picks_feed_v2', {
    p_filter_mode: filterMode,
    p_viewer_user_id: viewerUserId ?? null,
    p_search_text: searchText?.trim() || null,
    p_limit: 50,
    p_cursor: null,
  });
  if (error) throw error;
  return ((data ?? []) as TopAgentPickFeedRow[]).map((row) => ({
    ...row,
    units: Number(row.units ?? 0),
    agent_net_units: Number(row.agent_net_units ?? 0),
  }));
}

export async function fetchAgentPicks(agentId: string, filters?: AgentPicksFilters): Promise<AgentPick[]> {
  let query = (supabase as any)
    .from('avatar_picks')
    .select('*')
    .eq('avatar_id', agentId)
    .order('game_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.sport) query = query.eq('sport', filters.sport);
  if (filters?.result) query = query.eq('result', filters.result);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AgentPick[];
}

/**
 * Parlay tickets live in avatar_parlays (+ legs), NOT avatar_picks — parlay
 * agents' history is invisible without this. RLS allows owner + public-agent
 * reads; legs come back embedded via the parlay_id FK.
 */
export async function fetchAgentParlays(agentId: string, filters?: AgentPicksFilters): Promise<AgentParlay[]> {
  let query = (supabase as any)
    .from('avatar_parlays')
    .select('*, legs:avatar_parlay_legs(*)')
    .eq('avatar_id', agentId)
    .order('created_at', { ascending: false });

  if (filters?.sport) query = query.eq('sport', filters.sport);
  if (filters?.result) query = query.eq('result', filters.result);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AgentParlay[];
}

interface TriggerRunStatus {
  status: string;
  metadata?: AgentGenerationProgress;
}

interface TriggerV3Response {
  ledger_run_id?: string;
  run_id?: string;
  status?: string;
  error?: string;
}

export async function generatePicks(
  agentId: string,
  _isAdmin = false,
  onProgress?: (progress: AgentGenerationProgress) => void,
): Promise<GeneratePicksResponse> {
  // Get current session (no refresh – avoids triggering onAuthStateChange)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // Match iOS: enter through the Trigger.dev-backed V3 gateway.
  const { data, error } = await (supabase as any).functions.invoke(
    'trigger-v3-run',
    { body: { avatar_id: agentId } },
  );

  if (error) {
    // Extract actual error body from FunctionsHttpError context
    let detail = '';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        detail = body?.error || body?.message || '';
      }
    } catch (_e) { /* ignore parse failure */ }
    throw new Error(detail || error.message || 'Failed to request pick generation');
  }
  const request = data as TriggerV3Response | null;
  if (!request?.run_id || !request.ledger_run_id) {
    throw new Error(request?.error || 'V3 generation did not return a run');
  }

  const result = await pollTriggerV3Run(request.run_id, request.ledger_run_id, onProgress);
  return {
    picks: [],
    picks_generated: result.picksGenerated,
    slate_note: result.picksGenerated === 0 ? 'No games available for today' : undefined,
  };
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 660_000; // Trigger task ceiling is 10 minutes; match iOS headroom.
const MAX_CONSECUTIVE_ERRORS = 5;

const TRIGGER_TERMINAL = new Set([
  'COMPLETED', 'CANCELED', 'FAILED', 'CRASHED', 'INTERRUPTED', 'EXPIRED', 'TIMED_OUT', 'SYSTEM_FAILURE',
]);

async function pollTriggerV3Run(
  triggerRunId: string,
  ledgerRunId: string,
  onProgress?: (progress: AgentGenerationProgress) => void,
): Promise<{ status: string; picksGenerated: number }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    const { data: trigger, error: triggerError } = await (supabase as any).functions.invoke(
      'trigger-run-status',
      { body: { run_id: triggerRunId } },
    );

    if (triggerError) {
      consecutiveErrors++;
      console.warn(`[generatePicks:v3] Poll error (${consecutiveErrors}):`, triggerError.message);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error('Unable to check generation status — please try again');
      }
    } else if (trigger) {
      consecutiveErrors = 0;
      const run = trigger as TriggerRunStatus;
      onProgress?.(run.metadata ?? {});
      const triggerStatus = run.status.toUpperCase();
      if (TRIGGER_TERMINAL.has(triggerStatus)) {
        const { data: ledger } = await (supabase as any)
          .from('agent_generation_runs')
          .select('status, picks_generated, error_message, slate_note')
          .eq('id', ledgerRunId)
          .single();
        if (triggerStatus === 'COMPLETED') {
          return { status: 'succeeded', picksGenerated: ledger?.picks_generated || run.metadata?.picksAccepted || 0 };
        }
        throw new Error(ledger?.error_message || `Pick generation ${triggerStatus.toLowerCase().replace('_', ' ')}`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Pick generation timed out — check back in a few minutes');
}

export async function enrichPicksWithOverlap(picks: AgentPick[]): Promise<AgentPick[]> {
  if (picks.length === 0) return picks;

  try {
    const pickIds = picks.map((p) => p.id);
    const { data, error } = await (supabase as any).rpc('get_agent_pick_overlap_batch', {
      p_pick_ids: pickIds,
    });

    if (error) {
      console.warn('enrichPicksWithOverlap: RPC failed, returning picks without overlap', error.message);
      return picks;
    }

    const overlapMap = new Map<string, OverlapAgentSummary[]>();
    for (const row of data || []) {
      const list = overlapMap.get(row.source_pick_id) || [];
      list.push({
        avatar_id: row.overlap_avatar_id,
        name: row.avatar_name,
        avatar_emoji: row.avatar_emoji || '\u{1F916}',
        avatar_color: row.avatar_color || '#6366f1',
      });
      overlapMap.set(row.source_pick_id, list);
    }

    return picks.map((pick) => {
      const agents = overlapMap.get(pick.id) || [];
      return {
        ...pick,
        overlap: { totalCount: agents.length, agents } as AgentPickOverlap,
      };
    });
  } catch (err) {
    console.warn('enrichPicksWithOverlap: unexpected error, returning picks without overlap', err);
    return picks;
  }
}
