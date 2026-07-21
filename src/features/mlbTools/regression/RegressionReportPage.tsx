import * as React from 'react';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { RegressionFeedPanel } from './components/RegressionFeedPanel';
import { RegressionDetailPane } from './detail/RegressionDetailPane';
import { selectRegressionGames } from './buildFeed';
import { useRegressionData } from './hooks/useRegressionData';
import { useRegressionUrlState } from './hooks/useRegressionUrlState';
import type { RegressionFilter, RegressionSortKey } from './types';

/**
 * /mlb/daily-regression-report — the daily MLB regression report as a split
 * view. Left = today's games; right = that game's picks and regression signals,
 * or the report-wide record and method when nothing is selected.
 *
 * The route is registered in SPLIT_VIEW_ROUTES in App.tsx, without which the
 * page would sit inside the normal padded scroller and lose its internal scroll.
 */
export default function RegressionReportPage() {
  const { selectedGameId, selectGame } = useRegressionUrlState();
  const [filter, setFilter] = React.useState<RegressionFilter>('all');
  const [sortKey, setSortKey] = React.useState<RegressionSortKey>('time');
  const isDesktop = useIsDesktopSplit();

  const data = useRegressionData();
  const { games, isLoading, report, refetch } = data;

  const ordered = React.useMemo(
    () => selectRegressionGames(games, filter, sortKey),
    [games, filter, sortKey],
  );

  React.useEffect(() => {
    trackEvent('MLB Regression Report Viewed');
  }, []);

  // Deep links to a game that dropped off today's report resolve to null, which
  // falls back to the summary rather than a blank pane.
  const selectedGame = ordered.find((g) => g.id === selectedGameId) ?? null;

  // Desktop auto-selects the first game so the pane is never empty on load; the
  // summary stays reachable through the feed's "Today's report" row.
  const hasAutoSelected = React.useRef(false);
  React.useEffect(() => {
    if (isLoading || ordered.length === 0) return;
    if (!isDesktop || hasAutoSelected.current || selectedGameId) return;
    hasAutoSelected.current = true;
    selectGame(ordered[0].id, { replace: true });
  }, [isLoading, ordered, isDesktop, selectedGameId, selectGame]);

  React.useEffect(() => {
    if (selectedGame) {
      trackEvent('MLB Regression Game Viewed', {
        gameId: selectedGame.id,
        picks: selectedGame.picks.length,
        tier: selectedGame.topTier,
      });
    }
  }, [selectedGame?.id, selectedGame?.picks.length, selectedGame?.topTier]);

  const pickCount = React.useMemo(
    () => games.reduce((sum, g) => sum + g.picks.length, 0),
    [games],
  );

  // "Sat, Jul 5" rather than the raw report_date the payload carries.
  const reportDateLabel = React.useMemo(() => {
    if (!report?.report_date) return null;
    const d = new Date(`${report.report_date.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [report?.report_date]);

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-mlb-regression-split"
        showDetailOnMobile={!!selectedGame}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel="Report"
        list={
          <RegressionFeedPanel
            games={ordered}
            isLoading={isLoading}
            onRefresh={() => { void refetch(); }}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            onShowSummary={() => selectGame(null)}
            filter={filter}
            onFilterChange={setFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
            reportDateLabel={reportDateLabel}
            pickCount={pickCount}
          />
        }
        detail={<RegressionDetailPane game={selectedGame} data={data} />}
      />
    </div>
  );
}
