import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteSystem,
  fetchMySystems,
  fetchSystemsLeaderboard,
  renameSystem,
  saveSystem,
  setSystemPublic,
  type SaveSystemInput,
} from '@/services/analysisSystemsService';

/** Current user's saved MLB systems (signed-in only). */
export function useMySystems(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-systems', 'mlb', user?.id],
    queryFn: () => fetchMySystems(user!.id),
    enabled: !!user?.id && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/** Public Systems Leaderboard (MLB only for now). */
export function useSystemsLeaderboard(sport: string = 'mlb', limit: number = 50, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['systems-leaderboard', sport, limit],
    queryFn: () => fetchSystemsLeaderboard(sport, limit),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useSaveSystem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: Omit<SaveSystemInput, 'userId'>) => saveSystem({ ...input, userId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useRenameSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameSystem(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useSetSystemPublic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) => setSystemPublic(id, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSystem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}
