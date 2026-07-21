import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { fetchMlbTrends } from '../api/mlbTrends';
import { fetchNbaTrends } from '../api/nbaTrends';
import { fetchNcaabTrends } from '../api/ncaabTrends';
import type { TrendsFeed, TrendsFeedItem, TrendsSport } from '../types';

/** Situational tables are rebuilt once per slate; 5 minutes matches /games. */
const STALE_TIME = 5 * 60 * 1000;

export function trendsQueryKey(sport: TrendsSport) {
  return ['trends-today', sport] as const;
}

export interface TrendsFeedState {
  /** Every league's games merged, ready to filter. */
  games: TrendsFeedItem[];
  isLoading: boolean;
  /** Leagues whose fetch failed, with the message — partial data still renders. */
  errors: { sport: TrendsSport; message: string }[];
}

function errorFor(
  sport: TrendsSport,
  isError: boolean,
  error: unknown,
): { sport: TrendsSport; message: string } | null {
  if (!isError) return null;
  return { sport, message: (error as Error)?.message ?? 'Unknown error' };
}

/**
 * One React Query entry per league, merged client-side. Separate caches (rather
 * than a single combined query) mean a slow or broken league can't blank the
 * whole feed, and switching the league filter costs nothing.
 *
 * Written as three explicit `useQuery` calls rather than `useQueries` so the
 * merge memo has stable, individually-named dependencies — `useQueries` hands
 * back a fresh array every render, which would recompute the feed each time.
 */
export function useTrendsFeed(): TrendsFeedState {
  const mlb = useQuery<TrendsFeed>({
    queryKey: trendsQueryKey('mlb'),
    staleTime: STALE_TIME,
    queryFn: fetchMlbTrends,
  });
  const nba = useQuery<TrendsFeed>({
    queryKey: trendsQueryKey('nba'),
    staleTime: STALE_TIME,
    queryFn: fetchNbaTrends,
  });
  const ncaab = useQuery<TrendsFeed>({
    queryKey: trendsQueryKey('ncaab'),
    staleTime: STALE_TIME,
    queryFn: fetchNcaabTrends,
  });

  const games = React.useMemo(
    () => [...(mlb.data?.games ?? []), ...(nba.data?.games ?? []), ...(ncaab.data?.games ?? [])],
    [mlb.data, nba.data, ncaab.data],
  );

  const errors = React.useMemo(
    () =>
      [
        errorFor('mlb', mlb.isError, mlb.error),
        errorFor('nba', nba.isError, nba.error),
        errorFor('ncaab', ncaab.isError, ncaab.error),
      ].filter((e): e is { sport: TrendsSport; message: string } => e !== null),
    [mlb.isError, mlb.error, nba.isError, nba.error, ncaab.isError, ncaab.error],
  );

  return {
    games,
    isLoading: mlb.isLoading || nba.isLoading || ncaab.isLoading,
    errors,
  };
}

export function useRefreshTrendsFeed() {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trends-today'] });
  }, [queryClient]);
}
