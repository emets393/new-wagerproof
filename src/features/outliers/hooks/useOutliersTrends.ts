// Data hooks for the Outliers Trends section — mirrors OutliersTrendsStore.refresh()
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/OutliersTrendsStore.swift).
// NFL/NCAAF fetch server-pre-rendered cards for the current slate; MLB fetches the
// raw splits bundle and builds every card client-side. Subject/matchup filtering
// happens downstream in filtering.ts so one cache entry serves all filter states.
import { useQueries } from '@tanstack/react-query';
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

/** One sport's slate + cards, tagged so merged results stay attributable. */
export interface OutliersTrendsSportData extends OutliersTrendsData {
  sport: OutliersTrendsSport;
}

/** Shared query definition — one cache entry per sport, reused by both hooks. */
function trendsQueryOptions(sport: OutliersTrendsSport) {
  return {
    queryKey: ['outliers-trends', sport] as const,
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
  };
}

export interface OutliersTrendsMultiResult {
  /** Per-sport data in the order requested; sports that haven't resolved are omitted. */
  bySport: OutliersTrendsSportData[];
  /** True until every requested sport has resolved. */
  isLoading: boolean;
  /** True only when every sport failed — a partial slate still renders. */
  isError: boolean;
  refetch: () => void;
}

/**
 * The page's one data entry point — takes whatever sports are in scope, from a
 * single pinned sport up to all three under "All Sports". One cache entry per
 * sport means narrowing the pill is instant (the data is already there).
 * Partial failure is tolerated: one dead slate doesn't blank the other two.
 */
export function useOutliersTrendsMulti(sports: OutliersTrendsSport[]): OutliersTrendsMultiResult {
  return useQueries({
    queries: sports.map(trendsQueryOptions),
    combine: (results) => ({
      bySport: results.flatMap((r, i) =>
        r.data ? [{ sport: sports[i], games: r.data.games, cards: r.data.cards }] : [],
      ),
      isLoading: results.some((r) => r.isLoading),
      isError: results.length > 0 && results.every((r) => r.isError),
      refetch: () => results.forEach((r) => r.refetch()),
    }),
  });
}
