import { supabase } from './supabase';
import {
  AgentPick,
  PickResult,
  Sport,
  GeneratePicksResponse,
} from '@/types/agent';

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface AgentPicksFilters {
  sport?: Sport;
  result?: PickResult;
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
    const { data, error } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('avatar_id', agentId)
      .eq('result', 'pending')
      .order('game_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending picks:', error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} pending picks for agent ${agentId}`);
    return (data as AgentPick[]) || [];
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
    // Get today's date in YYYY-MM-DD format using local time (not UTC)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('avatar_id', agentId)
      .eq('game_date', todayStr)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching today\'s picks:', error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} picks for today for agent ${agentId}`);
    return (data as AgentPick[]) || [];
  } catch (error) {
    console.error('Error in fetchTodaysPicks:', error);
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

    // V2: Enqueue via request endpoint (JWT verified by Edge Function gateway)
    const { data, error } = await (supabase as any).functions.invoke(
      'request-avatar-picks-generation-v2',
      { body: { avatar_id: agentId } }
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
    if (!data?.success) throw new Error(data?.error || 'Failed to enqueue generation');

    const runId = data.run_id;
    if (!runId) throw new Error('No run_id returned from generation request');

    console.log(`[V2] Enqueued run ${runId}, polling for completion...`);

    // Poll for completion (worker processes asynchronously)
    const result = await pollGenerationRun(runId);

    console.log(`[V2] Run ${runId} completed: ${result.status}, picks: ${result.picksGenerated}`);
    return {
      picks: [],
      picks_generated: result.picksGenerated,
      slate_note: result.picksGenerated === 0 ? 'No games available for today' : undefined,
    };
  } catch (error) {
    console.error('Error in generatePicks:', error);
    throw error;
  }
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_CONSECUTIVE_ERRORS = 5;

async function pollGenerationRun(runId: string): Promise<{ status: string; picksGenerated: number }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    const { data: run, error } = await (supabase as any)
      .from('agent_generation_runs')
      .select('status, picks_generated, error_message')
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
        return { status: 'succeeded', picksGenerated: run.picks_generated || 0 };
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
