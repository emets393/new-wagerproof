import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { MlbToolFeedPanel } from '@/features/mlbTools/shared/MlbToolFeedPanel';
import { useNflPropMatchupsPages, useNflPropTrendsBatch } from './hooks';
import { buildNflPropGameFeed } from './model';
import { NflPropMatchupsDetailPane } from './NflPropMatchupsDetailPane';
import { NflPropMatchupsListCard } from './NflPropMatchupsListCard';
import { useNflPropMatchupsUrlState } from './useNflPropMatchupsUrlState';

/**
 * /nfl/props — NFL player prop matchups split view (MLB pitcher-matchups twin).
 * Left = week slate games; right = defense identity + home/away player board.
 * Player rows deep-link to /nfl/player/:playerId.
 */
export default function NflPropMatchupsPage() {
  const { selectedGameId, selectGame } = useNflPropMatchupsUrlState();
  const isDesktop = useIsDesktopSplit();

  const pagesQ = useNflPropMatchupsPages();
  const items = React.useMemo(
    () => buildNflPropGameFeed(pagesQ.data ?? []),
    [pagesQ.data]
  );

  const selected = items.find((g) => g.id === selectedGameId) ?? null;

  const selectedPlayerIds = React.useMemo(() => {
    if (!selected) return [];
    return [...selected.homePlayers, ...selected.awayPlayers].map((p) => p.player_id);
  }, [selected]);

  const trendsQ = useNflPropTrendsBatch(selectedPlayerIds);

  React.useEffect(() => {
    trackEvent('NFL Prop Matchups Viewed');
  }, []);

  React.useEffect(() => {
    if (pagesQ.isLoading || items.length === 0) return;
    if (isDesktop && !selected) {
      selectGame(items[0].id, { replace: true });
    }
  }, [pagesQ.isLoading, items, isDesktop, selected, selectGame]);

  React.useEffect(() => {
    if (selected) {
      trackEvent('NFL Prop Matchups Game Viewed', {
        game: selected.id,
        label: selected.gameLabel,
      });
    }
  }, [selected?.id]);

  const errorMessage = pagesQ.error instanceof Error ? pagesQ.error.message : null;
  const weekLabel =
    items[0] != null ? `Week ${items[0].week} · ${items[0].season}` : 'Current slate';

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-nfl-prop-matchups-split"
        showDetailOnMobile={!!selected}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel="Prop Matchups"
        list={
          <MlbToolFeedPanel
            games={items}
            isLoading={pagesQ.isLoading}
            errorMessage={errorMessage}
            onRefresh={() => pagesQ.refetch()}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            renderCard={(game, isSelected) => (
              <NflPropMatchupsListCard
                item={game}
                isSelected={isSelected}
                onSelect={(id) => selectGame(id)}
              />
            )}
            footnote={
              <>
                {weekLabel} · scheme + career look splits ·{' '}
                <Link to="/games?sport=nfl" className="font-semibold text-primary hover:underline">
                  NFL games
                </Link>
              </>
            }
            emptyIcon={<BarChart3 className="h-8 w-8 text-muted-foreground/50" />}
            emptyTitle="No NFL prop pages yet"
            emptyBody="Player prop matchups load once the weekly prop pages slate is generated."
          />
        }
        detail={
          <NflPropMatchupsDetailPane
            item={selected}
            isFeedLoading={pagesQ.isLoading}
            trendsByPlayer={trendsQ.data ?? {}}
          />
        }
      />
    </div>
  );
}
