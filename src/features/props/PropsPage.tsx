import * as React from 'react';
import { Link } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { trackEvent } from '@/lib/mixpanel';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { useAllMatchupData } from '@/hooks/useAllMatchupData';
import { useAllPlayerProps } from '@/hooks/useAllPlayerProps';
import { useParksMap } from '@/hooks/usePark';
import { PitcherMatchupsDetailPane } from '@/features/mlbTools/pitcherMatchups/PitcherMatchupsDetailPane';
import { PitcherMatchupsListCard } from '@/features/mlbTools/pitcherMatchups/PitcherMatchupsListCard';
import { buildPropMatchupFeedItems } from '@/features/mlbTools/pitcherMatchups/model';
import { useNflPropMatchupsPages, useNflPropTrendsBatch } from '@/features/nflTools/propMatchups/hooks';
import { buildNflPropGameFeed } from '@/features/nflTools/propMatchups/model';
import { NflPropMatchupsDetailPane } from '@/features/nflTools/propMatchups/NflPropMatchupsDetailPane';
import { NflPropMatchupsListCard } from '@/features/nflTools/propMatchups/NflPropMatchupsListCard';
import { PropBreakdownContent } from '@/features/propBreakdown/PropBreakdownPage';
import { PropsFeedPanel } from './PropsFeedPanel';
import { NflPlayerNavigator } from './NflPlayerNavigator';
import { usePropsUrlState, type PropsSport } from './usePropsUrlState';

interface WorkspaceProps {
  sport: PropsSport;
  onSportChange: (sport: PropsSport) => void;
  selectedGameId: string | null;
  selectedPlayerId: string | null;
  selectGame: (id: string | null, options?: { replace?: boolean }) => void;
  selectPlayer: (id: string | null, options?: { replace?: boolean }) => void;
}

function MlbPropsWorkspace(props: WorkspaceProps) {
  const isDesktop = useIsDesktopSplit();
  const { data: games = [], isLoading, error, refetch } = useTodaysMatchupGames();
  const { dataByGamePk, isLoading: matchupLoading } = useAllMatchupData(games, games.length > 0);
  const { propsByGamePk, isLoading: propsLoading } = useAllPlayerProps(games, games.length > 0);
  const homeAbbrs = React.useMemo(() => games.map((game) => game.home_abbr), [games]);
  const { data: parks } = useParksMap(homeAbbrs);
  const propsSignature = [...propsByGamePk].map(([pk, rows]) => `${pk}:${rows.length}`).join('|');
  const matchupSignature = [...dataByGamePk.keys()].join('|');
  const items = React.useMemo(
    () => buildPropMatchupFeedItems(games, propsByGamePk, dataByGamePk, propsLoading),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signatures replace unstable Map identities
    [games, propsSignature, matchupSignature, propsLoading],
  );
  const selected = items.find((game) => game.id === props.selectedGameId) ?? null;

  React.useEffect(() => {
    if (!isLoading && items.length > 0 && isDesktop && !selected) props.selectGame(items[0].id, { replace: true });
  }, [isDesktop, isLoading, items, props, selected]);

  return (
    <SplitViewLayout
      storageId="wagerproof-props-split"
      showDetailOnMobile={!!selected}
      onBackFromDetail={() => props.selectGame(null)}
      detailBackLabel="MLB Props"
      list={<PropsFeedPanel sport="mlb" onSportChange={props.onSportChange} games={items} isLoading={isLoading} errorMessage={error instanceof Error ? error.message : null} onRefresh={() => refetch()} selectedGameId={props.selectedGameId} onSelectGame={props.selectGame} renderCard={(game, isSelected) => <PitcherMatchupsListCard item={game} isSelected={isSelected} onSelect={props.selectGame} />} footnote={matchupLoading || propsLoading ? 'Loading lineups and posted props…' : <>DraftKings lines with last-10 clear rates · <Link to="/mlb/picks-report" className="font-semibold text-primary hover:underline">Player Prop Report</Link></>} emptyTitle="No MLB games scheduled" emptyBody="Prop matchups need a confirmed starter on both sides. Check back closer to first pitch." />}
      detail={<PitcherMatchupsDetailPane item={selected} isFeedLoading={isLoading} awayArchetype={selected ? dataByGamePk.get(selected.gamePk)?.awayArchetype ?? null : null} homeArchetype={selected ? dataByGamePk.get(selected.gamePk)?.homeArchetype ?? null : null} awayArsenal={selected ? dataByGamePk.get(selected.gamePk)?.awayArsenal ?? null : null} homeArsenal={selected ? dataByGamePk.get(selected.gamePk)?.homeArsenal ?? null : null} park={selected ? parks?.get(selected.game.home_abbr) : null} />}
    />
  );
}

function NflPropsWorkspace(props: WorkspaceProps) {
  const isDesktop = useIsDesktopSplit();
  const pagesQ = useNflPropMatchupsPages();
  const items = React.useMemo(() => buildNflPropGameFeed(pagesQ.data ?? []), [pagesQ.data]);
  const selectedByGame = items.find((game) => game.id === props.selectedGameId) ?? null;
  const selectedByPlayer = props.selectedPlayerId
    ? items.find((game) => [...game.awayPlayers, ...game.homePlayers].some((player) => player.player_id === props.selectedPlayerId)) ?? null
    : null;
  const selected = selectedByGame ?? selectedByPlayer;
  const playerIds = React.useMemo(() => selected ? [...selected.homePlayers, ...selected.awayPlayers].map((player) => player.player_id) : [], [selected]);
  const trendsQ = useNflPropTrendsBatch(playerIds);

  React.useEffect(() => {
    if (!pagesQ.isLoading && items.length > 0 && isDesktop && !selected) props.selectGame(items[0].id, { replace: true });
  }, [isDesktop, items, pagesQ.isLoading, props, selected]);

  const weekLabel = items[0] ? `Week ${items[0].week} · ${items[0].season}` : 'Current slate';
  const playerDrilldown = Boolean(selected && props.selectedPlayerId);
  const leavePlayer = () => props.selectPlayer(null);
  return (
    <SplitViewLayout
      storageId={playerDrilldown ? 'wagerproof-props-player-split' : 'wagerproof-props-split'}
      listDefaultSize={playerDrilldown ? 24 : undefined}
      listMinSize={playerDrilldown ? 20 : undefined}
      listMaxSize={playerDrilldown ? 32 : undefined}
      showDetailOnMobile={playerDrilldown || !!selected}
      onBackFromDetail={playerDrilldown ? leavePlayer : () => props.selectGame(null)}
      detailBackLabel={playerDrilldown ? 'Matchup' : 'NFL Props'}
      list={playerDrilldown && selected && props.selectedPlayerId ? (
        <NflPlayerNavigator game={selected} selectedPlayerId={props.selectedPlayerId} trendsByPlayer={trendsQ.data ?? {}} onSelectPlayer={props.selectPlayer} onBack={leavePlayer} />
      ) : (
        <PropsFeedPanel sport="nfl" onSportChange={props.onSportChange} games={items} isLoading={pagesQ.isLoading} errorMessage={pagesQ.error instanceof Error ? pagesQ.error.message : null} onRefresh={() => pagesQ.refetch()} selectedGameId={props.selectedGameId} onSelectGame={props.selectGame} renderCard={(game, isSelected) => <NflPropMatchupsListCard item={game} isSelected={isSelected} onSelect={props.selectGame} />} footnote={<>{weekLabel} · scheme + career look splits · <Link to="/games?sport=nfl" className="font-semibold text-primary hover:underline">NFL games</Link></>} emptyTitle="No NFL prop pages yet" emptyBody="Player prop matchups load once the weekly prop pages slate is generated." />
      )}
      detail={playerDrilldown && props.selectedPlayerId ? (
        <PropBreakdownContent playerId={props.selectedPlayerId} onBack={leavePlayer} backLabel="Matchup" />
      ) : (
        <NflPropMatchupsDetailPane item={selected} isFeedLoading={pagesQ.isLoading} trendsByPlayer={trendsQ.data ?? {}} onSelectPlayer={props.selectPlayer} />
      )}
    />
  );
}

export default function PropsPage() {
  const state = usePropsUrlState();
  React.useEffect(() => state.ensureSportInUrl(), [state.ensureSportInUrl]);
  React.useEffect(() => trackEvent('Props Viewed', { sport: state.sport }), [state.sport]);
  const workspaceProps = { sport: state.sport, onSportChange: state.setSport, selectedGameId: state.selectedGameId, selectedPlayerId: state.selectedPlayerId, selectGame: state.selectGame, selectPlayer: state.selectPlayer };
  return <div className="h-full min-h-0">{state.sport === 'nfl' ? <NflPropsWorkspace {...workspaceProps} /> : <MlbPropsWorkspace {...workspaceProps} />}</div>;
}
