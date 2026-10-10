import * as React from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { SegmentedControl } from '@/components/ios';
import { cn } from '@/lib/utils';
import { MlbToolListSkeleton } from '@/features/mlbTools/shared/MlbToolListSkeleton';
import { compactMarketLabel } from '@/features/nflTools/propMatchups/NflPropPlayerCard';
import type { NflPropGameFeedItem } from '@/features/nflTools/propMatchups/model';
import { browseNflPropPlayers } from '@/features/nflTools/propMatchups/model';
import { bestMarket } from '@/features/nflTools/propMatchups/propLean';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { getNflLinesCity } from '@/utils/nflTeamAssets';
import type { PropsRail, PropsSport } from './usePropsUrlState';

const SPORT_OPTIONS = [
  { value: 'mlb' as const, label: 'MLB' },
  { value: 'nfl' as const, label: 'NFL' },
  { value: 'nba' as const, label: 'NBA', status: 'Soon', disabled: true },
];

function formatLine(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type SpotlightListPick = {
  nFor: number;
  nAgainst: number;
  market?: string;
  side?: string;
  line?: number | null;
  label?: string;
};

export function pillText(player: NflPropPlayerPage, pick?: SpotlightListPick): { market: string | null; line: string } {
  if (pick?.market && pick.side && pick.label) {
    const label = compactMarketLabel(pick.label);
    const record = ` · ${pick.nFor}-${pick.nAgainst}`;
    if (pick.line == null) {
      const side = pick.side === 'under' ? 'Under' : 'Over';
      return { market: pick.market, line: `${label} ${side}${record}` };
    }
    const side = pick.side === 'under' ? 'U' : 'O';
    return { market: pick.market, line: `${label} ${side}${formatLine(pick.line)}${record}` };
  }
  const best = bestMarket(player);
  const market = best
    ? player.markets.find((row) => row.key === best.market)
    : player.markets.find((row) => row.status === 'posted');
  if (!market) return { market: null, line: player.position };
  const label = compactMarketLabel(market.label);
  if (!best || best.direction === 'split') {
    return { market: market.key, line: market.line == null ? label : `${label} ${formatLine(market.line)}` };
  }
  const side = best.direction === 'under' ? 'U' : 'O';
  const line = market.line == null ? label : `${label} ${side}${formatLine(market.line)}`;
  return { market: market.key, line: `${line} · ${best.nFor}-${best.nAgainst}` };
}

export function NflPropPlayerBrowser({
  players,
  games,
  gameIdByPlayer,
  spotlightRank,
  leanIds,
  spotlightRecord,
  rail,
  onRail,
  selectedPlayerId,
  onSelectPlayer,
  onSportChange,
  isLoading,
  onRefresh,
  onOpenCheat,
  cheatOpen = false,
  record,
}: {
  players: NflPropPlayerPage[];
  games: NflPropGameFeedItem[];
  gameIdByPlayer: ReadonlyMap<string, string>;
  spotlightRank: ReadonlyMap<string, number>;
  leanIds: ReadonlySet<string>;
  spotlightRecord: ReadonlyMap<string, SpotlightListPick & { rank?: number }>;
  rail: PropsRail;
  onRail: (rail: PropsRail) => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string, options?: { market?: string | null; gameId?: string | null; rail?: PropsRail }) => void;
  onSportChange: (sport: PropsSport) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCheat?: () => void;
  cheatOpen?: boolean;
  record?: React.ReactNode;
}) {
  const [searchText, setSearchText] = React.useState('');
  const searching = searchText.trim().length > 0;
  const visible = React.useMemo(
    () => browseNflPropPlayers(players, rail, searchText, spotlightRank, getNflLinesCity, leanIds, gameIdByPlayer),
    [gameIdByPlayer, leanIds, players, rail, searchText, spotlightRank],
  );

  const emptyTitle = searching
    ? 'No players match that search'
    : rail === 'spotlight'
      ? 'No spotlight picks this week'
      : rail === 'leans'
        ? 'No unanimous leans this week'
        : 'No players in this list';

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
          <SegmentedControl
            layoutId="props-player-sport-picker"
            size="sm"
            options={SPORT_OPTIONS}
            value="nfl"
            onChange={(value) => {
              if (value !== 'nba') onSportChange(value);
            }}
          />
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Player list"
              value={rail}
              onChange={(event) => onRail(event.target.value as PropsRail)}
              className="h-9 min-w-0 flex-1 rounded-full border border-black/5 bg-white/60 px-3 text-[12px] font-bold text-foreground outline-none dark:border-white/10 dark:bg-white/[0.06]"
            >
              <option value="spotlight">Spotlight</option>
              <option value="leans">Leans</option>
              <option value="all">All players</option>
              <option disabled>────────</option>
              {games.map((game) => (
                <option key={game.id} value={`g:${game.id}`}>
                  {game.away.abbrev} @ {game.home.abbrev}
                </option>
              ))}
            </select>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search players"
                className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-[13px] font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06]"
              />
              {searchText && (
                <button type="button" onClick={() => setSearchText('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh players"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
                isLoading && 'pointer-events-none opacity-60',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
          {onOpenCheat ? (
            <button
              type="button"
              onClick={onOpenCheat}
              className={cn(
                'h-8 w-full rounded-full text-[12px] font-bold',
                cheatOpen ? 'bg-primary text-primary-foreground' : 'border border-black/5 bg-white/60 dark:border-white/10 dark:bg-white/[0.06]',
              )}
            >
              Cheat sheet
            </button>
          ) : null}
          {record}
        </div>

        <div className="space-y-1 px-3 pb-10 pt-1">
          {isLoading ? <MlbToolListSkeleton /> : visible.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {searching ? 'Try a different name or team.' : 'Players show up once the weekly slate is generated.'}
              </p>
            </div>
          ) : visible.map((player) => {
            const selected = player.player_id === selectedPlayerId;
            const pill = pillText(player, spotlightRecord.get(player.player_id));
            const scored = bestMarket(player);
            const spotlight = spotlightRank.has(player.player_id);
            const record = spotlightRecord.get(player.player_id);
            const gameId = gameIdByPlayer.get(player.player_id) ?? null;
            return (
              <button
                key={player.player_id}
                type="button"
                onClick={() => {
                  onSelectPlayer(player.player_id, {
                    ...(pill.market ? { market: pill.market } : {}),
                    gameId,
                    ...(searching && gameId ? { rail: `g:${gameId}` } : {}),
                  });
                  if (searching) setSearchText('');
                }}
                className={cn(
                  'flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors',
                  selected ? 'bg-white shadow-sm dark:bg-white/10' : 'hover:bg-black/[0.035] dark:hover:bg-white/[0.05]',
                )}
              >
                <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                  {player.headshot_url ? (
                    <img src={player.headshot_url} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] font-bold text-muted-foreground">{player.position}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <div className="truncate text-[12px] font-bold">{player.player_name}</div>
                    <div className="shrink-0 text-[10px] font-bold tabular-nums text-foreground">{pill.line}</div>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    {spotlight ? (
                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                        Spotlight{record ? ` · ${record.nFor}-${record.nAgainst}` : ''}
                      </span>
                    ) : scored?.lean ? (
                      <span className="shrink-0 rounded-sm bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-700 dark:text-sky-300">
                        All {scored.populated} readings point {scored.direction}
                      </span>
                    ) : (
                      <span className="truncate text-[10px] font-semibold text-muted-foreground">{player.position} · {player.team}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
