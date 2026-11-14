import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPublicBoard } from '../api/fetchBoard';

const STALE_TIME = 5 * 60 * 1000;

export const publicBoardQueryKey = ['public-betting', 'board'] as const;

/** The writer runs hourly. Five minutes keeps an open tab current without polling. */
export function usePublicBoard() {
  return useQuery({
    queryKey: publicBoardQueryKey,
    queryFn: fetchPublicBoard,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

export function useRefreshPublicBoard() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: publicBoardQueryKey });
}
