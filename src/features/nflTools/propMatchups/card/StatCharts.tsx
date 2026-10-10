import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type {
  NflPropPlayerPage,
  PlayerCoverageSplit,
  PlayerQbSplit,
  PlayerRushSplit,
  PropNgs,
  PropScheme,
  SchemeGameSplits,
  TrendGameLogEntry,
} from '@/features/propBreakdown/types';
import { formatPctile, formatRatePct } from '@/features/propBreakdown/format';
import {
  COVERAGE_LABELS,
  contentMapForMarket,
  DEFENSE_LABELS,
  GAME_SPLIT_BUCKET_LABELS,
  NGS_LABELS,
  RUSH_LOOK_LABELS,
  type CoverageKey,
  type DefenseKey,
  type RushLookKey,
} from '@/features/propBreakdown/marketMap';
import { GAME_SPLIT_STAT_FOR_MARKET } from '@/features/propBreakdown/schemeCompare';
import { formatNum, headlineFor, marketUnit, storedBaselineRate } from '../fpCards';

const FRACTION_KEYS = new Set([
  'drop_rate',
  'contested_catch',
  'created_rate',
  'rz_tgt_share',
  'rz_carry_share',
  'pa_rate',
  'int_worthy_rate',
]);

const PERCENT_KEYS = new Set(['air_share', 'catch_pct', 'eight_box_pct', 'aggressiveness']);

const DEFENSE_FALLBACK: DefenseKey[] = ['pressure', 'blitz', 'man', 'zone', 'two_high', 'heavy_box', 'light_box'];

function formatNgs(key: string, value: number): string {
  if (FRACTION_KEYS.has(key)) return `${Math.round(value * 100)}%`;
  if (PERCENT_KEYS.has(key)) return `${Math.round(value)}%`;
  if (key === 'yac_above_exp' || key === 'ryoe_per_att' || key === 'cpoe' || key === 'air_yds_to_sticks') {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  }
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function isDefenseDim(value: unknown): value is { rate: number; pctile: number } {
  return Boolean(value) && typeof value === 'object' && typeof (value as { rate?: unknown }).rate === 'number' && typeof (value as { pctile?: unknown }).pctile === 'number';
}

export function loggedSeasonAverage(
  log: TrendGameLogEntry[] | null | undefined,
  season: number,
  market: string,
): { mean: number; n: number } | null {
  const values = (log ?? [])
    .filter((game) => game.season === season && Number.isFinite(game.actuals?.[market]))
    .map((game) => Number(game.actuals?.[market]));
  if (values.length === 0) return null;
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, n: values.length };
}

export interface HeroModel {
  kicker: string;
  valueText: string | null;
  unit: string;
  note: string | null;
  compare: { leftLabel: string; leftText: string; leftPct: number; rightLabel: string; rightText: string; rightPct: number } | null;
  blend: { weight: number; seasonText: string; priorText: string } | null;
}

export function heroModel(
  page: NflPropPlayerPage,
  market: string,
  log: TrendGameLogEntry[] | null | undefined,
): HeroModel {
  const headline = market ? headlineFor(page, market) : null;
  const logged = market ? loggedSeasonAverage(log, page.season, market) : null;
  const stored = market ? storedBaselineRate(page, market) : null;
  const storedSeason = page.baseline?.season;
  const priorSeason = storedSeason != null && storedSeason !== page.season;
  const perGameBaseline = market !== 'player_anytime_td';

  if (headline?.source === 'blend') {
    const seasonText = headline.seasonToDate != null
      ? `${formatNum(headline.seasonToDate, 1)} this season${headline.games != null ? ` · ${Math.round(headline.games)} games` : ''}${headline.weightThisSeason != null ? ` · ${Math.round(headline.weightThisSeason * 100)}%` : ''}`
      : 'This season';
    return {
      kicker: headline.rookie ? 'Blended rate · Rookie' : 'Blended rate',
      valueText: formatNum(headline.value, 1),
      unit: headline.unit,
      note: null,
      compare: null,
      blend: headline.weightThisSeason != null && headline.seasonToDate != null
        ? {
            weight: headline.weightThisSeason,
            seasonText,
            priorText: headline.priorSeason != null ? `${formatNum(headline.priorSeason, 1)} last season` : 'No prior season',
          }
        : null,
    };
  }

  if (logged && priorSeason && perGameBaseline && stored != null) {
    const max = Math.max(logged.mean, stored, 0.01);
    return {
      kicker: String(page.season),
      valueText: formatNum(logged.mean, 1),
      unit: marketUnit(market),
      note: null,
      compare: {
        leftLabel: `${page.season} · ${logged.n} ${logged.n === 1 ? 'game' : 'games'}`,
        leftText: formatNum(logged.mean, 1) ?? '',
        leftPct: (logged.mean / max) * 100,
        rightLabel: `${storedSeason} · ${page.baseline?.games ?? 0} games`,
        rightText: formatNum(stored, 1) ?? '',
        rightPct: (stored / max) * 100,
      },
      blend: null,
    };
  }

  if (logged && (!headline || priorSeason)) {
    const tdNote = market === 'player_anytime_td' && stored != null
      ? `${formatNum(stored, stored >= 10 ? 0 : 1)} touchdowns in ${storedSeason}`
      : null;
    return {
      kicker: String(page.season),
      valueText: formatNum(logged.mean, 1),
      unit: market === 'player_anytime_td' ? 'touchdowns a game' : marketUnit(market),
      note: tdNote,
      compare: null,
      blend: null,
    };
  }

  if (headline) {
    const touchdowns = market === 'player_anytime_td';
    return {
      kicker: storedSeason ? String(storedSeason) : 'Season rate',
      valueText: formatNum(headline.value, touchdowns && headline.value >= 10 ? 0 : 1),
      unit: touchdowns ? `touchdowns in ${storedSeason ?? 'the season'}` : headline.unit,
      note: !touchdowns && headline.games != null ? `${Math.round(headline.games)} games` : null,
      compare: null,
      blend: null,
    };
  }

  return { kicker: 'Season rate', valueText: null, unit: '', note: null, compare: null, blend: null };
}

function Card({ kicker, title, caption, children }: { kicker: string; title?: string; caption?: string | null; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-black/5 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{kicker}</div>
      {title && <h3 className="mt-1 text-[15px] font-black leading-tight">{title}</h3>}
      {caption && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{caption}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HBar({
  label,
  valueText,
  detail,
  pct,
  tone = 'player',
}: {
  label: string;
  valueText: string;
  detail?: string;
  pct: number;
  tone?: 'player' | 'opp';
}) {
  const width = Math.max(2, Math.min(100, pct));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono font-bold">
          {valueText}
          {detail ? <span className="font-sans font-medium text-muted-foreground"> {detail}</span> : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone === 'opp' ? 'bg-sky-500' : 'bg-primary')} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function GameLogChart({
  log,
  market,
  line,
}: {
  log: TrendGameLogEntry[] | null | undefined;
  market: string;
  line: number | null;
}) {
  const games = (log ?? [])
    .filter((game) => Number.isFinite(game.actuals?.[market]))
    .slice(0, 10)
    .reverse()
    .map((game) => ({
      opp: game.opp || `W${game.week}`,
      week: game.week,
      value: Number(game.actuals?.[market]),
    }));
  if (games.length === 0) return null;
  const reference = Number.isFinite(line) ? Number(line) : null;
  const max = Math.max(reference ?? 0, ...games.map((game) => game.value), 1);
  const plot = (value: number) => Math.max(4, Math.min(86, (value / max) * 86));
  const average = games.reduce((sum, game) => sum + game.value, 0) / games.length;

  return (
    <Card
      kicker="Last 10"
      title={`Last ${games.length}`}
      caption="His last games in this market, against the posted line."
    >
      <div className="mb-2 text-right font-mono text-[11px] font-bold text-muted-foreground">
        {formatNum(average, 1)} avg
      </div>
      <div className="relative h-36">
        {reference != null && (
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-foreground/45"
            style={{ bottom: `${plot(reference)}%` }}
          >
            <span className="absolute right-0 -translate-y-full rounded bg-background/90 px-1 text-[9px] font-bold text-foreground">
              {reference}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-1">
          {games.map((game) => {
            const height = plot(game.value);
            return (
              <div key={`${game.week}-${game.opp}`} className="relative h-full min-w-0 flex-1" title={`Week ${game.week} ${game.opp}: ${game.value}`}>
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 rounded-t',
                    reference == null || game.value >= reference ? 'bg-primary' : 'bg-muted-foreground/35',
                  )}
                  style={{ height: `${height}%` }}
                />
                <div
                  className="absolute inset-x-0 truncate text-center font-mono text-[9px] font-bold leading-none text-foreground"
                  style={{ bottom: `calc(${height}% + 3px)` }}
                >
                  {formatNum(game.value, game.value >= 100 ? 0 : 1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1">
        {games.map((game) => (
          <div key={`${game.week}-${game.opp}-label`} className="min-w-0 flex-1 truncate text-center text-[9px] font-bold uppercase text-muted-foreground">
            {game.opp}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ngsRows(ngs: PropNgs | null | undefined, market: string) {
  if (!ngs) return [];
  const map = contentMapForMarket(market);
  const preferred = [...map.ngs, ...(map.ngsDescriptive ?? [])];
  const keys = [...preferred, ...Object.keys(ngs).filter((key) => key !== 'kind' && !preferred.includes(key))];
  const rows: { key: string; label: string; valueText: string; pctile: number }[] = [];
  for (const key of keys) {
    const raw = ngs[key];
    if (!raw || typeof raw !== 'object' || !('v' in raw) || typeof raw.v !== 'number' || typeof raw.pctile !== 'number') continue;
    rows.push({
      key,
      label: NGS_LABELS[key] ?? key.replaceAll('_', ' '),
      valueText: formatNgs(key, raw.v),
      pctile: Math.max(0, Math.min(100, raw.pctile)),
    });
    if (rows.length === 6) break;
  }
  return rows;
}

export function NgsStandouts({ ngs, market }: { ngs: PropNgs | null | undefined; market: string }) {
  const rows = ngsRows(ngs, market);
  if (rows.length === 0) return null;
  return (
    <Card kicker="Where he sits" caption="Where he ranks among players at his position.">
      <div className="space-y-2.5">
        {rows.map((row) => (
          <HBar key={row.key} label={row.label} valueText={row.valueText} detail={formatPctile(row.pctile)} pct={row.pctile} />
        ))}
      </div>
    </Card>
  );
}

function matchupColumns(scheme: PropScheme | null | undefined, market: string) {
  const defense = scheme?.defense;
  if (!defense) return [];
  const preferred = contentMapForMarket(market).defense;
  const present = (key: string) => isDefenseDim(defense[key]);
  const chosen = preferred.filter(present);
  const extras = DEFENSE_FALLBACK.filter((key) => present(key) && !chosen.includes(key));
  return [...chosen, ...extras].slice(0, 3).map((key) => {
    const dim = defense[key] as { rate: number; pctile: number };
    return {
      key,
      label: DEFENSE_LABELS[key as DefenseKey] ?? key,
      rateText: formatRatePct(dim.rate),
      pctile: Math.max(0, Math.min(100, dim.pctile)),
      pctileText: formatPctile(dim.pctile),
    };
  });
}

export function MatchupStrip({ scheme, market, opponent }: { scheme: PropScheme | null | undefined; market: string; opponent: string }) {
  const columns = matchupColumns(scheme, market);
  if (columns.length === 0) return null;
  const identity = scheme?.defense?.identity;
  return (
    <Card kicker="Matchup" title={identity || undefined} caption={`How often ${opponent} plays each look. The bar is their rank, 100 being the highest rate.`}>
      <div className={cn('grid gap-2', columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {columns.map((column, index) => (
          <div key={column.key} className={cn('min-w-0', index > 0 && 'border-l border-border/70 pl-2')}>
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{column.label}</div>
            <div className="mt-1 font-mono text-[22px] font-black leading-none sm:text-[26px]">{column.rateText}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{column.pctileText}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(2, column.pctile)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function splitMeasure(raw: PlayerCoverageSplit | PlayerQbSplit | PlayerRushSplit | undefined) {
  if (!raw) return null;
  const row = raw as PlayerCoverageSplit & PlayerQbSplit & PlayerRushSplit;
  const pctile = typeof row.pctile === 'number' ? row.pctile : null;
  if (typeof row.ypt === 'number') return { value: row.ypt, unit: 'ypt', sample: `${row.targets ?? 0} tgt`, pctile };
  if (typeof row.ypa === 'number') return { value: row.ypa, unit: 'ypa', sample: `${row.dropbacks ?? 0} db`, pctile };
  if (typeof row.ypc === 'number') return { value: row.ypc, unit: 'ypc', sample: `${row.carries ?? 0} car`, pctile };
  if (typeof row.epa_db === 'number') return { value: row.epa_db, unit: 'epa/db', sample: `${row.dropbacks ?? 0} db`, pctile };
  return null;
}

function coverageRows(page: NflPropPlayerPage, market: string) {
  const scheme = page.scheme;
  if (!scheme) return [];
  const rush = market.includes('rush') || scheme.kind === 'rb';
  if (rush && scheme.rush_splits) {
    const preferred = (['light_box', 'neutral', 'heavy_box'] as RushLookKey[]).filter((key) => scheme.rush_splits?.[key]);
    return preferred.flatMap((key) => {
      const measure = splitMeasure(scheme.rush_splits?.[key]);
      if (!measure) return [];
      return [{ key, label: RUSH_LOOK_LABELS[key], ...measure }];
    });
  }
  const splits = scheme.player_splits;
  if (!splits) return [];
  const preferred = contentMapForMarket(market).coverage.filter((key) => splits[key]);
  const rest = (Object.keys(splits) as CoverageKey[]).filter((key) => !preferred.includes(key) && splits[key]);
  const keys = [...preferred, ...rest].slice(0, 6);
  return keys.flatMap((key) => {
    const measure = splitMeasure(splits[key]);
    if (!measure) return [];
    return [{ key, label: COVERAGE_LABELS[key] ?? key, ...measure }];
  });
}

export function CoverageChart({ page, market }: { page: NflPropPlayerPage; market: string }) {
  const rows = coverageRows(page, market);
  if (rows.length === 0) return null;
  const min = Math.min(0, ...rows.map((row) => row.value));
  const max = Math.max(...rows.map((row) => row.value));
  const span = Math.max(0.01, max - min);
  const unit = rows[0]?.unit ?? '';
  return (
    <Card kicker="By look" title={unit === 'ypc' ? 'Yards per carry by box' : unit === 'ypa' || unit === 'epa/db' ? 'Passing by pressure and shell' : 'Yards per target by coverage'}>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <HBar
            key={row.key}
            label={row.label}
            valueText={`${formatNum(row.value, 1)} ${row.unit}`}
            detail={row.pctile != null ? `${formatPctile(row.pctile)} · ${row.sample}` : row.sample}
            pct={((row.value - min) / span) * 100}
          />
        ))}
      </div>
    </Card>
  );
}

function lookRows(page: NflPropPlayerPage, market: string) {
  const stat = GAME_SPLIT_STAT_FOR_MARKET[market];
  const splits: SchemeGameSplits | null | undefined = page.scheme_game_splits;
  if (!stat || !splits?.splits) return null;
  const applicable = splits.applicable ?? [];
  const keys = applicable.length > 0 ? applicable : Object.keys(splits.splits);
  const rows: { key: string; label: string; value: number; n: number }[] = [];
  const overallValue = splits.overall && typeof splits.overall[stat] === 'number' ? Number(splits.overall[stat]) : null;
  if (overallValue != null) {
    rows.push({ key: 'overall', label: 'Overall', value: overallValue, n: splits.overall?.n ?? 0 });
  }
  for (const key of keys) {
    const entry = splits.splits[key];
    const value = entry?.[stat];
    if (typeof value !== 'number') continue;
    if (applicable.length === 0 && (entry?.n ?? 0) < 3) continue;
    rows.push({
      key,
      label: GAME_SPLIT_BUCKET_LABELS[key] ?? key.replaceAll('_', ' '),
      value,
      n: entry?.n ?? 0,
    });
  }
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((row) => row.value), 0.01);
  return { window: splits.window ?? null, rows: rows.slice(0, 7), max, matched: applicable.length > 0 };
}

export function LookChart({ page, market }: { page: NflPropPlayerPage; market: string }) {
  const chart = lookRows(page, market);
  if (!chart) return null;
  return (
    <Card
      kicker="Vs this defense"
      title={chart.matched ? `Per game when the defense looks like ${page.opponent}` : 'Per game by defensive look'}
      caption={chart.window}
    >
      <div className="space-y-2.5">
        {chart.rows.map((row) => (
          <HBar
            key={row.key}
            label={row.label}
            valueText={formatNum(row.value, 1) ?? ''}
            detail={`${row.n} games`}
            pct={(row.value / chart.max) * 100}
            tone={row.key === 'overall' ? 'opp' : 'player'}
          />
        ))}
      </div>
    </Card>
  );
}

export function hasGameLog(log: TrendGameLogEntry[] | null | undefined, market: string): boolean {
  return (log ?? []).some((game) => Number.isFinite(game.actuals?.[market]));
}

export function hasLookChart(page: NflPropPlayerPage, market: string): boolean {
  return lookRows(page, market) != null;
}

export function hasCoverageChart(page: NflPropPlayerPage, market: string): boolean {
  return coverageRows(page, market).length > 0;
}
