import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { SegmentedControl, StaggeredItem } from '@/components/ios';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { cn } from '@/lib/utils';
import {
  fetchNbaPropBooks,
  fetchNbaSlateProps,
  flagKeys,
  isOut,
  num,
  propKey,
  refSentence,
  type NbaBookQuote,
  type NbaPropDef,
  type NbaSlateProp,
} from './nbaPropsApi';
import type { PropsSport } from '@/features/props/usePropsUrlState';

const SPORT_OPTIONS = [
  { value: 'mlb' as const, label: 'MLB' },
  { value: 'nfl' as const, label: 'NFL' },
  { value: 'nba' as const, label: 'NBA' },
];

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
  const selected = rows.find((row) => propKey(row) === selectedPlayerId) ?? null;

  React.useEffect(() => {
    if (!query.isLoading && rows.length > 0 && isDesktop && !selected) {
      selectPlayer(propKey(rows[0]), { replace: true });
    }
  }, [isDesktop, query.isLoading, rows, selectPlayer, selected]);

  return (
    <SplitViewLayout
      storageId="wagerproof-nba-props-split"
      showDetailOnMobile={!!selected}
      onBackFromDetail={() => selectPlayer(null)}
      detailBackLabel="NBA Props"
      list={
        <NbaPropList
          rows={rows}
          defs={defs}
          isLoading={query.isLoading}
          errorMessage={query.error instanceof Error ? query.error.message : null}
          onRefresh={() => query.refetch()}
          selectedId={selectedPlayerId}
          onSelect={(id) => selectPlayer(id)}
          onSportChange={onSportChange}
        />
      }
      detail={selected ? <NbaPropDetail row={selected} defs={defs} /> : (
        <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-muted-foreground">
          Select a player. The board is ranked from the slate, and a card is a bet only when a rule fired.
        </div>
      )}
    />
  );
}

function NbaPropList({
  rows,
  defs,
  isLoading,
  errorMessage,
  onRefresh,
  selectedId,
  onSelect,
  onSportChange,
}: {
  rows: NbaSlateProp[];
  defs: Record<string, NbaPropDef>;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSportChange: (sport: PropsSport) => void;
}) {
  const [betsOnly, setBetsOnly] = React.useState(false);
  const visible = betsOnly ? rows.filter((row) => flagKeys(row.flags).length > 0) : rows;
  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <SegmentedControl
            layoutId="props-sport-picker"
            size="sm"
            className="min-w-0 flex-1"
            options={SPORT_OPTIONS}
            value="nba"
            onChange={(value) => onSportChange(value)}
          />
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh NBA props"
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground dark:border-white/10 dark:bg-white/[0.06]', isLoading && 'pointer-events-none opacity-60')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>
        <div className="flex gap-1.5 px-0.5">
          <FilterChip active={!betsOnly} onClick={() => setBetsOnly(false)} label={`Board ${rows.length}`} />
          <FilterChip active={betsOnly} onClick={() => setBetsOnly(true)} label={`Bets ${rows.filter((row) => flagKeys(row.flags).length > 0).length}`} />
        </div>
      </div>
      <div className="space-y-2 px-3 pb-10">
        {errorMessage && <p className="rounded-2xl bg-amber-500/10 px-3 py-2 text-[12px] text-foreground">{errorMessage}</p>}
        {isLoading ? (
          <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">Loading the slate…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-semibold">No NBA props on the board</p>
            <p className="max-w-[16rem] text-[12px] text-muted-foreground">Today and tomorrow are empty, or the bet filter has nothing fired.</p>
          </div>
        ) : visible.map((row, index) => (
          <StaggeredItem key={propKey(row)} index={index}>
            <button
              type="button"
              onClick={() => onSelect(propKey(row))}
              className={cn(
                'w-full rounded-2xl border px-3 py-2.5 text-left',
                propKey(row) === selectedId ? 'border-primary/40 bg-primary/5' : 'border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]',
                isOut(row.report_status) && 'opacity-50',
              )}
            >
              <PropSummary row={row} defs={defs} />
            </button>
          </StaggeredItem>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] font-semibold',
        active ? 'border-foreground/20 text-foreground' : 'border-black/5 text-muted-foreground dark:border-white/10',
      )}
    >
      {label}
    </button>
  );
}

function PropSummary({ row, defs }: { row: NbaSlateProp; defs: Record<string, NbaPropDef> }) {
  const keys = flagKeys(row.flags);
  const matchup = row.team && row.opponent ? `${row.team} vs ${row.opponent}` : row.game;
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold text-foreground">{row.player_name}</div>
          <div className="text-[11px] text-muted-foreground">
            {[row.position, matchup, row.game_date].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-bold text-foreground">{row.market_label || row.market}</div>
          <div className="text-[12px] font-semibold tabular-nums text-sky-500">{num(row.line)?.toFixed(1) ?? '—'}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Stat label="L5" value={avg(row.l5_avg)} sample="5 games" />
        <Stat label="Season" value={avg(row.szn_avg)} sample={sample(row.gp_prior, 'prior games')} />
        <Stat label="Form anchor" value={avg(row.baseline)} sample={sample(row.recent_games?.length, 'logged')} />
        {isOut(row.report_status) && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Out</span>}
        {keys.length > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">Bet</span>}
      </div>
      {keys.length > 0 && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-foreground">{defs[keys[0]]?.one_liner || defs[keys[0]]?.display_name || keys[0]}</p>
      )}
    </div>
  );
}

function NbaPropDetail({ row, defs }: { row: NbaSlateProp; defs: Record<string, NbaPropDef> }) {
  const books = useQuery({
    queryKey: ['nba-prop-books', propKey(row)],
    queryFn: () => fetchNbaPropBooks(row),
  });
  const keys = flagKeys(row.flags);
  const out = isOut(row.report_status);
  return (
    <div className={cn('h-full overflow-y-auto px-3 py-4', out && 'opacity-60')}>
      <div className="flex items-center gap-3">
        {row.headshot_url ? (
          <img src={row.headshot_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-[12px] font-bold">{row.position || 'NBA'}</div>
        )}
        <div>
          <h2 className="text-[18px] font-bold">{row.player_name}</h2>
          <p className="text-[12px] text-muted-foreground">
            {row.team} vs {row.opponent} · {row.market_label || row.market} {num(row.line)?.toFixed(1) ?? '—'}
          </p>
          {out && <p className="text-[12px] font-semibold text-muted-foreground">Report status: Out</p>}
        </div>
      </div>

      <section className="mt-4">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Log vs the line</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Averages from the games already played. The form anchor is a baseline of recent form, not a projection and not a model.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatCard label="Last game" value={avg(row.last_game)} sample="1 game" />
          <StatCard label="Last 3" value={avg(row.l3_avg)} sample="3 games" />
          <StatCard label="Last 5" value={avg(row.l5_avg)} sample="5 games" />
          <StatCard label="Last 10" value={avg(row.l10_avg)} sample="10 games" />
          <StatCard label="Season" value={avg(row.szn_avg)} sample={sample(row.gp_prior, 'prior games')} />
          <StatCard label="Prior season" value={avg(row.prior_szn_avg)} sample={sample(row.prior_szn_gp, 'games')} />
          <StatCard label="Form anchor" value={avg(row.baseline)} sample={gapText(row.baseline_gap)} />
          <StatCard label="Minutes, last 5" value={avg(row.min_l5)} sample="5 games" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatCard label="Over rate, L5" value={rate(row.over_rate_l5)} sample="5 games" />
          <StatCard label="Over rate, L10" value={rate(row.over_rate_l10)} sample="10 games" />
          <StatCard label="Over rate, season" value={rate(row.over_rate_szn)} sample={sample(row.gp_prior, 'prior games')} />
        </div>
      </section>

      {Array.isArray(row.recent_games) && row.recent_games.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Recent games ({row.recent_games.length})</h3>
          <div className="mt-2 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
            {row.recent_games.slice(0, 10).map((game, index) => (
              <div key={`${game.date}-${index}`} className="flex items-center justify-between border-b border-black/5 px-3 py-1.5 text-[12px] last:border-0 dark:border-white/10">
                <span className="text-muted-foreground">{game.date} · {game.opp}</span>
                <span className="font-semibold tabular-nums">{num(game.value)?.toFixed(1) ?? '—'} <span className="font-medium text-muted-foreground">on {num(game.line)?.toFixed(1) ?? '—'}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {keys.length > 0 && (
        <section className="mt-4 space-y-2">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Bet</h3>
          {keys.map((key) => {
            const def = defs[key];
            const sentence = refSentence(key, row.flag_detail);
            return (
              <div key={key} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <div className="text-[14px] font-bold">{def?.display_name || key}</div>
                {def?.one_liner && <p className="mt-1 text-[12px] leading-relaxed">{def.one_liner}</p>}
                {def?.definition && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{def.definition}</p>}
                {sentence && <p className="mt-1 text-[12px] leading-relaxed">{sentence}</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Record label="Back-test" text={def?.record_text} />
                  <Record label="This season" text={def?.season_record_text} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-4">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Shop the line</h3>
        {books.isLoading ? <p className="mt-2 text-[12px] text-muted-foreground">Loading posted prices…</p> : (
          <BookTable quotes={books.data?.current ?? []} />
        )}
      </section>
      <section className="mt-4 pb-8">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Line movement</h3>
        <MovementChart quotes={books.data?.history ?? []} loading={books.isLoading} />
      </section>
    </div>
  );
}

function BookTable({ quotes }: { quotes: NbaBookQuote[] }) {
  if (quotes.length === 0) return <p className="mt-2 text-[12px] text-muted-foreground">No posted prices yet.</p>;
  const sorted = [...quotes].sort((a, b) => (a.bookmaker || '').localeCompare(b.bookmaker || ''));
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
      <div className="grid grid-cols-4 bg-black/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.04]">
        <span>Book</span><span className="text-right">Line</span><span className="text-right">Over</span><span className="text-right">Under</span>
      </div>
      {sorted.map((quote, index) => (
        <div key={`${quote.bookmaker}-${index}`} className="grid grid-cols-4 border-t border-black/5 px-3 py-1.5 text-[12px] dark:border-white/10">
          <span className="truncate font-semibold">{quote.bookmaker}</span>
          <span className="text-right tabular-nums text-sky-500">{num(quote.line)?.toFixed(1) ?? '—'}</span>
          <span className="text-right tabular-nums">{price(quote.over_odds)}</span>
          <span className="text-right tabular-nums">{price(quote.under_odds)}</span>
        </div>
      ))}
    </div>
  );
}

function MovementChart({ quotes, loading }: { quotes: NbaBookQuote[]; loading: boolean }) {
  if (loading) return <p className="mt-2 text-[12px] text-muted-foreground">Loading the line history…</p>;
  const byBook = new Map<string, { t: string; line: number }[]>();
  for (const quote of quotes) {
    const line = num(quote.line);
    if (line === null) continue;
    const book = quote.bookmaker || 'line';
    const list = byBook.get(book) ?? [];
    list.push({ t: quote.snapshot_time || '', line });
    byBook.set(book, list);
  }
  const points = [...byBook.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  if (points.length < 2) return <p className="mt-2 text-[12px] text-muted-foreground">Not charted.</p>;
  const lines = points.map((point) => point.line);
  const min = Math.min(...lines);
  const max = Math.max(...lines);
  const span = max - min || 1;
  const w = 320;
  const h = 88;
  const path = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (w - 8) + 4;
    const y = h - 8 - ((point.line - min) / span) * (h - 16);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className="mt-2 rounded-2xl border border-black/5 px-2 py-2 dark:border-white/10">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Line movement">
        <path d={path} fill="none" stroke="#0EA5E9" strokeWidth="2" />
      </svg>
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>{min.toFixed(1)}</span>
        <span>{points.length} snapshots</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sample }: { label: string; value: string; sample: string }) {
  return (
    <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-foreground dark:bg-white/[0.06]">
      {label} {value} <span className="font-medium text-muted-foreground">({sample})</span>
    </span>
  );
}

function StatCard({ label, value, sample }: { label: string; value: string; sample: string }) {
  return (
    <div className="rounded-2xl border border-black/5 px-2.5 py-2 dark:border-white/10">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[16px] font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sample}</div>
    </div>
  );
}

function Record({ label, text }: { label: string; text: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-2.5 py-2 dark:bg-white/[0.04]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-0.5 text-[11px] leading-relaxed">{text || '—'}</p>
    </div>
  );
}

function avg(value: unknown): string {
  const n = num(value);
  return n === null ? '—' : n.toFixed(1);
}

function rate(value: unknown): string {
  const n = num(value);
  if (n === null) return '—';
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(0)}%`;
}

function sample(value: unknown, noun: string): string {
  const n = num(value);
  if (n === null) return `sample size not posted`;
  return `${n} ${noun}`;
}

function gapText(value: unknown): string {
  const n = num(value);
  if (n === null) return 'vs the line, not posted';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)} vs the line`;
}

function price(value: unknown): string {
  const n = num(value);
  if (n === null) return '—';
  return n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`;
}
