import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown, TrendingUp, TrendingDown, CalendarClock, Loader2,
  Bookmark, Trash2, X, Search, Send, MessageSquare,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { mlbAnalysisTeamLabel, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';
import { filterPitchers, foldSearchText } from '@/utils/mlbPitcherSearch';
import { loadMlbPitcherCatalog, mlbPitcherCatalogNames } from '@/utils/mlbPitcherCatalog';
import { isSideSymmetricMlb, MLB_SPORT_CONFIG } from '@/features/analysis/filterSchemaMlb';
import { applySportFilterPatch } from '@/features/analysis/sportFilterEngine';
import { rewriteMlbPitcherAgainstTeamOps } from '@/features/analysis/mlbNlPitcherTeamRewrite';
import { normalizeMlbSavedFilterSnapshot, MLB_SNAPSHOT_DEFAULTS, type MlbFilterSnapshot } from '@/features/analysis/normalizeSavedFilterSnapshot';

const NL_FILTER_EXAMPLES = [
  'home dogs facing an ace lefty',
  'run line for teams that won 5 straight',
  'day games where both teams go under more than half the time',
];

type NlChatTurn = {
  id: number;
  sentence: string;
  lines: string[];
};

// ── Bet-type spine ──
const BET_GROUPS = [
  {
    group: 'Full Game',
    items: [
      { key: 'ml', label: 'Moneyline' },
      { key: 'rl', label: 'Run Line' },
      { key: 'total', label: 'Total' },
    ],
  },
  {
    group: 'First Five (F5)',
    items: [
      { key: 'f5_ml', label: 'F5 ML' },
      { key: 'f5_rl', label: 'F5 Run Line' },
      { key: 'f5_total', label: 'F5 Total' },
    ],
  },
];

const ML_MARKETS = new Set(['ml', 'f5_ml']);
/** f5_ml has no historical odds — ROI slot is always "—" */
const NO_ROI_MARKETS = new Set(['f5_ml']);
const TOTAL_MARKETS = new Set(['total', 'f5_total']);
const SEASON_FLOOR = 2023;
const SEASON_MAX = 2026;
/** Default query window — last 2 seasons. Full history is still on the slider (floor→max). */
const DEFAULT_SEASONS: [number, number] = [Math.max(SEASON_FLOOR, SEASON_MAX - 1), SEASON_MAX];

const TOTAL_CFG: Record<string, { min: number; max: number; mk: string; xk: string; label: string }> = {
  total: { min: 5, max: 14, mk: 'total_min', xk: 'total_max', label: 'Game total' },
  f5_total: { min: 2, max: 8, mk: 'f5_total_min', xk: 'f5_total_max', label: 'F5 total' },
};

const ML_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Heavy fav ≤−180', max: -180 },
  { label: 'Mod fav −179…−135', min: -179, max: -135 },
  { label: 'Slight fav −134…−105', min: -134, max: -105 },
  { label: "Pick'em ±105", min: -105, max: 105 },
  { label: 'Slight dog +105…+135', min: 105, max: 135 },
  { label: 'Big dog ≥+150', min: 150 },
];

const TOTAL_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: '≤7.5', max: 7.5 },
  { label: '8–8.5', min: 8, max: 8.5 },
  { label: '9–9.5', min: 9, max: 9.5 },
  { label: '10+', min: 10 },
];

const TIME_CHIPS: { label: string; min?: string; max?: string }[] = [
  { label: 'Matinee', max: '14:59' },
  { label: 'Afternoon', min: '15:00', max: '17:59' },
  { label: 'Evening', min: '18:00', max: '20:59' },
  { label: 'Late night', min: '21:00' },
];

const XFIP_TIERS: { label: string; min?: number; max?: number }[] = [
  { label: 'Ace ≤3.50', max: 3.5 },
  { label: 'Good 3.51–4.00', min: 3.51, max: 4.0 },
  { label: 'Avg 4.01–4.50', min: 4.01, max: 4.5 },
  { label: 'Weak >4.50', min: 4.51 },
];

const BP_IP_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Rested ≤6', max: 6 },
  { label: 'Normal', min: 6.1, max: 11.9 },
  { label: 'Gassed ≥12', min: 12 },
];

const PF_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Hitter park ≥103', min: 103 },
  { label: 'Neutral', min: 97.1, max: 102.9 },
  { label: 'Pitcher park ≤97', max: 97 },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** One-sided numeric range — omit a bound entirely (do NOT fill with 0/defaults). */
type OptRange = { min?: number; max?: number };

/** Parse a free-text number field; empty / incomplete → unset (null). */
function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === '' || t === '-' || t === '+' || t === '.' || t === '-.' || t === '+.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Assign only the bounds the user actually set — never invent the other end. */
function assignRange(
  f: Record<string, unknown>,
  minKey: string,
  maxKey: string,
  range: OptRange | null | undefined,
) {
  if (!range) return;
  if (range.min != null && Number.isFinite(range.min)) f[minKey] = range.min;
  if (range.max != null && Number.isFinite(range.max)) f[maxKey] = range.max;
}

function assignOptionalNumber(f: Record<string, unknown>, key: string, raw: string) {
  const n = parseOptionalNumber(raw);
  if (n != null) f[key] = n;
}

/** Apply a dual-thumb range to p_filters only when it differs from the default. */
function applyNumRange(f: Record<string, unknown>, key: string, range: [number, number], def: [number, number]) {
  if (range[0] > def[0]) f[`${key}_min`] = range[0];
  if (range[1] < def[1]) f[`${key}_max`] = range[1];
}
/** Percent UI is 0–100; RPC expects 0–1. */
function applyPctRange(f: Record<string, unknown>, key: string, range: [number, number], def: [number, number] = [0, 100]) {
  if (range[0] > def[0]) f[`${key}_min`] = Math.round(range[0]) / 100;
  if (range[1] < def[1]) f[`${key}_max`] = Math.round(range[1]) / 100;
}
function rangeChanged(a: [number, number], b: [number, number]) {
  return a[0] !== b[0] || a[1] !== b[1];
}

const logoFor = (abbr?: string) => (abbr ? espnMlb500LogoUrlFromAbbrev(abbr) : '/placeholder.svg');

function sideLabel(betType: string, side: string): string {
  if (side === 'over') return 'Over';
  if (side === 'under') return 'Under';
  const verb = ML_MARKETS.has(betType) ? 'won' : 'covered';
  if (side === 'home') return `Home ${verb}`;
  if (side === 'away') return `Away ${verb}`;
  if (side === 'favorite') return `Favorites ${verb}`;
  if (side === 'underdog') return `Underdogs ${verb}`;
  return side;
}

function lineForBet(betType: string, g: Record<string, unknown>): string {
  const t = String(g.team ?? '');
  if (betType === 'ml') return `${t} ML (${g.is_favorite ? 'favorite' : 'underdog'}${g.ml != null ? ` ${fmtMl(g.ml as number)}` : ''})`;
  if (betType === 'rl') return `${t} RL ${g.is_favorite ? '−1.5' : '+1.5'}`;
  if (betType === 'total') return `Total O/U ${g.total ?? '—'}`;
  if (betType === 'f5_ml') return `${t} F5 ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
  if (betType === 'f5_rl') return `${t} F5 RL ${g.is_favorite ? '−0.5' : '+0.5'}`;
  if (betType === 'f5_total') return `F5 Total O/U ${g.f5_total ?? '—'}`;
  return '';
}

function fmtMl(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtKick(timeEt?: string, gameDate?: string): string {
  if (!timeEt && !gameDate) return '';
  try {
    if (gameDate && timeEt) {
      const iso = `${gameDate}T${timeEt.length === 5 ? `${timeEt}:00` : timeEt}`;
      return new Date(iso + (timeEt.includes('Z') || timeEt.includes('+') ? '' : '')).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'America/New_York',
      }) + ' ET';
    }
    if (timeEt) return `${timeEt} ET`;
    return gameDate || '';
  } catch {
    return [gameDate, timeEt].filter(Boolean).join(' ') + ' ET';
  }
}

function upcomingChips(g: Record<string, unknown>): string[] {
  const chips: string[] = [];
  if (g.series_game != null) chips.push(`Series G${Number(g.series_game) >= 4 ? '4+' : g.series_game}`);
  if (g.trip_series_index != null) {
    const t = Number(g.trip_series_index);
    chips.push(t >= 3 ? '3rd+ series of trip' : t === 2 ? '2nd series of trip' : '1st series of trip');
  }
  if (g.is_switch_game) chips.push('Switch game');
  if (g.opp_sp_hand) chips.push(`vs ${g.opp_sp_hand}HP`);
  if (g.opp_sp_name) chips.push(String(g.opp_sp_name));
  if (g.is_doubleheader) chips.push('DH');
  if (g.day_of_week) chips.push(String(g.day_of_week));
  return chips;
}

type Opt = { side: string; n: number; wins: number; hit_pct: number; roi: number | null };
type Bar = { dimension: string; options: Opt[] };
type Analysis = {
  bet_type: string;
  coverage: { season_min: number; season_max: number; n_bets: number; n_games: number };
  baseline_pct: number;
  overall: { n: number; wins: number; hit_pct: number; roi: number | null };
  bars: Bar[];
  by_team: { team: string; n: number; hit_pct: number; roi: number | null }[];
  by_venue: { venue: string; n: number; hit_pct: number; roi: number | null }[];
};

type PitcherOpt = { id: number; name: string; hand: string | null; team: string | null };

function significance(n: number, hit: number): { label: string; tone: string } {
  const dev = Math.abs(hit - 50);
  if (n < 20) return { label: 'Thin sample', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  if (n >= 60 && dev >= 5) return { label: 'Strong', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (n >= 30 && dev >= 3) return { label: 'Solid', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
  return { label: 'Neutral', tone: 'bg-muted text-muted-foreground' };
}

const VERB: Record<string, string> = {
  ml: 'won', rl: 'covered the run line', total: 'went over',
  f5_ml: 'won the F5', f5_rl: 'covered the F5 run line', f5_total: 'went over the F5 total',
};
const OUTCOME: Record<string, string> = {
  ml: 'Win', rl: 'Cover', total: 'Over', f5_ml: 'Win', f5_rl: 'Cover', f5_total: 'Over',
};
const nounFor = (bt?: string) => (bt && TOTAL_MARKETS.has(bt) ? 'games' : 'bets');

const PRESETS: { label: string; betType: string; filters: Record<string, unknown> }[] = [
  { label: 'Home underdogs', betType: 'ml', filters: { side: 'home', favDog: 'underdog' } },
  { label: 'Away after switch', betType: 'ml', filters: { side: 'away', switchGame: true } },
  { label: 'Series G1 unders', betType: 'total', filters: { seriesGame: [1, 1] } },
  { label: 'vs LHP', betType: 'ml', filters: { oppSpHand: 'L' } },
  { label: 'Gassed bullpen overs', betType: 'total', filters: { bpIp: { min: 12 } } },
  { label: 'Hitter-park overs', betType: 'total', filters: { pfRuns: { min: 103 } } },
];

const DIM_LABEL: Record<string, string> = {
  over_under: 'Over / Under',
  home_away: 'Home vs Away',
  fav_dog: 'Favorite vs Underdog',
};

function RoiSlot({ roi, betType }: { roi: number | null | undefined; betType: string }) {
  if (NO_ROI_MARKETS.has(betType)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground cursor-help">—</span>
          </TooltipTrigger>
          <TooltipContent>No historical F5 odds</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (roi == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
      {roi >= 0 ? '+' : ''}{roi}% ROI
    </span>
  );
}

function OptionRow({ betType, opt, baseline }: { betType: string; opt: Opt; baseline: number }) {
  const good = opt.hit_pct >= 52.4;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{sideLabel(betType, opt.side)}</span>
        <span className={good ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground/80'}>
          {opt.hit_pct}% <span className="text-xs text-muted-foreground font-normal">({opt.wins} of {opt.n})</span>
        </span>
      </div>
      <div className="relative h-2 rounded bg-muted mt-1 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded bg-emerald-500/50" style={{ width: `${Math.min(opt.hit_pct, 100)}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${baseline}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
        <span>vs {baseline}% baseline</span>
        <RoiSlot roi={opt.roi} betType={betType} />
      </div>
    </div>
  );
}

function ResultBar({ betType, bar, baseline, onFocus }: {
  betType: string; bar: Bar; baseline: number; onFocus?: (dimension: string, side: string) => void;
}) {
  // Side splits: highlight the more extreme side (green fill from the right, 50% midline) — same
  // visual language as SymmetricSplitHero / the NFL page.
  if (bar.dimension === 'home_away' || bar.dimension === 'fav_dog') {
    const opts = (bar.options || []).filter((o) => o.n > 0 && SIDE_CHIP_LABEL[o.side]);
    if (opts.length >= 2) {
      const sorted = [...opts].sort((a, b) => b.hit_pct - a.hit_pct);
      return (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIM_LABEL[bar.dimension]}</div>
          <VersusRow slice={{ dimension: bar.dimension, extreme: sorted[0], other: sorted[1] }} onFocus={onFocus} />
        </div>
      );
    }
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIM_LABEL[bar.dimension] || bar.dimension}</div>
      {bar.options.map((opt, i) => <OptionRow key={i} betType={betType} opt={opt} baseline={baseline} />)}
    </div>
  );
}

// ── Symmetric side-market hero ──────────────────────────────────────────────────────────────
// On ml/rl/f5 side markets, mirror-row bookkeeping forces "all teams" to ~50% whenever only
// game-level filters are active (see filterSchemaMlb.isSideSymmetricMlb). Never headline that
// tautology — lead with the most extreme REAL side split instead.
type SideSlice = { dimension: string; extreme: Opt; other: Opt };
const SIDE_CHIP_LABEL: Record<string, string> = { home: 'Home', away: 'Away', favorite: 'Favorites', underdog: 'Underdogs' };

function pickSideSlices(bars: Bar[] | undefined): SideSlice[] {
  const out: SideSlice[] = [];
  for (const bar of bars || []) {
    if (bar.dimension !== 'home_away' && bar.dimension !== 'fav_dog') continue;
    const opts = (bar.options || []).filter((o) => o.n > 0 && SIDE_CHIP_LABEL[o.side]);
    if (opts.length < 2) continue;
    // Lead with / highlight the stronger side (higher hit%). Complements are equally far from
    // 50%, so abs-from-50 ties and would arbitrarily keep RPC order (often the <50% side).
    const sorted = [...opts].sort((a, b) => b.hit_pct - a.hit_pct);
    out.push({ dimension: bar.dimension, extreme: sorted[0], other: sorted[1] });
  }
  out.sort((a, b) => b.extreme.hit_pct - a.extreme.hit_pct);
  return out;
}

function VersusRow({ slice, onFocus }: { slice: SideSlice; onFocus?: (dimension: string, side: string) => void }) {
  const otherLabel = `${SIDE_CHIP_LABEL[slice.other.side]} ${slice.other.hit_pct}%`;
  const extremeLabel = `${SIDE_CHIP_LABEL[slice.extreme.side]} ${slice.extreme.hit_pct}%`;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        {onFocus ? (
          <button type="button" className="text-foreground/70 hover:underline" onClick={() => onFocus(slice.dimension, slice.other.side)}>{otherLabel}</button>
        ) : (
          <span className="text-foreground/70">{otherLabel}</span>
        )}
        {onFocus ? (
          <button type="button" className="font-semibold hover:underline" onClick={() => onFocus(slice.dimension, slice.extreme.side)}>{extremeLabel}</button>
        ) : (
          <span className="font-semibold">{extremeLabel}</span>
        )}
      </div>
      <div className="relative h-2 rounded bg-muted overflow-hidden">
        <div className="absolute inset-y-0 right-0 rounded bg-emerald-500/60" style={{ width: `${Math.min(slice.extreme.hit_pct, 100)}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: '50%' }} />
      </div>
    </div>
  );
}

function SymmetricSplitHero({ betType, slices, cov, onFocus }: {
  betType: string; slices: SideSlice[]; cov: Analysis['coverage'] | undefined; onFocus: (dimension: string, side: string) => void;
}) {
  const head = slices[0];
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="py-5">
        <div className="flex items-start gap-4">
          <TrendingUp className="w-6 h-6 text-emerald-500 mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-primary tabular-nums leading-none">
                {head.extreme.hit_pct}%
              </span>
              {head.extreme.roi != null && !NO_ROI_MARKETS.has(betType) && (
                <span className={`text-lg font-semibold tabular-nums ${head.extreme.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {head.extreme.roi >= 0 ? '+' : ''}{head.extreme.roi}% ROI
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium leading-snug">
              {sideLabel(betType, head.extreme.side)}{' '}
              <span className="text-primary">{head.extreme.hit_pct}%</span>{' '}
              <span className="font-normal text-muted-foreground">
                ({head.extreme.wins} of {head.extreme.n} bets{cov ? ` · ${cov.season_min}–${cov.season_max}` : ''})
                {' · '}{significance(head.extreme.n, head.extreme.hit_pct).label}
              </span>
            </p>
            <div className="mt-3 space-y-2.5 max-w-md">
              {slices.map((sl) => <VersusRow key={sl.dimension} slice={sl} onFocus={onFocus} />)}
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-2.5">
              Every game here has one side that {ML_MARKETS.has(betType) ? 'wins and one that loses' : "covers and one that doesn't"},
              so “all teams” is always ~50% on this market — these are the real splits. Tap a side to focus on it.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  betType, rows, keyName, logo,
}: {
  betType: string;
  rows: Record<string, unknown>[];
  keyName: string;
  logo?: boolean;
}) {
  const [sort, setSort] = useState<'roi' | 'hit' | 'n'>('n');
  const sorted = useMemo(() => [...(rows || [])].sort((x, y) =>
    sort === 'n' ? Number(y.n) - Number(x.n)
      : sort === 'hit' ? Number(y.hit_pct) - Number(x.hit_pct)
        : (Number(y.roi) || -999) - (Number(x.roi) || -999)), [rows, sort]);
  const hideRoiSort = NO_ROI_MARKETS.has(betType);
  const outcome = OUTCOME[betType] || 'Hit';
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-6 text-center">No results with enough games (min 3).</p>;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {(['n', 'hit', 'roi'] as const).filter(s => s !== 'roi' || !hideRoiSort).map(s => (
            <Button key={s} size="sm" variant={sort === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSort(s)}>
              {s === 'n' ? 'Games' : s === 'hit' ? `${outcome} %` : 'ROI'}
            </Button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{outcome} rate</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border divide-y">
        {sorted.map((r, i) => {
          const n = Number(r.n);
          const hit = Number(r.hit_pct);
          const roi = r.roi as number | null;
          const sig = significance(n, hit);
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              {logo
                ? <img src={logoFor(String(r.team))} alt={String(r.team)} className="w-6 h-6 shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                : <div className="w-6 shrink-0" />}
              <span className="flex-1 truncate font-medium">{String(r[keyName])}</span>
              <Badge variant="secondary" className={`text-[10px] ${sig.tone}`}>{n}g</Badge>
              <span className={`w-14 text-right font-semibold ${hit > 52 ? 'text-emerald-600 dark:text-emerald-400' : hit < 48 ? 'text-red-600 dark:text-red-400' : ''}`}>{hit}%</span>
              <span className="w-16 text-right text-xs"><RoiSlot roi={roi} betType={betType} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MLBAnalytics() {
  const [betType, setBetType] = useState('ml');
  const [data, setData] = useState<Analysis | null>(null);
  const [upcoming, setUpcoming] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  // ── SCOPE ──
  // Default to last 2 seasons for first paint — full 2023–2026 is ~4× the rows. Slider still goes to 2023.
  const [seasons, setSeasons] = useState<[number, number]>(DEFAULT_SEASONS);
  const [months, setMonths] = useState<[number, number]>([3, 11]);
  const [teams, setTeams] = useState<string[]>([]);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<{ abbr: string; name: string }[]>([]);
  const [division, setDivision] = useState<boolean | null>(null);
  const [interleague, setInterleague] = useState<boolean | null>(null);

  // ── PRICE & LINE ──
  const [side, setSide] = useState('any');
  const [favDog, setFavDog] = useState('any');
  const [mlMin, setMlMin] = useState('');
  const [mlMax, setMlMax] = useState('');
  const [lineRange, setLineRange] = useState<[number, number]>([5, 14]);
  const [f5TotalRange, setF5TotalRange] = useState<[number, number]>([2, 8]);

  // ── GAME TIME ──
  const [timeMin, setTimeMin] = useState('');
  const [timeMax, setTimeMax] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState('any');
  const [doubleheader, setDoubleheader] = useState<boolean | null>(null);

  // ── SCHEDULE ──
  const [seriesGame, setSeriesGame] = useState<[number, number] | null>(null);
  const [trip, setTrip] = useState<[number, number] | null>(null);
  const [switchGame, setSwitchGame] = useState<boolean | null>(null);
  const [restRange, setRestRange] = useState<[number, number]>([0, 10]);
  const [streakMin, setStreakMin] = useState('');
  const [streakMax, setStreakMax] = useState('');
  const [lastResult, setLastResult] = useState('any');
  const [lastMarginMin, setLastMarginMin] = useState('');
  const [lastMarginMax, setLastMarginMax] = useState('');

  // ── PITCHING ──
  const [sp, setSp] = useState<PitcherOpt[]>([]);
  const [oppSp, setOppSp] = useState<PitcherOpt[]>([]);
  const [spHand, setSpHand] = useState('any');
  const [oppSpHand, setOppSpHand] = useState('any');
  const [spXfip, setSpXfip] = useState<OptRange | null>(null);
  const [oppSpXfip, setOppSpXfip] = useState<OptRange | null>(null);

  // ── BULLPEN ──
  const [bpIp, setBpIp] = useState<OptRange | null>(null);
  const [bpXfip, setBpXfip] = useState<OptRange | null>(null);

  // ── ENVIRONMENT ──
  const [tempRange, setTempRange] = useState<[number, number]>([30, 110]);
  const [windRange, setWindRange] = useState<[number, number]>([0, 40]);
  const [windDir, setWindDir] = useState('any');
  const [dome, setDome] = useState<boolean | null>(null);
  const [pfRuns, setPfRuns] = useState<OptRange | null>(null);
  /** Optional total/F5 total bounds from band chips — takes precedence over the slider when set. */
  const [totalBounds, setTotalBounds] = useState<OptRange | null>(null);

  // ── LAST GAME (subject) extras — canonical Systems shape (filterSchemaMlb rpcNotes) ──
  const D = MLB_SNAPSHOT_DEFAULTS;
  const [lastAts, setLastAts] = useState('any');     // covered | not
  const [lastTotal, setLastTotal] = useState('any'); // over | under
  const [lastRole, setLastRole] = useState('any');   // favorite | underdog

  // ── OPPONENT LAST GAME — the opponent's previous game (opp_last_* columns) ──
  const [oppLastResult, setOppLastResult] = useState('any');
  const [oppLastAts, setOppLastAts] = useState('any');
  const [oppLastTotal, setOppLastTotal] = useState('any');
  const [oppLastRole, setOppLastRole] = useState('any');
  const [oppLastMargin, setOppLastMargin] = useState<[number, number]>(D.oppLastMargin);

  // ── AS-OF SYSTEMS (season-to-date at game time) ──
  const [winPct, setWinPct] = useState<[number, number]>(D.winPct);
  const [winStreak, setWinStreak] = useState<[number, number]>(D.winStreak);
  const [lossStreak, setLossStreak] = useState<[number, number]>(D.lossStreak);
  const [rpg, setRpg] = useState<[number, number]>(D.rpg);
  const [rapg, setRapg] = useState<[number, number]>(D.rapg);
  const [runDiffPg, setRunDiffPg] = useState<[number, number]>(D.runDiffPg);
  const [minGames, setMinGames] = useState(D.minGames);
  const [rlCoverPct, setRlCoverPct] = useState<[number, number]>(D.rlCoverPct);
  const [rlStreak, setRlStreak] = useState<[number, number]>(D.rlStreak);
  const [overPct, setOverPct] = useState<[number, number]>(D.overPct);
  const [overStreak, setOverStreak] = useState<[number, number]>(D.overStreak);
  const [underStreak, setUnderStreak] = useState<[number, number]>(D.underStreak);
  const [prevWins, setPrevWins] = useState<[number, number]>(D.prevWins);
  const [prevWinPct, setPrevWinPct] = useState<[number, number]>(D.prevWinPct);
  const [h2hLastWin, setH2hLastWin] = useState('any');
  const [h2hLastAts, setH2hLastAts] = useState('any');
  const [h2hLastOver, setH2hLastOver] = useState('any');
  const [h2hLastMargin, setH2hLastMargin] = useState<[number, number]>(D.h2hLastMargin);
  const [h2hLastHome, setH2hLastHome] = useState<boolean | null>(null);
  const [h2hLastFav, setH2hLastFav] = useState<boolean | null>(null);
  const [h2hSameSeason, setH2hSameSeason] = useState<boolean | null>(null);
  const [oppWinPct, setOppWinPct] = useState<[number, number]>(D.oppWinPct);
  const [oppOverPct, setOppOverPct] = useState<[number, number]>(D.oppOverPct);
  const [oppRlCoverPct, setOppRlCoverPct] = useState<[number, number]>(D.oppRlCoverPct);
  const [oppWinStreak, setOppWinStreak] = useState<[number, number]>(D.oppWinStreak);
  const [oppLossStreak, setOppLossStreak] = useState<[number, number]>(D.oppLossStreak);
  const [oppRpg, setOppRpg] = useState<[number, number]>(D.oppRpg);
  const [oppRapg, setOppRapg] = useState<[number, number]>(D.oppRapg);
  const [oppPrevWinPct, setOppPrevWinPct] = useState<[number, number]>(D.oppPrevWinPct);

  const { user } = useAuth();
  const [saved, setSaved] = useState<Record<string, unknown>[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlTurns, setNlTurns] = useState<NlChatTurn[]>([]);
  const nlTurnId = React.useRef(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  /** Cached pitcher names for NL validation (typeahead results + selected). */
  const [pitcherNameCache, setPitcherNameCache] = useState<string[]>([]);

  // Load MLB team list — map ARI/OAK → AZ/ATH to match mlb_analysis_base.
  useEffect(() => {
    collegeFootballSupabase
      .from('mlb_team_mapping')
      .select('team, team_name')
      .then(({ data: rows }) => {
        const opts = (rows || [])
          .map((r: { team?: string; team_name?: string }) => {
            const abbr = toF5SplitTeamAbbr(String(r.team || ''));
            return {
              abbr,
              name: mlbAnalysisTeamLabel(abbr, String(r.team_name || r.team || '')),
            };
          })
          .filter(t => t.abbr)
          .sort((a, b) => a.abbr.localeCompare(b.abbr));
        // de-dupe by game-log abbr (OAK + any Athletics alias → one ATH)
        const seen = new Set<string>();
        setTeamOptions(opts.filter(t => (seen.has(t.abbr) ? false : (seen.add(t.abbr), true))));
      });
  }, []);

  useEffect(() => {
    // Line filters are market-independent — don't reset when bet type changes.
    setTotalBounds(null);
  }, [betType]);

  // Legacy page keys + canonical Systems keys; normalizeMlbSavedFilterSnapshot reads both shapes.
  const snapshot = () => ({
    betType, seasons, months, teams, opponents, division, interleague,
    side, favDog, mlMin, mlMax, lineRange, f5TotalRange, totalBounds, timeMin, timeMax, dayOfWeek, doubleheader,
    seriesGame, trip, switchGame, restRange, streakMin, streakMax, lastResult, lastMarginMin, lastMarginMax,
    sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
    lastAts, lastTotal, lastRole,
    oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastMargin,
    winPct, winStreak, lossStreak, rpg, rapg, runDiffPg, minGames,
    rlCoverPct, rlStreak, overPct, overStreak, underStreak, prevWins, prevWinPct,
    h2hLastWin, h2hLastAts, h2hLastOver, h2hLastMargin, h2hLastHome, h2hLastFav, h2hSameSeason,
    oppWinPct, oppOverPct, oppRlCoverPct, oppWinStreak, oppLossStreak, oppRpg, oppRapg, oppPrevWinPct,
  });

  const restore = (raw: Record<string, unknown>, rowBetType?: string) => {
    const s = normalizeMlbSavedFilterSnapshot(raw, rowBetType);
    const def = MLB_SNAPSHOT_DEFAULTS;
    const narrowed = (pair: [number, number], d: [number, number]): [number, number] | null =>
      (pair[0] !== d[0] || pair[1] !== d[1]) ? pair : null;

    setBetType(rowBetType || s.betType);
    setSeasons(s.seasons);
    setMonths(s.months);
    setTeams(s.teams);
    setOpponents(s.opponents);
    setDivision(s.division);
    setInterleague(s.interleague);
    setSide(s.side);
    setFavDog(s.favDog);
    setMlMin(s.mlMin);
    setMlMax(s.mlMax);
    setTimeout(() => {
      setLineRange(s.lineRange);
      setF5TotalRange(s.f5TotalRange);
    }, 0);
    if (raw.totalBounds && typeof raw.totalBounds === 'object' && !Array.isArray(raw.totalBounds)) {
      setTotalBounds(raw.totalBounds as OptRange);
    } else {
      setTotalBounds(null);
    }
    setTimeMin(s.timeMin);
    setTimeMax(s.timeMax);
    // Page UI is single-day; prefer first selected day from canonical daysOfWeek.
    if (s.daysOfWeek.length) setDayOfWeek(s.daysOfWeek[0]);
    else if (typeof raw.dayOfWeek === 'string') setDayOfWeek(raw.dayOfWeek);
    else setDayOfWeek('any');
    setDoubleheader(s.doubleheader);
    // Canonical snapshot always materializes full-range series/trip; page treats null = no filter.
    setSeriesGame(narrowed(s.seriesGame, def.seriesGame));
    setTrip(narrowed(s.trip, def.trip));
    setSwitchGame(s.switchGame);
    setRestRange(s.restRange);
    setLastResult(s.lastResult);
    setLastMarginMin(s.lastMargin[0] !== def.lastMargin[0] ? String(s.lastMargin[0]) : '');
    setLastMarginMax(s.lastMargin[1] !== def.lastMargin[1] ? String(s.lastMargin[1]) : '');
    setStreakMin(s.winLossStreak[0] !== def.winLossStreak[0] ? String(s.winLossStreak[0]) : '');
    setStreakMax(s.winLossStreak[1] !== def.winLossStreak[1] ? String(s.winLossStreak[1]) : '');
    if (Array.isArray(raw.sp)) setSp(raw.sp as PitcherOpt[]);
    else setSp([]);
    if (Array.isArray(raw.oppSp)) setOppSp(raw.oppSp as PitcherOpt[]);
    else setOppSp([]);
    setSpHand(s.spHand);
    setOppSpHand(s.oppSpHand);
    // OptRange UI: only set when narrowed off the schema default pair.
    const toOpt = (pair: [number, number], d: [number, number]): OptRange | null => {
      if (pair[0] === d[0] && pair[1] === d[1]) return null;
      return { min: pair[0], max: pair[1] };
    };
    setSpXfip(toOpt(s.spXfip, def.spXfip));
    setOppSpXfip(toOpt(s.oppSpXfip, def.oppSpXfip));
    setBpIp(toOpt(s.bpIp, def.bpIp));
    setBpXfip(toOpt(s.bpXfip, def.bpXfip));
    setTempRange(s.tempRange);
    setWindRange(s.windRange);
    setWindDir(s.windDir);
    setDome(s.dome);
    setPfRuns(toOpt(s.pfRuns, def.pfRuns));
    setLastAts(s.lastAts); setLastTotal(s.lastTotal); setLastRole(s.lastRole);
    setOppLastResult(s.oppLastResult); setOppLastAts(s.oppLastAts); setOppLastTotal(s.oppLastTotal);
    setOppLastRole(s.oppLastRole); setOppLastMargin(s.oppLastMargin);
    setWinPct(s.winPct); setWinStreak(s.winStreak); setLossStreak(s.lossStreak);
    setRpg(s.rpg); setRapg(s.rapg); setRunDiffPg(s.runDiffPg); setMinGames(s.minGames);
    setRlCoverPct(s.rlCoverPct); setRlStreak(s.rlStreak);
    setOverPct(s.overPct); setOverStreak(s.overStreak); setUnderStreak(s.underStreak);
    setPrevWins(s.prevWins); setPrevWinPct(s.prevWinPct);
    setH2hLastWin(s.h2hLastWin); setH2hLastAts(s.h2hLastAts); setH2hLastOver(s.h2hLastOver);
    setH2hLastMargin(s.h2hLastMargin); setH2hLastHome(s.h2hLastHome); setH2hLastFav(s.h2hLastFav);
    setH2hSameSeason(s.h2hSameSeason);
    setOppWinPct(s.oppWinPct); setOppOverPct(s.oppOverPct); setOppRlCoverPct(s.oppRlCoverPct);
    setOppWinStreak(s.oppWinStreak); setOppLossStreak(s.oppLossStreak);
    setOppRpg(s.oppRpg); setOppRapg(s.oppRapg); setOppPrevWinPct(s.oppPrevWinPct);
  };

  const resolvePitchersByName = async (names: string[]): Promise<PitcherOpt[]> => {
    const catalog = await loadMlbPitcherCatalog();
    const out: PitcherOpt[] = [];
    for (const name of names) {
      const q = name.trim();
      if (!q) continue;
      const rows = filterPitchers(catalog, q, 5);
      const match = rows.find((p) => foldSearchText(p.name) === foldSearchText(q)) ?? rows[0];
      if (match) out.push(match);
    }
    return out;
  };

  const loadSaved = useCallback(async () => {
    if (!user) { setSaved([]); return; }
    const { data: rows } = await supabase.from('mlb_analysis_saved_filters').select('*').order('created_at', { ascending: false });
    setSaved(rows || []);
  }, [user]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const saveCurrent = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase.from('mlb_analysis_saved_filters')
      .insert({ user_id: user.id, name: saveName.trim(), bet_type: betType, filters: snapshot() });
    if (error) { alert(error.message); return; }
    setSaveName(''); setShowSave(false); loadSaved();
  };
  const deleteSaved = async (id: string) => {
    await supabase.from('mlb_analysis_saved_filters').delete().eq('id', id);
    loadSaved();
  };

  const submitNlFilter = async (raw?: string) => {
    const sentence = (raw ?? nlInput).trim();
    if (!sentence || nlLoading || !user) return;
    setNlLoading(true);
    setNlInput('');
    const lines: string[] = [];
    try {
      const current = normalizeMlbSavedFilterSnapshot(snapshot());
      const currentFilter: Record<string, unknown> = { betType: current.betType };
      for (const k of Object.keys(MLB_SNAPSHOT_DEFAULTS) as Array<keyof MlbFilterSnapshot>) {
        if (k === 'betType') continue;
        if (JSON.stringify(current[k]) !== JSON.stringify(MLB_SNAPSHOT_DEFAULTS[k])) {
          currentFilter[k] = current[k];
        }
      }
      const selectedNames = [...sp, ...oppSp].map((p) => p.name);
      // Always load the full pitcher catalog for NL — otherwise the model has no
      // AVAILABLE PITCHERS list and pitcher ops are rejected (only teams stick).
      let pitcherNames = Array.from(new Set([...pitcherNameCache, ...selectedNames]));
      try {
        const catalog = await loadMlbPitcherCatalog();
        pitcherNames = Array.from(new Set([...mlbPitcherCatalogNames(catalog), ...pitcherNames]));
        setPitcherNameCache(pitcherNames);
      } catch {
        /* keep whatever we already had */
      }
      const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
        body: { sentence, currentFilter, sport: 'mlb', pitchers: pitcherNames },
      });
      if (error || data?.error) {
        lines.push("Couldn't process that, try again.");
      } else {
        const rewrittenOps = rewriteMlbPitcherAgainstTeamOps(
          sentence,
          data?.ops ?? [],
          pitcherNames,
        );
        const result = applySportFilterPatch(
          MLB_SPORT_CONFIG,
          current,
          { ops: rewrittenOps },
          { optionOverrides: { mlbPitchers: pitcherNames } },
        );
        if (result.applied.length) {
          const snap = result.snapshot;
          const [resolvedSp, resolvedOpp] = await Promise.all([
            resolvePitchersByName(snap.spNames ?? []),
            resolvePitchersByName(snap.oppSpNames ?? []),
          ]);
          restore({
            ...snap,
            sp: resolvedSp,
            oppSp: resolvedOpp,
          } as Record<string, unknown>);
          const dims = result.applied.map((a) => a.dimension).slice(0, 6);
          lines.push(dims.length
            ? `Updated your filters ✓ (${dims.join(', ')}${result.applied.length > 6 ? '…' : ''})`
            : 'Updated your filters ✓');
        }
        for (const t of data?.couldnt_map ?? []) lines.push(`Couldn't map: ${t}`);
        for (const t of data?.ambiguous ?? []) lines.push(`Too vague to apply: ${t} — try being specific.`);
        for (const r of result.rejected) lines.push(r.reason);
        if (!result.applied.length && !(data?.couldnt_map?.length) && !(data?.ambiguous?.length) && !result.rejected.length) {
          lines.push("I didn't catch a filter in that — try rephrasing.");
        }
      }
    } catch {
      lines.push("Couldn't process that, try again.");
    }
    nlTurnId.current += 1;
    setNlTurns((prev) => [...prev, { id: nlTurnId.current, sentence, lines }].slice(-8));
    setNlLoading(false);
  };

  const buildFilters = useCallback(() => {
    const f: Record<string, unknown> = {};
    if (seasons[0] > SEASON_FLOOR) f.season_min = seasons[0];
    if (seasons[1] < SEASON_MAX) f.season_max = seasons[1];
    if (months[0] > 3) f.month_min = months[0];
    if (months[1] < 11) f.month_max = months[1];
    if (teams.length) f.team = [...new Set(teams.map(toF5SplitTeamAbbr))];
    if (opponents.length) f.opponent = [...new Set(opponents.map(toF5SplitTeamAbbr))];
    if (division !== null) f.division = division;
    if (interleague !== null) f.interleague = interleague;

    if (side !== 'any') f.side = side;
    if (favDog !== 'any') f.fav_dog = favDog;

    // Moneyline — only send bounds the user typed. Swap only when BOTH are set
    // and reversed (never invent a missing bound).
    {
      let a = parseOptionalNumber(mlMin);
      let b = parseOptionalNumber(mlMax);
      if (a !== null && b !== null && a > b) { const s = a; a = b; b = s; }
      if (a !== null) f.ml_min = a;
      if (b !== null) f.ml_max = b;
    }

    // Cross-market totals — always available regardless of result market
    if (totalBounds) {
      assignRange(f, 'total_min', 'total_max', totalBounds);
    } else {
      if (lineRange[0] > 5) f.total_min = lineRange[0];
      if (lineRange[1] < 14) f.total_max = lineRange[1];
    }
    if (f5TotalRange[0] > 2) f.f5_total_min = f5TotalRange[0];
    if (f5TotalRange[1] < 8) f.f5_total_max = f5TotalRange[1];

    if (timeMin) f.time_min = timeMin;
    if (timeMax) f.time_max = timeMax;
    if (dayOfWeek !== 'any') f.day_of_week = dayOfWeek;
    if (doubleheader !== null) f.doubleheader = doubleheader;

    if (seriesGame) {
      f.series_game_min = seriesGame[0];
      f.series_game_max = seriesGame[1];
    }
    if (trip) {
      f.trip_min = trip[0];
      f.trip_max = trip[1];
    }
    if (switchGame !== null) f.switch_game = switchGame;
    // Rest slider: full [0,10] span = no filter. Only emit moved thumbs.
    if (restRange[0] > 0) f.rest_min = restRange[0];
    if (restRange[1] < 10) f.rest_max = restRange[1];

    // Streak / last-margin are SIGNED. Only include keys the user set —
    // a leftover max of 0 with min 10 is an impossible range and returns empty.
    assignOptionalNumber(f, 'streak_min', streakMin);
    assignOptionalNumber(f, 'streak_max', streakMax);
    if (lastResult !== 'any') f.last_result = lastResult;
    if (lastAts !== 'any') f.last_covered = lastAts === 'covered' ? 1 : 0;
    if (lastTotal !== 'any') f.last_over = lastTotal === 'over' ? 1 : 0;
    if (lastRole !== 'any') f.last_favorite = lastRole === 'favorite';
    assignOptionalNumber(f, 'last_margin_min', lastMarginMin);
    assignOptionalNumber(f, 'last_margin_max', lastMarginMax);
    if (oppLastResult !== 'any') f.opp_last_result = oppLastResult;
    if (oppLastAts !== 'any') f.opp_last_covered = oppLastAts === 'covered' ? 1 : 0;
    if (oppLastTotal !== 'any') f.opp_last_over = oppLastTotal === 'over' ? 1 : 0;
    if (oppLastRole !== 'any') f.opp_last_favorite = oppLastRole === 'favorite';
    applyNumRange(f, 'opp_last_margin', oppLastMargin, D.oppLastMargin);

    if (sp.length) f.sp = sp.map(p => p.id);
    if (oppSp.length) f.opp_sp = oppSp.map(p => p.id);
    if (spHand !== 'any') f.sp_hand = spHand;
    if (oppSpHand !== 'any') f.opp_sp_hand = oppSpHand;
    assignRange(f, 'sp_xfip_min', 'sp_xfip_max', spXfip);
    assignRange(f, 'opp_sp_xfip_min', 'opp_sp_xfip_max', oppSpXfip);
    assignRange(f, 'bp_ip3d_min', 'bp_ip3d_max', bpIp);
    assignRange(f, 'bp_xfip_min', 'bp_xfip_max', bpXfip);

    if (tempRange[0] > 30) f.temp_min = tempRange[0];
    if (tempRange[1] < 110) f.temp_max = tempRange[1];
    if (windRange[0] > 0) f.wind_min = windRange[0];
    if (windRange[1] < 40) f.wind_max = windRange[1];
    if (windDir !== 'any') f.wind_dir = windDir;
    if (dome !== null) f.dome = dome;
    assignRange(f, 'pf_runs_min', 'pf_runs_max', pfRuns);

    // As-of Systems filters (filterSchemaMlb rpcNotes) — percents sent as 0–1
    applyPctRange(f, 'win_pct', winPct);
    applyNumRange(f, 'win_streak', winStreak, D.winStreak);
    applyNumRange(f, 'loss_streak', lossStreak, D.lossStreak);
    applyNumRange(f, 'rpg', rpg, D.rpg);
    applyNumRange(f, 'rapg', rapg, D.rapg);
    applyNumRange(f, 'run_diff_pg', runDiffPg, D.runDiffPg);
    if (minGames > 0) f.min_games = minGames;
    applyPctRange(f, 'rl_cover_pct', rlCoverPct);
    applyNumRange(f, 'rl_streak', rlStreak, D.rlStreak);
    applyPctRange(f, 'over_pct', overPct);
    applyNumRange(f, 'over_streak', overStreak, D.overStreak);
    applyNumRange(f, 'under_streak', underStreak, D.underStreak);
    applyNumRange(f, 'prev_wins', prevWins, D.prevWins);
    applyPctRange(f, 'prev_win_pct', prevWinPct);
    if (h2hLastWin !== 'any') f.h2h_last_win = h2hLastWin === 'yes' ? 1 : 0;
    if (h2hLastAts !== 'any') f.h2h_last_ats_win = h2hLastAts === 'yes' ? 1 : 0;
    if (h2hLastOver !== 'any') f.h2h_last_over = h2hLastOver === 'yes' ? 1 : 0;
    applyNumRange(f, 'h2h_last_margin', h2hLastMargin, D.h2hLastMargin);
    if (h2hLastHome !== null) f.h2h_last_home = h2hLastHome;
    if (h2hLastFav !== null) f.h2h_last_fav = h2hLastFav;
    if (h2hSameSeason !== null) f.h2h_same_season = h2hSameSeason;
    applyPctRange(f, 'opp_win_pct', oppWinPct);
    applyPctRange(f, 'opp_over_pct', oppOverPct);
    applyPctRange(f, 'opp_rl_cover_pct', oppRlCoverPct);
    applyNumRange(f, 'opp_win_streak', oppWinStreak, D.oppWinStreak);
    applyNumRange(f, 'opp_loss_streak', oppLossStreak, D.oppLossStreak);
    applyNumRange(f, 'opp_rpg', oppRpg, D.oppRpg);
    applyNumRange(f, 'opp_rapg', oppRapg, D.oppRapg);
    applyPctRange(f, 'opp_prev_win_pct', oppPrevWinPct);

    return f;
  }, [
    betType, seasons, months, teams, opponents, division, interleague,
    side, favDog, mlMin, mlMax, lineRange, f5TotalRange, totalBounds, timeMin, timeMax, dayOfWeek, doubleheader,
    seriesGame, trip, switchGame, restRange, streakMin, streakMax, lastResult, lastMarginMin, lastMarginMax,
    sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
    lastAts, lastTotal, lastRole, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastMargin,
    winPct, winStreak, lossStreak, rpg, rapg, runDiffPg, minGames, rlCoverPct, rlStreak,
    overPct, overStreak, underStreak, prevWins, prevWinPct,
    h2hLastWin, h2hLastAts, h2hLastOver, h2hLastMargin, h2hLastHome, h2hLastFav, h2hSameSeason,
    oppWinPct, oppOverPct, oppRlCoverPct, oppWinStreak, oppLossStreak, oppRpg, oppRapg, oppPrevWinPct,
    D,
  ]);

  const weatherOnlyUpcoming = useMemo(() => {
    const f = buildFilters();
    const keys = Object.keys(f);
    if (keys.length === 0) return false;
    const weatherKeys = new Set(['temp_min', 'temp_max', 'wind_min', 'wind_max', 'wind_dir']);
    return keys.every(k => weatherKeys.has(k));
  }, [buildFilters]);

  const resetAll = () => {
    setSeasons(DEFAULT_SEASONS); setMonths([3, 11]); setTeams([]); setOpponents([]);
    setDivision(null); setInterleague(null); setSide('any'); setFavDog('any');
    setMlMin(''); setMlMax('');
    const t = TOTAL_CFG[betType]; setLineRange([5, 14]); setF5TotalRange([2, 8]); setTotalBounds(null);
    setTimeMin(''); setTimeMax(''); setDayOfWeek('any'); setDoubleheader(null);
    setSeriesGame(null); setTrip(null); setSwitchGame(null); setRestRange([0, 10]);
    setStreakMin(''); setStreakMax(''); setLastResult('any'); setLastMarginMin(''); setLastMarginMax('');
    setSp([]); setOppSp([]); setSpHand('any'); setOppSpHand('any'); setSpXfip(null); setOppSpXfip(null);
    setBpIp(null); setBpXfip(null);
    setTempRange([30, 110]); setWindRange([0, 40]); setWindDir('any'); setDome(null); setPfRuns(null);
    setLastAts('any'); setLastTotal('any'); setLastRole('any');
    setOppLastResult('any'); setOppLastAts('any'); setOppLastTotal('any'); setOppLastRole('any');
    setOppLastMargin(D.oppLastMargin);
    setWinPct(D.winPct); setWinStreak(D.winStreak); setLossStreak(D.lossStreak);
    setRpg(D.rpg); setRapg(D.rapg); setRunDiffPg(D.runDiffPg); setMinGames(0);
    setRlCoverPct(D.rlCoverPct); setRlStreak(D.rlStreak);
    setOverPct(D.overPct); setOverStreak(D.overStreak); setUnderStreak(D.underStreak);
    setPrevWins(D.prevWins); setPrevWinPct(D.prevWinPct);
    setH2hLastWin('any'); setH2hLastAts('any'); setH2hLastOver('any');
    setH2hLastMargin(D.h2hLastMargin); setH2hLastHome(null); setH2hLastFav(null); setH2hSameSeason(null);
    setOppWinPct(D.oppWinPct); setOppOverPct(D.oppOverPct); setOppRlCoverPct(D.oppRlCoverPct);
    setOppWinStreak(D.oppWinStreak); setOppLossStreak(D.oppLossStreak);
    setOppRpg(D.oppRpg); setOppRapg(D.oppRapg); setOppPrevWinPct(D.oppPrevWinPct);
  };

  const chips = useMemo(() => {
    const c: { label: string; clear: () => void }[] = [];
    if (seasons[0] !== DEFAULT_SEASONS[0] || seasons[1] !== DEFAULT_SEASONS[1]) {
      c.push({ label: `Seasons ${seasons[0]}–${seasons[1]}`, clear: () => setSeasons(DEFAULT_SEASONS) });
    }
    if (months[0] !== 3 || months[1] !== 11) c.push({ label: `Months ${months[0]}–${months[1]}`, clear: () => setMonths([3, 11]) });
    if (teams.length) c.push({ label: `Team: ${teams.join(', ')}`, clear: () => setTeams([]) });
    if (opponents.length) c.push({ label: `Opp: ${opponents.join(', ')}`, clear: () => setOpponents([]) });
    if (division !== null) c.push({ label: `Divisional: ${division ? 'Yes' : 'No'}`, clear: () => setDivision(null) });
    if (interleague !== null) c.push({ label: `Interleague: ${interleague ? 'Yes' : 'No'}`, clear: () => setInterleague(null) });
    if (side !== 'any') c.push({ label: side === 'home' ? 'Home' : 'Away', clear: () => setSide('any') });
    if (favDog !== 'any') c.push({ label: favDog === 'favorite' ? 'Favorites' : 'Underdogs', clear: () => setFavDog('any') });
    if (mlMin || mlMax) {
      const fmt = (s: string) => { const n = Number(s); return n > 0 ? `+${n}` : `${n}`; };
      const lbl = mlMin && mlMax ? `ML ${fmt(mlMin)} to ${fmt(mlMax)}` : mlMin ? `ML ≥ ${fmt(mlMin)}` : `ML ≤ ${fmt(mlMax)}`;
      c.push({ label: lbl, clear: () => { setMlMin(''); setMlMax(''); } });
    }
    if (totalBounds && (totalBounds.min != null || totalBounds.max != null)) {
      const lo = totalBounds.min != null ? String(totalBounds.min) : '…';
      const hi = totalBounds.max != null ? String(totalBounds.max) : '…';
      c.push({ label: `Game total ${lo}–${hi}`, clear: () => setTotalBounds(null) });
    } else if (lineRange[0] !== 5 || lineRange[1] !== 14) {
      c.push({ label: `Game total ${lineRange[0]}–${lineRange[1]}`, clear: () => setLineRange([5, 14]) });
    }
    if (f5TotalRange[0] !== 2 || f5TotalRange[1] !== 8) {
      c.push({ label: `F5 total ${f5TotalRange[0]}–${f5TotalRange[1]}`, clear: () => setF5TotalRange([2, 8]) });
    }
    if (timeMin || timeMax) c.push({ label: `Time ${timeMin || '…'}–${timeMax || '…'}`, clear: () => { setTimeMin(''); setTimeMax(''); } });
    if (dayOfWeek !== 'any') c.push({ label: dayOfWeek, clear: () => setDayOfWeek('any') });
    if (doubleheader !== null) c.push({ label: `DH: ${doubleheader ? 'Yes' : 'No'}`, clear: () => setDoubleheader(null) });
    if (seriesGame) c.push({ label: `Series G${seriesGame[0]}${seriesGame[0] !== seriesGame[1] ? `–${seriesGame[1]}` : ''}`, clear: () => setSeriesGame(null) });
    if (trip) c.push({ label: `Trip series ${trip[0]}${trip[0] !== trip[1] ? `–${trip[1]}` : ''}`, clear: () => setTrip(null) });
    if (switchGame !== null) c.push({ label: `Switch: ${switchGame ? 'Yes' : 'No'}`, clear: () => setSwitchGame(null) });
    if (restRange[0] !== 0 || restRange[1] !== 10) c.push({ label: `Rest ${restRange[0]}–${restRange[1]}d`, clear: () => setRestRange([0, 10]) });
    if (streakMin || streakMax) c.push({ label: `Streak ${streakMin || '…'}…${streakMax || '…'}`, clear: () => { setStreakMin(''); setStreakMax(''); } });
    if (lastResult !== 'any') c.push({ label: `Last: ${lastResult}`, clear: () => setLastResult('any') });
    if (lastMarginMin || lastMarginMax) c.push({ label: `Last margin ${lastMarginMin || '…'}…${lastMarginMax || '…'}`, clear: () => { setLastMarginMin(''); setLastMarginMax(''); } });
    if (sp.length) c.push({ label: `SP: ${sp.map(p => p.name).join(', ')}`, clear: () => setSp([]) });
    if (oppSp.length) c.push({ label: `Opp SP: ${oppSp.map(p => p.name).join(', ')}`, clear: () => setOppSp([]) });
    if (spHand !== 'any') c.push({ label: `SP ${spHand}HP`, clear: () => setSpHand('any') });
    if (oppSpHand !== 'any') c.push({ label: `Opp ${oppSpHand}HP`, clear: () => setOppSpHand('any') });
    if (spXfip) c.push({ label: `SP xFIP ${spXfip.min ?? '…'}–${spXfip.max ?? '…'}`, clear: () => setSpXfip(null) });
    if (oppSpXfip) c.push({ label: `Opp xFIP ${oppSpXfip.min ?? '…'}–${oppSpXfip.max ?? '…'}`, clear: () => setOppSpXfip(null) });
    if (bpIp) c.push({ label: `BP IP ${bpIp.min ?? '…'}–${bpIp.max ?? '…'}`, clear: () => setBpIp(null) });
    if (bpXfip) c.push({ label: `BP xFIP ${bpXfip.min ?? '…'}–${bpXfip.max ?? '…'}`, clear: () => setBpXfip(null) });
    if (tempRange[0] !== 30 || tempRange[1] !== 110) c.push({ label: `Temp ${tempRange[0]}–${tempRange[1]}°F`, clear: () => setTempRange([30, 110]) });
    if (windRange[0] !== 0 || windRange[1] !== 40) c.push({ label: `Wind ${windRange[0]}–${windRange[1]}`, clear: () => setWindRange([0, 40]) });
    if (windDir !== 'any') c.push({ label: `Wind: ${windDir}`, clear: () => setWindDir('any') });
    if (dome !== null) c.push({ label: dome ? 'Dome' : 'Outdoor', clear: () => setDome(null) });
    if (pfRuns) c.push({ label: `Park factor ${pfRuns.min ?? '…'}–${pfRuns.max ?? '…'}`, clear: () => setPfRuns(null) });
    if (lastAts !== 'any') c.push({ label: `Last game: ${lastAts === 'covered' ? 'Covered RL' : "Didn't cover RL"}`, clear: () => setLastAts('any') });
    if (lastTotal !== 'any') c.push({ label: `Last game: ${lastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setLastTotal('any') });
    if (lastRole !== 'any') c.push({ label: `Last game: ${lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setLastRole('any') });
    if (oppLastResult !== 'any') c.push({ label: `Opp last game: ${oppLastResult === 'won' ? 'Won' : 'Lost'}`, clear: () => setOppLastResult('any') });
    if (oppLastAts !== 'any') c.push({ label: `Opp last game: ${oppLastAts === 'covered' ? 'Covered RL' : "Didn't cover RL"}`, clear: () => setOppLastAts('any') });
    if (oppLastTotal !== 'any') c.push({ label: `Opp last game: ${oppLastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setOppLastTotal('any') });
    if (oppLastRole !== 'any') c.push({ label: `Opp last game: ${oppLastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setOppLastRole('any') });
    if (rangeChanged(oppLastMargin, D.oppLastMargin)) c.push({ label: `Opp last margin ${oppLastMargin[0]} to ${oppLastMargin[1]}`, clear: () => setOppLastMargin(D.oppLastMargin) });
    if (rangeChanged(winPct, D.winPct)) c.push({ label: `Win% ${winPct[0]}–${winPct[1]}`, clear: () => setWinPct(D.winPct) });
    if (rangeChanged(winStreak, D.winStreak)) c.push({ label: `Win streak ${winStreak[0]}–${winStreak[1]}`, clear: () => setWinStreak(D.winStreak) });
    if (rangeChanged(lossStreak, D.lossStreak)) c.push({ label: `Loss streak ${lossStreak[0]}–${lossStreak[1]}`, clear: () => setLossStreak(D.lossStreak) });
    if (rangeChanged(rpg, D.rpg)) c.push({ label: `R/G ${rpg[0]}–${rpg[1]}`, clear: () => setRpg(D.rpg) });
    if (rangeChanged(rapg, D.rapg)) c.push({ label: `RA/G ${rapg[0]}–${rapg[1]}`, clear: () => setRapg(D.rapg) });
    if (rangeChanged(runDiffPg, D.runDiffPg)) c.push({ label: `Run diff/g ${runDiffPg[0]}–${runDiffPg[1]}`, clear: () => setRunDiffPg(D.runDiffPg) });
    if (minGames > 0) c.push({ label: `Min ${minGames} games`, clear: () => setMinGames(0) });
    if (rangeChanged(rlCoverPct, D.rlCoverPct)) c.push({ label: `RL cover% ${rlCoverPct[0]}–${rlCoverPct[1]}`, clear: () => setRlCoverPct(D.rlCoverPct) });
    if (rangeChanged(rlStreak, D.rlStreak)) c.push({ label: `RL streak ${rlStreak[0]}–${rlStreak[1]}`, clear: () => setRlStreak(D.rlStreak) });
    if (rangeChanged(overPct, D.overPct)) c.push({ label: `Over% ${overPct[0]}–${overPct[1]}`, clear: () => setOverPct(D.overPct) });
    if (rangeChanged(overStreak, D.overStreak)) c.push({ label: `Over streak ${overStreak[0]}–${overStreak[1]}`, clear: () => setOverStreak(D.overStreak) });
    if (rangeChanged(underStreak, D.underStreak)) c.push({ label: `Under streak ${underStreak[0]}–${underStreak[1]}`, clear: () => setUnderStreak(D.underStreak) });
    if (rangeChanged(prevWins, D.prevWins)) c.push({ label: `Prev wins ${prevWins[0]}–${prevWins[1]}`, clear: () => setPrevWins(D.prevWins) });
    if (rangeChanged(prevWinPct, D.prevWinPct)) c.push({ label: `Prev win% ${prevWinPct[0]}–${prevWinPct[1]}`, clear: () => setPrevWinPct(D.prevWinPct) });
    if (h2hLastWin !== 'any') c.push({ label: `H2H: ${h2hLastWin === 'yes' ? 'Won last' : 'Lost last'}`, clear: () => setH2hLastWin('any') });
    if (h2hLastAts !== 'any') c.push({ label: `H2H: ${h2hLastAts === 'yes' ? 'Covered RL last' : "Didn't cover RL last"}`, clear: () => setH2hLastAts('any') });
    if (h2hLastOver !== 'any') c.push({ label: `H2H: ${h2hLastOver === 'yes' ? 'Over last' : 'Under last'}`, clear: () => setH2hLastOver('any') });
    if (rangeChanged(h2hLastMargin, D.h2hLastMargin)) c.push({ label: `H2H margin ${h2hLastMargin[0]} to ${h2hLastMargin[1]}`, clear: () => setH2hLastMargin(D.h2hLastMargin) });
    if (h2hLastHome !== null) c.push({ label: `H2H home: ${h2hLastHome ? 'Yes' : 'No'}`, clear: () => setH2hLastHome(null) });
    if (h2hLastFav !== null) c.push({ label: `H2H fav: ${h2hLastFav ? 'Yes' : 'No'}`, clear: () => setH2hLastFav(null) });
    if (h2hSameSeason !== null) c.push({ label: `H2H same season: ${h2hSameSeason ? 'Yes' : 'No'}`, clear: () => setH2hSameSeason(null) });
    if (rangeChanged(oppWinPct, D.oppWinPct)) c.push({ label: `Opp win% ${oppWinPct[0]}–${oppWinPct[1]}`, clear: () => setOppWinPct(D.oppWinPct) });
    if (rangeChanged(oppOverPct, D.oppOverPct)) c.push({ label: `Opp over% ${oppOverPct[0]}–${oppOverPct[1]}`, clear: () => setOppOverPct(D.oppOverPct) });
    if (rangeChanged(oppRlCoverPct, D.oppRlCoverPct)) c.push({ label: `Opp RL cover% ${oppRlCoverPct[0]}–${oppRlCoverPct[1]}`, clear: () => setOppRlCoverPct(D.oppRlCoverPct) });
    if (rangeChanged(oppWinStreak, D.oppWinStreak)) c.push({ label: `Opp win streak ${oppWinStreak[0]}–${oppWinStreak[1]}`, clear: () => setOppWinStreak(D.oppWinStreak) });
    if (rangeChanged(oppLossStreak, D.oppLossStreak)) c.push({ label: `Opp loss streak ${oppLossStreak[0]}–${oppLossStreak[1]}`, clear: () => setOppLossStreak(D.oppLossStreak) });
    if (rangeChanged(oppRpg, D.oppRpg)) c.push({ label: `Opp R/G ${oppRpg[0]}–${oppRpg[1]}`, clear: () => setOppRpg(D.oppRpg) });
    if (rangeChanged(oppRapg, D.oppRapg)) c.push({ label: `Opp RA/G ${oppRapg[0]}–${oppRapg[1]}`, clear: () => setOppRapg(D.oppRapg) });
    if (rangeChanged(oppPrevWinPct, D.oppPrevWinPct)) c.push({ label: `Opp prev win% ${oppPrevWinPct[0]}–${oppPrevWinPct[1]}`, clear: () => setOppPrevWinPct(D.oppPrevWinPct) });
    return c;
  }, [
    betType, seasons, months, teams, opponents, division, interleague, side, favDog, mlMin, mlMax, lineRange, f5TotalRange, totalBounds,
    timeMin, timeMax, dayOfWeek, doubleheader, seriesGame, trip, switchGame, restRange, streakMin, streakMax,
    lastResult, lastMarginMin, lastMarginMax, sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
    lastAts, lastTotal, lastRole, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastMargin,
    winPct, winStreak, lossStreak, rpg, rapg, runDiffPg, minGames, rlCoverPct, rlStreak,
    overPct, overStreak, underStreak, prevWins, prevWinPct,
    h2hLastWin, h2hLastAts, h2hLastOver, h2hLastMargin, h2hLastHome, h2hLastFav, h2hSameSeason,
    oppWinPct, oppOverPct, oppRlCoverPct, oppWinStreak, oppLossStreak, oppRpg, oppRapg, oppPrevWinPct,
    D,
  ]);

  useEffect(() => {
    setLoading(true);
    setUpcoming([]); // drop stale slate while analysis refetches
    const filters = buildFilters();
    const upcomingFilters = weatherOnlyUpcoming ? {} : filters;
    let cancelled = false;
    const t = setTimeout(async () => {
      // Analysis first — paint the hero ASAP. Upcoming is heavier and was blocking the whole page
      // (and racing the analysis query on the warehouse). Failures there must not blank results.
      const a = await collegeFootballSupabase.rpc('mlb_analysis', { p_bet_type: betType, p_filters: filters });
      if (cancelled) return;
      if (a.error) {
        console.error('[mlb-analytics] mlb_analysis error', a.error);
        setData(null);
      } else {
        setData(a.data as Analysis);
      }
      setLoading(false);

      const u = await collegeFootballSupabase.rpc('mlb_analysis_upcoming', {
        p_bet_type: betType,
        p_filters: upcomingFilters,
      });
      if (cancelled) return;
      if (u.error) {
        console.error('[mlb-analytics] mlb_analysis_upcoming error', u.error);
        setUpcoming([]);
      } else {
        setUpcoming((u.data as Record<string, unknown>[]) || []);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [betType, buildFilters, weatherOnlyUpcoming]);

  const applyPreset = (p: typeof PRESETS[0]) => {
    resetAll();
    setBetType(p.betType);
    const f = p.filters;
    if (f.side) setSide(String(f.side));
    if (f.favDog) setFavDog(String(f.favDog));
    if (f.switchGame != null) setSwitchGame(f.switchGame as boolean);
    if (f.seriesGame) setSeriesGame(f.seriesGame as [number, number]);
    if (f.oppSpHand) setOppSpHand(String(f.oppSpHand));
    if (f.bpIp) setBpIp(f.bpIp as OptRange);
    if (f.pfRuns) setPfRuns(f.pfRuns as OptRange);
  };

  // Two-sided-market tautology guard: both sides of every game are base rows, so game-level
  // filters force "all teams" ≈ 50% on ml/rl/f5 side markets — lead with real side splits instead.
  const symmetricSlices = data && isSideSymmetricMlb(normalizeMlbSavedFilterSnapshot(snapshot()))
    ? (() => { const sl = pickSideSlices(data.bars); return sl.length ? sl : null; })()
    : null;
  const focusSide = (dimension: string, sideVal: string) => {
    if (dimension === 'home_away') setSide(sideVal);
    else if (dimension === 'fav_dog') setFavDog(sideVal);
  };

  const shownBars = useMemo(() => {
    const hideSide = !!symmetricSlices;
    return (data?.bars || []).filter(bar => {
      if (hideSide && (bar.dimension === 'home_away' || bar.dimension === 'fav_dog')) return false;
      const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
      return total > 0 && bar.options.every(o => o && o.n > 0 && o.n / total >= 0.1);
    });
  }, [data, symmetricSlices]);

  const isTotalMkt = TOTAL_MARKETS.has(betType);
  // Totals are game outcomes ("went over") — never "Favorites went over".
  // favDog remains a filter chip; it just doesn't own the headline subject.
  const subject = useMemo(() => {
    if (isTotalMkt) {
      if (teams.length === 1) return `${teams[0]} games`;
      if (side !== 'any') return side === 'home' ? 'Home games' : 'Road games';
      return 'Games';
    }
    const parts: string[] = [];
    if (side !== 'any') parts.push(side === 'home' ? 'Home' : 'Road');
    if (favDog !== 'any') parts.push(favDog === 'favorite' ? 'favorites' : 'underdogs');
    if (teams.length === 1) return `${teams[0]}${parts.length ? ` (${parts.join(' ').toLowerCase()})` : ''}`;
    if (parts.length) return parts.join(' ').replace(/^\w/, c => c.toUpperCase());
    return 'Teams';
  }, [side, favDog, teams, isTotalMkt]);

  const scopeNote = useMemo(() => {
    const bits: string[] = [];
    if (teams.length) bits.push(teams.join('/'));
    if (oppSp.length) bits.push(`vs ${oppSp.map(p => p.name).join(', ')}`);
    const who = bits.length ? bits.join(' · ') : 'all teams';
    return `${who} in every past game that matches your filters.`;
  }, [teams, oppSp]);

  const cov = data?.coverage;
  const clickPitcher = (g: Record<string, unknown>) => {
    if (g.opp_sp_id == null || !g.opp_sp_name) return;
    setOppSp([{
      id: Number(g.opp_sp_id),
      name: String(g.opp_sp_name),
      hand: g.opp_sp_hand ? String(g.opp_sp_hand) : null,
      team: g.opponent ? String(g.opponent) : null,
    }]);
    if (g.team) setTeams([String(g.team)]);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">MLB Historical Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Pick a bet type, set the situation, and see how it&apos;s played out — plus today&apos;s games that match.
        </p>
      </div>

      {/* Bet-type spine */}
      <div className="flex flex-wrap gap-4 mb-4">
        {BET_GROUPS.map(g => (
          <div key={g.group}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{g.group}</div>
            <div className="flex gap-1">
              {g.items.map(it => (
                <Button key={it.key} size="sm" variant={betType === it.key ? 'default' : 'outline'}
                  onClick={() => setBetType(it.key)}>{it.label}</Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map(p => (
          <Badge key={p.label} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset(p)}>{p.label}</Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!user ? (
          <span className="text-xs text-muted-foreground">Sign in to save filters you want to track this season.</span>
        ) : (
          <>
            {saved.length > 0 && (
              <Select onValueChange={(id) => {
                const s = saved.find(x => x.id === id) as { filters?: Record<string, unknown>; bet_type?: string } | undefined;
                if (s) restore(s.filters || {}, s.bet_type);
              }}>
                <SelectTrigger className="h-8 w-56 text-xs"><Bookmark className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder={`Saved filters (${saved.length})`} /></SelectTrigger>
                <SelectContent>
                  {saved.map(s => (
                    <div key={String(s.id)} className="flex items-center">
                      <SelectItem value={String(s.id)} className="flex-1">{String(s.name)}</SelectItem>
                      <button className="px-2 text-muted-foreground hover:text-red-500" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSaved(String(s.id)); }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showSave ? (
              <div className="flex items-center gap-1">
                <Input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Name this filter" className="h-8 w-48 text-xs"
                  onKeyDown={e => e.key === 'Enter' && saveCurrent()} />
                <Button size="sm" className="h-8" onClick={saveCurrent} disabled={!saveName.trim() || saved.length >= 25}>Save</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowSave(false); setSaveName(''); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSave(true)} disabled={saved.length >= 25}>
                <Bookmark className="w-3.5 h-3.5 mr-1" /> Save current {saved.length >= 25 && '(25 max)'}
              </Button>
            )}
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Active:</span>
          {chips.map((chip, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1 font-normal">
              {chip.label}
              <button onClick={chip.clear} className="rounded p-0.5 hover:bg-foreground/15" aria-label={`Clear ${chip.label}`}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={resetAll}>Reset all</Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-primary/20">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="w-4 h-4 text-primary" />
                Describe a filter
              </div>
              {!user ? (
                <p className="text-xs text-muted-foreground">Sign in to use filter chat.</p>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={nlInput}
                      onChange={(e) => {
                        setNlInput(e.target.value);
                        const el = e.target;
                        el.style.height = '40px';
                        el.style.height = `${Math.min(96, Math.max(40, el.scrollHeight))}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitNlFilter();
                        }
                      }}
                      placeholder='e.g. "home dogs facing an ace lefty"'
                      className="min-h-[40px] max-h-[96px] flex-1 resize-none text-sm leading-snug py-2 overflow-y-auto"
                      rows={1}
                      disabled={nlLoading}
                      maxLength={500}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 shrink-0"
                      disabled={nlLoading || !nlInput.trim()}
                      onClick={() => submitNlFilter()}
                    >
                      {nlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  {nlTurns.length === 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {NL_FILTER_EXAMPLES.map((ex) => (
                        <Badge
                          key={ex}
                          variant="outline"
                          className="cursor-pointer font-normal text-[11px] hover:bg-accent"
                          onClick={() => { if (!nlLoading) submitNlFilter(ex); }}
                        >
                          {ex}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {nlTurns.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
                      {nlTurns.map((t) => (
                        <div key={t.id} className="rounded-md bg-muted/50 px-2.5 py-1.5 space-y-0.5">
                          <div className="font-medium text-foreground/90">“{t.sentence}”</div>
                          {t.lines.map((line, i) => (
                            <div key={i} className="text-muted-foreground">{line}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className={`space-y-4 transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge variant="secondary">
              {cov
                ? `${cov.n_bets} bets across ${cov.n_games} games, ${cov.season_min}–${cov.season_max}`
                : loading ? 'Loading…' : 'No games match'}
            </Badge>
            {data?.overall && data.overall.n < 20 && data.overall.n > 0 && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">Small sample</Badge>
            )}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          {!data ? <Skeleton className="h-28 w-full" /> : symmetricSlices ? (
            <SymmetricSplitHero betType={betType} slices={symmetricSlices} cov={cov} onFocus={focusSide} />
          ) : data.overall && cov && data.overall.n > 0 ? (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  {data.overall.hit_pct >= 50
                    ? <TrendingUp className="w-6 h-6 text-emerald-500 mt-1 shrink-0" />
                    : <TrendingDown className="w-6 h-6 text-red-500 mt-1 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-4xl sm:text-5xl font-bold tracking-tight text-primary tabular-nums leading-none">
                        {data.overall.hit_pct}%
                      </span>
                      {!NO_ROI_MARKETS.has(betType) && data.overall.roi != null && (
                        <span className={`text-lg font-semibold tabular-nums ${data.overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {data.overall.roi >= 0 ? '+' : ''}{data.overall.roi}% ROI
                        </span>
                      )}
                      {NO_ROI_MARKETS.has(betType) && (
                        <span className="text-lg font-semibold"><RoiSlot roi={null} betType={betType} /></span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">
                      {subject} {VERB[betType]}{' '}
                      <span className="text-primary">{data.overall.hit_pct}%</span>
                      {' '}
                      <span className="font-normal text-muted-foreground">
                        ({data.overall.wins} of {data.overall.n} {nounFor(betType)}
                        {cov ? ` · ${cov.season_min}–${cov.season_max}` : ''})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(data.overall.hit_pct - data.baseline_pct >= 0 ? '+' : '')}
                      {(data.overall.hit_pct - data.baseline_pct).toFixed(1)} pts vs the {data.baseline_pct}% baseline
                      {' · '}{significance(data.overall.n, data.overall.hit_pct).label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">{scopeNote}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No games match these filters — try widening them.</CardContent></Card>
          )}

          {data && (shownBars.length > 0 || data.by_team?.length || data.by_venue?.length) && (
            <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between h-10 text-sm font-medium"
                  aria-expanded={breakdownOpen}
                >
                  Explore the breakdown
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-3">
                {shownBars.length > 0 && (
                  <Card><CardContent className="py-4 space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdown</div>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">The same {data.overall.n} {nounFor(betType)}, split by situation.</p>
                    </div>
                    {shownBars.map((bar, i) => (
                      <ResultBar key={i} betType={betType} bar={bar} baseline={data.baseline_pct} onFocus={focusSide} />
                    ))}
                  </CardContent></Card>
                )}

                <Card><CardContent className="py-4">
                  <Tabs defaultValue="team">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="team">By Team</TabsTrigger>
                      <TabsTrigger value="venue">By Ballpark</TabsTrigger>
                    </TabsList>
                    <TabsContent value="team"><BreakdownTable betType={betType} rows={data.by_team} keyName="team" logo /></TabsContent>
                    <TabsContent value="venue"><BreakdownTable betType={betType} rows={data.by_venue} keyName="venue" /></TabsContent>
                  </Tabs>
                </CardContent></Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {data && upcoming.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-1 font-semibold text-sm">
                  <CalendarClock className="w-4 h-4 text-primary" /> Today&apos;s matching games ({upcoming.length})
                </div>
                {weatherOnlyUpcoming && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                    Weather filters aren&apos;t applied to upcoming games (often unconfirmed pregame).
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-2">
                  {upcoming.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <img src={logoFor(String(g.team))} alt="" className="w-6 h-6" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{String(g.matchup)}</div>
                        <div className="text-xs font-medium text-foreground/80">{lineForBet(betType, g)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {fmtKick(g.time_et as string | undefined, g.game_date as string | undefined)}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {upcomingChips(g).map((chip, ci) => (
                            <Badge
                              key={ci}
                              variant="outline"
                              className={`text-[10px] font-normal ${g.opp_sp_name && chip === String(g.opp_sp_name) ? 'cursor-pointer hover:bg-accent' : ''}`}
                              onClick={() => {
                                if (g.opp_sp_name && chip === String(g.opp_sp_name)) clickPitcher(g);
                              }}
                            >
                              {chip}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </div>

        {/* Filters */}
        <div className="xl:sticky xl:top-4 h-fit space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto pr-1">
          <Card><CardContent className="py-4 space-y-4">
            <div className="text-sm font-semibold">Scope</div>
            <RangeRow label={`Seasons: ${seasons[0]}–${seasons[1]}`} min={SEASON_FLOOR} max={SEASON_MAX} step={1} value={seasons} onChange={setSeasons} />
            <RangeRow label={`Months: ${months[0]}–${months[1]}`} min={3} max={11} step={1} value={months} onChange={setMonths} />
            <TeamMultiSelect label="Team" options={teamOptions} value={teams} onChange={setTeams} />
            <TeamMultiSelect label="Opponent" options={teamOptions} value={opponents} onChange={setOpponents} />
            <TriRow label="Divisional" value={division} onChange={setDivision} />
            <TriRow label="Interleague" value={interleague} onChange={setInterleague} />
          </CardContent></Card>

          <FilterSection title="Price & Line" defaultOpen>
            <SelectRow label="Side" value={side} onChange={setSide} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
            <SelectRow label="Favorite / Underdog" value={favDog} onChange={setFavDog} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Moneyline odds (American)</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {ML_BANDS.map(b => (
                  <Badge key={b.label} variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"
                    onClick={() => { setMlMin(b.min != null ? String(b.min) : ''); setMlMax(b.max != null ? String(b.max) : ''); }}>
                    {b.label}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={mlMin} onChange={e => setMlMin(e.target.value)} placeholder="min" className="h-9" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="number" inputMode="numeric" value={mlMax} onChange={e => setMlMax(e.target.value)} placeholder="max" className="h-9" />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground -mt-1">Line filters apply on every result market.</div>
            <div className="flex flex-wrap gap-1">
              {TOTAL_BANDS.map(b => {
                const active = totalBounds?.min === b.min && totalBounds?.max === b.max
                  || (totalBounds?.min === b.min && b.max == null && totalBounds?.max == null)
                  || (totalBounds?.max === b.max && b.min == null && totalBounds?.min == null);
                return (
                  <Badge key={b.label} variant={active ? 'default' : 'outline'} className="cursor-pointer text-[10px] hover:bg-accent"
                    onClick={() => {
                      const next: OptRange = {};
                      if (b.min != null) next.min = b.min;
                      if (b.max != null) next.max = b.max;
                      setTotalBounds(next);
                      setLineRange([b.min ?? 5, b.max ?? 14]);
                    }}>
                    {b.label}
                  </Badge>
                );
              })}
            </div>
            <RangeRow label={`Game total: ${lineRange[0]}–${lineRange[1]}`}
              min={5} max={14} step={0.5}
              value={lineRange}
              onChange={(v) => { setTotalBounds(null); setLineRange(v); }} />
            <RangeRow label={`F5 total: ${f5TotalRange[0]}–${f5TotalRange[1]}`}
              min={2} max={8} step={0.5}
              value={f5TotalRange}
              onChange={setF5TotalRange} />
          </FilterSection>

          <FilterSection title="Game Time (ET)">
            <div className="flex flex-wrap gap-1">
              {TIME_CHIPS.map(chip => (
                <Badge key={chip.label} variant={timeMin === (chip.min || '') && timeMax === (chip.max || '') ? 'default' : 'outline'}
                  className="cursor-pointer text-[10px]"
                  onClick={() => { setTimeMin(chip.min || ''); setTimeMax(chip.max || ''); }}>
                  {chip.label}
                </Badge>
              ))}
            </div>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowCustomTime(v => !v)}>
              {showCustomTime ? 'Hide custom range' : 'Custom range'}
            </button>
            {showCustomTime && (
              <div className="flex items-center gap-2">
                <Input type="time" value={timeMin} onChange={e => setTimeMin(e.target.value)} className="h-9" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={timeMax} onChange={e => setTimeMax(e.target.value)} className="h-9" />
              </div>
            )}
            <SelectRow label="Day of week" value={dayOfWeek} onChange={setDayOfWeek}
              options={[['any', 'Any day'], ...DAYS.map(d => [d, d] as [string, string])]} />
            <TriRow label="Doubleheader" value={doubleheader} onChange={setDoubleheader} />
          </FilterSection>

          <FilterSection title="Schedule Situation">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Series game</div>
              <div className="flex flex-wrap gap-1">
                {([[1, 1], [2, 2], [3, 3], [4, 9]] as [number, number][]).map(([lo, hi]) => (
                  <Badge key={`${lo}-${hi}`} variant={seriesGame?.[0] === lo && seriesGame?.[1] === hi ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => setSeriesGame(seriesGame?.[0] === lo && seriesGame?.[1] === hi ? null : [lo, hi])}>
                    {hi >= 4 ? 'G4+' : `G${lo}`}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Trip series index</div>
              <p className="text-[10px] text-muted-foreground/80 mb-1">e.g. away + G2 + 1st series = game 2 of first away series after a homestand</p>
              <div className="flex flex-wrap gap-1">
                {([[1, 1, '1st'], [2, 2, '2nd'], [3, 9, '3rd+']] as [number, number, string][]).map(([lo, hi, label]) => (
                  <Badge key={label} variant={trip?.[0] === lo && trip?.[1] === hi ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => setTrip(trip?.[0] === lo && trip?.[1] === hi ? null : [lo, hi])}>
                    {label} series of trip
                  </Badge>
                ))}
              </div>
            </div>
            <TriRow label="Switch game (home↔away flip)" value={switchGame} onChange={setSwitchGame} />
            <RangeRow label={`Days rest: ${restRange[0]}–${restRange[1]}`} min={0} max={10} step={1} value={restRange} onChange={setRestRange} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">W/L streak entering (pos = wins, neg = losses)</div>
              <div className="flex items-center gap-2">
                <Input type="number" value={streakMin} onChange={e => setStreakMin(e.target.value)} placeholder="min" className="h-9" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" value={streakMax} onChange={e => setStreakMax(e.target.value)} placeholder="max" className="h-9" />
              </div>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="cursor-pointer text-[10px]" onClick={() => { setStreakMin(''); setStreakMax('-3'); }}>3+ game skid</Badge>
                <Badge variant="outline" className="cursor-pointer text-[10px]" onClick={() => { setStreakMin('3'); setStreakMax(''); }}>3+ win streak</Badge>
              </div>
            </div>
            <SelectRow label="Last result" value={lastResult} onChange={setLastResult}
              options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="Last game run line" value={lastAts} onChange={setLastAts}
              options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Last game total" value={lastTotal} onChange={setLastTotal}
              options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Last game role" value={lastRole} onChange={setLastRole}
              options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Last game margin (signed: + won by, − lost by)</div>
              <div className="flex gap-1 mb-1">
                <Badge variant="outline" className="cursor-pointer text-[10px]"
                  onClick={() => { setLastMarginMin(''); setLastMarginMax('-5'); }}>
                  Blown out last game
                </Badge>
                <Badge variant="outline" className="cursor-pointer text-[10px]"
                  onClick={() => { setLastMarginMin('5'); setLastMarginMax(''); }}>
                  Won big last game
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={lastMarginMin}
                  onChange={e => setLastMarginMin(e.target.value)} placeholder="min e.g. 10" className="h-9" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" inputMode="numeric" value={lastMarginMax}
                  onChange={e => setLastMarginMax(e.target.value)} placeholder="max e.g. -10" className="h-9" />
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-1">
                Leave a side blank for open-ended. Lost by 10+ → max −10. Won by 10+ → min 10.
              </p>
            </div>
          </FilterSection>

          <FilterSection title="Opponent last game">
            <SelectRow label="Result" value={oppLastResult} onChange={setOppLastResult}
              options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="Run line" value={oppLastAts} onChange={setOppLastAts}
              options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Total" value={oppLastTotal} onChange={setOppLastTotal}
              options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Was" value={oppLastRole} onChange={setOppLastRole}
              options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <RangeRow label={`Opponent last game margin: ${oppLastMargin[0]} to ${oppLastMargin[1]} runs (+ = won by, − = lost by)`}
              min={-30} max={30} step={1} value={oppLastMargin} onChange={setOppLastMargin} />
          </FilterSection>

          <FilterSection title="Pitching Matchup">
            <PitcherTypeahead
              label="Team starter (SP)"
              selected={sp}
              onChange={setSp}
              onNamesSeen={(names) => setPitcherNameCache((prev) => Array.from(new Set([...prev, ...names])))}
            />
            <PitcherTypeahead
              label="Opposing starter"
              selected={oppSp}
              onChange={setOppSp}
              onNamesSeen={(names) => setPitcherNameCache((prev) => Array.from(new Set([...prev, ...names])))}
            />
            <SelectRow label="SP hand" value={spHand} onChange={setSpHand} options={[['any', 'Any'], ['L', 'Left'], ['R', 'Right']]} />
            <SelectRow label="Opp SP hand" value={oppSpHand} onChange={setOppSpHand} options={[['any', 'Any'], ['L', 'Left'], ['R', 'Right']]} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">SP season xFIP</div>
              <div className="flex flex-wrap gap-1">
                {XFIP_TIERS.map(t => (
                  <Badge key={t.label} variant="outline" className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next: OptRange = {};
                      if (t.min != null) next.min = t.min;
                      if (t.max != null) next.max = t.max;
                      setSpXfip(next);
                    }}>{t.label}</Badge>
                ))}
                {spXfip && <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setSpXfip(null)}>Clear</Badge>}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opp SP season xFIP</div>
              <div className="flex flex-wrap gap-1">
                {XFIP_TIERS.map(t => (
                  <Badge key={t.label} variant="outline" className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next: OptRange = {};
                      if (t.min != null) next.min = t.min;
                      if (t.max != null) next.max = t.max;
                      setOppSpXfip(next);
                    }}>{t.label}</Badge>
                ))}
                {oppSpXfip && <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setOppSpXfip(null)}>Clear</Badge>}
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Bullpen (opponent)">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opp BP IP last 3 days</div>
              <div className="flex flex-wrap gap-1">
                {BP_IP_PRESETS.map(p => (
                  <Badge key={p.label} variant="outline" className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next: OptRange = {};
                      if (p.min != null) next.min = p.min;
                      if (p.max != null) next.max = p.max;
                      setBpIp(next);
                    }}>{p.label}</Badge>
                ))}
                {bpIp && <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setBpIp(null)}>Clear</Badge>}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opp BP season xFIP</div>
              <div className="flex flex-wrap gap-1">
                {XFIP_TIERS.map(t => (
                  <Badge key={t.label} variant="outline" className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next: OptRange = {};
                      if (t.min != null) next.min = t.min;
                      if (t.max != null) next.max = t.max;
                      setBpXfip(next);
                    }}>{t.label}</Badge>
                ))}
                {bpXfip && <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setBpXfip(null)}>Clear</Badge>}
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Environment">
            <RangeRow label={`Temp: ${tempRange[0]}–${tempRange[1]}°F`} min={30} max={110} step={1} value={tempRange} onChange={setTempRange} />
            <RangeRow label={`Wind: ${windRange[0]}–${windRange[1]} mph`} min={0} max={40} step={1} value={windRange} onChange={setWindRange} />
            <SelectRow label="Wind direction" value={windDir} onChange={setWindDir}
              options={[['any', 'Any'], ['out', 'Out'], ['in', 'In'], ['cross', 'Cross'], ['none', 'None']]} />
            <TriRow label="Dome" value={dome} onChange={setDome} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Park run factor (100 = neutral)</div>
              <div className="flex flex-wrap gap-1">
                {PF_PRESETS.map(p => (
                  <Badge key={p.label} variant="outline" className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next: OptRange = {};
                      if (p.min != null) next.min = p.min;
                      if (p.max != null) next.max = p.max;
                      setPfRuns(next);
                    }}>{p.label}</Badge>
                ))}
                {pfRuns && <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setPfRuns(null)}>Clear</Badge>}
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Season Record">
            <RangeRow label={`Win%: ${winPct[0]}–${winPct[1]}%`} min={0} max={100} step={1} value={winPct} onChange={setWinPct} />
            <RangeRow label={`Win streak: ${winStreak[0]}–${winStreak[1]}`} min={0} max={25} step={1} value={winStreak} onChange={setWinStreak} />
            <RangeRow label={`Loss streak: ${lossStreak[0]}–${lossStreak[1]}`} min={0} max={25} step={1} value={lossStreak} onChange={setLossStreak} />
            <RangeRow label={`Runs/game: ${rpg[0]}–${rpg[1]}`} min={0} max={10} step={0.1} value={rpg} onChange={setRpg} />
            <RangeRow label={`Runs allowed/game: ${rapg[0]}–${rapg[1]}`} min={0} max={10} step={0.1} value={rapg} onChange={setRapg} />
            <RangeRow label={`Run diff/game: ${runDiffPg[0]}–${runDiffPg[1]}`} min={-4} max={4} step={0.1} value={runDiffPg} onChange={setRunDiffPg} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Min games this season: {minGames === 0 ? 'Any' : minGames}</div>
              <Slider min={0} max={40} step={1} value={[minGames]} onValueChange={([v]) => setMinGames(v)} />
            </div>
          </FilterSection>

          <FilterSection title="Run Line Profile">
            <RangeRow label={`RL cover%: ${rlCoverPct[0]}–${rlCoverPct[1]}%`} min={0} max={100} step={1} value={rlCoverPct} onChange={setRlCoverPct} />
            <RangeRow label={`RL cover streak: ${rlStreak[0]}–${rlStreak[1]}`} min={0} max={25} step={1} value={rlStreak} onChange={setRlStreak} />
          </FilterSection>

          <FilterSection title="Total Profile">
            <RangeRow label={`Over%: ${overPct[0]}–${overPct[1]}%`} min={0} max={100} step={1} value={overPct} onChange={setOverPct} />
            <RangeRow label={`Over streak: ${overStreak[0]}–${overStreak[1]}`} min={0} max={25} step={1} value={overStreak} onChange={setOverStreak} />
            <RangeRow label={`Under streak: ${underStreak[0]}–${underStreak[1]}`} min={0} max={25} step={1} value={underStreak} onChange={setUnderStreak} />
          </FilterSection>

          <FilterSection title="Prior Year">
            <RangeRow label={`Last season wins: ${prevWins[0]}–${prevWins[1]}`} min={0} max={120} step={1} value={prevWins} onChange={setPrevWins} />
            <RangeRow label={`Last season win%: ${prevWinPct[0]}–${prevWinPct[1]}%`} min={0} max={100} step={1} value={prevWinPct} onChange={setPrevWinPct} />
          </FilterSection>

          <FilterSection title="Head-to-Head">
            <SelectRow label="Won last meeting" value={h2hLastWin} onChange={setH2hLastWin}
              options={[['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']]} />
            <SelectRow label="Covered RL last meeting" value={h2hLastAts} onChange={setH2hLastAts}
              options={[['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]]} />
            <SelectRow label="Last meeting total" value={h2hLastOver} onChange={setH2hLastOver}
              options={[['any', 'Any'], ['yes', 'Over'], ['no', 'Under']]} />
            <RangeRow label={`Last meeting margin: ${h2hLastMargin[0]} to ${h2hLastMargin[1]} runs`}
              min={-30} max={30} step={1} value={h2hLastMargin} onChange={setH2hLastMargin} />
            <TriRow label="Was home last meeting" value={h2hLastHome} onChange={setH2hLastHome} />
            <TriRow label="Was favorite last meeting" value={h2hLastFav} onChange={setH2hLastFav} />
            <TriRow label="Same season as last meeting" value={h2hSameSeason} onChange={setH2hSameSeason} />
          </FilterSection>

          <FilterSection title="Opponent Record">
            <RangeRow label={`Opp win%: ${oppWinPct[0]}–${oppWinPct[1]}%`} min={0} max={100} step={1} value={oppWinPct} onChange={setOppWinPct} />
            <RangeRow label={`Opp over%: ${oppOverPct[0]}–${oppOverPct[1]}%`} min={0} max={100} step={1} value={oppOverPct} onChange={setOppOverPct} />
            <RangeRow label={`Opp RL cover%: ${oppRlCoverPct[0]}–${oppRlCoverPct[1]}%`} min={0} max={100} step={1} value={oppRlCoverPct} onChange={setOppRlCoverPct} />
            <RangeRow label={`Opp win streak: ${oppWinStreak[0]}–${oppWinStreak[1]}`} min={0} max={25} step={1} value={oppWinStreak} onChange={setOppWinStreak} />
            <RangeRow label={`Opp loss streak: ${oppLossStreak[0]}–${oppLossStreak[1]}`} min={0} max={25} step={1} value={oppLossStreak} onChange={setOppLossStreak} />
            <RangeRow label={`Opp runs/game: ${oppRpg[0]}–${oppRpg[1]}`} min={0} max={10} step={0.1} value={oppRpg} onChange={setOppRpg} />
            <RangeRow label={`Opp runs allowed/game: ${oppRapg[0]}–${oppRapg[1]}`} min={0} max={10} step={0.1} value={oppRapg} onChange={setOppRapg} />
            <RangeRow label={`Opp last-season win%: ${oppPrevWinPct[0]}–${oppPrevWinPct[1]}%`} min={0} max={100} step={1} value={oppPrevWinPct} onChange={setOppPrevWinPct} />
          </FilterSection>
        </div>
      </div>
    </div>
  );
}

// ── primitives ──
function RangeRow({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number;
  value: [number, number]; onChange: (v: [number, number]) => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Slider min={min} max={max} step={step} value={value} onValueChange={(v: number[]) => onChange([v[0], v[1]])} minStepsBetweenThumbs={0} />
    </div>
  );
}
function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
function TriRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts: [string, boolean | null][] = [['Any', null], ['Yes', true], ['No', false]];
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-1">
        {opts.map(([l, v]) => (
          <Button key={l} size="sm" variant={value === v ? 'default' : 'outline'} className="h-7 flex-1 text-xs" onClick={() => onChange(v)}>{l}</Button>
        ))}
      </div>
    </div>
  );
}
function FilterSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card><CardContent className="py-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold">
          {title}<ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">{children}</CollapsibleContent>
      </CardContent></Card>
    </Collapsible>
  );
}

function TeamMultiSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: { abbr: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter(o => o.abbr.toLowerCase().includes(qq) || o.name.toLowerCase().includes(qq));
  }, [options, q]);
  const toggle = (abbr: string) => {
    onChange(value.includes(abbr) ? value.filter(t => t !== abbr) : [...value, abbr]);
  };
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {value.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 pr-1 text-[10px]">
              <img src={logoFor(t)} alt="" className="w-3.5 h-3.5" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              {t}
              <button onClick={() => toggle(t)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      <Button size="sm" variant="outline" className="h-8 w-full justify-between text-xs" onClick={() => setOpen(o => !o)}>
        {value.length ? `${value.length} selected` : 'Any team'}
        <ChevronDown className={`w-3.5 h-3.5 ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="mt-1 rounded-md border bg-popover p-2 max-h-48 overflow-y-auto space-y-1">
          <div className="relative mb-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="h-8 pl-7 text-xs" />
          </div>
          {filtered.map(o => (
            <label key={o.abbr} className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-accent cursor-pointer">
              <Checkbox checked={value.includes(o.abbr)} onCheckedChange={() => toggle(o.abbr)} />
              <img src={logoFor(o.abbr)} alt="" className="w-4 h-4" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <span className="font-medium w-8">{o.abbr}</span>
              <span className="text-muted-foreground truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PitcherTypeahead({
  label, selected, onChange, onNamesSeen,
}: {
  label: string;
  selected: PitcherOpt[];
  onChange: (v: PitcherOpt[]) => void;
  onNamesSeen?: (names: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<PitcherOpt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadOnce = useRef<Promise<PitcherOpt[]> | null>(null);
  const onNamesSeenRef = useRef(onNamesSeen);
  onNamesSeenRef.current = onNamesSeen;

  const ensureCatalog = useCallback(async () => {
    if (catalog) return catalog;
    if (loadOnce.current) return loadOnce.current;
    setLoading(true);
    setLoadError(false);
    loadOnce.current = loadMlbPitcherCatalog();
    try {
      const rows = await loadOnce.current;
      setCatalog(rows);
      if (rows.length && onNamesSeenRef.current) onNamesSeenRef.current(rows.map((p) => p.name));
      return rows;
    } catch {
      loadOnce.current = null;
      setLoadError(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, [catalog]);

  const opts = useMemo(
    () => filterPitchers(catalog ?? [], q, 40),
    [catalog, q],
  );

  const add = (p: PitcherOpt) => {
    if (selected.some(s => s.id === p.id)) return;
    onChange([...selected, p]);
    setQ('');
    // Keep open so users can multi-select without re-fighting the dropdown.
    setOpen(true);
  };
  const remove = (id: number) => onChange(selected.filter(s => s.id !== id));

  const showPanel = open && (loading || loadError || catalog !== null);

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map(p => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1 text-[10px]">
              {p.name}{p.team ? ` (${p.team})` : ''}{p.hand ? ` · ${p.hand}` : ''}
              <button type="button" onClick={() => remove(p.id)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
            void ensureCatalog();
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
            void ensureCatalog();
          }}
          onBlur={() => {
            // Delay so option mousedown/click can register before close.
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Search pitchers… (accents optional)"
          className="h-9 pl-7 text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        {showPanel && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {loading && !catalog && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading pitchers…</div>
            )}
            {loadError && !catalog && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Couldn’t load pitchers — try again</div>
            )}
            {!loading && catalog && opts.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {q.trim() ? 'No pitchers match' : 'No pitchers available'}
              </div>
            )}
            {opts.map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p)}
              >
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-muted-foreground shrink-0">{[p.team, p.hand].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
