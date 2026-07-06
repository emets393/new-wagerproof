// Data hook for the Outliers Trends section — mirrors OutliersTrendsStore.refresh()
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/OutliersTrendsStore.swift).
// NFL/NCAAF fetch server-pre-rendered cards for the current slate; MLB fetches the
// raw splits bundle and builds every card client-side. Subject/matchup filtering
// happens downstream in filtering.ts so one cache entry serves all filter states.
import { useQuery } from '@tanstack/react-query';
import { buildMLBCards } from '../mlbTrendsEngine';
import {
  fetchMLBBundle,
  fetchPrecomputedCards,
  fetchSlateGames,
} from '../outliersTrendsService';
import { sportHasTrendsData } from '../types';
import type {
  OutliersTrendsCard,
  OutliersTrendsGame,
  OutliersTrendsSport,
} from '../types';

export interface OutliersTrendsData {
  games: OutliersTrendsGame[];
  cards: OutliersTrendsCard[];
}

export function useOutliersTrends(sport: OutliersTrendsSport) {
  return useQuery({
    queryKey: ['outliers-trends', sport],
    // NBA/NCAAB have no trends source yet — the section renders "coming soon" without fetching.
    enabled: sportHasTrendsData(sport),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OutliersTrendsData> => {
      if (sport === 'mlb') {
        const bundle = await fetchMLBBundle();
        // Build the full unfiltered card set ('teams' is MLB's only subject).
        const cards = buildMLBCards(bundle, 'all', 'teams');
        return { games: bundle.games, cards };
      }
      const games = await fetchSlateGames(sport);
      const first = games[0];
      const cards = first
        ? await fetchPrecomputedCards(sport, first.season, first.week)
        : [];
      return { games, cards };
    },
  });
}
