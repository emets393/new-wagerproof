import * as React from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { GlassCard, SegmentedControl } from '@/components/ios';
import { cn } from '@/lib/utils';
import { MlbToolListSkeleton } from '@/features/mlbTools/shared/MlbToolListSkeleton';
import { compactMarketLabel } from '@/features/nflTools/propMatchups/NflPropPlayerCard';
import type { NflPropGameFeedItem } from '@/features/nflTools/propMatchups/model';
import { browseNflPropPlayers } from '@/features/nflTools/propMatchups/model';
import { bestMarket } from '@/features/nflTools/propMatchups/propLean';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { getNFLTeamColors } from '@/features/games/api/nflGames';
import { sportsbookMarkUrl } from '@/features/games/detail/sportsbooks/marks';
import { sportsbookName } from '@/features/games/detail/sportsbooks/quotes';
import type { NflPropBookQuote } from '@/features/nflTools/propMatchups/hooks';
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

function american(price: number): string {
  const rounded = Math.round(price);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `\u2212${Math.abs(rounded)}`;
  return '0';
}

/** The bet on the card: best book for the side, its line, and its price. */
export function listedOffer(
  side: 'over' | 'under' | null,
  market: { line: number | null; over_price: number | null; under_price: number | null } | undefined,
  quote?: NflPropBookQuote | null,
): { book: string | null; line: string | null; price: string | null } {
  const read = (which: 'over' | 'under') => {
    const fromBook = which === 'under'
      ? { book: quote?.underBook ?? null, line: quote?.underLine ?? null, price: quote?.underPrice ?? null }
      : { book: quote?.overBook ?? null, line: quote?.overLine ?? null, price: quote?.overPrice ?? null };
    return {
      book: fromBook.book,
      line: fromBook.line ?? market?.line ?? null,
      price: fromBook.price ?? (which === 'under' ? market?.under_price ?? null : market?.over_price ?? null),
    };
  };
  const chosen = side === 'under' ? read('under') : side === 'over' ? read('over') : (read('over').book || read('over').price != null ? read('over') : read('under'));
  return {
    book: chosen.book,
    line: chosen.line == null ? null : formatLine(chosen.line),
    price: chosen.price == null ? null : american(chosen.price),
  };
}

export function kickoffLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export function pillText(player: NflPropPlayerPage, pick?: SpotlightListPick): { market: string | null; line: string } {
  if (pick?.market && pick.side && pick.label) {
    const label = compactMarketLabel(pick.label);
    if (pick.line == null) {
      const side = pick.side === 'under' ? 'Under' : 'Over';
      return { market: pick.market, line: `${label} ${side}` };
    }
    const side = pick.side === 'under' ? 'U' : 'O';
    return { market: pick.market, line: `${label} ${side}${formatLine(pick.line)}` };
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
  return { market: market.key, line };
}

export function NflPropPlayerBrowser({
  players,
  games,
  gameIdByPlayer,
  spotlightRank,
  leanIds,
  spotlightRecord,
  books,
  rail,
  onRail,
  selectedPlayerId,
  onSelectPlayer,
  onSportChange,
  isLoading,
  onRefresh,
}: {
  players: NflPropPlayerPage[];
  games: NflPropGameFeedItem[];
  gameIdByPlayer: ReadonlyMap<string, string>;
  spotlightRank: ReadonlyMap<string, number>;
  leanIds: ReadonlySet<string>;
  spotlightRecord: ReadonlyMap<string, SpotlightListPick & { rank?: number }>;
  books?: ReadonlyMap<string, NflPropBookQuote>;
  rail: PropsRail;
  onRail: (rail: PropsRail) => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string, options?: { market?: string | null; gameId?: string | null; rail?: PropsRail }) => void;
  onSportChange: (sport: PropsSport) => void;
  isLoading: boolean;
  onRefresh: () => void;
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
        </div>

        <div className="space-y-2 px-3 pb-10 pt-1">
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
            const side = record?.side === 'over' || record?.side === 'under'
              ? record.side
              : scored?.direction === 'over' || scored?.direction === 'under'
                ? scored.direction
                : null;
            const posted = pill.market ? player.markets.find((row) => row.key === pill.market) : undefined;
            const offer = listedOffer(side, posted, pill.market ? books?.get(`${player.player_id}:${pill.market}`) : undefined);
            const bookSrc = sportsbookMarkUrl(offer.book);
            const when = kickoffLabel(player.kickoff);
            const gameId = gameIdByPlayer.get(player.player_id) ?? null;
            const open = () => {
              onSelectPlayer(player.player_id, {
                ...(pill.market ? { market: pill.market } : {}),
                gameId,
                ...(searching && gameId ? { rail: `g:${gameId}` } : {}),
              });
              if (searching) setSearchText('');
            };
            return (
              <GlassCard
                key={player.player_id}
                interactive
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                  }
                }}
                className="relative overflow-hidden px-3 py-2.5 text-left"
              >
                {selected ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-3/5 opacity-30 dark:opacity-40"
                    style={{ background: `radial-gradient(125% 100% at 0% 50%, ${getNFLTeamColors(player.team).primary} 0%, transparent 72%)` }}
                  />
                ) : null}
                <div className="relative flex items-center gap-2.5">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 bg-muted dark:border-white/10">
                    {player.headshot_url ? (
                      <img src={player.headshot_url} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[9px] font-bold text-muted-foreground">{player.position}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold leading-tight">{player.player_name}</div>
                    <div className="truncate text-[10px] font-semibold text-muted-foreground">
                      {player.position} · {player.team} vs {player.opponent}
                    </div>
                  </div>
                  <span className="max-w-[46%] shrink-0 truncate rounded-md border border-black/5 bg-white/50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
                    {pill.line}
                  </span>
                </div>
                {spotlight || scored?.lean ? (
                  <>
                    <div className="relative mt-2 border-t border-black/5 dark:border-white/10" />
                    <div className="relative mt-2">
                      {spotlight ? (
                        <span className="inline-flex rounded-full border border-primary/20 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          <span aria-hidden>🌟 </span>Spotlight
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                          <span aria-hidden>📈 </span>All {scored?.populated} readings point {scored?.direction}
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
                {offer.book || offer.line || offer.price || when ? (
                  <div className="relative mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-black/5 pt-2 dark:border-white/10">
                    {bookSrc ? (
                      <img src={bookSrc} alt={offer.book ? sportsbookName(offer.book) : ''} className="h-4 w-4 shrink-0 object-contain" />
                    ) : offer.book ? (
                      <span className="shrink-0 text-[10px] font-bold">{sportsbookName(offer.book)}</span>
                    ) : null}
                    {offer.line ? <span className="text-[12px] font-black tabular-nums">{offer.line}</span> : null}
                    {offer.price ? <span className="text-[12px] font-bold tabular-nums text-muted-foreground">{offer.price}</span> : null}
                    {when ? <span className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground">🕐 {when}</span> : null}
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
