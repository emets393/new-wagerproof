import { supabase } from './supabase';
import { invokeAgentAuthorizedAction } from './agentAuthorizedActions';
import {
  AgentPick,
  AgentGenerationRunSummary,
  PickResult,
  Sport,
  GeneratePicksResponse,
  OverlapAgentSummary,
  AgentPickOverlap,
} from '@/types/agent';
import { trackAgentTiming } from '@/services/agentPerformanceMetrics';

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface AgentPicksFilters {
  sport?: Sport;
  result?: PickResult;
}

export interface TopAgentPickFeedV2Row extends AgentPick {
  api_version: string;
  agent_name: string;
  agent_avatar_emoji: string;
  agent_avatar_color: string;
  agent_wins: number;
  agent_losses: number;
  agent_pushes: number;
  agent_net_units: number;
  agent_rank: number | null;
}

export interface AgentDetailSnapshotV2 {
  api_version: 'v2' | 'v3';
  agent: any;
  performance: any | null;
  todays_picks: AgentPick[];
  todays_generation_run: AgentGenerationRunSummary | null;
  can_view_agent_picks: boolean;
  is_following?: boolean;
}

export interface AgentPicksPageV2 {
  api_version: 'v2' | 'v3';
  picks: AgentPick[];
  next_cursor: string | null;
  has_more: boolean;
}

function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ============================================================================
// PICK OPERATIONS
// ============================================================================

/**
 * Fetch picks for an agent with optional filters
 */
export async function fetchAgentPicks(
  agentId: string,
  filters?: AgentPicksFilters
): Promise<AgentPick[]> {
  try {
    let query = supabase
      .from('avatar_picks')
      .select('*')
      .eq('avatar_id', agentId)
      .order('game_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply optional filters
    if (filters?.sport) {
      query = query.eq('sport', filters.sport);
    }

    if (filters?.result) {
      query = query.eq('result', filters.result);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agent picks:', error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} picks for agent ${agentId}`);
    return (data as AgentPick[]) || [];
  } catch (error) {
    console.error('Error in fetchAgentPicks:', error);
    throw error;
  }
}

/**
 * Fetch pending (ungraded) picks for an agent
 */
export async function fetchPendingPicks(agentId: string): Promise<AgentPick[]> {
  try {
    const page = await fetchAgentPicksPageV2(agentId, undefined, 'pending', 50, null, false);

    console.log(`Loaded ${page.picks.length || 0} pending picks for agent ${agentId}`);
    return page.picks;
  } catch (error) {
    console.error('Error in fetchPendingPicks:', error);
    throw error;
  }
}

/**
 * Fetch picks for today for an agent
 */
export async function fetchTodaysPicks(agentId: string): Promise<AgentPick[]> {
  try {
    const todayStr = getLocalDateString(new Date());
    const page = await fetchAgentPicksPageV2(agentId, undefined, 'all', 25, null, false, todayStr);

    console.log(`Loaded ${page.picks.length || 0} picks for today for agent ${agentId}`);
    return page.picks;
  } catch (error) {
    console.error('Error in fetchTodaysPicks:', error);
    throw error;
  }
}

/**
 * Fetch the latest successful generation run for today for an agent.
 * Used to distinguish "hasn't run yet" from "ran and found no picks".
 */
export async function fetchTodaysGenerationRun(agentId: string): Promise<AgentGenerationRunSummary | null> {
  try {
    const todayStr = getLocalDateString(new Date());

    const { data, error } = await supabase
      .from('agent_generation_runs')
      .select('id, avatar_id, generation_type, target_date, status, weak_slate, no_games, picks_generated, completed_at, created_at')
      .eq('avatar_id', agentId)
      .eq('target_date', todayStr)
      .eq('status', 'succeeded')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching today\'s generation run:', error);
      throw error;
    }

    return (data as AgentGenerationRunSummary | null) || null;
  } catch (error) {
    console.error('Error in fetchTodaysGenerationRun:', error);
    throw error;
  }
}

/**
 * Generate picks for an agent via V2 async queue.
 * Enqueues a generation job and polls for completion.
 */
export async function generatePicks(agentId: string, _isAdmin: boolean = false): Promise<GeneratePicksResponse> {
  try {
    console.log(`[V2] Requesting pick generation for agent ${agentId}...`);

    // Get current session (no refresh – avoids triggering onAuthStateChange)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const data = await invokeAgentAuthorizedAction<{
      success: boolean;
      run_id: string;
      status: string;
    }>(
      {
        action: 'request_generation',
        agent_id: agentId,
      },
      'Failed to request pick generation',
    );
    if (!data?.success) throw new Error('Failed to enqueue generation');

    const runId = data.run_id;
    if (!runId) throw new Error('No run_id returned from generation request');

    console.log(`[V2] Enqueued run ${runId}, polling for completion...`);

    // Poll for completion (worker processes asynchronously)
    const result = await pollGenerationRun(runId);

    console.log(`[V2] Run ${runId} completed: ${result.status}, picks: ${result.picksGenerated}`);
    return {
      picks: [],
      picks_generated: result.picksGenerated,
      slate_note: result.picksGenerated === 0
        ? result.noGames
          ? 'No games available for today.'
          : result.weakSlate
          ? 'This agent skipped today because the slate was too weak for its settings.'
          : 'No high-confidence picks met this agent\'s standards today.'
        : undefined,
    };
  } catch (error) {
    console.error('Error in generatePicks:', error);
    throw error;
  }
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_CONSECUTIVE_ERRORS = 5;

async function pollGenerationRun(runId: string): Promise<{ status: string; picksGenerated: number; weakSlate: boolean; noGames: boolean }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    const { data: run, error } = await (supabase as any)
      .from('agent_generation_runs')
      .select('status, picks_generated, error_message, weak_slate, no_games')
      .eq('id', runId)
      .single();

    if (error) {
      consecutiveErrors++;
      console.warn(`[V2 poll] Error (${consecutiveErrors}):`, error.message);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error('Unable to check generation status — please try again');
      }
    } else if (run) {
      consecutiveErrors = 0;
      if (run.status === 'succeeded') {
        return {
          status: 'succeeded',
          picksGenerated: run.picks_generated || 0,
          weakSlate: !!run.weak_slate,
          noGames: !!run.no_games,
        };
      }
      if (run.status === 'failed_terminal') {
        throw new Error(run.error_message || 'Pick generation failed permanently');
      }
      if (run.status === 'canceled') {
        throw new Error('Pick generation was canceled');
      }
      // Still processing: queued, leased, processing, failed_retryable
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Pick generation timed out — check back in a few minutes');
}

/**
 * Fetch a flat feed of upcoming picks (today + next 3 days) from multiple agents.
 * Sorted newest first. Used by the Top Agent Picks feed.
 */
export async function fetchTopAgentPicksFeed(
  agentIds: string[],
  limit: number = 50
): Promise<AgentPick[]> {
  try {
    if (agentIds.length === 0) {
      return [];
    }

    // Build date range: today through +3 days (local time)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 3);
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('avatar_picks')
      .select('*')
      .in('avatar_id', agentIds)
      .gte('game_date', todayStr)
      .lte('game_date', endStr)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top agent picks feed:', error);
      throw error;
    }

    console.log(`Feed: ${data?.length || 0} picks from ${agentIds.length} agents (${todayStr} to ${endStr})`);
    return (data as AgentPick[]) || [];
  } catch (error) {
    console.error('Error in fetchTopAgentPicksFeed:', error);
    throw error;
  }
}

export async function fetchTopAgentPicksFeedV2(
  filterMode: 'top10' | 'following' | 'favorites',
  viewerUserId?: string,
  searchText?: string,
  limit: number = 50,
  cursor?: string | null
): Promise<TopAgentPickFeedV2Row[]> {
  const startedAt = Date.now();
  const { data, error } = await (supabase as any).rpc('get_top_agent_picks_feed_v2', {
    p_filter_mode: filterMode,
    p_viewer_user_id: viewerUserId ?? null,
    p_search_text: searchText ?? null,
    p_limit: limit,
    p_cursor: cursor ?? null,
  });

  trackAgentTiming('top_picks_time_to_content_ms', Date.now() - startedAt, {
    source: 'v2',
    filter_mode: filterMode,
    limit,
    success: !error,
  });

  if (error) throw error;
  return ((data || []) as TopAgentPickFeedV2Row[]).map((row) => ({
    ...row,
    units: Number((row as any).units ?? 0),
  }));
}

export async function fetchAgentDetailSnapshotV2(
  agentId: string,
  _viewerUserId?: string
): Promise<AgentDetailSnapshotV2> {
  const startedAt = Date.now();
  const data = await invokeAgentAuthorizedAction<AgentDetailSnapshotV2>(
    {
      action: 'detail_snapshot',
      agent_id: agentId,
    },
    'Failed to load agent detail snapshot',
  );

  trackAgentTiming('agent_detail_time_to_content_ms', Date.now() - startedAt, {
    source: 'v3',
    success: true,
  });

  return (data || {
    api_version: 'v3',
    agent: null,
    performance: null,
    todays_picks: [],
    todays_generation_run: null,
    can_view_agent_picks: false,
  }) as AgentDetailSnapshotV2;
}

export async function fetchAgentPicksPageV2(
  agentId: string,
  _viewerUserId: string | undefined,
  filter: 'all' | 'won' | 'lost' | 'pending' | 'push' = 'all',
  pageSize: number = 20,
  cursor?: string | null,
  includeOverlap: boolean = false,
  gameDate?: string | null,
): Promise<AgentPicksPageV2> {
  const startedAt = Date.now();
  const data = await invokeAgentAuthorizedAction<AgentPicksPageV2>(
    {
      action: 'picks_page',
      agent_id: agentId,
      filter,
      page_size: pageSize,
      cursor: cursor ?? null,
      include_overlap: includeOverlap,
      game_date: gameDate ?? null,
    },
    'Failed to load agent picks',
  );

  trackAgentTiming('agent_history_page_load_ms', Date.now() - startedAt, {
    source: 'v3',
    filter,
    page_size: pageSize,
    include_overlap: includeOverlap,
    success: true,
  });

  const payload = (data || {}) as AgentPicksPageV2;
  return {
    api_version: payload.api_version || 'v3',
    picks: (payload.picks || []) as AgentPick[],
    next_cursor: payload.next_cursor || null,
    has_more: !!payload.has_more,
  };
}

/**
 * Enrich picks with overlap data from other public agents.
 * Best-effort: returns original picks on any failure.
 */
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

/**
 * Fetch picks for multiple agents (useful for comparison views)
 */
export async function fetchPicksForAgents(
  agentIds: string[],
  filters?: AgentPicksFilters
): Promise<Map<string, AgentPick[]>> {
  try {
    if (agentIds.length === 0) {
      return new Map();
    }

    let query = supabase
      .from('avatar_picks')
      .select('*')
      .in('avatar_id', agentIds)
      .order('game_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply optional filters
    if (filters?.sport) {
      query = query.eq('sport', filters.sport);
    }

    if (filters?.result) {
      query = query.eq('result', filters.result);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching picks for agents:', error);
      throw error;
    }

    // Group picks by agent ID
    const picksByAgent = new Map<string, AgentPick[]>();
    agentIds.forEach((id) => picksByAgent.set(id, []));

    if (data) {
      data.forEach((pick) => {
        const agentPicks = picksByAgent.get(pick.avatar_id) || [];
        agentPicks.push(pick as AgentPick);
        picksByAgent.set(pick.avatar_id, agentPicks);
      });
    }

    return picksByAgent;
  } catch (error) {
    console.error('Error in fetchPicksForAgents:', error);
    throw error;
  }
}
