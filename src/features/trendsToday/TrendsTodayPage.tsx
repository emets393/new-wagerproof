import * as React from 'react';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { TrendsFeedPanel } from './components/TrendsFeedPanel';
import { TrendsDetailPane } from './detail/TrendsDetailPane';
import { selectTrendsGames } from './feedUtils';
import { useRefreshTrendsFeed, useTrendsFeed } from './hooks/useTrendsFeed';
import { useTrendsUrlState } from './hooks/useTrendsUrlState';
import { TRENDS_SPORT_LABELS, type TrendsSortKey } from './types';

/**
 * /todays-trends — one split-view tool replacing the three per-sport
 * "Today's Betting Trends" pages. Left = today's slate across MLB, NBA and
 * NCAAB with a league filter; right = that game's situational trends.
 * URL carries ?sport & ?game for deep links, same as /games.
 */
export default function TrendsTodayPage() {
  const { sport, selectedGameId, setSport, selectGame, ensureSportInUrl } = useTrendsUrlState();
  const [sortKey, setSortKey] = React.useState<TrendsSortKey>('time');
  const isDesktop = useIsDesktopSplit();

  const { games, isLoading, errors } = useTrendsFeed();
  const refresh = useRefreshTrendsFeed();

  const ordered = React.useMemo(
    () => selectTrendsGames(games, sport, sortKey),
    [games, sport, sortKey],
  );

  React.useEffect(() => {
    ensureSportInUrl();
  }, [ensureSportInUrl]);

  React.useEffect(() => {
    trackEvent('Todays Trends Viewed', { sport });
  }, [sport]);

  // Resolve the selection: ignore stale deep links, auto-select on desktop only.
  const selectedGame = ordered.find((g) => g.id === selectedGameId) ?? null;
  React.useEffect(() => {
    if (isLoading || ordered.length === 0) return;
    if (isDesktop && !selectedGame) {
      selectGame(ordered[0].id, { replace: true });
    }
  }, [isLoading, ordered, isDesktop, selectedGame, selectGame]);

  React.useEffect(() => {
    if (selectedGame) {
      trackEvent('Todays Trends Game Viewed', {
        sport: selectedGame.sport,
        gameId: selectedGame.id,
      });
    }
  }, [selectedGame?.id, selectedGame?.sport]);

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-trends-today-split"
        showDetailOnMobile={!!selectedGame}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel={sport === 'all' ? 'Trends' : TRENDS_SPORT_LABELS[sport]}
        list={
          <TrendsFeedPanel
            sport={sport}
            onSportChange={setSport}
            games={ordered}
            isLoading={isLoading}
            errors={errors}
            onRefresh={refresh}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />
        }
        detail={<TrendsDetailPane game={selectedGame} isFeedLoading={isLoading} />}
      />
    </div>
  );
}
