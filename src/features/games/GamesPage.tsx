import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { trackEvent } from '@/lib/mixpanel';
import { useGamesFeed, useRefreshGamesFeed } from './hooks/useGamesFeed';
import { useGamesUrlState } from './hooks/useGamesUrlState';
import { GamesFeedPanel } from './components/GamesFeedPanel';
import { GameDetailPane } from './detail/GameDetailPane';
import { SPORT_LABELS } from './types';

/**
 * Unified /games page: iOS-style split view replacing the five legacy sport
 * pages. Left = feed (sport picker, search, cards); right = detail pane for
 * the selected game. URL carries ?sport & ?game for deep links.
 */
export default function GamesPage() {
  const navigate = useNavigate();
  const { sport, selectedGameId, setSport, selectGame, ensureSportInUrl } = useGamesUrlState();
  const { isFreemiumUser } = useFreemiumAccess();
  const { adminModeEnabled } = useAdminMode();
  const isDesktop = useIsDesktopSplit();

  const feed = useGamesFeed(sport);
  const refreshFeed = useRefreshGamesFeed(sport);

  const games = feed.data?.games ?? [];

  React.useEffect(() => {
    ensureSportInUrl();
  }, [ensureSportInUrl]);

  React.useEffect(() => {
    trackEvent('Games Sport Viewed', { sport });
  }, [sport]);

  // Resolve the selection: ignore stale deep links, auto-select on desktop only.
  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null;
  React.useEffect(() => {
    if (feed.isLoading || games.length === 0) return;
    if (isDesktop && !selectedGame) {
      // games[0] is always a free game for freemium users (first 2 unlocked).
      selectGame(games[0].id, { replace: true });
    }
  }, [feed.isLoading, games, isDesktop, selectedGame, selectGame]);

  React.useEffect(() => {
    if (selectedGame) {
      trackEvent('Game Detail Viewed', { sport, gameId: selectedGame.id });
    }
  }, [selectedGame?.id, sport]);

  const handleLockedClick = React.useCallback(() => {
    navigate('/account');
  }, [navigate]);

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-games-split"
        showDetailOnMobile={!!selectedGame}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel={SPORT_LABELS[sport]}
        list={
          <GamesFeedPanel
            sport={sport}
            onSportChange={setSport}
            games={games}
            isLoading={feed.isLoading}
            error={feed.isError ? (feed.error as Error)?.message ?? 'Unknown error' : null}
            onRetry={() => feed.refetch()}
            onRefresh={refreshFeed}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            isFreemiumUser={isFreemiumUser}
            isAdmin={adminModeEnabled}
            onLockedClick={handleLockedClick}
          />
        }
        detail={
          <GameDetailPane
            sport={sport}
            game={selectedGame}
            extras={feed.data?.extras ?? {}}
            isFeedLoading={feed.isLoading}
          />
        }
      />
    </div>
  );
}
