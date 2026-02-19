import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserAgents,
  fetchAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  CreateAgentInput,
  UpdateAgentInput,
} from '@/services/agentService';
import { AgentWithPerformance, AgentProfile } from '@/types/agent';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (userId: string) => [...agentKeys.lists(), userId] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (agentId: string) => [...agentKeys.details(), agentId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch all agents for the current user
 */
export function useUserAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: agentKeys.list(user?.id || ''),
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return fetchUserAgents(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single agent by ID
 */
export function useAgent(agentId: string) {
  return useQuery({
    queryKey: agentKeys.detail(agentId),
    queryFn: () => fetchAgentById(agentId),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new agent
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateAgentInput) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return createAgent(user.id, data);
    },
    onSuccess: (newAgent) => {
      // Invalidate user agents list to refetch
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: agentKeys.list(user.id) });
      }
      // Optionally add the new agent to the cache immediately
      queryClient.setQueryData<AgentWithPerformance>(
        agentKeys.detail(newAgent.id),
        { ...newAgent, performance: null }
      );
    },
    onError: (error) => {
      console.error('Error creating agent:', error);
    },
  });
}

/**
 * Hook to update an existing agent
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: UpdateAgentInput }) => {
      return updateAgent(agentId, data);
    },
    onSuccess: (updatedAgent) => {
      // Update the agent in the detail cache
      queryClient.setQueryData<AgentWithPerformance>(
        agentKeys.detail(updatedAgent.id),
        (old) => ({
          ...updatedAgent,
          performance: old?.performance || null,
        })
      );
      // Invalidate user agents list to ensure consistency
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: agentKeys.list(user.id) });
      }
    },
    onError: (error) => {
      console.error('Error updating agent:', error);
    },
  });
}

/**
 * Hook to delete (soft delete) an agent
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: (_, deletedAgentId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: agentKeys.detail(deletedAgentId) });
      // Invalidate user agents list
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: agentKeys.list(user.id) });
      }
    },
    onError: (error) => {
      console.error('Error deleting agent:', error);
    },
  });
}

/**
 * Hook to invalidate all agent-related queries (useful after bulk operations)
 */
export function useInvalidateAgents() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: agentKeys.all });
  };
}
