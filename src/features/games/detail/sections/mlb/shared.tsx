import * as React from 'react';
import { Activity, Calendar, CloudSun, Flame, MapPin, Target, User } from 'lucide-react';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import type { MLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';
import { isF5MlStrongSignal, type MLBPredictionRow } from '../../../api/mlbGames';

/**
 * Shared helpers + split panels for the MLB detail sections. Logic is copied
 * verbatim from src/pages/MLB.tsx (which keeps its own copies until the /games
 * cutover); only Tailwind classes were adapted to be light/dark safe inside
 * the glass WidgetCard chrome.
 */

// ---------------------------------------------------------------------------
// Formatting (copied from MLB.tsx)
// ---------------------------------------------------------------------------

export function formatMoneyline(ml: number | null): string {
  if (ml === null || ml === undefined) return '-';
  return ml > 0 ? `+${ml}` : String(ml);
}

export function formatSpread(spread: number | null | undefined): string {
  if (spread === null || spread === undefined || Number.isNaN(Number(spread))) return '-';
  const n = Number(spread);
  const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n > 0 ? `+${body}` : body;
}

export function toNum(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/** Match `official_date` (YYYY-MM-DD) to today's date in Eastern Time (same notion of "game day" as first-pitch ET). */
export function isOfficialDateToday(officialDate: string | null | undefined): boolean {
  if (!officialDate) return false;
  const day = officialDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return day === todayEt;
}

export function dayLabelFromDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(`${dateString.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

// ---------------------------------------------------------------------------
// Historical breakdown context (copied from MLB.tsx)
// ---------------------------------------------------------------------------

export function findBreakdownRow(
  rows: ModelBreakdownRow[],
  betType: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou',
  breakdownType: 'dow' | 'team',
  value: string | null | undefined,
): ModelBreakdownRow | null {
  if (!value) return null;
  return rows.find(
    r => r.bet_type === betType && r.breakdown_type === breakdownType && r.breakdown_value === value,
  ) ?? null;
}

export function toBreakdownTeamAbbr(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const a = abbr.toUpperCase();
  if (a === 'ARI') return 'AZ';
  if (a === 'OAK' || a === 'LVA' || a === 'SAC') return 'ATH';
  return a;
}

export interface TrendDetailsResult {
  text: string;
  roi: number | null;
}

export function trendDetails(
  row: ModelBreakdownRow | null,
  missingText = 'No history yet',
): TrendDetailsResult {
  if (!row) return { text: missingText, roi: null };
  const record = `${row.wins}-${row.losses}${row.pushes ? `-${row.pushes}` : ''}`;
  const roi = `${row.roi_pct > 0 ? '+' : ''}${row.roi_pct}%`;
  return { text: `${row.breakdown_value} • ${record} • ${row.win_pct}% W • ${roi} ROI`, roi: row.roi_pct };
}

/** ROI-colored trend value span used inside the Historical Model Context box. */
export function TrendValue({ details }: { details: TrendDetailsResult }) {
  const cls =
    details.roi == null
      ? 'text-muted-foreground'
      : details.roi >= 0
        ? 'text-emerald-600 dark:text-emerald-300'
        : 'text-red-600 dark:text-red-300';
  return <span className={cls}>{details.text}</span>;
}

// ---------------------------------------------------------------------------
// Edge buckets + accuracy lookups (copied from MLB.tsx; thresholds must match
// the Python grading script)
// ---------------------------------------------------------------------------

export const ML_BUCKETS: [number, string][] = [[7, '7%+'], [4, '4-6.9%'], [2, '2-3.9%'], [0, '<2%']];
export const OU_BUCKETS: [number, string][] = [[1.5, '1.5+'], [1.0, '1.0-1.49'], [0.5, '0.5-0.99'], [0, '<0.5']];
export const F5_ML_BUCKETS: [number, string][] = [[20, '20%+'], [10, '10-19.9%'], [5, '5-9.9%'], [0, '<5%']];
export const F5_OU_BUCKETS: [number, string][] = [[1.0, '1.0+'], [0.5, '0.5-0.99'], [0, '<0.5']];

export function getBucketLabel(edge: number, buckets: [number, string][]): string {
  const absEdge = Math.abs(edge);
  const prefix = edge < 0 ? '-' : '+';
  for (const [threshold, label] of buckets) {
    if (absEdge >= threshold) return `${prefix}${label}`;
  }
  return `${prefix}${buckets[buckets.length - 1][1]}`;
}

export interface BucketAccuracyInfo {
  win_pct: number;
  roi_pct: number;
  record: string;
}

export function lookupBucketAccuracy(
  modelAccuracy: MLBBucketAccuracy | null | undefined,
  betType: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou',
  edge: number,
  side?: 'home' | 'away',
  fav_dog?: 'favorite' | 'underdog',
  direction?: string,
): BucketAccuracyInfo | null {
  if (!modelAccuracy) return null;
  const data = modelAccuracy[betType];
  if (!data) return null;

  const buckets = betType === 'full_ml' ? ML_BUCKETS
    : betType === 'full_ou' ? OU_BUCKETS
    : betType === 'f5_ml' ? F5_ML_BUCKETS
    : F5_OU_BUCKETS;
  const bucketLabel = getBucketLabel(edge, buckets);

  // Find matching bucket in accuracy data
  for (const b of data.by_bucket) {
    const bAny = b as any;
    if (b.bucket !== bucketLabel) continue;
    if (side && b.side && b.side !== side) continue;
    if (fav_dog && b.fav_dog && b.fav_dog !== fav_dog) continue;
    if (direction && b.direction && b.direction !== direction) continue;
    if (b.games < 3) continue; // minimum sample
    return {
      win_pct: b.win_pct,
      roi_pct: bAny.roi_pct ?? 0,
      record: `${b.wins}-${b.games - b.wins}`,
    };
  }
  return null;
}

export function AccuracyBadge({ info }: { info: BucketAccuracyInfo | null }) {
  if (!info) return null;
  const color = info.win_pct >= 54.1
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300'
    : info.win_pct >= 52.1
      ? 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-300'
      : 'border-red-500/40 bg-red-500/15 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-300';
  return (
    <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${color}`}>
      {info.win_pct}% W ({info.record})
    </span>
  );
}

export function signalStyleClass(signal: 'Strong' | 'Moderate' | 'Weak'): string {
  if (signal === 'Strong') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
  if (signal === 'Moderate') {
    return 'border-orange-500/40 bg-orange-500/15 text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-300';
  }
  return 'border-red-500/40 bg-red-500/15 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-300';
}

// ---------------------------------------------------------------------------
// Signal pills (copied from MLB.tsx; colors adapted for light mode)
// ---------------------------------------------------------------------------

export function signalSeverityPillClass(severity: string): string {
  switch (severity) {
    case 'negative':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-800 dark:bg-orange-950/45 dark:text-orange-100';
    case 'positive':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100';
    case 'over':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
    case 'under':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:bg-blue-950/40 dark:text-blue-100';
    default:
      return 'border-black/10 bg-black/[0.04] text-foreground/80 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200';
  }
}

export function SignalCategoryIcon({ category }: { category: string }) {
  const cn = 'h-3.5 w-3.5 flex-shrink-0 opacity-90';
  switch (category.toLowerCase()) {
    case 'pitcher':
      return <User className={cn} aria-hidden />;
    case 'bullpen':
      return <Flame className={cn} aria-hidden />;
    case 'batting':
      return <Activity className={cn} aria-hidden />;
    case 'schedule':
      return <Calendar className={cn} aria-hidden />;
    case 'weather':
      return <CloudSun className={cn} aria-hidden />;
    case 'park':
      return <MapPin className={cn} aria-hidden />;
    default:
      return <Target className={cn} aria-hidden />;
  }
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/** Inner panel for nested projection blocks (ML / Total) — glass equivalent of MLB_CARD_INNER. */
export const INNER_PANEL =
  'rounded-xl border border-black/5 bg-black/[0.03] p-3 space-y-2 dark:border-white/10 dark:bg-white/[0.04]';

/** Historical Model Context box inside a panel. */
export const CONTEXT_BOX =
  'mt-2 rounded-lg border border-black/5 bg-black/[0.03] px-2.5 py-2 text-[11px] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]';

/** Round team-logo disc used in the projected score row (ESPN fallback → abbrev text). */
export function ScoreLogoDisc({
  url,
  abbrev,
  title,
}: {
  url: string | null;
  abbrev: string;
  title: string;
}) {
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.src = espnMlb500LogoUrlFromAbbrev(abbrev);
    target.onerror = () => {
      target.style.display = 'none';
      const parent = target.parentElement;
      if (parent && !parent.querySelector('.mlb-score-logo-fallback')) {
        const span = document.createElement('span');
        span.className = 'text-sm sm:text-base font-bold mlb-score-logo-fallback';
        span.textContent = abbrev;
        parent.appendChild(span);
      }
    };
  };
  return (
    <div
      className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-400 bg-white/80 dark:bg-slate-900/40"
      title={title}
    >
      {url ? (
        <img
          src={url}
          alt={abbrev}
          className="h-full w-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={onImgError}
        />
      ) : (
        <span className="text-sm sm:text-base font-bold">{abbrev}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split panels (ML / Total × Full Game / 1st 5) — logic copied verbatim from
// the MLB.tsx card body; consumed by both the Projected Score toggle and the
// always-on First-Five Splits section.
// ---------------------------------------------------------------------------

export interface SplitPanelProps {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
  modelAccuracy: MLBBucketAccuracy | null | undefined;
  breakdownRows: ModelBreakdownRow[];
}

export function FullMlPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows }: SplitPanelProps) {
  const homeMlEdge = toNum(raw.home_ml_edge_pct);
  const awayMlEdge = toNum(raw.away_ml_edge_pct);
  // Pick the team with the higher edge (where the model sees value)
  const mlPickIsHome = (homeMlEdge ?? -999) >= (awayMlEdge ?? -999);
  const mlPickTeam = mlPickIsHome ? homeAbbrev : awayAbbrev;
  const mlPickEdge = mlPickIsHome ? homeMlEdge : awayMlEdge;
  const mlIsStrong = mlPickIsHome ? raw.home_ml_strong_signal : raw.away_ml_strong_signal;
  const mlConfidenceLabel = mlIsStrong ? 'Strong' : 'Weak';

  const mlSide = mlPickIsHome ? 'home' : 'away';
  const mlLine = mlPickIsHome ? toNum(raw.home_ml) : toNum(raw.away_ml);
  const mlFavDog = mlLine !== null ? (mlLine < 0 ? 'favorite' : 'underdog') as 'favorite' | 'underdog' : undefined;
  const mlAcc = mlPickEdge !== null
    ? lookupBucketAccuracy(modelAccuracy, 'full_ml', mlPickEdge, mlSide as 'home' | 'away', mlFavDog)
    : null;

  const gameDowLabel = dayLabelFromDate(raw.official_date);
  const fullMlDowRow = findBreakdownRow(breakdownRows, 'full_ml', 'dow', gameDowLabel);
  const fullMlTeamRow = findBreakdownRow(breakdownRows, 'full_ml', 'team', toBreakdownTeamAbbr(mlPickTeam));
  const fullMlDowDetails = trendDetails(fullMlDowRow, gameDowLabel ? `${gameDowLabel} unavailable` : 'Unavailable');
  const fullMlTeamDetails = trendDetails(fullMlTeamRow, `${mlPickTeam} unavailable`);

  return (
    <div className={INNER_PANEL}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Moneyline Projection</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground">
        <span>Pick: <span className="font-semibold">{mlPickTeam}</span></span>
        <span>Edge: <span className="font-semibold">{mlPickEdge !== null ? `${mlPickEdge > 0 ? '+' : ''}${mlPickEdge.toFixed(1)}%` : '-'}</span></span>
        {mlAcc ? <AccuracyBadge info={mlAcc} /> : (
          <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyleClass(mlConfidenceLabel as 'Strong' | 'Weak')}`}>
            {mlConfidenceLabel}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {awayAbbrev}: Win Prob {toNum(raw.ml_away_win_prob) !== null ? `${((toNum(raw.ml_away_win_prob) as number) * 100).toFixed(1)}%` : '-'} | ML Edge {awayMlEdge !== null ? `${awayMlEdge > 0 ? '+' : ''}${awayMlEdge.toFixed(1)}%` : '-'}
      </div>
      <div className="text-xs text-muted-foreground">
        {homeAbbrev}: Win Prob {toNum(raw.ml_home_win_prob) !== null ? `${((toNum(raw.ml_home_win_prob) as number) * 100).toFixed(1)}%` : '-'} | ML Edge {homeMlEdge !== null ? `${homeMlEdge > 0 ? '+' : ''}${homeMlEdge.toFixed(1)}%` : '-'}
      </div>
      <div className={CONTEXT_BOX}>
        <div className="font-semibold text-foreground">Historical Model Context (Full Game ML)</div>
        <div className="mt-1">Day trend: <TrendValue details={fullMlDowDetails} /></div>
        <div className="mt-1">Team trend (predicted side): <TrendValue details={fullMlTeamDetails} /></div>
      </div>
    </div>
  );
}

export function F5MlPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows }: SplitPanelProps) {
  const f5HomeMlEdge = toNum(raw.f5_home_ml_edge_pct);
  const f5AwayMlEdge = toNum(raw.f5_away_ml_edge_pct);
  // Pick F5 based on highest edge (where model sees value)
  const f5PickIsHome = (f5HomeMlEdge ?? -999) >= (f5AwayMlEdge ?? -999);
  const f5PickTeam = f5PickIsHome ? homeAbbrev : awayAbbrev;
  const f5PickEdge = f5PickIsHome ? f5HomeMlEdge : f5AwayMlEdge;
  const rSig = raw as Record<string, unknown>;
  const f5PickMlStrong = f5PickIsHome
    ? isF5MlStrongSignal(rSig.f5_home_ml_strong_signal)
    : isF5MlStrongSignal(rSig.f5_away_ml_strong_signal);
  const f5HomeProb = toNum(raw.f5_home_win_prob);
  const f5AwayProb = toNum(raw.f5_away_win_prob);

  const f5Side = f5PickIsHome ? 'home' : 'away';
  const f5Acc = f5PickEdge !== null
    ? lookupBucketAccuracy(modelAccuracy, 'f5_ml', f5PickEdge, f5Side as 'home' | 'away')
    : null;

  const gameDowLabel = dayLabelFromDate(raw.official_date);
  const f5MlDowRow = findBreakdownRow(breakdownRows, 'f5_ml', 'dow', gameDowLabel);
  const f5MlTeamRow = findBreakdownRow(breakdownRows, 'f5_ml', 'team', toBreakdownTeamAbbr(f5PickTeam));
  const f5MlDowDetails = trendDetails(f5MlDowRow, gameDowLabel ? `${gameDowLabel} unavailable` : 'Unavailable');
  const f5MlTeamDetails = trendDetails(f5MlTeamRow, `${f5PickTeam} unavailable`);

  return (
    <div className={INNER_PANEL}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">1st 5 Moneyline Projection</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground">
        <span>Pick: <span className="font-semibold">{f5PickTeam}</span></span>
        <span>Edge: <span className="font-semibold">{f5PickEdge !== null ? `${f5PickEdge > 0 ? '+' : ''}${f5PickEdge.toFixed(1)}%` : '-'}</span></span>
        {f5Acc ? <AccuracyBadge info={f5Acc} /> : f5PickMlStrong ? (
          <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyleClass('Strong')}`}>
            Strong
          </span>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {awayAbbrev}: F5 Win Prob{' '}
        {f5AwayProb !== null ? `${(f5AwayProb * 100).toFixed(1)}%` : '-'}
        {' '}| F5 ML Edge{' '}
        {f5AwayMlEdge !== null ? `${f5AwayMlEdge > 0 ? '+' : ''}${f5AwayMlEdge.toFixed(1)}%` : '-'}
      </div>
      <div className="text-xs text-muted-foreground">
        {homeAbbrev}: F5 Win Prob{' '}
        {f5HomeProb !== null ? `${(f5HomeProb * 100).toFixed(1)}%` : '-'}
        {' '}| F5 ML Edge{' '}
        {f5HomeMlEdge !== null ? `${f5HomeMlEdge > 0 ? '+' : ''}${f5HomeMlEdge.toFixed(1)}%` : '-'}
      </div>
      <div className={CONTEXT_BOX}>
        <div className="font-semibold text-foreground">Historical Model Context (1st 5 ML)</div>
        <div className="mt-1">Day trend: <TrendValue details={f5MlDowDetails} /></div>
        <div className="mt-1">Team trend (predicted side): <TrendValue details={f5MlTeamDetails} /></div>
      </div>
    </div>
  );
}

export function FullTotalPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows }: SplitPanelProps) {
  const ouEdge = Math.abs(raw.ou_edge || 0);
  const ouDirection = raw.ou_direction || 'N/A';
  const totalConfidenceLabel = raw.ou_strong_signal
    ? 'Strong'
    : raw.ou_moderate_signal
      ? 'Moderate'
      : 'Weak';
  const ouAcc = lookupBucketAccuracy(
    modelAccuracy,
    'full_ou',
    toNum(raw.ou_edge) ?? 0,
    undefined,
    undefined,
    raw.ou_direction ?? undefined,
  );

  const gameDowLabel = dayLabelFromDate(raw.official_date);
  const fullOuDowRow = findBreakdownRow(breakdownRows, 'full_ou', 'dow', gameDowLabel);
  const fullOuAwayRow = findBreakdownRow(breakdownRows, 'full_ou', 'team', toBreakdownTeamAbbr(awayAbbrev));
  const fullOuHomeRow = findBreakdownRow(breakdownRows, 'full_ou', 'team', toBreakdownTeamAbbr(homeAbbrev));
  const fullOuDowDetails = trendDetails(fullOuDowRow, gameDowLabel ? `${gameDowLabel} unavailable` : 'Unavailable');
  const fullOuAwayDetails = trendDetails(fullOuAwayRow, 'Unavailable');
  const fullOuHomeDetails = trendDetails(fullOuHomeRow, 'Unavailable');

  return (
    <div className={INNER_PANEL}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Projection</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground">
        <span>Pick: <span className="font-semibold">{ouDirection}</span></span>
        <span>Edge: <span className="font-semibold">+{ouEdge.toFixed(2)}</span></span>
        {ouAcc ? <AccuracyBadge info={ouAcc} /> : (
          <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyleClass(totalConfidenceLabel as 'Strong' | 'Moderate' | 'Weak')}`}>
            {totalConfidenceLabel}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Fair Total: {toNum(raw.ou_fair_total)?.toFixed(2) ?? '-'} | Market Total: {toNum(raw.total_line)?.toFixed(1) ?? '-'}
      </div>
      <div className={CONTEXT_BOX}>
        <div className="font-semibold text-foreground">Historical Model Context (Full Game O/U)</div>
        <div className="mt-1">Day trend: <TrendValue details={fullOuDowDetails} /></div>
        <div className="mt-1 font-medium text-foreground">Team Trends</div>
        <div className="mt-1"><TrendValue details={fullOuAwayDetails} /></div>
        <div className="mt-1"><TrendValue details={fullOuHomeDetails} /></div>
      </div>
    </div>
  );
}

export function F5TotalPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows }: SplitPanelProps) {
  const f5TotalEdge = Math.abs(toNum(raw.f5_ou_edge) ?? 0);
  const f5Direction = (toNum(raw.f5_ou_edge) ?? 0) >= 0 ? 'OVER' : 'UNDER';
  const f5OuAcc = lookupBucketAccuracy(
    modelAccuracy,
    'f5_ou',
    toNum(raw.f5_ou_edge) ?? 0,
    undefined,
    undefined,
    f5Direction.toLowerCase(),
  );

  const gameDowLabel = dayLabelFromDate(raw.official_date);
  const f5OuDowRow = findBreakdownRow(breakdownRows, 'f5_ou', 'dow', gameDowLabel);
  const f5OuAwayRow = findBreakdownRow(breakdownRows, 'f5_ou', 'team', toBreakdownTeamAbbr(awayAbbrev));
  const f5OuHomeRow = findBreakdownRow(breakdownRows, 'f5_ou', 'team', toBreakdownTeamAbbr(homeAbbrev));
  const f5OuDowDetails = trendDetails(f5OuDowRow, gameDowLabel ? `${gameDowLabel} unavailable` : 'Unavailable');
  const f5OuAwayDetails = trendDetails(f5OuAwayRow, 'Unavailable');
  const f5OuHomeDetails = trendDetails(f5OuHomeRow, 'Unavailable');

  return (
    <div className={INNER_PANEL}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">1st 5 Total Projection</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground">
        <span>Pick: <span className="font-semibold">{f5Direction}</span></span>
        <span>Edge: <span className="font-semibold">+{f5TotalEdge.toFixed(2)}</span></span>
        {f5OuAcc ? <AccuracyBadge info={f5OuAcc} /> : null}
      </div>
      <div className="text-xs text-muted-foreground">
        F5 Fair Total: {toNum(raw.f5_fair_total)?.toFixed(2) ?? '-'} | F5 Market Total: {toNum(raw.f5_total_line)?.toFixed(1) ?? '-'}
      </div>
      <div className={CONTEXT_BOX}>
        <div className="font-semibold text-foreground">Historical Model Context (1st 5 O/U)</div>
        <div className="mt-1">Day trend: <TrendValue details={f5OuDowDetails} /></div>
        <div className="mt-1 font-medium text-foreground">Team Trends</div>
        <div className="mt-1"><TrendValue details={f5OuAwayDetails} /></div>
        <div className="mt-1"><TrendValue details={f5OuHomeDetails} /></div>
      </div>
    </div>
  );
}
