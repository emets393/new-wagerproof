import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { useAllMatchupData } from '@/hooks/useAllMatchupData';
import { useAllPlayerProps } from '@/hooks/useAllPlayerProps';
import { useParksMap } from '@/hooks/usePark';
import { MlbToolFeedPanel } from '../shared/MlbToolFeedPanel';
import { useMlbToolUrlState } from '../shared/useMlbToolUrlState';
import { PitcherMatchupsDetailPane } from './PitcherMatchupsDetailPane';
import { PitcherMatchupsListCard } from './PitcherMatchupsListCard';
import { buildPropMatchupFeedItems } from './model';

/**
 * /mlb/pitcher-matchups — player prop matchups as a split view. Left = today's
 * MLB slate with each game's best posted prop on the card; right = that game's
 * prop board. Registered in SPLIT_VIEW_ROUTES in App.tsx, without which the page
 * would sit inside the padded scroller and lose its internal scrolling.
 *
 * Reuses the existing data layer verbatim (useTodaysMatchupGames +
 * useAllMatchupData + useAllPlayerProps); only the presentation is new.
 */
export default function PitcherMatchupsPage() {
  const { selectedGameId, selectGame } = useMlbToolUrlState();
  const isDesktop = useIsDesktopSplit();

  const { data: games = [], isLoading, error, refetch } = useTodaysMatchupGames();

  const { dataByGamePk, isLoading: matchupLoading } = useAllMatchupData(games, games.length > 0);
  const { propsByGamePk, isLoading: propsLoading } = useAllPlayerProps(games, games.length > 0);

  const homeAbbrs = React.useMemo(() => games.map((g) => g.home_abbr), [games]);
  const { data: parks } = useParksMap(homeAbbrs);

  // useQueries hands back a fresh Map on every render, so memoizing on the Map
  // identity would rebuild the whole feed (a pickHeadlineProp pass over every
  // posted line in the slate) each time. Key on a cheap content signature.
  const propsSignature = [...propsByGamePk]
    .map(([pk, rows]) => `${pk}:${rows.length}`)
    .join('|');
  const matchupSignature = [...dataByGamePk.keys()].join('|');

  const items = React.useMemo(
    () => buildPropMatchupFeedItems(games, propsByGamePk, dataByGamePk, propsLoading),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signatures stand in for the unstable Maps
    [games, propsSignature, matchupSignature, propsLoading],
  );

  const errorMessage = error instanceof Error ? error.message : null;

  React.useEffect(() => {
    trackEvent('Prop Matchups Viewed');
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
    if (selected) trackEvent('Prop Matchups Game Viewed', { gamePk: selected.gamePk });
  }, [selected?.gamePk]);

  const selectedMatchup = selected ? dataByGamePk.get(selected.gamePk) : undefined;

  return (
    <div className="h-full min-h-0">
      <SplitViewLayout
        storageId="wagerproof-mlb-prop-matchups-split"
        showDetailOnMobile={!!selected}
        onBackFromDetail={() => selectGame(null)}
        detailBackLabel="Prop Matchups"
        list={
          <MlbToolFeedPanel
            games={items}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onRefresh={() => refetch()}
            selectedGameId={selectedGameId}
            onSelectGame={(id) => selectGame(id)}
            renderCard={(game, isSelected) => (
              <PitcherMatchupsListCard
                item={game}
                isSelected={isSelected}
                onSelect={(id) => selectGame(id)}
              />
            )}
            footnote={
              matchupLoading || propsLoading
                ? 'Loading lineups and posted props…'
                : 'DraftKings lines with last-10 clear rates'
            }
            emptyIcon={<BarChart3 className="h-8 w-8 text-muted-foreground/50" />}
            emptyTitle="No MLB games scheduled"
            emptyBody="Prop matchups need a confirmed starter on both sides. Check back closer to first pitch."
          />
        }
        detail={
          <PitcherMatchupsDetailPane
            item={selected}
            isFeedLoading={isLoading}
            awayArchetype={selectedMatchup?.awayArchetype ?? null}
            homeArchetype={selectedMatchup?.homeArchetype ?? null}
            awayArsenal={selectedMatchup?.awayArsenal ?? null}
            homeArsenal={selectedMatchup?.homeArsenal ?? null}
            park={selected ? parks?.get(selected.game.home_abbr) : null}
          />
        }
      />
    </div>
  );
}
