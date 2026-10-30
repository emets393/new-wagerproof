import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, RefreshCw, Search, X, Zap } from 'lucide-react';
import { GlassCard, SegmentedControl } from '@/components/ios';
import { HeroFilterPill } from '@/features/outliers/components/HeroFilterPills';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { PropMiniViz } from '@/components/mlb/player-props/PropMiniViz';
import { RecentPropBarChart } from '@/components/mlb/player-props/RecentPropBarChart';
import { sportsbookMarkUrl } from '@/features/games/detail/sportsbooks/marks';
import { sportsbookName } from '@/features/games/detail/sportsbooks/quotes';
import { cn } from '@/lib/utils';
import type { PropsSport } from '@/features/props/usePropsUrlState';
import {
  betterAmerican,
  clearedCount,
  fetchNbaPropBooks,
  fetchNbaSlateProps,
  flagKeys,
  formatAmerican,
  formatPropNumber,
  gameKey,
  gameLabel,
  isOut,
  lineMovement,
  nbaOpponentLogo,
  num,
  pickSide,
  propKey,
  recentForm,
  signalSentence,
  type NbaBookQuote,
  type NbaPickSide,
  type NbaPropDef,
  type NbaSlateProp,
} from './nbaPropsApi';

const SPORT_OPTIONS = [
  { value: 'mlb' as const, label: 'MLB' },
  { value: 'nfl' as const, label: 'NFL' },
  { value: 'nba' as const, label: 'NBA' },
];

const MARKET_EMOJI: Record<string, string> = {
  player_points: '🏀',
  player_rebounds: '💪',
  player_assists: '🎯',
  player_threes: '🔥',
  player_blocks: '🛑',
  player_steals: '🧤',
  player_points_rebounds_assists: '📊',
  player_points_rebounds: '📈',
  player_points_assists: '🤝',
  player_rebounds_assists: '🧩',
};

function Emoji({ children }: { children: string }) {
  return <span className="text-[14px] leading-none">{children}</span>;
}

export function NbaPropsWorkspace({
  onSportChange,
  selectedPlayerId,
  selectPlayer,
}: {
  onSportChange: (sport: PropsSport) => void;
  selectedPlayerId: string | null;
  selectPlayer: (id: string | null, options?: { replace?: boolean }) => void;
}) {
  const isDesktop = useIsDesktopSplit();
  const query = useQuery({ queryKey: ['nba-slate-props'], queryFn: fetchNbaSlateProps });
  const rows = query.data?.rows ?? [];
  const defs = query.data?.defs ?? {};
  const [game, setGame] = React.useState('all');
  const [market, setMarket] = React.useState('all');
  const [signal, setSignal] = React.useState('all');
  const [searchText, setSearchText] = React.useState('');

  const games = React.useMemo(() => slateGames(rows), [rows]);
  const markets = React.useMemo(() => slateMarkets(rows), [rows]);
  const names = React.useMemo(() => athleteNames(rows), [rows]);
  const signalCounts = React.useMemo(() => playerSignalCounts(rows), [rows]);
  const visible = React.useMemo(
    () => filterRows(rows, { game, market, signal, query: searchText }),
    [game, market, rows, searchText, signal],
  );
  const selected = rows.find((row) => propKey(row) === selectedPlayerId) ?? null;

  React.useEffect(() => {
    if (query.isLoading || selected || !isDesktop || visible.length === 0) return;
    selectPlayer(propKey(visible[0]), { replace: true });
  }, [isDesktop, query.isLoading, selectPlayer, selected, visible]);

  return (
    <SplitViewLayout
      storageId="wagerproof-nba-props-split"
      showDetailOnMobile={!!selected}
      onBackFromDetail={() => selectPlayer(null)}
      detailBackLabel="NBA Props"
      list={
        <NbaPropList
          rows={rows}
          visible={visible}
          games={games}
          markets={markets}
          defs={defs}
          game={game}
          market={market}
          signal={signal}
          signalCounts={signalCounts}
          names={names}
          searchText={searchText}
          isLoading={query.isLoading}
          errorMessage={query.error instanceof Error ? query.error.message : null}
          onGame={setGame}
          onMarket={setMarket}
          onSignal={setSignal}
          onSearch={setSearchText}
          onRefresh={() => query.refetch()}
          selectedId={selected ? propKey(selected) : null}
          onSelect={(id) => selectPlayer(id)}
          onSportChange={onSportChange}
        />
      }
      detail={selected ? (
        <NbaPropDetail
          key={propKey(selected)}
          row={selected}
          defs={defs}
          siblings={playerMarkets(rows, selected)}
          names={names}
          onMarket={(id) => selectPlayer(id, { replace: true })}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-muted-foreground">
          Select a player to see the pick, the recent games, and the posted prices.
        </div>
      )}
    />
  );
}

function NbaPropList({
  rows,
  visible,
  games,
  markets,
  defs,
  game,
  market,
  signal,
  signalCounts,
  names,
  searchText,
  isLoading,
  errorMessage,
  onGame,
  onMarket,
  onSignal,
  onSearch,
  onRefresh,
  selectedId,
  onSelect,
  onSportChange,
}: {
  rows: NbaSlateProp[];
  visible: NbaSlateProp[];
  games: { key: string; label: string; away: string | null; home: string | null }[];
  markets: { key: string; label: string }[];
  defs: Record<string, NbaPropDef>;
  game: string;
  market: string;
  signal: string;
  signalCounts: Map<string, number>;
  names: Map<string, string>;
  searchText: string;
  isLoading: boolean;
  errorMessage: string | null;
  onGame: (value: string) => void;
  onMarket: (value: string) => void;
  onSignal: (value: string) => void;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSportChange: (sport: PropsSport) => void;
}) {
  const searching = searchText.trim().length > 0;
  const filtered = game !== 'all' || market !== 'all' || signal !== 'all';
  const signalChoices = signalFilterOptions(rows);
  const selectedGame = games.find((item) => item.key === game) ?? null;
  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              layoutId="props-sport-picker"
              size="sm"
              className="min-w-0 flex-1"
              options={SPORT_OPTIONS}
              value="nba"
              onChange={onSportChange}
            />
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh NBA props"
              className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]', isLoading && 'pointer-events-none opacity-60')}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-transparent">
            <HeroFilterPill
              icon={selectedGame ? <MatchupLogos away={selectedGame.away} home={selectedGame.home} /> : <Emoji>🏀</Emoji>}
              label="All games"
              defaultValue="all"
              value={game}
              onChange={onGame}
              options={[
                { value: 'all', label: 'All games', icon: <Emoji>🏀</Emoji> },
                ...games.map((item) => ({
                  value: item.key,
                  label: item.label,
                  icon: <MatchupLogos away={item.away} home={item.home} />,
                })),
              ]}
            />
            <HeroFilterPill
              icon={<Emoji>{market === 'all' ? '🎯' : MARKET_EMOJI[market] || '🎯'}</Emoji>}
              label="All markets"
              defaultValue="all"
              value={market}
              onChange={onMarket}
              options={[
                { value: 'all', label: 'All markets', icon: <Emoji>🎯</Emoji> },
                ...markets.map((item) => ({
                  value: item.key,
                  label: item.label,
                  icon: <Emoji>{MARKET_EMOJI[item.key] || '🎯'}</Emoji>,
                })),
              ]}
            />
            <HeroFilterPill
              icon={<Emoji>⚡</Emoji>}
              label="Signals"
              defaultValue="all"
              value={signal}
              onChange={onSignal}
              options={signalChoices}
            />
          </div>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search players"
              className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-[13px] font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06]"
            />
            {searchText && (
              <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 px-3 pb-10 pt-1">
          {errorMessage && <p className="rounded-2xl bg-amber-500/10 px-3 py-2 text-[12px] text-foreground">{errorMessage}</p>}
          {isLoading ? (
            <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">Loading the slate…</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">{searching ? 'No players match that search' : 'No NBA props on the board'}</p>
              <p className="max-w-[16rem] text-[12px] text-muted-foreground">
                {searching ? 'Try a different name or team.' : filtered ? 'Nothing in this game, market, or signal filter.' : 'Today and tomorrow are empty.'}
              </p>
            </div>
          ) : visible.map((row) => (
            <PropCard
              key={propKey(row)}
              row={row}
              defs={defs}
              names={names}
              signalCount={signalCounts.get(playerGameId(row)) ?? 0}
              selected={propKey(row) === selectedId}
              onSelect={() => onSelect(propKey(row))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PropCard({
  row,
  defs,
  names,
  signalCount,
  selected,
  onSelect,
}: {
  row: NbaSlateProp;
  defs: Record<string, NbaPropDef>;
  names: Map<string, string>;
  signalCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const form = recentForm(row);
  const side = pickSide(row, defs);
  const label = row.market_label || row.market || 'Prop';
  const line = formatPropNumber(num(row.line));
  const pick = side === 'over' ? `${label} O${line}` : side === 'under' ? `${label} U${line}` : `${label} ${line}`;
  const reasons = signalLines(row, defs, names);
  return (
    <GlassCard
      interactive
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn('relative overflow-hidden px-3 py-2.5 text-left', isOut(row.report_status) && 'opacity-50')}
    >
      {selected ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-primary/25 to-transparent" />
      ) : null}
      <div className="relative flex items-center gap-2.5">
        <Headshot row={row} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold leading-tight">{row.player_name || 'Player'}</div>
          <div className="truncate text-[10px] font-semibold text-muted-foreground">
            {[row.position, row.team && row.opponent ? `${row.team} vs ${row.opponent}` : row.game].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className="max-w-[46%] shrink-0 truncate rounded-md border border-black/5 bg-white/50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
          {pick}
        </span>
      </div>
      <div className="relative mt-2 flex items-center gap-2 border-t border-black/5 pt-2 dark:border-white/10">
        <PropMiniViz strip={form.strip} />
        <span className="text-[11px] font-semibold tabular-nums text-primary">
          {form.games > 0 ? `${form.hits}/${form.games}` : '—'}
        </span>
        {signalCount > 0 && <SignalCount count={signalCount} />}
        {isOut(row.report_status) && <span className="text-[10px] font-bold uppercase text-muted-foreground">Out</span>}
      </div>
      {reasons.map((reason) => (
        <p key={reason} className="relative mt-1.5 text-[11px] leading-snug text-foreground">{reason}</p>
      ))}
    </GlassCard>
  );
}

function NbaPropDetail({
  row,
  defs,
  siblings,
  names,
  onMarket,
}: {
  row: NbaSlateProp;
  defs: Record<string, NbaPropDef>;
  siblings: NbaSlateProp[];
  names: Map<string, string>;
  onMarket: (id: string) => void;
}) {
  const books = useQuery({
    queryKey: ['nba-prop-books', propKey(row)],
    queryFn: () => fetchNbaPropBooks(row),
  });
  const form = recentForm(row);
  const last5 = recentForm(row, 5);
  const side = pickSide(row, defs);
  const keys = flagKeys(row.flags);
  const line = num(row.line);
  const lineText = formatPropNumber(line);
  const market = row.market_label || row.market || 'Prop';
  const quotes = books.data?.current ?? [];
  const bestOver = bestQuote(quotes, 'over');
  const bestUnder = bestQuote(quotes, 'under');
  const hero = side === 'under' ? bestUnder : side === 'over' ? bestOver : null;
  const heroPrice = hero?.price ?? (side === 'under' ? num(row.under_price) : side === 'over' ? num(row.over_price) : null);
  const out = isOut(row.report_status);
  const seasonGames = num(row.gp_prior);

  return (
    <div className={cn('h-full overflow-y-auto px-4 py-5', out && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <Headshot row={row} size={56} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight">{row.player_name}</h2>
          <p className="text-[12px] text-muted-foreground">
            {[row.position, row.team && row.opponent ? `${row.team} vs ${row.opponent}` : row.game, tipLabel(row.commence_time)].filter(Boolean).join(' · ')}
          </p>
          {out && <p className="text-[12px] font-semibold text-muted-foreground">Out</p>}
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={`Markets for ${row.player_name ?? 'this player'}`}>
          {siblings.map((sibling) => {
            const active = propKey(sibling) === propKey(row);
            const label = sibling.market_label || sibling.market || 'Prop';
            return (
              <button
                key={propKey(sibling)}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onMarket(propKey(sibling))}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-[12px] font-bold tabular-nums',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-black/5 bg-white/60 text-foreground dark:border-white/10 dark:bg-white/[0.06]',
                )}
              >
                {label} {formatPropNumber(num(sibling.line))}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{market}</p>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-extrabold tabular-nums leading-none text-primary sm:text-4xl">
            {side ? `${side === 'over' ? 'Over' : 'Under'} ${lineText}` : lineText}
          </span>
          {side && heroPrice !== null && (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums">
              <BookMark book={hero?.book ?? null} />
              {formatAmerican(heroPrice)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <PricePill emphasis={side !== 'under'} label="Over" line={lineText} market={market} price={bestOver?.price ?? num(row.over_price)} book={bestOver?.book ?? null} />
          <PricePill emphasis={side === 'under'} label="Under" line={lineText} market={market} price={bestUnder?.price ?? num(row.under_price)} book={bestUnder?.book ?? null} />
        </div>
        {keys.length > 0 && <SignalBlock row={row} defs={defs} keys={keys} names={names} />}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-extrabold tabular-nums leading-none text-primary">
          {form.pct === null ? '—' : `${Math.round(form.pct)}` }
          {form.pct !== null && <span className="text-xl">%</span>}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          Cleared the line{form.games > 0 ? ` · ${form.hits}/${form.games} last ${form.games}` : ''}
        </span>
      </div>

      <div className="mt-4">
        {line === null ? (
          <p className="py-6 text-center text-xs italic text-muted-foreground">No line posted</p>
        ) : (
          <RecentPropBarChart
            bars={form.bars}
            line={line}
            valueLabel={market}
            mark={(bar) => <OpponentMark opponent={bar.archetype} date={bar.date} />}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-black/5 p-3 dark:border-white/10">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Shop the line</h3>
          {books.isLoading ? <p className="mt-2 text-[12px] text-muted-foreground">Loading posted prices…</p> : (
            <BookTable quotes={quotes} bestOver={bestOver} bestUnder={bestUnder} />
          )}
        </section>
        <section className="rounded-2xl border border-black/5 p-3 dark:border-white/10">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Line movement</h3>
          <MovementChart
            quotes={books.data?.history ?? []}
            loading={books.isLoading}
            openLine={num(row.open_line)}
            currentLine={line}
          />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 pb-8">
        <FormStat
          window="Last 5 games"
          market={market}
          avg={num(row.l5_avg)}
          hits={last5.games > 0 ? last5.hits : null}
          games={last5.games > 0 ? last5.games : null}
          line={line}
        />
        <FormStat
          window="Last 10 games"
          market={market}
          avg={num(row.l10_avg)}
          hits={form.games > 0 ? form.hits : null}
          games={form.games > 0 ? form.games : null}
          line={line}
        />
        <FormStat
          window="This season"
          market={market}
          avg={num(row.szn_avg)}
          hits={clearedCount(num(row.over_rate_szn), seasonGames)}
          games={seasonGames}
          line={line}
        />
      </div>
    </div>
  );
}

function signalLines(row: NbaSlateProp, defs: Record<string, NbaPropDef>, names: Map<string, string>): string[] {
  return flagKeys(row.flags).flatMap((key) => {
    const def = defs[key];
    const line = signalSentence(key, row.flag_detail, (id) => names.get(id) ?? null)
      || blankToNull(def?.one_liner)
      || blankToNull(def?.display_name);
    return line ? [line] : [];
  });
}

function SignalCount({ count }: { count: number }) {
  const label = `${count} Signal${count === 1 ? '' : 's'}`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-extrabold tracking-tight text-amber-700 dark:border-amber-400/50 dark:bg-amber-400/20 dark:text-amber-300"
      title={label}
      aria-label={label}
    >
      <Zap className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />
      {label}
    </span>
  );
}

function SignalBlock({
  row,
  defs,
  keys,
  names,
}: {
  row: NbaSlateProp;
  defs: Record<string, NbaPropDef>;
  keys: string[];
  names: Map<string, string>;
}) {
  return (
    <div className="space-y-2 pt-1">
      {keys.map((key) => {
        const def = defs[key];
        const specific = signalSentence(key, row.flag_detail, (id) => names.get(id) ?? null);
        const oneLiner = blankToNull(def?.one_liner);
        const definition = blankToNull(def?.definition);
        const why = blankToNull(def?.why_it_works);
        return (
          <div key={key} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            <div className="text-[14px] font-bold">{def?.display_name || key}</div>
            {oneLiner && <p className="mt-1 text-[13px] leading-snug">{oneLiner}</p>}
            {specific && specific !== oneLiner && <p className="mt-1 text-[13px] leading-snug">{specific}</p>}
            {definition && definition !== oneLiner && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{definition}</p>
            )}
            {why && why !== definition && why !== oneLiner && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{why}</p>
            )}
            {(def?.record_text || def?.season_record_text) && (
              <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                {[def?.season_record_text, def?.record_text].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function blankToNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function Headshot({ row, size }: { row: NbaSlateProp; size: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full border border-black/10 bg-muted dark:border-white/10" style={{ width: size, height: size }}>
      {row.headshot_url ? (
        <img src={row.headshot_url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full items-center justify-center text-[9px] font-bold text-muted-foreground">{row.position || 'NBA'}</div>
      )}
    </div>
  );
}

function BookMark({ book }: { book: string | null }) {
  const src = sportsbookMarkUrl(book);
  if (!src) return null;
  return <img src={src} alt={book ? sportsbookName(book.toLowerCase()) : ''} className="h-4 w-4 shrink-0 object-contain" />;
}

function PricePill({
  emphasis,
  label,
  line,
  market,
  price,
  book,
}: {
  emphasis: boolean;
  label: string;
  line: string;
  market: string;
  price: number | null;
  book: string | null;
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md border px-2 py-1',
      emphasis ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/60 bg-muted/30 text-muted-foreground',
    )}>
      <BookMark book={book} />
      {label} {line} {market.toLowerCase()}
      <span className={cn('ml-1 font-bold', emphasis ? 'text-primary' : 'text-foreground')}>{formatAmerican(price)}</span>
    </span>
  );
}

function OpponentMark({ opponent, date }: { opponent: string | null; date: string | null }) {
  const src = nbaOpponentLogo(opponent);
  return (
    <>
      {src ? (
        <img src={src} alt={opponent ?? ''} className="h-5 w-5 object-contain" />
      ) : (
        <span className="text-[9px] font-bold text-muted-foreground">{opponent ?? ''}</span>
      )}
      <span className="text-[9px] tabular-nums text-muted-foreground">{shortDate(date)}</span>
    </>
  );
}

function BookTable({
  quotes,
  bestOver,
  bestUnder,
}: {
  quotes: NbaBookQuote[];
  bestOver: { book: string; price: number } | null;
  bestUnder: { book: string; price: number } | null;
}) {
  if (quotes.length === 0) return <p className="mt-2 text-[12px] text-muted-foreground">No posted prices yet.</p>;
  const sorted = [...quotes].sort((a, b) => (a.bookmaker || '').localeCompare(b.bookmaker || ''));
  return (
    <div className="mt-2 space-y-2">
      {sorted.map((quote, index) => {
        const book = quote.bookmaker || '';
        const over = num(quote.over_odds);
        const under = num(quote.under_odds);
        const overBest = bestOver !== null && book === bestOver.book && over === bestOver.price;
        const underBest = bestUnder !== null && book === bestUnder.book && under === bestUnder.price;
        return (
          <div key={`${book}-${index}`} className="flex items-start gap-2 text-[12px]">
            <BookMark book={book} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{book ? sportsbookName(book.toLowerCase()) : 'Book'}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums">
                <span className="text-sky-500">{formatPropNumber(num(quote.line))}</span>
                <span className={cn(overBest && 'font-bold text-primary')}>O {formatAmerican(over)}{overBest ? ' Best' : ''}</span>
                <span className={cn(underBest && 'font-bold text-primary')}>U {formatAmerican(under)}{underBest ? ' Best' : ''}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MovementChart({
  quotes,
  loading,
  openLine,
  currentLine,
}: {
  quotes: NbaBookQuote[];
  loading: boolean;
  openLine: number | null;
  currentLine: number | null;
}) {
  if (loading) return <p className="mt-2 text-[12px] text-muted-foreground">Loading the line history…</p>;
  const summary = lineMovement(quotes);
  const openValue = summary.open?.line ?? openLine;
  const currentValue = summary.current?.line ?? currentLine;
  if (openValue === null && currentValue === null) {
    return <p className="mt-2 text-[12px] text-muted-foreground">Not charted.</p>;
  }

  const timed = summary.open !== null && summary.current !== null;
  const openAt = summary.open?.at ?? 0;
  const currentAt = summary.current?.at ?? 1;
  const mid = timed ? summary.mid : null;
  const flat = !timed || currentAt <= openAt;
  const values = [openValue, currentValue, mid?.line ?? null].filter((value): value is number => value !== null);
  for (const move of summary.moves) values.push(move.line);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const spanT = Math.max(currentAt - openAt, 1);
  const w = 280;
  const h = 128;
  const padX = 14;
  const plotTop = 50;
  const plotBottom = 104;
  const xOf = (at: number) => padX + ((at - openAt) / spanT) * (w - padX * 2);
  const yOf = (line: number) => (
    max === min
      ? (plotTop + plotBottom) / 2
      : plotBottom - ((line - min) / span) * (plotBottom - plotTop)
  );
  const xOpen = flat ? padX : xOf(openAt);
  const xCurrent = flat ? w - padX : xOf(currentAt);
  const segs: MovementSeg[] = [];
  const push = (x1: number, y1: number, x2: number, y2: number) => {
    segs.push({ x1, y1, x2, y2 });
  };
  let path = '';
  const approximate = !timed && openValue !== null && currentValue !== null && Math.abs(openValue - currentValue) >= 0.05;
  if (flat || summary.moves.length === 0) {
    const y1 = yOf(openValue ?? currentValue!);
    const y2 = yOf(currentValue ?? openValue!);
    push(xOpen, y1, xCurrent, y2);
    path = `M${xOpen.toFixed(1)},${y1.toFixed(1)} L${xCurrent.toFixed(1)},${y2.toFixed(1)}`;
  } else {
    let cx = xOf(summary.moves[0].at);
    let cy = yOf(summary.moves[0].line);
    path = `M${cx.toFixed(1)},${cy.toFixed(1)}`;
    for (let index = 1; index < summary.moves.length; index += 1) {
      const move = summary.moves[index];
      const nx = xOf(move.at);
      const ny = yOf(move.line);
      if (Math.abs(nx - cx) > 0.4) {
        push(cx, cy, nx, cy);
        path += ` H${nx.toFixed(1)}`;
        cx = nx;
      }
      if (Math.abs(ny - cy) > 0.4) {
        push(cx, cy, cx, ny);
        path += ` V${ny.toFixed(1)}`;
        cy = ny;
      }
    }
    if (Math.abs(xCurrent - cx) > 0.4) {
      push(cx, cy, xCurrent, cy);
      path += ` H${xCurrent.toFixed(1)}`;
    }
  }

  const labels: { key: string; line: number; x: number; anchor: MovementAnchor; at: number | null }[] = [];
  if (openValue !== null) labels.push({ key: 'open', line: openValue, x: xOpen, anchor: 'start', at: timed ? openAt : null });
  if (mid) labels.push({ key: 'mid', line: mid.line, x: xOf(mid.at), anchor: 'middle', at: mid.at });
  if (currentValue !== null) labels.push({ key: 'current', line: currentValue, x: xCurrent, anchor: 'end', at: timed ? currentAt : null });
  if (labels.length === 1) labels[0] = { ...labels[0], x: w / 2, anchor: 'middle' };

  const placed = labels.map((label) => {
    const spot = placeMovementLabel(label, yOf(label.line), segs);
    return { ...label, ...spot };
  });
  const sameDay = new Set(placed.flatMap((label) => (label.at === null || flat ? [] : [etParts(label.at).day]))).size <= 1;
  const aria = placed.map((label) => `${label.caption} ${label.value}`).join(', ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 block h-auto w-full text-primary" role="img" aria-label={`Line movement. ${aria}`}>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={approximate ? '4 3' : undefined}
      />
      {placed.map((label) => (
        <g key={label.key}>
          <text x={label.x} y={label.captionY} textAnchor={label.anchor} fontSize="9" fontFamily="inherit" className="fill-muted-foreground">
            {label.caption}
          </text>
          <text
            x={label.x}
            y={label.valueY}
            textAnchor={label.anchor}
            fontSize="13"
            fontWeight="700"
            fontFamily="inherit"
            className="fill-foreground"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {label.value}
          </text>
          {label.at !== null && !flat && (
            <text x={label.x} y={h - 6} textAnchor={label.anchor} fontSize="8" fontFamily="inherit" className="fill-muted-foreground">
              {sameDay ? etParts(label.at).clock : `${etParts(label.at).day} ${etParts(label.at).clock}`}
            </text>
          )}
        </g>
      ))}
      {placed.map((label) => (
        <circle key={`${label.key}-dot`} cx={label.x} cy={yOf(label.line)} r="3.25" fill="currentColor">
          <title>{label.at === null ? `${label.caption} ${label.value}` : `${label.caption} ${label.value} at ${moveWhen(label.at)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

type MovementAnchor = 'start' | 'middle' | 'end';
type MovementSeg = { x1: number; y1: number; x2: number; y2: number };
type MovementBox = { x1: number; y1: number; x2: number; y2: number };

const MOVEMENT_NAMES: Record<string, [string, string]> = {
  open: ['Opening', 'Open'],
  mid: ['Middle', 'Mid'],
  current: ['Current', 'Now'],
};

function movementLabelBox(
  x: number,
  anchor: MovementAnchor,
  caption: string,
  value: string,
  captionY: number,
  valueY: number,
): MovementBox {
  const width = Math.max(caption.length * 6.4, value.length * 7.6);
  const x1 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
  return {
    x1,
    y1: Math.min(captionY, valueY) - 9,
    x2: x1 + width,
    y2: Math.max(captionY, valueY) + 2,
  };
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number) {
  const left = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const right = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return right - left > 0.5;
}

function movementLabelHits(box: MovementBox, segs: MovementSeg[]) {
  const rect = { x1: box.x1 - 2, y1: box.y1 - 2, x2: box.x2 + 2, y2: box.y2 + 2 };
  return segs.some((seg) => {
    const horizontal = Math.abs(seg.y1 - seg.y2) < 0.6;
    const vertical = Math.abs(seg.x1 - seg.x2) < 0.6;
    if (horizontal) {
      const y = (seg.y1 + seg.y2) / 2;
      return y >= rect.y1 && y <= rect.y2 && rangesOverlap(seg.x1, seg.x2, rect.x1, rect.x2);
    }
    if (vertical) {
      const x = (seg.x1 + seg.x2) / 2;
      return x >= rect.x1 && x <= rect.x2 && rangesOverlap(seg.y1, seg.y2, rect.y1, rect.y2);
    }
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const x = seg.x1 + (seg.x2 - seg.x1) * t;
      const y = seg.y1 + (seg.y2 - seg.y1) * t;
      if (x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2) return true;
    }
    return false;
  });
}

function placeMovementLabel(
  label: { key: string; x: number; anchor: MovementAnchor; line: number },
  dotY: number,
  segs: MovementSeg[],
) {
  const value = formatPropNumber(label.line);
  const names = MOVEMENT_NAMES[label.key] ?? ['Line', 'Line'];
  const stacks = [
    { captionY: dotY - 28, valueY: dotY - 14 },
    { captionY: dotY + 30, valueY: dotY + 16 },
  ];
  for (const caption of names) {
    for (const stack of stacks) {
      const box = movementLabelBox(label.x, label.anchor, caption, value, stack.captionY, stack.valueY);
      if (box.y1 < 2 || box.y2 > 110) continue;
      if (!movementLabelHits(box, segs)) return { caption, value, ...stack };
    }
  }
  let captionY = dotY - 28;
  let valueY = dotY - 14;
  const caption = names[1];
  for (let step = 0; step < 10; step += 1) {
    const box = movementLabelBox(label.x, label.anchor, caption, value, captionY, valueY);
    if (box.y1 >= 2 && !movementLabelHits(box, segs)) break;
    captionY -= 4;
    valueY -= 4;
    if (captionY < 12) break;
  }
  return { caption, value, captionY, valueY };
}

function FormStat({
  window,
  market,
  avg,
  hits,
  games,
  line,
}: {
  window: string;
  market: string;
  avg: number | null;
  hits: number | null;
  games: number | null;
  line: number | null;
}) {
  const cleared = hits !== null && games !== null && games > 0 && line !== null
    ? `Over ${formatPropNumber(line)} in ${hits} of ${games}`
    : null;
  return (
    <div className="rounded-2xl border border-black/5 px-2.5 py-2 dark:border-white/10">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{window}</div>
      <div className="mt-1 text-[18px] font-bold tabular-nums leading-none">{avg === null ? '—' : avg.toFixed(1)}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{market} per game</div>
      {cleared ? (
        <div className="mt-0.5 text-[11px] font-semibold leading-snug">{cleared}</div>
      ) : games !== null && games > 0 ? (
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{Math.round(games)} games</div>
      ) : null}
    </div>
  );
}

function bestQuote(quotes: NbaBookQuote[], side: NbaPickSide): { book: string; price: number } | null {
  let best: { book: string; price: number } | null = null;
  for (const quote of quotes) {
    const price = num(side === 'over' ? quote.over_odds : quote.under_odds);
    const book = quote.bookmaker || '';
    if (price === null || !book) continue;
    if (!best || betterAmerican(price, best.price)) best = { book, price };
  }
  return best;
}

const MARKET_ORDER = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_blocks',
  'player_steals',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_rebounds_assists',
];

function playerMarkets(rows: NbaSlateProp[], row: NbaSlateProp): NbaSlateProp[] {
  return rows
    .filter((candidate) => String(candidate.athlete_id) === String(row.athlete_id) && candidate.game_date === row.game_date)
    .sort((a, b) => {
      const left = MARKET_ORDER.indexOf(a.market ?? '');
      const right = MARKET_ORDER.indexOf(b.market ?? '');
      return (left === -1 ? MARKET_ORDER.length : left) - (right === -1 ? MARKET_ORDER.length : right);
    });
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  return `${Number(match[2])}/${Number(match[3])}`;
}

function moveWhen(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

function etParts(ms: number): { day: string; clock: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const period = part('dayPeriod').toLowerCase().startsWith('a') ? 'a' : 'p';
  return {
    day: `${part('month')}/${part('day')}`,
    clock: `${part('hour')}:${part('minute')}${period}`,
  };
}

function tipLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })} ET`;
}

function MatchupLogos({ away, home }: { away: string | null; home: string | null }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <TeamLogo abbr={away} />
      <TeamLogo abbr={home} />
    </span>
  );
}

function TeamLogo({ abbr }: { abbr: string | null }) {
  const src = nbaOpponentLogo(abbr);
  if (!src) {
    return <span className="text-[9px] font-bold leading-none text-muted-foreground">{abbr || ''}</span>;
  }
  return <img src={src} alt={abbr || ''} className="h-4 w-4 object-contain" />;
}

function slateGames(rows: NbaSlateProp[]): { key: string; label: string; away: string | null; home: string | null }[] {
  const first = new Map<string, NbaSlateProp>();
  for (const row of rows) {
    const key = gameKey(row);
    if (!first.has(key)) first.set(key, row);
  }
  const games = [...first.values()].sort((a, b) => (a.commence_time || a.game_date || '').localeCompare(b.commence_time || b.game_date || ''));
  const labels = games.map(gameLabel);
  const duplicated = new Set(labels.filter((label, index) => labels.indexOf(label) !== index));
  return games.map((row) => {
    const label = gameLabel(row);
    const dated = duplicated.has(label) && row.game_date ? `${label} · ${row.game_date.slice(5)}` : label;
    return { key: gameKey(row), label: dated, away: row.away_abbr, home: row.home_abbr };
  });
}

function slateMarkets(rows: NbaSlateProp[]): { key: string; label: string }[] {
  const labels = new Map<string, string>();
  for (const row of rows) {
    if (!row.market || labels.has(row.market)) continue;
    labels.set(row.market, row.market_label || row.market);
  }
  return [...labels.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function playerGameId(row: Pick<NbaSlateProp, 'game_date' | 'athlete_id'>): string {
  return `${row.game_date ?? ''}:${row.athlete_id ?? ''}`;
}

function athleteNames(rows: NbaSlateProp[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.athlete_id == null || !row.player_name) continue;
    names.set(String(row.athlete_id), row.player_name);
  }
  return names;
}

function playerSignalCounts(rows: NbaSlateProp[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const id = playerGameId(row);
    totals.set(id, (totals.get(id) ?? 0) + flagKeys(row.flags).length);
  }
  return totals;
}

function signalFilterOptions(rows: NbaSlateProp[]) {
  const players = new Set<string>();
  for (const row of rows) {
    if (flagKeys(row.flags).length > 0) players.add(playerGameId(row));
  }
  return [
    { value: 'all', label: 'All players', icon: <Emoji>👥</Emoji> },
    { value: 'any', label: `Has a signal · ${players.size}`, icon: <Emoji>⚡</Emoji> },
  ];
}

function filterRows(
  rows: NbaSlateProp[],
  filters: { game: string; market: string; signal: string; query: string },
): NbaSlateProp[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.game !== 'all' && gameKey(row) !== filters.game) return false;
    if (filters.market !== 'all' && row.market !== filters.market) return false;
    if (filters.signal === 'any' && flagKeys(row.flags).length === 0) return false;
    if (!needle) return true;
    return `${row.player_name ?? ''} ${row.team ?? ''} ${row.opponent ?? ''}`.toLowerCase().includes(needle);
  });
}
