import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAgentPicks,
  fetchPendingPicks,
  fetchTodaysPicks,
  generatePicks,
  AgentPicksFilters,
} from '@/services/agentPicksService';
import { forceTrackActivity } from '@/services/activityService';
import { AgentPick, GeneratePicksResponse } from '@/types/agent';
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
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch picks for an agent with optional filters
 */
export function useAgentPicks(agentId: string, filters?: AgentPicksFilters) {
  return useQuery({
    queryKey: pickKeys.list(agentId, filters),
    queryFn: () => fetchAgentPicks(agentId, filters),
    enabled: !!agentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch pending picks for an agent
 */
export function usePendingPicks(agentId: string) {
  return useQuery({
    queryKey: pickKeys.pending(agentId),
    queryFn: () => fetchPendingPicks(agentId),
    enabled: !!agentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch today's picks for an agent
 */
export function useTodaysPicks(agentId: string) {
  return useQuery({
    queryKey: pickKeys.today(agentId),
    queryFn: () => fetchTodaysPicks(agentId),
    enabled: !!agentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Refetch more frequently for today's picks
    refetchInterval: 5 * 60 * 1000, // 5 minutes
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
