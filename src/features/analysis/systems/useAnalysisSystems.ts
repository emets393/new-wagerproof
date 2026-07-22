import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Sport } from '@/features/analysis/sportAdapters';
import {
  deleteSystem,
  fetchMySystems,
  fetchSystemsLeaderboard,
  renameSystem,
  saveSystem,
  setSystemPublic,
  type LeaderboardSportFilter,
  type SaveSystemInput,
} from './analysisSystemsService';

/** Current user's saved systems (signed-in only). Defaults to current sport. */
export function useMySystems(
  sport: LeaderboardSportFilter = 'all',
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-systems', sport, user?.id],
    queryFn: () => fetchMySystems(user!.id, sport),
    enabled: !!user?.id && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/** Public Systems Leaderboard — pass `'all'` to merge MLB+NFL+CFB. */
export function useSystemsLeaderboard(
  sport: LeaderboardSportFilter = 'all',
  limit: number = 50,
  options?: { enabled?: boolean },
) {
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
    mutationFn: (input: Omit<SaveSystemInput, 'userId'>) =>
      saveSystem({ ...input, userId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useRenameSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sport, id, name }: { sport: Sport; id: string; name: string }) =>
      renameSystem(sport, id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useSetSystemPublic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sport,
      id,
      isPublic,
    }: {
      sport: Sport;
      id: string;
      isPublic: boolean;
    }) => setSystemPublic(sport, id, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sport, id }: { sport: Sport; id: string }) => deleteSystem(sport, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-systems'] });
      queryClient.invalidateQueries({ queryKey: ['systems-leaderboard'] });
    },
  });
}
