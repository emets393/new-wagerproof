import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import type { FpCards, NflPropPlayerPage, NflPropSpotlight, PropMarket, TrendGameLogEntry } from '@/features/propBreakdown/types';
import { formatAmerican, kickoffShort } from '@/features/propBreakdown/format';
import { baselineKeyForMarket, formatNum, marketUnit, qualifiedPlayerCount, storedBaselineRate } from '../fpCards';
import { RouteDiagram } from './RouteDiagram';
import { SpotlightPickCard } from './SpotlightPickCard';
import { GameLogChart, NgsStandouts } from './StatCharts';
import {
  absentBlobNames,
  AlignmentSection,
  DefenseSection,
  expectedBlobNames,
  RedZoneSection,
  RunSection,
  SchemeSection,
  SECTION_COPY,
  sectionPlan,
  type DeepSection,
} from './ArgumentSections';

function postedLine(market: PropMarket | undefined): string | null {
  if (!market || market.line == null) return null;
  const line = market.line.toFixed(1);
  return `${market.label} ${line}`;
}

function formatSpread(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function BlendBar({ weight, seasonText, priorText }: { weight: number; seasonText: string; priorText: string }) {
  const season = Math.min(1, Math.max(0, weight));
  return (
    <div className="mt-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${season * 100}%` }} />
        <div className="h-full bg-sky-500/80" style={{ width: `${(1 - season) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{seasonText}</span>
        <span className="text-right">{priorText}</span>
      </div>
    </div>
  );
}

function Bone({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-muted', className)} />;
}

function TheNumber({
  cards,
  page,
  market,
  loading,
}: {
  cards: FpCards | null;
  page: NflPropPlayerPage;
  market: string;
  loading: boolean;
}) {
  if (loading) return <Bone className="h-36" />;
  const key = baselineKeyForMarket(market);
  const arm = key ? cards?.baseline?.[key] : undefined;
  if (arm && typeof arm.blended === 'number') {
    const games = typeof arm.games === 'number' ? Math.round(arm.games) : null;
    const weight = typeof arm.weight_this_season === 'number' ? arm.weight_this_season : null;
    const seasonText = typeof arm.season_to_date === 'number'
      ? `${formatNum(arm.season_to_date, 1)} this season${games != null ? ` · ${games} ${games === 1 ? 'game' : 'games'}` : ''}${weight != null ? ` · ${Math.round(weight * 100)}%` : ''}`
      : 'This season';
    const priorText = typeof arm.prior_season === 'number' ? `${formatNum(arm.prior_season, 1)} last season` : 'No prior season';
    return (
      <section className="min-w-0 rounded-2xl border border-black/5 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Blended rate{arm.rookie ? ' · Rookie' : ''}
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">This season and last season, blended.</p>
        <div className="mt-1 font-mono text-[56px] font-black leading-none tracking-tight">{formatNum(arm.blended, 1)}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{marketUnit(market)}</div>
        {weight != null && typeof arm.season_to_date === 'number' && <BlendBar weight={weight} seasonText={seasonText} priorText={priorText} />}
      </section>
    );
  }
  const stored = storedBaselineRate(page, market);
  if (stored == null) {
    return (
      <section className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-[13px] text-muted-foreground dark:border-white/10">
        No blended rate on file for this market.
      </section>
    );
  }
  return (
    <section className="min-w-0 rounded-2xl border border-black/5 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{page.baseline?.season ?? 'Season'}</div>
      <p className="mt-1 text-[12px] text-muted-foreground">Season rate. The blend is not on file for this market.</p>
      <div className="mt-1 font-mono text-[56px] font-black leading-none tracking-tight">{formatNum(stored, 1)}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">
        {market === 'player_anytime_td' ? `touchdowns in ${page.baseline?.season ?? 'the season'}` : marketUnit(market)}
        {page.baseline?.games != null && market !== 'player_anytime_td' ? ` · ${Math.round(page.baseline.games)} games` : ''}
      </div>
    </section>
  );
}

function DeepBlock({
  id,
  desktop,
  children,
}: {
  id: DeepSection;
  desktop: boolean;
  children: ReactNode;
}) {
  const copy = SECTION_COPY[id];
  const [open, setOpen] = useState(desktop);
  useEffect(() => setOpen(desktop), [desktop]);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-black/5 bg-white/45 dark:border-white/10 dark:bg-white/[0.03]">
      <button type="button" className="flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{copy.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-foreground">{copy.subtitle}</span>
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn('min-w-0 border-t border-black/5 px-3 py-3 dark:border-white/10', !open && 'hidden')}>{children}</div>
    </section>
  );
}

export function PlayerStatDetail({
  page,
  slate,
  picks,
  picksReady,
  marketKey,
  onMarket,
  onOpenBoard,
  log = null,
  logLoading = false,
  cards,
  cardsLoading = false,
  gameLines = null,
}: {
  page: NflPropPlayerPage;
  slate: NflPropPlayerPage[];
  picks: NflPropSpotlight[];
  picksReady: boolean;
  marketKey: string | null;
  onMarket: (market: string) => void;
  onOpenBoard: () => void;
  log?: TrendGameLogEntry[] | null;
  logLoading?: boolean;
  cards?: FpCards | null;
  cardsLoading?: boolean;
  gameLines?: { spread: number | null; total: number | null; moneyline: number | null } | null;
}) {
  const isDesktop = useIsDesktopSplit();
  const markets = page.markets ?? [];
  const playerPicks = picks.filter((pick) => pick.player_id === page.player_id);
  const activeKey = marketKey && markets.some((market) => market.key === marketKey) ? marketKey : null;
  const fallbackMarket = playerPicks.find((pick) => markets.some((market) => market.key === pick.market))?.market ?? markets[0]?.key ?? null;

  useEffect(() => {
    if (!picksReady || activeKey || !fallbackMarket) return;
    onMarket(fallbackMarket);
  }, [activeKey, fallbackMarket, onMarket, picksReady]);

  const market = markets.find((item) => item.key === activeKey) ?? markets[0];
  const key = market?.key ?? '';
  const fp = cardsLoading ? null : cards !== undefined ? cards : page.fp_cards ?? null;
  const plan = sectionPlan(page.position, key, fp);
  const thisPick = playerPicks.find((pick) => pick.market === key) ?? null;
  const otherPicks = playerPicks.filter((pick) => pick.market !== key);
  const kickoff = kickoffShort(page.kickoff);

  useEffect(() => {
    if (cardsLoading || !key) return;
    const missing = absentBlobNames(fp, expectedBlobNames(page.position, key));
    for (const name of missing) {
      console.debug('[props] missing blob', name, page.player_name, key);
    }
  }, [cardsLoading, fp, key, page.player_name, page.position]);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
            {page.headshot_url ? (
              <img src={page.headshot_url} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">{page.position}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-black leading-tight">{page.player_name}</div>
            <div className="truncate text-[12px] text-muted-foreground">
              {page.position} · {page.team} vs {page.opponent}
              {kickoff ? ` · ${kickoff}` : ''}
            </div>
          </div>
          {gameLines && (gameLines.spread != null || gameLines.total != null || gameLines.moneyline != null) ? (
            <div className="shrink-0 text-right font-mono text-[12px] font-bold leading-tight">
              {gameLines.spread != null && <div>{page.team} {formatSpread(gameLines.spread)}</div>}
              {gameLines.total != null && <div className="text-muted-foreground">O/U {gameLines.total}</div>}
              {gameLines.moneyline != null && <div className="text-muted-foreground">{formatAmerican(gameLines.moneyline)}</div>}
            </div>
          ) : postedLine(market) ? (
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Line</div>
              <div className="font-mono text-[13px] font-bold">{postedLine(market)}</div>
            </div>
          ) : null}
        </div>
        {markets.length > 0 && (
          <div className="mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {markets.map((item) => {
              const active = item.key === key;
              const onBoard = playerPicks.some((pick) => pick.market === item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onMarket(item.key)}
                  className={cn(
                    'min-h-11 shrink-0 rounded-full px-3 text-[13px] font-bold',
                    active && 'bg-primary text-primary-foreground',
                    !active && onBoard && 'bg-primary/15 text-primary',
                    !active && !onBoard && 'bg-muted text-foreground',
                  )}
                >
                  {item.label}
                  {onBoard ? ' · pick' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3 px-4 py-4">
        <TheNumber cards={fp} page={page} market={key} loading={cardsLoading} />

        {thisPick && <SpotlightPickCard pick={thisPick} />}
        {otherPicks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {otherPicks.map((pick) => (
              <button key={pick.market} type="button" onClick={() => onMarket(pick.market)} className="min-h-11 rounded-full border border-primary/40 px-3 text-[12px] font-semibold text-primary">
                Also a spotlight pick: {pick.market_label}
              </button>
            ))}
          </div>
        )}

        {logLoading ? <Bone className="h-48" /> : (
          GameLogChart({ log, market: key, line: market?.line ?? null }) ?? (
            <section className="rounded-2xl border border-black/5 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Last 10</div>
              <p className="mt-2 text-[13px] text-muted-foreground">No recent games in this market.</p>
            </section>
          )
        )}

        {cardsLoading && (
          <div className="space-y-3">
            <Bone className="h-56" />
            <Bone className="h-28" />
            <Bone className="h-28" />
          </div>
        )}

        {!cardsLoading && fp && plan.map((id) => (
          <DeepBlock key={id} id={id} desktop={isDesktop}>
            {id === 'playsheet' && <RouteDiagram cards={fp} opponent={page.opponent} />}
            {id === 'alignment' && <AlignmentSection cards={fp} />}
            {id === 'defense' && <DefenseSection cards={fp} market={key} position={page.position} opponent={page.opponent} />}
            {id === 'scheme' && <SchemeSection cards={fp} position={page.position} />}
            {id === 'runs' && <RunSection cards={fp} />}
            {id === 'redzone' && <RedZoneSection cards={fp} market={key} />}
          </DeepBlock>
        ))}

        <section className="min-w-0">
          <NgsStandouts ngs={page.ngs} market={key} />
        </section>

        {!thisPick && picksReady && (
          <button type="button" onClick={onOpenBoard} className="min-h-11 text-left text-[13px] text-muted-foreground">
            {page.player_name.split(' ')[0]} is not on the board — {qualifiedPlayerCount(picks)} of {slate.length} players are.{' '}
            <span className="font-semibold text-primary">See this week&apos;s board</span>
          </button>
        )}
      </div>
    </div>
  );
}
