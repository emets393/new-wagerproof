import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboard,
  fetchLeaderboardV2,
  fetchAgentPerformance,
  LeaderboardEntry,
  LeaderboardSortMode,
  LeaderboardTimeframe,
} from '@/services/agentPerformanceService';
import { AgentPerformance, Sport } from '@/types/agent';
import { useAgentV2Flags } from '@/hooks/useAgentV2Flags';
import { useAgentV2DebugSettings } from '@/hooks/useAgentV2DebugSettings';
import { trackAgentParity } from '@/services/agentPerformanceMetrics';

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
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  const sortMode: LeaderboardSortMode = 'overall';
  const excludeUnder10Picks = false;
  const timeframe: LeaderboardTimeframe = 'all_time';
  return useQuery({
    queryKey: [
      ...leaderboardKeys.list(limit, sport, sortMode, excludeUnder10Picks, timeframe),
      !!flags?.agents_v2_leaderboard_enabled,
      !!flags?.agents_v2_shadow_compare_enabled,
      forceV2Only,
    ],
    queryFn: async () => {
      const useV2 = forceV2Only || !!flags?.agents_v2_leaderboard_enabled;
      const shadowCompare = !!flags?.agents_v2_shadow_compare_enabled;

      if (useV2) {
        try {
          return await fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe);
        } catch (err) {
          if (forceV2Only) throw err;
          return fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe);
        }
      }

      if (shadowCompare) {
        Promise.allSettled([
          fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe),
          fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe),
        ]).then(([legacyResult, v2Result]) => {
          if (legacyResult.status !== 'fulfilled' || v2Result.status !== 'fulfilled') return;
          if (legacyResult.value.length !== v2Result.value.length) {
            trackAgentParity('leaderboard', 'row_count', {
              legacy_count: legacyResult.value.length,
              v2_count: v2Result.value.length,
            });
          }
        });
      }

      return fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe);
    },
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
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  return useQuery({
    queryKey: [
      ...leaderboardKeys.list(limit, sport, sortMode, excludeUnder10Picks, timeframe),
      !!flags?.agents_v2_leaderboard_enabled,
      !!flags?.agents_v2_shadow_compare_enabled,
      forceV2Only,
    ],
    queryFn: async () => {
      const useV2 = forceV2Only || !!flags?.agents_v2_leaderboard_enabled;
      const shadowCompare = !!flags?.agents_v2_shadow_compare_enabled;

      if (useV2) {
        try {
          return await fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe);
        } catch (err) {
          if (forceV2Only) throw err;
          return fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe);
        }
      }

      if (shadowCompare) {
        Promise.allSettled([
          fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe),
          fetchLeaderboardV2(limit, sport, sortMode, excludeUnder10Picks, timeframe),
        ]).then(([legacyResult, v2Result]) => {
          if (legacyResult.status !== 'fulfilled' || v2Result.status !== 'fulfilled') return;
          if (legacyResult.value.length !== v2Result.value.length) {
            trackAgentParity('leaderboard', 'row_count', {
              legacy_count: legacyResult.value.length,
              v2_count: v2Result.value.length,
            });
          }
        });
      }

      return fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe);
    },
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
    queryFn: () => fetchLeaderboard(limit, sport, sortMode, excludeUnder10Picks, timeframe),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
