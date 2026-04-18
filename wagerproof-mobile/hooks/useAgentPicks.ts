import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
  /** When false, disables refetchInterval to save battery when screen not visible */
  focused?: boolean;
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
  const { user } = useAuth();

  return useQuery({
    queryKey: [...pickKeys.list(agentId, filters), user?.id],
    queryFn: async () => {
      const result = await fetchAgentPicksPageV2(
        agentId,
        user?.id,
        (filters?.result || 'all') as 'all' | 'won' | 'lost' | 'pending' | 'push',
        50,
        null,
        false // skip expensive LATERAL overlap subqueries for pick history
      );
      return result.picks;
    },
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAgentDetailSnapshot(agentId: string, options?: PickQueryOptions) {
  const { user } = useAuth();

  return useQuery<AgentDetailSnapshotV2>({
    queryKey: ['agent-detail-snapshot-v2', agentId, user?.id],
    queryFn: async () => {
      const snapshot = await fetchAgentDetailSnapshotV2(agentId, user?.id);
      console.log(
        `[useAgentDetailSnapshot] agent=${agentId} can_view=${(snapshot as any)?.can_view_agent_picks} todays_picks.length=${snapshot.todays_picks?.length ?? 'undef'} run=${JSON.stringify(snapshot.todays_generation_run)} debug=${JSON.stringify((snapshot as any)?._debug)}`,
      );
      if (snapshot.todays_picks && snapshot.todays_picks.length > 0) {
        snapshot.todays_picks = await enrichPicksWithOverlap(snapshot.todays_picks);
      }
      return snapshot;
    },
    enabled: !!agentId && (options?.enabled ?? true),
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

  return useQuery<AgentPicksPageV2>({
    queryKey: ['agent-picks-page-v2', agentId, filter, pageSize, cursor, includeOverlap, user?.id],
    queryFn: () => fetchAgentPicksPageV2(agentId, user?.id, filter, pageSize, cursor, includeOverlap),
    enabled: !!agentId && (options?.enabled ?? true),
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
    // Only poll when screen is focused to save battery
    refetchInterval: (options?.focused ?? false) ? 10 * 60 * 1000 : false,
  });
}

export function useTodaysGenerationRun(agentId: string, options?: PickQueryOptions) {
  return useQuery<AgentGenerationRunSummary | null>({
    queryKey: pickKeys.todayRun(agentId),
    queryFn: () => fetchTodaysGenerationRun(agentId),
    enabled: !!agentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
    // Only poll when screen is focused to save battery
    refetchInterval: (options?.focused ?? false) ? 10 * 60 * 1000 : false,
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
      // Invalidate pick queries scoped to this agent only
      queryClient.invalidateQueries({ queryKey: pickKeys.list(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.pending(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.today(agentId) });
      queryClient.invalidateQueries({ queryKey: pickKeys.todayRun(agentId) });
      // Invalidate the detail snapshot (includes today's picks)
      queryClient.invalidateQueries({ queryKey: ['agent-detail-snapshot-v2', agentId] });
      // Also invalidate agent detail for performance stats
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
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
  const { user } = useAuth();

  return (agentId: string, filters?: AgentPicksFilters) => {
    // Prefetch picks data
    queryClient.prefetchQuery({
      // Match the same query key used by useAgentPicks (includes user?.id)
      queryKey: [...pickKeys.list(agentId, filters), user?.id],
      queryFn: async () => {
        const result = await fetchAgentPicksPageV2(
          agentId,
          user?.id,
          (filters?.result || 'all') as 'all' | 'won' | 'lost' | 'pending' | 'push',
          50,
          null,
          false // skip expensive overlap subqueries for prefetch
        );
        return result.picks;
      },
      staleTime: 2 * 60 * 1000,
    });
    // Also prefetch the detail snapshot (agent profile + today's picks)
    queryClient.prefetchQuery({
      queryKey: ['agent-detail-snapshot-v2', agentId, user?.id],
      queryFn: async () => {
        const snapshot = await fetchAgentDetailSnapshotV2(agentId, user?.id);
        if (snapshot.todays_picks && snapshot.todays_picks.length > 0) {
          snapshot.todays_picks = await enrichPicksWithOverlap(snapshot.todays_picks);
        }
        return snapshot;
      },
      staleTime: 2 * 60 * 1000,
    });
  };
}
