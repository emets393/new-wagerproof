import { supabase } from '@/integrations/supabase/client';
import { AgentPick, PickResult, Sport, GeneratePicksResponse, OverlapAgentSummary, AgentPickOverlap } from '@/types/agent';

export interface AgentPicksFilters {
  sport?: Sport;
  result?: PickResult;
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

export async function generatePicks(agentId: string, _isAdmin = false): Promise<GeneratePicksResponse> {
  // Get current session (no refresh – avoids triggering onAuthStateChange)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

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

  // Poll for completion (worker processes asynchronously)
  const result = await pollGenerationRun(runId);
  return {
    picks: [],
    picks_generated: result.picksGenerated,
    slate_note: result.picksGenerated === 0 ? 'No games available for today' : undefined,
  };
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
      console.warn(`[generatePicks] Poll error (${consecutiveErrors}):`, error.message);
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
