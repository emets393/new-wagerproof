import { supabase } from './supabase';
import { AgentPerformance, AgentWithPerformance, Sport } from '@/types/agent';

// ============================================================================
// LEADERBOARD ENTRY TYPE
// ============================================================================

export interface LeaderboardEntry {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  user_id: string;
  preferred_sports: Sport[];
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number | null;
  net_units: number;
  current_streak: number;
  best_streak: number;
}

// ============================================================================
// PERFORMANCE OPERATIONS
// ============================================================================

/**
 * Fetch performance data for a single agent
 */
export async function fetchAgentPerformance(
  agentId: string
): Promise<AgentPerformance | null> {
  try {
    const { data, error } = await supabase
      .from('avatar_performance_cache')
      .select('*')
      .eq('avatar_id', agentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching agent performance:', error);
      throw error;
    }

    if (!data) {
      console.log(`No performance data found for agent ${agentId}`);
      return null;
    }

    console.log(`Loaded performance for agent ${agentId}: ${data.wins}-${data.losses}`);
    return data as AgentPerformance;
  } catch (error) {
    console.error('Error in fetchAgentPerformance:', error);
    throw error;
  }
}

/**
 * Fetch leaderboard of top public agents
 */
export async function fetchLeaderboard(
  limit: number = 50,
  sport?: Sport
): Promise<LeaderboardEntry[]> {
  try {
    // Query from a view that joins avatar_profiles with avatar_performance_cache
    // for public agents only
    let query = supabase
      .from('avatar_leaderboard')
      .select('*')
      .order('net_units', { ascending: false })
      .limit(limit);

    // Filter by sport if provided
    if (sport) {
      query = query.contains('preferred_sports', [sport]);
    }

    const { data, error } = await query;

    if (error) {
      // If the view doesn't exist, fall back to manual join
      console.warn('Leaderboard view not available, falling back to manual query');
      return await fetchLeaderboardFallback(limit, sport);
    }

    console.log(`Loaded ${data?.length || 0} leaderboard entries`);
    return (data as LeaderboardEntry[]) || [];
  } catch (error) {
    console.error('Error in fetchLeaderboard:', error);
    // Try fallback
    return await fetchLeaderboardFallback(limit, sport);
  }
}

/**
 * Fallback leaderboard fetch using manual join
 */
async function fetchLeaderboardFallback(
  limit: number = 50,
  sport?: Sport
): Promise<LeaderboardEntry[]> {
  try {
    // Fetch public agents
    let agentsQuery = supabase
      .from('avatar_profiles')
      .select('id, name, avatar_emoji, avatar_color, user_id, preferred_sports')
      .eq('is_public', true)
      .eq('is_active', true);

    if (sport) {
      agentsQuery = agentsQuery.contains('preferred_sports', [sport]);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError || !agents || agents.length === 0) {
      console.log('No public agents found');
      return [];
    }

    // Fetch performance for these agents
    const agentIds = agents.map((a) => a.id);
    const { data: performances, error: perfError } = await supabase
      .from('avatar_performance_cache')
      .select('*')
      .in('avatar_id', agentIds);

    if (perfError) {
      console.error('Error fetching performance for leaderboard:', perfError);
      return [];
    }

    // Create performance map
    const perfMap = new Map<string, AgentPerformance>();
    if (performances) {
      performances.forEach((p) => perfMap.set(p.avatar_id, p as AgentPerformance));
    }

    // Combine and sort
    const leaderboard: LeaderboardEntry[] = agents
      .map((agent) => {
        const perf = perfMap.get(agent.id);
        return {
          avatar_id: agent.id,
          name: agent.name,
          avatar_emoji: agent.avatar_emoji,
          avatar_color: agent.avatar_color,
          user_id: agent.user_id,
          preferred_sports: agent.preferred_sports,
          total_picks: perf?.total_picks || 0,
          wins: perf?.wins || 0,
          losses: perf?.losses || 0,
          pushes: perf?.pushes || 0,
          win_rate: perf?.win_rate || null,
          net_units: perf?.net_units || 0,
          current_streak: perf?.current_streak || 0,
          best_streak: perf?.best_streak || 0,
        };
      })
      .filter((entry) => entry.total_picks > 0) // Only show agents with picks
      .sort((a, b) => b.net_units - a.net_units)
      .slice(0, limit);

    console.log(`Loaded ${leaderboard.length} leaderboard entries (fallback)`);
    return leaderboard;
  } catch (error) {
    console.error('Error in fetchLeaderboardFallback:', error);
    return [];
  }
}

/**
 * Fetch performance data for multiple agents
 */
export async function fetchPerformanceForAgents(
  agentIds: string[]
): Promise<Map<string, AgentPerformance>> {
  try {
    if (agentIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('avatar_performance_cache')
      .select('*')
      .in('avatar_id', agentIds);

    if (error) {
      console.error('Error fetching performance for agents:', error);
      throw error;
    }

    const perfMap = new Map<string, AgentPerformance>();
    if (data) {
      data.forEach((p) => perfMap.set(p.avatar_id, p as AgentPerformance));
    }

    return perfMap;
  } catch (error) {
    console.error('Error in fetchPerformanceForAgents:', error);
    throw error;
  }
}
