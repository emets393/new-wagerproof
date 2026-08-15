import * as React from 'react';
import { Chip } from '@heroui/react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronRight,
  CloudSun,
  Flame,
  MapPin,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import type { MLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';
import {
  MLB_EDGE_SCALE,
  ModelEdgeRail,
  ModelVsMarketRow,
  MoneylineEdgeBar,
  moneylineOutcome,
} from '../../charts';
import {
  BestBookChip,
  preferredQuote,
  quotesForMarket,
  type SportsbookGameOdds,
  type SportsbookMarket,
} from '../../sportsbooks';
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
  /** Pre-joined fallback, used when there's no history row to lay out. */
  text: string;
  roi: number | null;
  /** Present only when a history row exists (see TrendStatRow). */
  label?: string;
  record?: string;
  winPct?: number;
}

export function trendDetails(
  row: ModelBreakdownRow | null,
  missingText = 'No history yet',
): TrendDetailsResult {
  if (!row) return { text: missingText, roi: null };
  const record = `${row.wins}-${row.losses}${row.pushes ? `-${row.pushes}` : ''}`;
  const roi = `${row.roi_pct > 0 ? '+' : ''}${row.roi_pct}%`;
  return {
    text: `${row.breakdown_value} • ${record} • ${row.win_pct}% W • ${roi} ROI`,
    roi: row.roi_pct,
    // Structured fields so the row can be laid out as aligned columns; `text`
    // stays as the fallback for the no-history case.
    label: row.breakdown_value,
    record,
    winPct: row.win_pct,
  };
}

function roiClass(roi: number | null): string {
  if (roi == null) return 'text-muted-foreground';
  return roi >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300';
}

/** ROI magnitude that pins a bar to full width. Beyond ±25% the exact value stops mattering. */
const ROI_BAR_CAP = 25;

/**
 * One historical-context row: label, record, and a diverging ROI bar growing
 * left (losing) or right (winning) from a center zero line. The bar is the
 * point — you can see at a glance whether the model's history on this angle is
 * red or green without reading a single number.
 */
export function TrendStatRow({ details }: { details: TrendDetailsResult }) {
  if (details.label === undefined) {
    return <div className="py-1 text-[11px] text-muted-foreground">{details.text}</div>;
  }
  const roi = details.roi ?? 0;
  const magnitude = Math.min(Math.abs(roi) / ROI_BAR_CAP, 1) * 50;
  const positive = roi >= 0;

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-10 shrink-0 truncate text-[11px] font-semibold text-foreground">
        {details.label}
      </span>
      <span className="w-16 shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {details.record}
      </span>
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {details.winPct}%
      </span>
      {/* Center line = 0% ROI; bars diverge from it. */}
      <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
        <span
          className={cn(
            'absolute inset-y-0 rounded-sm',
            positive ? 'bg-emerald-500/80' : 'bg-red-500/80',
          )}
          style={
            positive
              ? { left: '50%', width: `${magnitude}%` }
              : { right: '50%', width: `${magnitude}%` }
          }
        />
      </span>
      <span
        className={cn('w-14 shrink-0 text-right text-[11px] font-bold tabular-nums', roiClass(details.roi))}
      >
        {details.roi != null ? `${details.roi > 0 ? '+' : ''}${details.roi}%` : '—'}
      </span>
    </div>
  );
}

/** Column captions for a group of TrendStatRows. */
export function TrendStatHeader() {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-10 shrink-0" />
      <span className="w-16 shrink-0">Record</span>
      <span className="w-9 shrink-0 text-right">Win</span>
      <span className="min-w-0 flex-1 text-center">ROI</span>
      <span className="w-14 shrink-0" />
    </div>
  );
}

/**
 * The picked side's moneyline, resolved once so the panel, the card headline and
 * the bar all read the same object.
 *
 * TWO EDGES LIVE HERE ON PURPOSE:
 * - `storedEdge` is `*_ml_edge_pct` off the row. It is the key the historical
 *   bucket tables were built on (`ML_BUCKETS`, and the Python grader behind
 *   them), so accuracy lookups MUST keep using it.
 * - `displayEdge` is what the card prints: model% − the price's raw break-even.
 *   It is derived from the two figures `MoneylineEdgeBar` draws, so nothing on
 *   screen can disagree with the bar (WIDGET_DESIGN.md rule 10). With no book
 *   price on the row it falls back to `storedEdge`, which is the F5 case.
 */
export interface FullMlDerivation {
  pickIsHome: boolean;
  pickTeam: string;
  pickVisuals: TeamVisuals;
  /** 0-1 model win probability for the picked side. */
  prob: number | null;
  /** American price for the picked side, when the row carries one. */
  price: number | null;
  storedEdge: number | null;
  /** The other side's edge on the SAME basis as `displayEdge`, so "no value on
   *  either side" compares like with like. */
  otherDisplayEdge: number | null;
  /** Break-even-derived edge when there is a price, else the stored column. */
  displayEdge: number | null;
  /** The percentage the model has to beat: the price's raw implied probability. */
  breakEvenPct: number | null;
}

export function deriveFullMl(
  raw: MLBPredictionRow,
  awayAbbrev: string,
  homeAbbrev: string,
  away: TeamVisuals,
  home: TeamVisuals,
): FullMlDerivation {
  const homeEdge = toNum(raw.home_ml_edge_pct);
  const awayEdge = toNum(raw.away_ml_edge_pct);
  // Pick the team with the higher stored edge (where the model sees value).
  // Unchanged from the shipped rule — it is the same comparison the grading SQL
  // and the feed card make.
  const pickIsHome = (homeEdge ?? -999) >= (awayEdge ?? -999);
  const prob = pickIsHome ? toNum(raw.ml_home_win_prob) : toNum(raw.ml_away_win_prob);
  const price = pickIsHome ? toNum(raw.home_ml) : toNum(raw.away_ml);
  const storedEdge = pickIsHome ? homeEdge : awayEdge;

  const otherProb = pickIsHome ? toNum(raw.ml_away_win_prob) : toNum(raw.ml_home_win_prob);
  const otherPrice = pickIsHome ? toNum(raw.away_ml) : toNum(raw.home_ml);
  const otherStoredEdge = pickIsHome ? awayEdge : homeEdge;

  const edgeAt = (p: number | null, q: number | null) =>
    p !== null && p !== 0 && q !== null ? moneylineOutcome(p, q, MLB_EDGE_SCALE) : null;
  const outcome = edgeAt(price, prob);
  const otherOutcome = edgeAt(otherPrice, otherProb);

  return {
    pickIsHome,
    pickTeam: pickIsHome ? homeAbbrev : awayAbbrev,
    pickVisuals: pickIsHome ? home : away,
    prob,
    price: outcome ? price : null,
    storedEdge,
    otherDisplayEdge: otherOutcome ? otherOutcome.edge : otherStoredEdge,
    displayEdge: outcome ? outcome.edge : storedEdge,
    breakEvenPct: outcome ? outcome.breakEvenPercent : null,
  };
}

/**
 * Model history, collapsed by default.
 *
 * These rows are supporting evidence, not the answer — leaving them open meant
 * every market card opened with a table under the recommendation. Behind a
 * disclosure, the card leads with one thing and the detail is one tap away.
 */
export function ModelHistory({
  rows,
  label,
}: {
  rows: TrendDetailsResult[];
  /** What angle the rows describe, e.g. "full-game moneyline". */
  label: string;
}) {
  const [open, setOpen] = React.useState(false);
  const withRoi = rows.filter((r) => r.roi != null);
  const positive = withRoi.filter((r) => (r.roi ?? 0) >= 0).length;

  return (
    <div className="border-t border-black/5 pt-2 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        <span className="text-[11px] font-semibold text-foreground">How this angle has done</span>
        {/* Summarize while collapsed so the disclosure isn't a blind door. */}
        {withRoi.length > 0 && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {positive}/{withRoi.length} profitable
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground/80">
            How the model has historically performed on {label} picks in these situations.
            ROI is return per unit staked.
          </p>
          <TrendStatHeader />
          {rows.map((r, i) => (
            <TrendStatRow key={`${r.label ?? 'row'}-${i}`} details={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Break-even win rate at -110 juice. Below this, a "winning" record still loses money. */
const BREAK_EVEN_PCT = 52.4;

/**
 * The model's historical hit rate on picks like this one, as a meter against the
 * break-even line. This is the single most important qualifier on a
 * recommendation — a +7.1% edge the model hits 38% of the time is a warning, not
 * a bet — and as a small chip it read as decoration. The break-even tick makes
 * "is this actually profitable" answerable without knowing that 52.4% is the bar.
 */
export function HitRateMeter({ info }: { info: BucketAccuracyInfo | null }) {
  if (!info) return null;
  const beatsBreakEven = info.win_pct >= BREAK_EVEN_PCT;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          Model hits{' '}
          <span className={cn('font-bold', beatsBreakEven ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300')}>
            {info.win_pct}%
          </span>{' '}
          on picks like this
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {info.record}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', beatsBreakEven ? 'bg-emerald-500' : 'bg-red-500')}
          style={{ width: `${Math.min(info.win_pct, 100)}%` }}
        />
        {/* Break-even tick — the line a pick has to clear to make money. */}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${BREAK_EVEN_PCT}%` }}
          title={`Break-even at -110 is ${BREAK_EVEN_PCT}%`}
        />
      </div>
    </div>
  );
}

/**
 * The recommendation itself, stated first and largest: what to bet, on which
 * side, by how much. Everything below it in a panel is supporting evidence.
 */
export function Recommendation({
  market,
  pick,
  edge,
  pickVisuals,
  edgeIcon,
  edgeTone = 'primary',
}: {
  market: string;
  pick: string;
  edge: string;
  pickVisuals?: TeamVisuals;
  edgeIcon?: React.ReactNode;
  edgeTone?: 'primary' | 'over' | 'under';
}) {
  const toneClass =
    edgeTone === 'over'
      ? 'text-emerald-600 dark:text-emerald-300'
      : edgeTone === 'under'
        ? 'text-blue-600 dark:text-blue-300'
        : 'text-primary';

  return (
    <div className="flex items-center gap-2.5">
      {pickVisuals && <TeamMark visuals={pickVisuals} abbrev={pick} size={38} />}
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        <span
          className={cn(
            'truncate text-xl font-bold leading-tight tracking-tight',
            // Over/under picks carry their direction color on the word itself,
            // not just on the edge value beside it.
            edgeTone === 'primary' ? 'text-foreground' : toneClass,
          )}
        >
          {pick}
        </span>
      </div>
      <span
        className={cn(
          'ml-auto flex shrink-0 items-center gap-0.5 font-mono text-sm font-bold',
          toneClass,
        )}
      >
        {edgeIcon}
        {edge}
      </span>
    </div>
  );
}

/** Small circular team logo, falling back to the abbreviation on a color chip. */
export function TeamMark({
  visuals,
  abbrev,
  size = 22,
  dimmed = false,
}: {
  visuals: TeamVisuals;
  abbrev: string;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(visuals.logoUrl) && !failed;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-40',
      )}
      style={{
        width: size,
        height: size,
        background: showLogo ? 'hsl(var(--background))' : visuals.colors.primary,
      }}
    >
      {showLogo ? (
        <img
          src={visuals.logoUrl as string}
          alt={abbrev}
          loading="lazy"
          className="h-full w-full object-contain p-px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[8px] font-bold text-white">{abbrev.slice(0, 3)}</span>
      )}
    </span>
  );
}

/**
 * Opposed win-probability bar in the two teams' own colors, with logos on each
 * end. The side the model likes is called out explicitly — a check mark, full
 * opacity, and the edge value — because the bar alone only shows who's favored,
 * not where the model disagrees with the market. Those are different questions
 * and the pick is the one that matters here.
 */
export function WinProbBar({
  awayAbbrev,
  homeAbbrev,
  awayProb,
  homeProb,
  away,
  home,
  pickIsHome,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  /** 0-1 probabilities. */
  awayProb: number | null;
  homeProb: number | null;
  away: TeamVisuals;
  home: TeamVisuals;
  /** Which side the model's edge is on. */
  pickIsHome: boolean;
}) {
  if (awayProb === null || homeProb === null) return null;
  const awayPct = awayProb * 100;
  const homePct = homeProb * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamMark visuals={away} abbrev={awayAbbrev} size={28} dimmed={pickIsHome} />
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              pickIsHome ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {awayAbbrev} {awayPct.toFixed(1)}%
          </span>
          {!pickIsHome && <Check className="h-3 w-3 shrink-0 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {pickIsHome && <Check className="h-3 w-3 shrink-0 text-primary" />}
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              pickIsHome ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {homePct.toFixed(1)}% {homeAbbrev}
          </span>
          <TeamMark visuals={home} abbrev={homeAbbrev} size={28} dimmed={!pickIsHome} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${awayAbbrev} ${awayPct.toFixed(1)}%, ${homeAbbrev} ${homePct.toFixed(1)}%. Model picks ${pickIsHome ? homeAbbrev : awayAbbrev}.`}
      >
        {/* The unpicked side is muted so the eye lands on the edge. */}
        <div
          style={{ width: `${awayPct}%`, backgroundColor: away.colors.primary }}
          className={cn('transition-opacity', pickIsHome && 'opacity-35')}
        />
        <div
          style={{ width: `${homePct}%`, backgroundColor: home.colors.primary }}
          className={cn('transition-opacity', !pickIsHome && 'opacity-35')}
        />
      </div>
    </div>
  );
}

/**
 * Fair total against the market total on the centred edge rail, with the model's
 * lean called out by the zone it lands in.
 *
 * Runs, not points: the rail gets `MLB_EDGE_SCALE`, whose bands (0.5 / 1.0 / 2.0)
 * are `OU_BUCKETS`. The football scale here would read STRONG OVER on every game.
 *
 * `ou_direction` is the authority on the lean, but `total_line` can move after
 * the model snapshot is written, so sign(fair − market) can disagree with it.
 * When it does the rail would print "Over Lean" under an UNDER recommendation,
 * so the card falls back to the plain comparison row and says so.
 */
export function TotalEdge({
  fair,
  market,
  direction,
}: {
  fair: number | null;
  market: number | null;
  direction: string;
}) {
  if (fair === null || market === null) return null;
  const gap = fair - market;
  const leansOver = direction.toUpperCase().includes('OVER');
  const agrees = gap === 0 || gap > 0 === leansOver;

  if (agrees) {
    return (
      <ModelEdgeRail
        market={market}
        model={fair}
        scale={MLB_EDGE_SCALE}
        // Two decimals throughout: 0.33 runs and 0.5 runs are different verdicts
        // and the card's own headline quotes them at this precision.
        format={(v) => v.toFixed(2)}
        formatGap={(m) => m.toFixed(2)}
      />
    );
  }

  return (
    <ModelVsMarketRow
      model={fair.toFixed(2)}
      market={market.toFixed(1)}
      gapDisplay={`${gap > 0 ? '+' : ''}${gap.toFixed(2)}`}
      gapUnit="runs"
      tone={leansOver ? 'over' : 'under'}
      lean={
        <>
          The posted total has moved since the model ran, so its{' '}
          <span className="font-bold text-foreground">{fair.toFixed(2)}</span> now sits the other
          side of {market.toFixed(1)} — the model&apos;s own call is still{' '}
          <span
            className={cn(
              'font-bold',
              leansOver ? 'text-emerald-600 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-300',
            )}
          >
            {leansOver ? 'OVER' : 'UNDER'}
          </span>
        </>
      }
    />
  );
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

/** Model confidence when there's no bucket-accuracy sample to show instead. */
export function ConfidenceChip({ label }: { label: 'Strong' | 'Moderate' | 'Weak' }) {
  const tone = label === 'Strong' ? 'success' : label === 'Moderate' ? 'warning' : 'default';
  return (
    <Chip size="sm" variant="flat" color={tone} classNames={{ content: 'font-semibold' }}>
      {label}
    </Chip>
  );
}

// ---------------------------------------------------------------------------
// Signal pills (copied from MLB.tsx; colors adapted for light mode)
// ---------------------------------------------------------------------------

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
// One container per market, not three. The widget card already supplies a
// surface, so the panel only needs separation — a hairline rule between markets
// instead of a nested box, and no box at all around the history rows.
export const INNER_PANEL = 'space-y-3 py-1';

/** Historical Model Context box inside a panel. */
export const CONTEXT_BOX = 'pt-1';

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

export interface TeamVisuals {
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
}

export interface SplitPanelProps {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
  modelAccuracy: MLBBucketAccuracy | null | undefined;
  breakdownRows: ModelBreakdownRow[];
  /** Logo + colors so the panels can show WHICH side the edge is on, not just its size. */
  away: TeamVisuals;
  home: TeamVisuals;
  bookOdds?: SportsbookGameOdds | null;
  selectedBookKeys?: Set<string>;
}

function selectedBookQuote(
  odds: SportsbookGameOdds | null | undefined,
  selectedBookKeys: Set<string> | undefined,
  market: SportsbookMarket,
) {
  if (!odds) return null;
  const board = quotesForMarket(odds, market);
  if (board.quotes.length === 0) return null;
  return preferredQuote(board, selectedBookKeys ?? new Set()) ?? null;
}

function MlbBookChip({
  odds,
  selectedBookKeys,
  market,
  title,
  selection,
}: {
  odds?: SportsbookGameOdds | null;
  selectedBookKeys?: Set<string>;
  market: SportsbookMarket;
  title: string;
  selection: string;
}) {
  if (!odds) return null;
  const board = quotesForMarket(odds, market);
  if (board.quotes.length === 0) return null;
  return (
    <BestBookChip
      quotes={board}
      selectedBookKeys={selectedBookKeys ?? new Set()}
      marketTitle={title}
      selectionTitle={selection}
      formatLine={(line) => {
        const body = Number.isInteger(line) ? String(line) : line.toFixed(1);
        return line > 0 ? `+${body}` : body;
      }}
    />
  );
}

export function FullMlPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows, away, home, bookOdds, selectedBookKeys }: SplitPanelProps) {
  const ml = deriveFullMl(raw, awayAbbrev, homeAbbrev, away, home);
  const mlMarket: SportsbookMarket = { kind: 'moneyline', isHome: ml.pickIsHome };
  const bookPrice = selectedBookQuote(bookOdds, selectedBookKeys, mlMarket)?.price ?? null;
  const barPrice = bookPrice ?? ml.price;
  const barOutcome =
    barPrice !== null && ml.prob !== null && ml.prob > 0 && ml.prob < 1
      ? moneylineOutcome(barPrice, ml.prob, MLB_EDGE_SCALE)
      : null;
  const displayEdge = barOutcome ? barOutcome.edge : ml.displayEdge;
  const mlIsStrong = ml.pickIsHome ? raw.home_ml_strong_signal : raw.away_ml_strong_signal;
  const mlConfidenceLabel = mlIsStrong ? 'Strong' : 'Weak';

  const mlSide = ml.pickIsHome ? 'home' : 'away';
  const mlLine = ml.pickIsHome ? toNum(raw.home_ml) : toNum(raw.away_ml);
  const mlFavDog = mlLine !== null ? (mlLine < 0 ? 'favorite' : 'underdog') as 'favorite' | 'underdog' : undefined;
  // Bucket lookups key off the STORED edge — those tables were built from that
  // column by the grading script, so a derived figure would land in the wrong cell.
  const mlAcc = ml.storedEdge !== null
    ? lookupBucketAccuracy(modelAccuracy, 'full_ml', ml.storedEdge, mlSide as 'home' | 'away', mlFavDog)
    : null;

  const gameDowLabel = dayLabelFromDate(raw.official_date);
  const fullMlDowRow = findBreakdownRow(breakdownRows, 'full_ml', 'dow', gameDowLabel);
  const fullMlTeamRow = findBreakdownRow(breakdownRows, 'full_ml', 'team', toBreakdownTeamAbbr(ml.pickTeam));
  const fullMlDowDetails = trendDetails(fullMlDowRow, gameDowLabel ? `${gameDowLabel} unavailable` : 'Unavailable');
  const fullMlTeamDetails = trendDetails(fullMlTeamRow, `${ml.pickTeam} unavailable`);

  return (
    <div className={INNER_PANEL}>
      <Recommendation
        market="Moneyline"
        pick={ml.pickTeam}
        pickVisuals={ml.pickVisuals}
        edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
        edge={displayEdge !== null ? `${displayEdge > 0 ? '+' : ''}${displayEdge.toFixed(1)}%` : '—'}
      />
      <MlbBookChip
        odds={bookOdds}
        selectedBookKeys={selectedBookKeys}
        market={mlMarket}
        title="Moneyline"
        selection={`${ml.pickTeam} moneyline`}
      />
      {mlAcc ? (
        <HitRateMeter info={mlAcc} />
      ) : (
        <ConfidenceChip label={mlConfidenceLabel as 'Strong' | 'Weak'} />
      )}
      {/* A price IS a required win rate, so the moneyline gets the same
          threshold-vs-model shape as a spread. Falls back to the plain row when
          the row carries no book price to derive a break-even from. */}
      {barPrice !== null && ml.prob !== null ? (
        <MoneylineEdgeBar
          price={barPrice}
          modelProbability={ml.prob}
          scale={MLB_EDGE_SCALE}
          teamAbbrev={ml.pickTeam}
        />
      ) : (
        ml.prob !== null && displayEdge !== null && (
          <ModelVsMarketRow
            model={`${(ml.prob * 100).toFixed(1)}%`}
            modelAccessory={<TeamMark visuals={ml.pickVisuals} abbrev={ml.pickTeam} size={24} />}
            market={`${(ml.prob * 100 - displayEdge).toFixed(1)}%`}
            gapDisplay={`${displayEdge > 0 ? '+' : ''}${displayEdge.toFixed(1)}%`}
            gapUnit={displayEdge >= 0 ? 'value' : 'no value'}
            tone={displayEdge >= 0 ? 'win' : 'loss'}
            lean={
              <>
                Model rates <span className="font-bold text-foreground">{ml.pickTeam}</span>{' '}
                {Math.abs(displayEdge).toFixed(1)} pts{' '}
                {displayEdge >= 0 ? 'higher' : 'lower'} than Vegas
              </>
            }
          />
        )
      )}
      <WinProbBar
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        awayProb={toNum(raw.ml_away_win_prob)}
        homeProb={toNum(raw.ml_home_win_prob)}
        away={away}
        home={home}
        pickIsHome={ml.pickIsHome}
      />
      <ModelHistory label="full-game moneyline" rows={[fullMlDowDetails, fullMlTeamDetails]} />
    </div>
  );
}

export function F5MlPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows, away, home, bookOdds, selectedBookKeys }: SplitPanelProps) {
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
  const f5PickProb = f5PickIsHome ? f5HomeProb : f5AwayProb;

  const f5Side = f5PickIsHome ? 'home' : 'away';
  const f5Market: SportsbookMarket = { kind: 'firstFiveMoneyline', isHome: f5PickIsHome };
  const bookPrice = selectedBookQuote(bookOdds, selectedBookKeys, f5Market)?.price ?? null;
  const barOutcome =
    bookPrice !== null && f5PickProb !== null && f5PickProb > 0 && f5PickProb < 1
      ? moneylineOutcome(bookPrice, f5PickProb, MLB_EDGE_SCALE)
      : null;
  const displayEdge = barOutcome ? barOutcome.edge : f5PickEdge;
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
      <Recommendation
        market="1st 5 Moneyline"
        pick={f5PickTeam}
        pickVisuals={f5PickIsHome ? home : away}
        edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
        edge={displayEdge !== null ? `${displayEdge > 0 ? '+' : ''}${displayEdge.toFixed(1)}%` : '—'}
      />
      <MlbBookChip
        odds={bookOdds}
        selectedBookKeys={selectedBookKeys}
        market={f5Market}
        title="1st 5 Moneyline"
        selection={`${f5PickTeam} moneyline`}
      />
      {f5Acc ? <HitRateMeter info={f5Acc} /> : f5PickMlStrong ? <ConfidenceChip label="Strong" /> : null}
      {barOutcome && bookPrice !== null && f5PickProb !== null ? (
        <MoneylineEdgeBar
          price={bookPrice}
          modelProbability={f5PickProb}
          scale={MLB_EDGE_SCALE}
          teamAbbrev={f5PickTeam}
        />
      ) : (
        f5PickProb !== null && displayEdge !== null && (
          <ModelVsMarketRow
            model={`${(f5PickProb * 100).toFixed(1)}%`}
            modelAccessory={
              <TeamMark visuals={f5PickIsHome ? home : away} abbrev={f5PickTeam} size={24} />
            }
            market={`${(f5PickProb * 100 - displayEdge).toFixed(1)}%`}
            gapDisplay={`${displayEdge > 0 ? '+' : ''}${displayEdge.toFixed(1)}%`}
            gapUnit={displayEdge >= 0 ? 'value' : 'no value'}
            tone={displayEdge >= 0 ? 'win' : 'loss'}
            lean={
              <>
                Model rates <span className="font-bold text-foreground">{f5PickTeam}</span>{' '}
                {Math.abs(displayEdge).toFixed(1)} pts {displayEdge >= 0 ? 'higher' : 'lower'} than Vegas
              </>
            }
          />
        )
      )}
      <WinProbBar
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        awayProb={f5AwayProb}
        homeProb={f5HomeProb}
        away={away}
        home={home}
        pickIsHome={f5PickIsHome}
      />
      <ModelHistory label="1st-5 moneyline" rows={[f5MlDowDetails, f5MlTeamDetails]} />
    </div>
  );
}

export function FullTotalPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows, bookOdds, selectedBookKeys }: SplitPanelProps) {
  const ouFair = toNum(raw.ou_fair_total);
  const ouDirection = raw.ou_direction || 'N/A';
  const isOver = ouDirection.toUpperCase().includes('OVER');
  const bookLine = selectedBookQuote(bookOdds, selectedBookKeys, { kind: 'total', isOver })?.line ?? null;
  const ouMarket = bookLine ?? toNum(raw.total_line);
  // Prefer the subtraction TotalEdge draws, so the chip and the rail can't print
  // two different sizes for one gap when `total_line` has moved since the
  // snapshot; `ou_edge` only fills in when a total is missing.
  const ouEdge =
    ouFair !== null && ouMarket !== null ? Math.abs(ouFair - ouMarket) : Math.abs(raw.ou_edge || 0);
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
      <Recommendation
        market="Total"
        pick={ouDirection}
        edgeTone={ouDirection.toUpperCase().includes('OVER') ? 'over' : 'under'}
        edgeIcon={
          ouDirection.toUpperCase().includes('OVER')
            ? <ArrowUp className="h-3.5 w-3.5" />
            : <ArrowDown className="h-3.5 w-3.5" />
        }
        edge={`+${ouEdge.toFixed(2)}`}
      />
      <MlbBookChip
        odds={bookOdds}
        selectedBookKeys={selectedBookKeys}
        market={{ kind: 'total', isOver: ouDirection.toUpperCase().includes('OVER') }}
        title="Total"
        selection={`${ouDirection} ${ouMarket ?? ''}`}
      />
      {ouAcc ? (
        <HitRateMeter info={ouAcc} />
      ) : (
        <ConfidenceChip label={totalConfidenceLabel as 'Strong' | 'Moderate' | 'Weak'} />
      )}
      <TotalEdge fair={ouFair} market={ouMarket} direction={ouDirection} />
      <ModelHistory
        label="full-game total"
        rows={[fullOuDowDetails, fullOuAwayDetails, fullOuHomeDetails]}
      />
    </div>
  );
}

export function F5TotalPanel({ raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows, bookOdds, selectedBookKeys }: SplitPanelProps) {
  const f5Fair = toNum(raw.f5_fair_total);
  const f5Direction = (toNum(raw.f5_ou_edge) ?? 0) >= 0 ? 'OVER' : 'UNDER';
  const bookLine = selectedBookQuote(
    bookOdds,
    selectedBookKeys,
    { kind: 'firstFiveTotal', isOver: f5Direction === 'OVER' },
  )?.line ?? null;
  const f5Market = bookLine ?? toNum(raw.f5_total_line);
  const f5TotalEdge =
    f5Fair !== null && f5Market !== null
      ? Math.abs(f5Fair - f5Market)
      : Math.abs(toNum(raw.f5_ou_edge) ?? 0);
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
      <Recommendation
        market="1st 5 Total"
        pick={f5Direction}
        edgeTone={f5Direction === 'OVER' ? 'over' : 'under'}
        edgeIcon={
          f5Direction === 'OVER'
            ? <ArrowUp className="h-3.5 w-3.5" />
            : <ArrowDown className="h-3.5 w-3.5" />
        }
        edge={`+${f5TotalEdge.toFixed(2)}`}
      />
      <MlbBookChip
        odds={bookOdds}
        selectedBookKeys={selectedBookKeys}
        market={{ kind: 'firstFiveTotal', isOver: f5Direction === 'OVER' }}
        title="1st 5 Total"
        selection={`${f5Direction} ${f5Market ?? ''}`}
      />
      {f5OuAcc ? <HitRateMeter info={f5OuAcc} /> : null}
      <TotalEdge fair={f5Fair} market={f5Market} direction={f5Direction} />
      <ModelHistory
        label="1st-5 total"
        rows={[f5OuDowDetails, f5OuAwayDetails, f5OuHomeDetails]}
      />
    </div>
  );
}
