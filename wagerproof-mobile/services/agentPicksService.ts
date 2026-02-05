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
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
 * Generate picks for an agent by calling the edge function
 */
export async function generatePicks(agentId: string, isAdmin: boolean = false): Promise<GeneratePicksResponse> {
  try {
    console.log(`Generating picks for agent ${agentId}...`);

    // Get current user session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    // Call edge function directly via fetch so we can see the full error response
    const functionUrl = `https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/generate-avatar-picks`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        avatar_id: agentId,
        user_id: session.user.id,
        is_admin: isAdmin,
      }),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error('Edge function error:', response.status, JSON.stringify(responseBody));
      throw new Error(
        responseBody?.error || `Pick generation failed (${response.status})`
      );
    }

    if (!responseBody?.success) {
      console.error('Edge function returned failure:', JSON.stringify(responseBody));
      throw new Error(responseBody?.error || 'Pick generation returned failure');
    }

    const result: GeneratePicksResponse = {
      picks: responseBody.picks || [],
      slate_note: responseBody.slate_note,
    };

    console.log(`Generated ${result.picks.length} picks for agent ${agentId}`);
    return result;
  } catch (error) {
    console.error('Error in generatePicks:', error);
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
