import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboardV2,
  fetchAgentPerformance,
  LeaderboardEntry,
  LeaderboardSortMode,
  LeaderboardTimeframe,
} from '@/services/agentPerformanceService';
import { AgentPerformance, Sport } from '@/types/agent';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  list: (
    limit?: number,
    sport?: Sport,
    sortMode?: LeaderboardSortMode,
    excludeUnder10Picks?: boolean,
    timeframe?: LeaderboardTimeframe
  ) =>
    [...leaderboardKeys.all, 'list', limit, sport, sortMode, excludeUnder10Picks, timeframe] as const,
  performance: (agentId: string) =>
    [...leaderboardKeys.all, 'performance', agentId] as const,
};

interface LeaderboardQueryOptions {
  enabled?: boolean;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch the leaderboard of top public agents
 */
export function useLeaderboard(limit: number = 100, sport?: Sport, options?: LeaderboardQueryOptions) {
  const sortMode: LeaderboardSortMode = 'overall';
  const excludeUnder10Picks = false;
  const timeframe: LeaderboardTimeframe = 'all_time';
  return useQuery({
    queryKey: leaderboardKeys.list(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    queryFn: () => fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLeaderboardByMode(
  sortMode: LeaderboardSortMode,
  limit: number = 100,
  sport?: Sport,
  excludeUnder10Picks: boolean = false,
  timeframe: LeaderboardTimeframe = 'all_time',
  options?: LeaderboardQueryOptions
) {
  return useQuery({
    queryKey: leaderboardKeys.list(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    queryFn: () => fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch performance data for a specific agent
 */
export function useAgentPerformance(agentId: string) {
  return useQuery({
    queryKey: leaderboardKeys.performance(agentId),
    queryFn: () => fetchAgentPerformance(agentId),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch top performers by sport
 */
export function useTopPerformersBySport(sport: Sport, limit: number = 10) {
  const sortMode: LeaderboardSortMode = 'overall';
  const excludeUnder10Picks = false;
  const timeframe: LeaderboardTimeframe = 'all_time';
  return useQuery({
    queryKey: leaderboardKeys.list(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    queryFn: () => fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
