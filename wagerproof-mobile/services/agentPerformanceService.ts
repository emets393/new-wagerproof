import { supabase } from './supabase';
import { AgentPerformance, AgentWithPerformance, Sport } from '@/types/agent';
import { trackAgentTiming } from '@/services/agentPerformanceMetrics';

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

export type LeaderboardSortMode = 'overall' | 'recent_run' | 'longest_streak' | 'bottom_100';
export type LeaderboardTimeframe = 'all_time' | 'last_7_days' | 'last_30_days';

interface LeaderboardPickRow {
  avatar_id: string;
  result: 'won' | 'lost' | 'push';
  odds: string | null;
  units: number;
  created_at: string;
}

function getCutoffDate(timeframe: Exclude<LeaderboardTimeframe, 'all_time'>): string {
  const now = new Date();
  const days = timeframe === 'last_7_days' ? 7 : 30;
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

function calculateNetUnits(result: LeaderboardPickRow['result'], odds: string | null, units: number): number {
  if (result === 'lost') return -units;
  if (result !== 'won') return 0;

  if (odds && /^[+-]?\d+$/.test(odds)) {
    const americanOdds = Number(odds);
    if (americanOdds < 0) {
      return units * (100 / Math.abs(americanOdds));
    }
    return units * (americanOdds / 100);
  }

  return units;
}

function calculateStreaks(picks: LeaderboardPickRow[]) {
  let currentStreak = 0;
  let bestStreak = 0;
  let previousResult: LeaderboardPickRow['result'] | null = null;

  [...picks]
    .filter((pick) => pick.result === 'won' || pick.result === 'lost')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((pick) => {
      if (!previousResult || pick.result === previousResult) {
        currentStreak = pick.result === 'won' ? currentStreak + 1 : currentStreak - 1;
      } else {
        bestStreak = Math.max(bestStreak, currentStreak);
        currentStreak = pick.result === 'won' ? 1 : -1;
      }

      previousResult = pick.result;
    });

  bestStreak = Math.max(bestStreak, currentStreak);

  return {
    current_streak: currentStreak,
    best_streak: bestStreak,
  };
}

function sortLeaderboardEntries(entries: LeaderboardEntry[], sortMode: LeaderboardSortMode) {
  return entries.sort((a, b) => {
    if (sortMode === 'recent_run') {
      if (b.current_streak !== a.current_streak) {
        return b.current_streak - a.current_streak;
      }
      if (b.net_units !== a.net_units) {
        return b.net_units - a.net_units;
      }
      return (b.win_rate || 0) - (a.win_rate || 0);
    }
    if (sortMode === 'longest_streak') {
      if (b.best_streak !== a.best_streak) {
        return b.best_streak - a.best_streak;
      }
      if (b.current_streak !== a.current_streak) {
        return b.current_streak - a.current_streak;
      }
      if (b.net_units !== a.net_units) {
        return b.net_units - a.net_units;
      }
      return (b.win_rate || 0) - (a.win_rate || 0);
    }
    if (sortMode === 'bottom_100') {
      if (a.net_units !== b.net_units) {
        return a.net_units - b.net_units;
      }
      if ((a.win_rate || 0) !== (b.win_rate || 0)) {
        return (a.win_rate || 0) - (b.win_rate || 0);
      }
      return a.current_streak - b.current_streak;
    }

    if (b.net_units !== a.net_units) {
      return b.net_units - a.net_units;
    }
    if ((b.win_rate || 0) !== (a.win_rate || 0)) {
      return (b.win_rate || 0) - (a.win_rate || 0);
    }
    return b.current_streak - a.current_streak;
  });
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
  limit: number = 100,
  sport?: Sport,
  sortMode: LeaderboardSortMode = 'overall',
  excludeUnder10Picks: boolean = false,
  timeframe: LeaderboardTimeframe = 'all_time'
): Promise<LeaderboardEntry[]> {
  // Always use the manual query so we control the filters directly
  return await fetchLeaderboardFallback(limit, sport, sortMode, excludeUnder10Picks, timeframe);
}

export async function fetchLeaderboardV2(
  limit: number = 100,
  sport?: Sport,
  sortMode: LeaderboardSortMode = 'overall',
  excludeUnder10Picks: boolean = false,
  timeframe: LeaderboardTimeframe = 'all_time'
): Promise<LeaderboardEntry[]> {
  const startedAt = Date.now();
  const { data, error } = await (supabase as any).rpc('get_leaderboard_v2', {
    p_limit: limit,
    p_sport: sport ?? null,
    p_sort_mode: sortMode,
    p_timeframe: timeframe,
    p_exclude_under_10_picks: excludeUnder10Picks,
    p_viewer_user_id: null,
  });

  trackAgentTiming('leaderboard_time_to_content_ms', Date.now() - startedAt, {
    source: 'v2',
    sort_mode: sortMode,
    timeframe,
    limit,
    sport: sport ?? 'all',
    success: !error,
  });

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    avatar_id: row.avatar_id,
    name: row.name,
    avatar_emoji: row.avatar_emoji,
    avatar_color: row.avatar_color,
    user_id: row.user_id,
    preferred_sports: row.preferred_sports,
    total_picks: row.total_picks || 0,
    wins: row.wins || 0,
    losses: row.losses || 0,
    pushes: row.pushes || 0,
    win_rate: row.win_rate ?? null,
    net_units: Number(row.net_units || 0),
    current_streak: row.current_streak || 0,
    best_streak: row.best_streak || 0,
  })) as LeaderboardEntry[];
}

/**
 * Fallback leaderboard fetch using manual join
 */
async function fetchLeaderboardFallback(
  limit: number = 100,
  sport?: Sport,
  sortMode: LeaderboardSortMode = 'overall',
  excludeUnder10Picks: boolean = false,
  timeframe: LeaderboardTimeframe = 'all_time'
): Promise<LeaderboardEntry[]> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  try {
    // Fetch public agents
    let agentsQuery = supabase
      .from('avatar_profiles')
      .select('id, name, avatar_emoji, avatar_color, user_id, preferred_sports')
      .eq('is_public', true);

    if (sport) {
      agentsQuery = agentsQuery.contains('preferred_sports', [sport]);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError || !agents || agents.length === 0) {
      console.log('No public agents found');
      return [];
    }

    const agentIds = agents.map((a) => a.id);
    let leaderboard: LeaderboardEntry[];

    if (timeframe === 'all_time') {
      // Fetch performance data (agents already loaded above)
      const { data: performances, error: perfError } = await supabase
        .from('avatar_performance_cache')
        .select('*')
        .in('avatar_id', agentIds);

      if (perfError) {
        console.error('Error fetching performance for leaderboard:', perfError);
        return [];
      }

      const perfMap = new Map<string, AgentPerformance>();
      if (performances) {
        performances.forEach((p) => perfMap.set(p.avatar_id, p as AgentPerformance));
      }

      leaderboard = agents
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
        });
    } else {
      const cutoffDate = getCutoffDate(timeframe);
      const { data: picks, error: picksError } = await supabase
        .from('avatar_picks')
        .select('avatar_id, result, odds, units, created_at')
        .in('avatar_id', agentIds)
        .in('result', ['won', 'lost', 'push'])
        .gte('game_date', cutoffDate);

      if (picksError) {
        console.error('Error fetching timeframe picks for leaderboard:', picksError);
        return [];
      }

      const picksByAvatar = new Map<string, LeaderboardPickRow[]>();
      if (picks) {
        picks.forEach((pick) => {
          const existing = picksByAvatar.get(pick.avatar_id) || [];
          existing.push(pick as LeaderboardPickRow);
          picksByAvatar.set(pick.avatar_id, existing);
        });
      }

      leaderboard = agents.map((agent) => {
        const agentPicks = picksByAvatar.get(agent.id) || [];
        const wins = agentPicks.filter((pick) => pick.result === 'won').length;
        const losses = agentPicks.filter((pick) => pick.result === 'lost').length;
        const pushes = agentPicks.filter((pick) => pick.result === 'push').length;
        const totalPicks = agentPicks.length;
        const settledCount = wins + losses;
        const streaks = calculateStreaks(agentPicks);

        return {
          avatar_id: agent.id,
          name: agent.name,
          avatar_emoji: agent.avatar_emoji,
          avatar_color: agent.avatar_color,
          user_id: agent.user_id,
          preferred_sports: agent.preferred_sports,
          total_picks: totalPicks,
          wins,
          losses,
          pushes,
          win_rate: settledCount > 0 ? wins / settledCount : null,
          net_units: agentPicks.reduce(
            (sum, pick) => sum + calculateNetUnits(pick.result, pick.odds, pick.units),
            0
          ),
          current_streak: streaks.current_streak,
          best_streak: streaks.best_streak,
        };
      });
    }

    leaderboard = sortLeaderboardEntries(
      leaderboard
        .filter((entry) => (entry.wins + entry.losses) > 0)
        .filter((entry) => (excludeUnder10Picks ? entry.total_picks >= 10 : true)),
      sortMode
    ).slice(0, effectiveLimit);

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
