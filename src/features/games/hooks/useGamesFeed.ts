import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminMode } from '@/contexts/AdminModeContext';
import type { GamesSport, SportFeed } from '../types';
import { fetchNflGames } from '../api/nflGames';
import { fetchCfbGames } from '../api/cfbGames';
import { fetchNbaGames } from '../api/nbaGames';
import { fetchNcaabGames } from '../api/ncaabGames';
import { fetchMlbGames } from '../api/mlbGames';

const STALE_TIME = 5 * 60 * 1000; // matches the legacy sessionStorage cache TTL

/**
 * Unified games feed. Replaces each legacy page's imperative fetchData() +
 * useSportsPageCache — React Query provides the same 5-minute freshness and
 * instant back-navigation. CFB is the only sport whose data depends on admin
 * mode (slate), hence the conditional query-key segment.
 */
export function useGamesFeed(sport: GamesSport) {
  const { adminModeEnabled } = useAdminMode();
  const cfbAdminMode = sport === 'cfb' ? adminModeEnabled : false;

  return useQuery<SportFeed>({
    // v3: feed signalCount from slate_feed flags_* / n_flags_* (excludes blanket keys)
    queryKey: ['games-feed', sport, cfbAdminMode, 'signals-v3'],
    staleTime: STALE_TIME,
    queryFn: () => {
      switch (sport) {
        case 'nfl':
          return fetchNflGames();
        case 'cfb':
          return fetchCfbGames(cfbAdminMode);
        case 'nba':
          return fetchNbaGames();
        case 'ncaab':
          return fetchNcaabGames();
        case 'mlb':
          return fetchMlbGames();
      }
    },
  });
}

export function useRefreshGamesFeed(sport: GamesSport) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['games-feed', sport] });
}
