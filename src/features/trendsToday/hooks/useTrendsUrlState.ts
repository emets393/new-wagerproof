import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TRENDS_SPORTS, type TrendsSportFilter } from '../types';

function isSportFilter(value: string | null): value is TrendsSportFilter {
  if (!value) return false;
  return value === 'all' || (TRENDS_SPORTS as string[]).includes(value);
}

/**
 * URL model for /todays-trends: ?sport=all|mlb|nba|ncaab&game=<id>. Mirrors
 * /games, with an extra `all` value because this tool lists every league in one
 * feed. Legacy per-sport routes redirect in with an explicit sport, so a
 * bookmarked /mlb/todays-betting-trends still lands on MLB only.
 */
export function useTrendsUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSport = searchParams.get('sport');
  const sport: TrendsSportFilter = isSportFilter(rawSport) ? rawSport : 'all';
  const selectedGameId = searchParams.get('game');

  const setSport = useCallback(
    (next: TrendsSportFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('sport', next);
          params.delete('game'); // the selection may not exist in the new filter
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const selectGame = useCallback(
    (gameId: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (gameId) params.set('game', gameId);
          else params.delete('game');
          return params;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  // Normalize once so shared links always carry an explicit filter.
  const ensureSportInUrl = useCallback(() => {
    if (!isSportFilter(rawSport)) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('sport', sport);
          return params;
        },
        { replace: true },
      );
    }
  }, [rawSport, sport, setSearchParams]);

  return { sport, selectedGameId, setSport, selectGame, ensureSportInUrl };
}
