import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAgentPicks,
  fetchPendingPicks,
  fetchTodaysPicks,
  fetchTodaysGenerationRun,
  fetchAgentDetailSnapshotV2,
  fetchAgentPicksPageV2,
  generatePicks,
  enrichPicksWithOverlap,
  AgentPicksFilters,
  AgentDetailSnapshotV2,
  AgentPicksPageV2,
} from '@/services/agentPicksService';
import { forceTrackActivity } from '@/services/activityService';
import { AgentGenerationRunSummary, AgentPick } from '@/types/agent';
import { useAuth } from '@/contexts/AuthContext';
import { agentKeys } from './useAgents';
import { useAgentV2Flags } from './useAgentV2Flags';
import { useAgentV2DebugSettings } from './useAgentV2DebugSettings';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const pickKeys = {
  all: ['picks'] as const,
  lists: () => [...pickKeys.all, 'list'] as const,
  list: (agentId: string, filters?: AgentPicksFilters) =>
    [...pickKeys.lists(), agentId, filters] as const,
  pending: (agentId: string) => [...pickKeys.all, 'pending', agentId] as const,
  today: (agentId: string) => [...pickKeys.all, 'today', agentId] as const,
  todayRun: (agentId: string) => [...pickKeys.all, 'today-run', agentId] as const,
};

interface PickQueryOptions {
  enabled?: boolean;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch picks for an agent with optional filters
 */
export function useAgentPicks(
  agentId: string,
  filters?: AgentPicksFilters,
  options?: PickQueryOptions
) {
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  const { user } = useAuth();
  const useV2Detail = forceV2Only || !!flags?.agents_v2_agent_detail_enabled;

  return useQuery({
    queryKey: [...pickKeys.list(agentId, filters), useV2Detail, forceV2Only, user?.id],
    queryFn: async () => {
      if (useV2Detail) {
        try {
          const result = await fetchAgentPicksPageV2(
            agentId,
            user?.id,
            (filters?.result || 'all') as 'all' | 'won' | 'lost' | 'pending' | 'push',
            50,
            null,
            true
          );
          return result.picks;
        } catch (err) {
          if (forceV2Only) throw err;
          // Fall back to legacy path below
        }
      }
      const picks = await fetchAgentPicks(agentId, filters);
      return enrichPicksWithOverlap(picks);
    },
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAgentDetailSnapshot(agentId: string, options?: PickQueryOptions) {
  const { user } = useAuth();
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  const useV2Detail = forceV2Only || !!flags?.agents_v2_agent_detail_enabled;
  const enabled = !!agentId && useV2Detail && (options?.enabled ?? true);

  return useQuery<AgentDetailSnapshotV2>({
    queryKey: ['agent-detail-snapshot-v2', agentId, user?.id, forceV2Only],
    queryFn: () => fetchAgentDetailSnapshotV2(agentId, user?.id),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAgentPicksPage(
  agentId: string,
  filter: 'all' | 'won' | 'lost' | 'pending' | 'push',
  pageSize: number,
  cursor?: string | null,
  includeOverlap: boolean = false,
  options?: PickQueryOptions
) {
  const { user } = useAuth();
  const { data: flags } = useAgentV2Flags();
  const { forceV2Only } = useAgentV2DebugSettings();
  const useV2Detail = forceV2Only || !!flags?.agents_v2_agent_detail_enabled;
  const enabled = !!agentId && useV2Detail && (options?.enabled ?? true);

  return useQuery<AgentPicksPageV2>({
    queryKey: ['agent-picks-page-v2', agentId, filter, pageSize, cursor, includeOverlap, user?.id, forceV2Only],
    queryFn: () => fetchAgentPicksPageV2(agentId, user?.id, filter, pageSize, cursor, includeOverlap),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch pending picks for an agent
 */
export function usePendingPicks(agentId: string, options?: PickQueryOptions) {
  return useQuery({
    queryKey: pickKeys.pending(agentId),
    queryFn: () => fetchPendingPicks(agentId),
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch today's picks for an agent
 */
export function useTodaysPicks(agentId: string, options?: PickQueryOptions) {
  return useQuery({
    queryKey: pickKeys.today(agentId),
    queryFn: async () => {
      const picks = await fetchTodaysPicks(agentId);
      return enrichPicksWithOverlap(picks);
    },
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Refetch more frequently for today's picks
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTodaysGenerationRun(agentId: string, options?: PickQueryOptions) {
  return useQuery<AgentGenerationRunSummary | null>({
    queryKey: pickKeys.todayRun(agentId),
    queryFn: () => fetchTodaysGenerationRun(agentId),
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Hook to generate picks for an agent
 */
export function useGeneratePicks() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ agentId, isAdmin = false }: { agentId: string; isAdmin?: boolean }) => {
      const result = await generatePicks(agentId, isAdmin);

      // Force track activity when user manually generates picks
      if (user?.id) {
        await forceTrackActivity(user.id);
      }

      return { agentId, result };
    },
    onSuccess: ({ agentId, result }) => {
      // Invalidate all pick-related queries for this agent
      queryClient.invalidateQueries({ queryKey: pickKeys.list(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.pending(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.today(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.todayRun(agentId) });

      // Also invalidate performance since it may have changed
      queryClient.invalidateQueries({
        queryKey: agentKeys.detail(agentId),
      });
    },
    onError: (error) => {
      console.error('Error generating picks:', error);
    },
  });
}

/**
 * Hook to invalidate all pick-related queries for an agent
 */
export function useInvalidateAgentPicks(agentId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: pickKeys.list(agentId) });
    queryClient.invalidateQueries({ queryKey: pickKeys.pending(agentId) });
    queryClient.invalidateQueries({ queryKey: pickKeys.today(agentId) });
    queryClient.invalidateQueries({ queryKey: pickKeys.todayRun(agentId) });
  };
}

/**
 * Hook to prefetch picks for an agent (useful for navigation optimization)
 */
export function usePrefetchAgentPicks() {
  const queryClient = useQueryClient();

  return (agentId: string, filters?: AgentPicksFilters) => {
    queryClient.prefetchQuery({
      queryKey: pickKeys.list(agentId, filters),
      queryFn: () => fetchAgentPicks(agentId, filters),
      staleTime: 2 * 60 * 1000,
    });
  };
}
