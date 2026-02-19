import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  createAgent,
  deleteAgent,
  fetchAgentById,
  fetchPresetArchetypes,
  fetchUserAgents,
  updateAgent,
} from '@/services/agentService';
import { fetchAgentPicks, generatePicks } from '@/services/agentPicksService';
import { fetchLeaderboard, LeaderboardSortMode } from '@/services/agentPerformanceService';
import type { CreateAgentInput, UpdateAgentInput, PickResult, Sport } from '@/types/agent';

export function useUserAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agents', 'user', user?.id],
    queryFn: () => fetchUserAgents(user!.id),
    enabled: !!user?.id,
  });
}

export function useAgent(agentId?: string) {
  return useQuery({
    queryKey: ['agents', 'detail', agentId],
    queryFn: () => fetchAgentById(agentId!),
    enabled: !!agentId,
  });
}

export function useCreateAgent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAgentInput) => {
      if (!user?.id) throw new Error('You must be logged in to create an agent.');
      return createAgent(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'user', user?.id] });
    },
  });
}

export function useUpdateAgent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: UpdateAgentInput }) => updateAgent(agentId, data),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'user', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agent.id] });
    },
  });
}

export function useDeleteAgent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'user', user?.id] });
    },
  });
}

export function usePresetArchetypes() {
  return useQuery({
    queryKey: ['agents', 'archetypes'],
    queryFn: fetchPresetArchetypes,
  });
}

export function useAgentPicks(agentId?: string, filters?: { sport?: Sport; result?: PickResult }) {
  return useQuery({
    queryKey: ['agents', 'picks', agentId, filters?.sport, filters?.result],
    queryFn: () => fetchAgentPicks(agentId!, filters),
    enabled: !!agentId,
  });
}

export function useGenerateAgentPicks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, isAdmin = false }: { agentId: string; isAdmin?: boolean }) =>
      generatePicks(agentId, isAdmin),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'picks', vars.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', vars.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'user', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'leaderboard'] });
    },
  });
}

export function useAgentLeaderboard(
  sport?: Sport,
  sortMode: LeaderboardSortMode = 'overall',
  excludeUnder10Picks = false
) {
  return useQuery({
    queryKey: ['agents', 'leaderboard', sport, sortMode, excludeUnder10Picks],
    queryFn: () => fetchLeaderboard(100, sport, sortMode, excludeUnder10Picks),
  });
}
