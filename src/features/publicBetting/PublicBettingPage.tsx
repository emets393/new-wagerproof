import * as React from 'react';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { BoardUnavailableError } from './api/fetchBoard';
import { FeedPanel } from './components/FeedPanel';
import { DetailPane } from './detail/DetailPane';
import { selectPublicGames, sportsOnBoard } from './feedUtils';
import { usePublicBoard, useRefreshPublicBoard } from './hooks/usePublicBoard';
import { usePublicUrlState } from './hooks/usePublicUrlState';
import { pickLandingSport } from './landing';
import { SPORT_LABELS } from './types';

/**
 * /public-betting — tickets vs money for the posted slate.
 * Opens on the in-season league (NFL from September through February when
 * that league is on the board). Percentages are free; the read is Premium.
 */
export default function PublicBettingPage() {
  const board = usePublicBoard();
  const refresh = useRefreshPublicBoard();
  const isDesktop = useIsDesktopSplit();
  const games = board.data ?? [];
  const sports = React.useMemo(() => sportsOnBoard(games), [games]);
  const landing = board.isSuccess ? pickLandingSport(sports) : null;
  const {
    sport,
    market,
    tier,
    sort,
    selectedGameId,
    setSport,
    setMarket,
    setTier,
    setSort,
    selectGame,
    ensureFiltersInUrl,
  } = usePublicUrlState(landing);

  const ordered = React.useMemo(
    () => selectPublicGames(games, sport, market, tier, '', sort),
    [games, sport, market, tier, sort],
  );

  React.useEffect(() => {
    ensureFiltersInUrl();
  }, [ensureFiltersInUrl]);

  React.useEffect(() => {
    trackEvent('Public Betting Viewed', { sport, market, tier, sort });
  }, [sport, market, tier, sort]);

  const selected = ordered.find((game) => game.id === selectedGameId) ?? null;

  React.useEffect(() => {
    if (board.isLoading || ordered.length === 0) return;
    if (isDesktop && !selected) selectGame(ordered[0].id, { replace: true });
  }, [board.isLoading, ordered, isDesktop, selected, selectGame]);

  const searchText = React.useRef('');
  const listScrollTop = React.useRef(0);
  const unavailable = board.error instanceof BoardUnavailableError;
  const errorMessage = board.error && !unavailable ? (board.error as Error).message : null;
  const backLabel = sport === 'all' ? 'Public Betting' : SPORT_LABELS[sport];

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-public-betting-split"
        listDefaultSize={38}
        listMinSize={30}
        listMaxSize={52}
        showDetailOnMobile={!!selected}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel={backLabel}
        list={
          <FeedPanel
            sport={sport}
            market={market}
            tier={tier}
            sports={sports}
            games={ordered}
            boardCount={games.length}
            isLoading={board.isLoading}
            isRefreshing={board.isFetching && !board.isLoading}
            isUnavailable={unavailable}
            errorMessage={errorMessage}
            onSportChange={setSport}
            onMarketChange={setMarket}
            sort={sort}
            onSortChange={setSort}
            onTierChange={setTier}
            onRefresh={refresh}
            searchText={searchText}
            listScrollTop={listScrollTop}
            selectedGameId={selected?.id ?? null}
            onSelectGame={(id) => selectGame(id)}
          />
        }
        detail={<DetailPane game={selected} market={market} isLoading={board.isLoading} />}
      />
    </div>
  );
}
