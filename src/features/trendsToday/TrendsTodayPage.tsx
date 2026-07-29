import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { trackEvent } from '@/lib/mixpanel';
import { PAYWALL_ROUTE } from '@/lib/routes';
import { TrendsFeedPanel } from './components/TrendsFeedPanel';
import { TrendsDetailPane } from './detail/TrendsDetailPane';
import { selectTrendsGames } from './feedUtils';
import { isFreemiumTrendLocked } from './freemium';
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
  const navigate = useNavigate();
  const { sport, selectedGameId, setSport, selectGame, ensureSportInUrl } = useTrendsUrlState();
  const { isFreemiumUser } = useFreemiumAccess();
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
  const selectedGameIndex = ordered.findIndex((g) => g.id === selectedGameId);
  const selectedGameIsLocked = selectedGameId
    ? isFreemiumTrendLocked(ordered, selectedGameId, isFreemiumUser)
    : false;
  const selectedGame =
    selectedGameIndex >= 0 && !selectedGameIsLocked ? ordered[selectedGameIndex] : null;

  React.useEffect(() => {
    if (!isLoading && selectedGameId && selectedGameIsLocked) {
      navigate(PAYWALL_ROUTE, { replace: true });
    }
  }, [isLoading, navigate, selectedGameId, selectedGameIsLocked]);

  React.useEffect(() => {
    if (isLoading || ordered.length === 0) return;
    if (selectedGameIsLocked) return;
    if (isDesktop && !selectedGame) {
      selectGame(ordered[0].id, { replace: true });
    }
  }, [isLoading, ordered, isDesktop, selectedGame, selectedGameIsLocked, selectGame]);

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
            isFreemiumUser={isFreemiumUser}
            onLockedClick={() => navigate(PAYWALL_ROUTE)}
          />
        }
        detail={<TrendsDetailPane game={selectedGame} isFeedLoading={isLoading} />}
      />
    </div>
  );
}
