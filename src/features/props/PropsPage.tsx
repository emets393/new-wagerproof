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
import { quotesForPlayer, slateContextFacts, useNflPropBooks, useNflPropCheatsheet, useNflPropMatchupsPages, useNflPropSpotlight, useNflPropSpotlightLedger, useNflPropTrendsBatch, useNflSlateLines } from '@/features/nflTools/propMatchups/hooks';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { buildNflPropGameFeed, spotlightRankMap } from '@/features/nflTools/propMatchups/model';
import { LivePropCard } from '@/features/nflTools/propMatchups/card/library/liveCard';
import { SpotlightPickCard } from '@/features/nflTools/propMatchups/card/SpotlightPickCard';
import { bestMarket, playerHasLean } from '@/features/nflTools/propMatchups/propLean';
import { PropsFeedPanel } from './PropsFeedPanel';
import { NflPropPlayerBrowser } from './NflPropPlayerBrowser';
import { NflCheatSheet } from './NflCheatSheet';
import { NflRecordStrip } from './NflRecordStrip';
import { usePropsUrlState, type PropsBrowse, type PropsFocus, type PropsPanel, type PropsRail, type PropsSport } from './usePropsUrlState';

interface WorkspaceProps {
  sport: PropsSport;
  panel: PropsPanel;
  market: string | null;
  onSportChange: (sport: PropsSport) => void;
  onPanelChange: (panel: PropsPanel) => void;
  selectedGameId: string | null;
  selectedPlayerId: string | null;
  browse: PropsBrowse;
  focus: PropsFocus;
  rail: PropsRail;
  onBrowseChange: (browse: PropsBrowse) => void;
  onFocusChange: (focus: PropsFocus) => void;
  onRailChange: (rail: PropsRail) => void;
  selectGame: (id: string | null, options?: { replace?: boolean }) => void;
  selectPlayer: (id: string | null, options?: { replace?: boolean; market?: string | null; gameId?: string | null }) => void;
  openPick: (next: { gameId: string | null; playerId: string; market: string }) => void;
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
  const pagesQ = useNflPropMatchupsPages();
  const pages = pagesQ.data ?? [];
  const season = pages[0]?.season;
  const week = pages[0]?.week;
  const spotlightQ = useNflPropSpotlight(season, week);
  const linesQ = useNflSlateLines(season, week);
  const ledgerQ = useNflPropSpotlightLedger();
  const cheatQ = useNflPropCheatsheet(season, week);
  const [cheatOpen, setCheatOpen] = React.useState(false);
  const booksQ = useNflPropBooks(season, week);
  const picks = spotlightQ.data ?? [];
  const spotlightRank = React.useMemo(() => spotlightRankMap(picks), [picks]);
  const spotlightRecord = React.useMemo(() => {
    const records = new Map<string, { nFor: number; nAgainst: number; rank: number; market: string; side: string; line: number | null; label: string }>();
    for (const pick of picks) {
      const rank = typeof pick.board_rank === 'number' ? pick.board_rank : Number.POSITIVE_INFINITY;
      const previous = records.get(pick.player_id);
      if (previous && rank >= previous.rank) continue;
      records.set(pick.player_id, {
        nFor: pick.n_for ?? 0,
        nAgainst: pick.n_against ?? 0,
        rank,
        market: pick.market,
        side: pick.side,
        line: pick.line,
        label: pick.market_label,
      });
    }
    return records;
  }, [picks]);
  const leanIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const player of pages) {
      if (spotlightRank.has(player.player_id)) continue;
      if (playerHasLean(player)) ids.add(player.player_id);
    }
    return ids;
  }, [pages, spotlightRank]);
  const items = React.useMemo(() => buildNflPropGameFeed(pages), [pages]);
  const listedPlayers = React.useMemo(() => {
    const rows: typeof pages = [];
    const seen = new Set<string>();
    for (const game of items) {
      for (const player of [...game.awayPlayers, ...game.homePlayers]) {
        if (seen.has(player.player_id)) continue;
        seen.add(player.player_id);
        rows.push(player);
      }
    }
    return rows;
  }, [items]);
  const gameIdByPlayer = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const game of items) {
      for (const player of [...game.awayPlayers, ...game.homePlayers]) map.set(player.player_id, game.id);
    }
    return map;
  }, [items]);
  const playerPage = props.selectedPlayerId ? pages.find((player) => player.player_id === props.selectedPlayerId) ?? null : null;
  const playerBooks = React.useMemo(
    () => quotesForPlayer(booksQ.data, playerPage?.player_id, playerPage?.markets ?? []),
    [booksQ.data, playerPage],
  );
  const playerPicks = picks
    .filter((pick) => pick.player_id === playerPage?.player_id)
    .sort((a, b) => (a.board_rank ?? 99) - (b.board_rank ?? 99));
  const activeMarket = props.market ?? playerPicks[0]?.market ?? (playerPage ? bestMarket(playerPage)?.market : null) ?? playerPage?.markets.find((market) => market.status === 'posted')?.key ?? null;
  const shownPicks = playerPicks.filter((pick) => pick.market === activeMarket);
  const playerIds = React.useMemo(
    () => (props.selectedPlayerId ? [props.selectedPlayerId] : []),
    [props.selectedPlayerId],
  );
  const trendsQ = useNflPropTrendsBatch(playerIds);
  const onMarket = React.useCallback((market: string) => {
    if (!props.selectedPlayerId) return;
    props.selectPlayer(props.selectedPlayerId, { market, replace: true });
  }, [props.selectedPlayerId, props.selectPlayer]);

  const showingPlayerCard = Boolean(playerPage);

  return (
    <SplitViewLayout
      storageId="wagerproof-props-split"
      showDetailOnMobile={showingPlayerCard || cheatOpen}
      onBackFromDetail={() => {
        if (cheatOpen) setCheatOpen(false);
        else props.selectPlayer(null);
      }}
      detailBackLabel={cheatOpen ? 'Cheat sheet' : 'Players'}
      list={
        <NflPropPlayerBrowser
          players={listedPlayers}
          games={items}
          gameIdByPlayer={gameIdByPlayer}
          spotlightRank={spotlightRank}
          leanIds={leanIds}
          spotlightRecord={spotlightRecord}
          rail={props.rail}
          onRail={props.onRailChange}
          selectedPlayerId={props.selectedPlayerId}
          onSelectPlayer={props.selectPlayer}
          onSportChange={props.onSportChange}
          isLoading={pagesQ.isLoading}
          onRefresh={() => { pagesQ.refetch(); spotlightQ.refetch(); ledgerQ.refetch(); }}
          onOpenCheat={() => setCheatOpen((open) => !open)}
          cheatOpen={cheatOpen}
          record={<NflRecordStrip rows={ledgerQ.data ?? []} isLoading={ledgerQ.isLoading} />}
        />
      }
      detail={cheatOpen ? (
        <NflCheatSheet
          rows={cheatQ.data ?? []}
          games={items}
          isLoading={cheatQ.isLoading}
          onClose={() => setCheatOpen(false)}
          onTeam={(gameId) => {
            setCheatOpen(false);
            props.onRailChange(`g:${gameId}`);
          }}
          onPlayer={(playerId) => {
            setCheatOpen(false);
            props.selectPlayer(playerId);
          }}
        />
      ) : playerPage ? (
        <div className="h-full overflow-y-auto px-3 py-4">
          {shownPicks.map((pick) => (
            <div key={`${pick.market}-${pick.side}`} className="mb-4">
              <SpotlightPickCard pick={pick} />
            </div>
          ))}
          <LivePropCard
            page={playerPage}
            marketKey={activeMarket}
            onMarket={onMarket}
            books={playerBooks}
            log={trendsQ.data?.[playerPage.player_id]?.recent_game_log ?? null}
            facts={slateContextFacts(playerPage, linesQ.data ?? [])}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-muted-foreground">
          Select a player. The list opens on this week's spotlight.
        </div>
      )}
    />
  );
}

export default function PropsPage() {
  const state = usePropsUrlState();
  React.useEffect(() => state.ensureSportInUrl(), [state.ensureSportInUrl]);
  React.useEffect(() => trackEvent('Props Viewed', { sport: state.sport }), [state.sport]);
  const workspaceProps = { sport: state.sport, panel: state.panel, market: state.market, browse: state.browse, focus: state.focus, rail: state.rail, onSportChange: state.setSport, onPanelChange: state.setPanel, onBrowseChange: state.setBrowse, onFocusChange: state.setFocus, onRailChange: state.setRail, selectedGameId: state.selectedGameId, selectedPlayerId: state.selectedPlayerId, selectGame: state.selectGame, selectPlayer: state.selectPlayer, openPick: state.openPick };
  return <div className="h-full min-h-0">{state.sport === 'nfl' ? <NflPropsWorkspace {...workspaceProps} /> : <MlbPropsWorkspace {...workspaceProps} />}</div>;
}
