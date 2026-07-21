import * as React from 'react';
import { Timer } from 'lucide-react';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { useTodaysMlbGames } from '@/hooks/useTodaysMlbGames';
import { useF5Splits } from '@/hooks/useF5Splits';
import { MlbToolFeedPanel } from '../shared/MlbToolFeedPanel';
import { useMlbToolUrlState } from '../shared/useMlbToolUrlState';
import { F5SplitsDetailPane } from './F5SplitsDetailPane';
import { F5SplitsListCard } from './F5SplitsListCard';
import { buildF5FeedItems } from './model';

/**
 * /mlb/f5-splits — first-five splits as a split view. Left = today's MLB slate
 * with both first-five verdicts on each card; right = that game's split
 * breakdown. Registered in SPLIT_VIEW_ROUTES in App.tsx, without which the page
 * would sit inside the padded scroller and lose its internal scrolling.
 *
 * Reuses the existing data layer verbatim (useTodaysMlbGames + useF5Splits);
 * only the presentation is new.
 */
export default function F5SplitsPage() {
  const { selectedGameId, selectGame } = useMlbToolUrlState();
  const isDesktop = useIsDesktopSplit();

  const {
    data: games = [],
    isLoading: gamesLoading,
    error: gamesError,
    refetch: refetchGames,
  } = useTodaysMlbGames();

  const teamAbbrs = React.useMemo(
    () => games.flatMap((g) => [g.away_abbr, g.home_abbr]),
    [games],
  );

  const {
    data: splitsData,
    isLoading: splitsLoading,
    error: splitsError,
    refetch: refetchSplits,
  } = useF5Splits(teamAbbrs);

  const isLoading = gamesLoading || (teamAbbrs.length > 0 && splitsLoading);

  const items = React.useMemo(
    () => buildF5FeedItems(games, splitsData?.lookup ?? new Map()),
    [games, splitsData?.lookup],
  );

  const errorMessage =
    (gamesError instanceof Error ? gamesError.message : null) ??
    (splitsError instanceof Error ? splitsError.message : null) ??
    null;

  const lastRefreshed = splitsData?.lastRefreshedAt
    ? `${new Date(splitsData.lastRefreshedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })} ET`
    : null;

  const refresh = React.useCallback(() => {
    refetchGames();
    refetchSplits();
  }, [refetchGames, refetchSplits]);

  React.useEffect(() => {
    trackEvent('F5 Splits Viewed');
  }, []);

  // Resolve the selection: ignore stale deep links, auto-select on desktop only.
  const selected = items.find((g) => g.id === selectedGameId) ?? null;
  React.useEffect(() => {
    if (isLoading || items.length === 0) return;
    if (isDesktop && !selected) {
      selectGame(items[0].id, { replace: true });
    }
  }, [isLoading, items, isDesktop, selected, selectGame]);

  React.useEffect(() => {
    if (selected) trackEvent('F5 Splits Game Viewed', { gamePk: selected.gamePk });
  }, [selected?.gamePk]);

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-mlb-f5-splits-split"
        showDetailOnMobile={!!selected}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel="First-Five"
        list={
          <MlbToolFeedPanel
            games={items}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onRefresh={refresh}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            renderCard={(game, isSelected) => (
              <F5SplitsListCard
                item={game}
                isSelected={isSelected}
                onSelect={(id) => selectGame(id)}
              />
            )}
            footnote={lastRefreshed ? `Splits last refreshed ${lastRefreshed}` : null}
            emptyIcon={<Timer className="h-8 w-8 text-muted-foreground/50" />}
            emptyTitle="No MLB games scheduled"
            emptyBody="First-five splits are published per slate. Check back closer to first pitch."
          />
        }
        detail={<F5SplitsDetailPane item={selected} isFeedLoading={isLoading} />}
      />
    </div>
  );
}
