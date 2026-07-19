import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, TrendingUp, TrendingDown, CalendarClock, Loader2, Bookmark, Trash2, X, Send, MessageSquare } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeNflSavedFilterSnapshot, NFL_ASOF_DEFAULTS, type NflWebFilterSnapshot } from '@/features/analysis/normalizeSavedFilterSnapshot';
import { TeamMultiSelect, type TeamOption } from '@/features/analysis/TeamMultiSelect';
import { DEFAULT_NFL_SNAPSHOT, NFL_DAYS, NFL_DIVISIONS, isSideSymmetric } from '@/features/analysis/filterSchema';
import { applyFilterPatch } from '@/features/analysis/applyFilterPatch';

const NL_FILTER_EXAMPLES = [
  'home favorites off a loss, weeks 2-10',
  'teams on a 3-game win streak getting a TD',
  'make it a moneyline for road dogs',
];

type NlChatTurn = {
  id: number;
  sentence: string;
  lines: string[];
};

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

// ── Bet-type spine — the FIRST choice; everything downstream speaks this one market ──
const BET_GROUPS = [
  { group: 'Full Game', items: [
    { key: 'fg_spread', label: 'Spread' }, { key: 'fg_ml', label: 'Moneyline' },
    { key: 'fg_total', label: 'Total' }, { key: 'team_total', label: 'Team Total' }] },
  { group: 'First Half', items: [
    { key: 'h1_spread', label: '1H Spread' }, { key: 'h1_ml', label: '1H Moneyline' },
    { key: 'h1_total', label: '1H Total' }] },
];
const SPREAD_MARKETS = new Set(['fg_spread', 'h1_spread']);
const ML_MARKETS = new Set(['fg_ml', 'h1_ml']);
const TOTAL_MARKETS = new Set(['fg_total', 'h1_total']);
const LIMITED_MARKETS = new Set(['h1_spread', 'h1_ml', 'h1_total', 'team_total']); // 2023+ only

// per-market line-filter config (the SUBJECT market's line, filterable for every bet type)
const SPREAD_CFG: Record<string, { max: number; mk: string; xk: string; amk: string; axk: string }> = {
  fg_spread: { max: 20, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max' },
  h1_spread: { max: 14, mk: 'h1_spread_min', xk: 'h1_spread_max', amk: 'h1_abs_spread_min', axk: 'h1_abs_spread_max' },
  // moneyline markets filter by the FULL-GAME spread (ML is just the spread priced up)
  fg_ml: { max: 20, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max' },
  h1_ml: { max: 20, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max' },
};
const TOTAL_CFG: Record<string, { min: number; max: number; mk: string; xk: string; label: string }> = {
  fg_total: { min: 30, max: 60, mk: 'total_min', xk: 'total_max', label: 'Game total' },
  h1_total: { min: 15, max: 35, mk: 'h1_total_min', xk: 'h1_total_max', label: '1H total' },
  team_total: { min: 10, max: 40, mk: 'tt_min', xk: 'tt_max', label: 'Team total line' },
};

// team abbr → ESPN logo (handles the LA/LAR + WAS/WSH quirks across our two sources)
const ESPN: Record<string, string> = { LA: 'lar', LAR: 'lar', LAC: 'lac', WAS: 'wsh', WSH: 'wsh', JAC: 'jax', OAK: 'lv', SD: 'lac', STL: 'lar' };
/** nfl_teams uses LA for the Rams; nfl_analysis_base / by_team use LAR. Map at the edge. */
const NFL_TEAM_RPC_ALIAS: Record<string, string> = { LA: 'LAR' };
const toRpcTeam = (abbr: string) => NFL_TEAM_RPC_ALIAS[abbr.toUpperCase()] || abbr.toUpperCase();
const logoFor = (abbr?: string) => abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500/${(ESPN[abbr] || abbr).toLowerCase()}.png` : '/placeholder.svg';

const NFL_TEAMS: TeamOption[] = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
  'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
].map((abbr) => ({ id: abbr, name: abbr, logo: logoFor(abbr) }));

// plain-English label for a result side, per market
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

// the bet-type-relevant line for an upcoming game
function lineForBet(betType: string, g: any): string {
  const t = g.team, sp = g.team_spread;
  if (betType === 'fg_spread') return `${t} ${sp > 0 ? '+' : ''}${sp}`;
  if (betType === 'fg_ml') return `${t} ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
  if (betType === 'fg_total') return `Total O/U ${g.total ?? '—'}`;
  if (betType === 'team_total') return `${t} team total ${g.tt_line ?? '—'}`;
  if (betType === 'h1_spread') return `${t} 1H ${g.h1_spread > 0 ? '+' : ''}${g.h1_spread ?? '—'}`;
  if (betType === 'h1_ml') return `${t} 1H ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
  if (betType === 'h1_total') return `1H Total O/U ${g.h1_total ?? '—'}`;
  return '';
}
function fmtKick(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  } catch { return ''; }
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
  by_coach: { coach: string; n: number; hit_pct: number; roi: number | null }[];
  by_referee: { referee: string; n: number; hit_pct: number; roi: number | null }[];
};

// significance: sample size + deviation from break-even
function significance(n: number, hit: number): { label: string; tone: string } {
  const dev = Math.abs(hit - 50);
  if (n < 20) return { label: 'Thin sample', tone: 'bg-muted text-muted-foreground' };
  if (n >= 60 && dev >= 5) return { label: 'Strong', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (n >= 30 && dev >= 3) return { label: 'Solid', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
  return { label: 'Neutral', tone: 'bg-muted text-muted-foreground' };
}

// verb + outcome word + count noun, per market
const VERB: Record<string, string> = {
  fg_spread: 'covered', h1_spread: 'covered the 1H spread',
  fg_ml: 'won', h1_ml: 'won in the 1H',
  fg_total: 'went over', h1_total: 'went over the 1H total',
  team_total: 'went over their team total',
};
const OUTCOME: Record<string, string> = {
  fg_spread: 'Cover', h1_spread: 'Cover', fg_ml: 'Win', h1_ml: 'Win',
  fg_total: 'Over', h1_total: 'Over', team_total: 'Over',
};
const nounFor = (bt: string) => bt === 'team_total' ? 'team totals' : 'games';

const PRESETS: { label: string; betType: string; filters: any }[] = [
  { label: 'Cold-weather unders', betType: 'fg_total', filters: { tempMax: 32 } },
  { label: 'Home underdogs', betType: 'fg_spread', filters: { side: 'away', favDog: 'underdog' } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Divisional unders', betType: 'fg_total', filters: { division: true } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', spreadSide: 'favorite', spreadSize: [7, 20] } },
];

const DIM_LABEL: Record<string, string> = { over_under: 'Over / Under', home_away: 'Home vs Away', fav_dog: 'Favorite vs Underdog' };

/**
 * Game totals (fg_total / h1_total) de-dupe via `is_home` in the RPC so each game
 * counts once. Team-perspective filters (H2H, last-*, win%, …) can leave only the
 * *away* row matching — overall.n becomes 0 while coverage + by_team still have
 * games. Rebuild overall from by_team (hit is the game O/U, identical on both sides).
 */
function recoverGameLevelOverall(data: Analysis): Analysis['overall'] | null {
  if (data.overall && data.overall.n > 0) return data.overall;
  const rows = data.by_team || [];
  if (!rows.length || !(data.coverage?.n_games > 0)) return null;
  const n = rows.reduce((s, r) => s + (r.n || 0), 0);
  if (n <= 0) return null;
  const winSum = rows.reduce((s, r) => s + ((r.hit_pct || 0) / 100) * (r.n || 0), 0);
  const hit = winSum / n;
  return {
    n,
    wins: Math.round(winSum),
    hit_pct: Math.round(hit * 1000) / 10,
    roi: Math.round((hit * 1.909 - 1) * 1000) / 10,
  };
}

function recoverTotalBars(overall: Analysis['overall']): Bar[] {
  const hit = (overall.hit_pct || 0) / 100;
  const underHit = 1 - hit;
  return [{
    dimension: 'over_under',
    options: [
      { side: 'over', n: overall.n, wins: overall.wins, hit_pct: overall.hit_pct, roi: overall.roi },
      {
        side: 'under',
        n: overall.n,
        wins: Math.max(0, overall.n - overall.wins),
        hit_pct: Math.round(underHit * 1000) / 10,
        roi: Math.round((underHit * 1.909 - 1) * 1000) / 10,
      },
    ],
  }];
}

// one clearly-labeled row per option: "Home covered 44% (19 of 44)" with a hit-rate bar + baseline
function OptionRow({ betType, opt, baseline }: { betType: string; opt: Opt; baseline: number }) {
  const good = opt.hit_pct >= 52.4; // break-even at -110
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
        {opt.roi != null && <span className={opt.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{opt.roi >= 0 ? '+' : ''}{opt.roi}% ROI</span>}
      </div>
    </div>
  );
}

function ResultBar({ betType, bar, baseline }: { betType: string; bar: Bar; baseline: number }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIM_LABEL[bar.dimension] || bar.dimension}</div>
      {bar.options.map((opt, i) => <OptionRow key={i} betType={betType} opt={opt} baseline={baseline} />)}
    </div>
  );
}

// ── Symmetric side-market hero ──────────────────────────────────────────────────────────────
// On the two-sided markets, mirror-row bookkeeping forces "all teams" to ~50% whenever only
// game-level filters are active (see isSideSymmetric). Never headline that tautology — lead with
// the most extreme REAL side split instead.
type SideSlice = { dimension: string; extreme: Opt; other: Opt };
const SIDE_CHIP_LABEL: Record<string, string> = { home: 'Home', away: 'Away', favorite: 'Favorites', underdog: 'Underdogs' };

function pickSideSlices(bars: Bar[] | undefined): SideSlice[] {
  const out: SideSlice[] = [];
  for (const bar of bars || []) {
    if (bar.dimension !== 'home_away' && bar.dimension !== 'fav_dog') continue;
    const opts = (bar.options || []).filter((o) => o.n > 0 && SIDE_CHIP_LABEL[o.side]);
    if (opts.length < 2) continue;
    const sorted = [...opts].sort((a, b) => Math.abs(b.hit_pct - 50) - Math.abs(a.hit_pct - 50));
    out.push({ dimension: bar.dimension, extreme: sorted[0], other: sorted[1] });
  }
  out.sort((a, b) => Math.abs(b.extreme.hit_pct - 50) - Math.abs(a.extreme.hit_pct - 50));
  return out;
}

function VersusRow({ slice, onFocus }: { slice: SideSlice; onFocus: (dimension: string, side: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onFocus(slice.dimension, slice.other.side)}>
          {SIDE_CHIP_LABEL[slice.other.side]} {slice.other.hit_pct}%
        </button>
        <button type="button" className="font-semibold hover:underline" onClick={() => onFocus(slice.dimension, slice.extreme.side)}>
          {SIDE_CHIP_LABEL[slice.extreme.side]} {slice.extreme.hit_pct}%
        </button>
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
              {head.extreme.roi != null && (
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

function BreakdownTable({ betType, rows, keyName }: { betType: string; rows: any[]; keyName: string }) {
  const [sort, setSort] = useState<'roi' | 'hit' | 'n'>('n');
  const sorted = useMemo(() => [...(rows || [])].sort((x, y) =>
    sort === 'n' ? y.n - x.n : sort === 'hit' ? y.hit_pct - x.hit_pct : (y.roi ?? -999) - (x.roi ?? -999)), [rows, sort]);
  const isTeam = keyName === 'team';
  // Every market now returns REAL price-based ROI (closing prices from nfl_historical_odds for
  // 2023+, team_ml for fg_ml 2018+; flat -110 fallback only for pre-2023 spread/totals).
  const isML = false;
  const outcome = OUTCOME[betType] || 'Hit';
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-6 text-center">No results with enough games (min 3).</p>;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {(['n', 'hit', 'roi'] as const).filter(s => s !== 'roi' || !isML).map(s => (
            <Button key={s} size="sm" variant={sort === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSort(s)}>
              {s === 'n' ? 'Games' : s === 'hit' ? `${outcome} %` : 'ROI'}
            </Button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{outcome} rate</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border divide-y">
        {sorted.map((r, i) => {
          const sig = significance(r.n, r.hit_pct);
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              {isTeam
                ? <img src={logoFor(r.team)} alt={r.team} className="w-6 h-6 shrink-0" onError={e => (e.currentTarget.style.visibility = 'hidden')} />
                : <div className="w-6 shrink-0" />}
              <span className="flex-1 truncate font-medium">{r[keyName]}</span>
              <Badge variant="secondary" className={`text-[10px] ${sig.tone}`}>{r.n}g</Badge>
              <span className={`w-14 text-right font-semibold ${r.hit_pct > 52 ? 'text-emerald-600 dark:text-emerald-400' : r.hit_pct < 48 ? 'text-red-600 dark:text-red-400' : ''}`}>{r.hit_pct}%</span>
              {!isML && <span className={`w-16 text-right text-xs ${(r.roi ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.roi != null ? `${r.roi >= 0 ? '+' : ''}${r.roi}%` : '—'}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NFLAnalytics() {
  const [betType, setBetType] = useState('fg_spread');
  const [data, setData] = useState<Analysis | null>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filter state (UI-shaped; translated to RPC keys in buildFilters)
  const [seasons, setSeasons] = useState<[number, number]>([2018, 2025]);
  const [weeks, setWeeks] = useState<[number, number]>([1, 18]);
  const [side, setSide] = useState('any');
  const [seasonType, setSeasonType] = useState('any'); // any | regular | postseason
  const [playoffRound, setPlayoffRound] = useState('any'); // any | Wild Card | Divisional | Conference | Super Bowl
  const [favDog, setFavDog] = useState('any');
  const [spreadSide, setSpreadSide] = useState('any'); // favorite | underdog | any
  const [spreadSize, setSpreadSize] = useState<[number, number]>([0, 20]);
  const [lineRange, setLineRange] = useState<[number, number]>([30, 60]);
  const [mlMin, setMlMin] = useState<string>(''); // team moneyline (American odds) — exact numeric bounds
  const [mlMax, setMlMax] = useState<string>('');
  const [primetime, setPrimetime] = useState<boolean | null>(null);
  const [division, setDivision] = useState<boolean | null>(null);
  const [dome, setDome] = useState<string>('any');
  const [tempRange, setTempRange] = useState<[number, number]>([-10, 100]);
  const [windMax, setWindMax] = useState(60);
  const [precip, setPrecip] = useState('any');
  const [restBye, setRestBye] = useState('any'); // any | off_bye | pre_bye | short
  const [coach, setCoach] = useState('any');
  const [referee, setReferee] = useState('any');
  // "Last game" filters — each describes the team's PREVIOUS game (derived server-side via last_* columns)
  const [lastResult, setLastResult] = useState('any');   // won | lost
  const [lastAts, setLastAts] = useState('any');         // covered | not
  const [lastTotal, setLastTotal] = useState('any');     // over | under
  const [lastRole, setLastRole] = useState('any');       // favorite | underdog
  const [lastOt, setLastOt] = useState<boolean | null>(null);
  const [lastMargin, setLastMargin] = useState<[number, number]>([-60, 60]);
  // "Opponent last game" filters — the OPPONENT's previous game (opp_last_* columns)
  const [oppLastResult, setOppLastResult] = useState('any');
  const [oppLastAts, setOppLastAts] = useState('any');
  const [oppLastTotal, setOppLastTotal] = useState('any');
  const [oppLastRole, setOppLastRole] = useState('any');
  const [oppLastOt, setOppLastOt] = useState<boolean | null>(null);
  const [oppLastMargin, setOppLastMargin] = useState<[number, number]>([-60, 60]);
  const [teams, setTeams] = useState<string[]>([]);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>(NFL_TEAMS);
  const [coaches, setCoaches] = useState<string[]>([]);
  const [refs, setRefs] = useState<string[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // As-of Systems filters (season-to-date at game time) — see 05_LIVE_FILTER_KEYS.md
  const D = NFL_ASOF_DEFAULTS;
  const [winPct, setWinPct] = useState<[number, number]>(D.winPct);
  const [winStreak, setWinStreak] = useState<[number, number]>(D.winStreak);
  const [lossStreak, setLossStreak] = useState<[number, number]>(D.lossStreak);
  const [above500, setAbove500] = useState<boolean | null>(null);
  const [winPctGtOpp, setWinPctGtOpp] = useState<boolean | null>(null);
  const [ppg, setPpg] = useState<[number, number]>(D.ppg);
  const [paPg, setPaPg] = useState<[number, number]>(D.paPg);
  const [pointDiffPg, setPointDiffPg] = useState<[number, number]>(D.pointDiffPg);
  const [minGames, setMinGames] = useState(D.minGames);
  const [atsWinPct, setAtsWinPct] = useState<[number, number]>(D.atsWinPct);
  const [atsWinStreak, setAtsWinStreak] = useState<[number, number]>(D.atsWinStreak);
  const [avgCoverMargin, setAvgCoverMargin] = useState<[number, number]>(D.avgCoverMargin);
  const [overPct, setOverPct] = useState<[number, number]>(D.overPct);
  const [overStreak, setOverStreak] = useState<[number, number]>(D.overStreak);
  const [underStreak, setUnderStreak] = useState<[number, number]>(D.underStreak);
  const [prevWins, setPrevWins] = useState<[number, number]>(D.prevWins);
  const [prevWinPct, setPrevWinPct] = useState<[number, number]>(D.prevWinPct);
  const [madePlayoffsPrev, setMadePlayoffsPrev] = useState<boolean | null>(null);
  const [moreWinsThanOppPrev, setMoreWinsThanOppPrev] = useState<boolean | null>(null);
  const [h2hLastWin, setH2hLastWin] = useState('any');
  const [h2hLastAts, setH2hLastAts] = useState('any');
  const [h2hLastOver, setH2hLastOver] = useState('any');
  const [h2hLastHome, setH2hLastHome] = useState<boolean | null>(null);
  const [h2hLastFav, setH2hLastFav] = useState<boolean | null>(null);
  const [h2hSameSeason, setH2hSameSeason] = useState<boolean | null>(null);
  const [h2hSpreadCmp, setH2hSpreadCmp] = useState('any');
  const [oppWinPct, setOppWinPct] = useState<[number, number]>(D.oppWinPct);
  const [oppOverPct, setOppOverPct] = useState<[number, number]>(D.oppOverPct);
  const [oppWinStreak, setOppWinStreak] = useState<[number, number]>(D.oppWinStreak);
  const [oppPrevWinPct, setOppPrevWinPct] = useState<[number, number]>(D.oppPrevWinPct);

  // saved filters (per authed user, main project)
  const { user } = useAuth();
  const [saved, setSaved] = useState<any[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  // NL filter chat (patches via nl-filter-patch → applyFilterPatch → restore)
  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlTurns, setNlTurns] = useState<NlChatTurn[]>([]);
  const nlTurnId = React.useRef(0);

  const snapshot = (): NflWebFilterSnapshot => ({
    betType, seasons, weeks, side, seasonType, playoffRound, favDog, spreadSide, spreadSize, lineRange,
    mlMin, mlMax, primetime, division, dome, tempRange, windMax, precip, restBye, coach, referee,
    lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin,
    oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin, teams, opponents, daysOfWeek, teamDivisions,
    winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames,
    atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak,
    prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev,
    h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp,
    oppWinPct, oppOverPct, oppWinStreak, oppPrevWinPct,
  });
  const restore = (raw: unknown, rowBetType?: string) => {
    const s = normalizeNflSavedFilterSnapshot(
      raw as Record<string, unknown> | null | undefined,
      rowBetType,
    );
    setBetType(s.betType);
    setSeasons(s.seasons);
    setWeeks(s.weeks);
    setSide(s.side);
    setSeasonType(s.seasonType);
    setPlayoffRound(s.playoffRound);
    setFavDog(s.favDog);
    setSpreadSide(s.spreadSide);
    setPrimetime(s.primetime);
    setDivision(s.division);
    setDome(s.dome);
    setTempRange(s.tempRange);
    setWindMax(s.windMax);
    setPrecip(s.precip);
    setRestBye(s.restBye);
    setCoach(s.coach);
    setReferee(s.referee);
    setLastResult(s.lastResult);
    setLastAts(s.lastAts);
    setLastTotal(s.lastTotal);
    setLastRole(s.lastRole);
    setLastOt(s.lastOt);
    setLastMargin(s.lastMargin);
    setOppLastResult(s.oppLastResult); setOppLastAts(s.oppLastAts); setOppLastTotal(s.oppLastTotal);
    setOppLastRole(s.oppLastRole); setOppLastOt(s.oppLastOt); setOppLastMargin(s.oppLastMargin);
    setMlMin(s.mlMin);
    setMlMax(s.mlMax);
    setTeams(s.teams);
    setOpponents(s.opponents);
    setDaysOfWeek(s.daysOfWeek); setTeamDivisions(s.teamDivisions);
    setWinPct(s.winPct); setWinStreak(s.winStreak); setLossStreak(s.lossStreak);
    setAbove500(s.above500); setWinPctGtOpp(s.winPctGtOpp);
    setPpg(s.ppg); setPaPg(s.paPg); setPointDiffPg(s.pointDiffPg); setMinGames(s.minGames);
    setAtsWinPct(s.atsWinPct); setAtsWinStreak(s.atsWinStreak); setAvgCoverMargin(s.avgCoverMargin);
    setOverPct(s.overPct); setOverStreak(s.overStreak); setUnderStreak(s.underStreak);
    setPrevWins(s.prevWins); setPrevWinPct(s.prevWinPct);
    setMadePlayoffsPrev(s.madePlayoffsPrev); setMoreWinsThanOppPrev(s.moreWinsThanOppPrev);
    setH2hLastWin(s.h2hLastWin); setH2hLastAts(s.h2hLastAts); setH2hLastOver(s.h2hLastOver);
    setH2hLastHome(s.h2hLastHome); setH2hLastFav(s.h2hLastFav); setH2hSameSeason(s.h2hSameSeason);
    setH2hSpreadCmp(s.h2hSpreadCmp);
    setOppWinPct(s.oppWinPct); setOppOverPct(s.oppOverPct);
    setOppWinStreak(s.oppWinStreak); setOppPrevWinPct(s.oppPrevWinPct);
    setTimeout(() => {
      setSpreadSize(s.spreadSize);
      setLineRange(s.lineRange);
    }, 0);
  };
  const loadSaved = useCallback(async () => {
    if (!user) { setSaved([]); return; }
    const { data } = await supabase.from('nfl_analysis_saved_filters').select('*').order('created_at', { ascending: false });
    setSaved(data || []);
  }, [user]);
  useEffect(() => { loadSaved(); }, [loadSaved]);
  const saveCurrent = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase.from('nfl_analysis_saved_filters')
      .insert({ user_id: user.id, name: saveName.trim(), bet_type: betType, filters: snapshot() });
    if (error) { alert(error.message); return; }
    setSaveName(''); setShowSave(false); loadSaved();
  };
  const deleteSaved = async (id: string) => { await supabase.from('nfl_analysis_saved_filters').delete().eq('id', id); loadSaved(); };

  const submitNlFilter = async (raw?: string) => {
    const sentence = (raw ?? nlInput).trim();
    if (!sentence || nlLoading || !user) return;
    setNlLoading(true);
    setNlInput('');
    const lines: string[] = [];
    try {
      const current = snapshot();
      const currentFilter: Record<string, unknown> = { betType: current.betType };
      for (const k of Object.keys(DEFAULT_NFL_SNAPSHOT) as Array<keyof typeof DEFAULT_NFL_SNAPSHOT>) {
        if (k === 'betType') continue;
        if (JSON.stringify(current[k as keyof NflWebFilterSnapshot]) !== JSON.stringify(DEFAULT_NFL_SNAPSHOT[k])) {
          currentFilter[k] = current[k as keyof NflWebFilterSnapshot];
        }
      }
      const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
        body: { sentence, currentFilter, coaches, referees: refs },
      });
      if (error || data?.error) {
        lines.push("Couldn't process that, try again.");
      } else {
        const result = applyFilterPatch(current, { ops: data?.ops ?? [] }, { coaches, referees: refs });
        if (result.applied.length) {
          restore(result.snapshot);
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

  // 1H/TT markets only have 2023+; clamp the season floor so users can't pick empty ranges
  const seasonFloor = LIMITED_MARKETS.has(betType) ? 2023 : 2018;
  // when the bet type changes, reset the line controls to that market's range (avoids stale bounds)
  useEffect(() => {
    if (seasons[0] < seasonFloor) setSeasons([seasonFloor, seasons[1]]);
    setSpreadSize([0, SPREAD_CFG[betType]?.max ?? 20]);
    const t = TOTAL_CFG[betType];
    if (t) setLineRange([t.min, t.max]);
  }, [betType]); // eslint-disable-line

  const buildFilters = useCallback(() => {
    const f: any = {};
    if (seasons[0] > seasonFloor) f.season_min = seasons[0];
    if (seasons[1] < 2025) f.season_max = seasons[1];
    // week vs playoff-round is contextual on season type (weeks alone can't separate them —
    // the reg/postseason boundary moved from wk17 to wk18 in 2021)
    if (seasonType === 'regular') {
      f.season_type = 'regular';
      if (weeks[0] > 1) f.week_min = weeks[0];
      if (weeks[1] < 18) f.week_max = weeks[1];
    } else if (seasonType === 'postseason') {
      f.season_type = 'postseason';
      if (playoffRound !== 'any') f.playoff_round = playoffRound;
    }
    if (side !== 'any') f.side = side;
    if (teams.length) f.team = teams.map(toRpcTeam);
    if (opponents.length) f.opponent = opponents.map(toRpcTeam);
    if (daysOfWeek.length) f.day_of_week = daysOfWeek;
    if (teamDivisions.length) f.team_division = teamDivisions;
    // subject-market line control: size+side for spread markets, range for total markets
    const scfg = SPREAD_CFG[betType];
    if (scfg) {
      const [lo, hi] = spreadSize;
      // Floor the near-zero edge to 0.5 so a chosen direction is STRICTLY favored/underdog — a
      // "Favored by 0" edge would otherwise include pick'em (spread 0) games, which then fall into
      // the underdog bucket (is_favorite = spread < 0) and show a contradictory "underdogs" split.
      const loD = Math.max(lo, 0.5);
      if (spreadSide === 'favorite') { f[scfg.mk] = -hi; f[scfg.xk] = -loD; }
      else if (spreadSide === 'underdog') { f[scfg.mk] = loD; f[scfg.xk] = hi; }
      else if (lo > 0 || hi < scfg.max) { f[scfg.amk] = lo; f[scfg.axk] = hi; }
    }
    if (favDog !== 'any' && (betType === 'team_total')) f.fav_dog = favDog;
    // team moneyline (American odds) — exact numeric bounds; same value in both = an exact line.
    // forgive reversed entry by sorting when both are present.
    { let a = mlMin.trim() === '' ? null : Number(mlMin); let b = mlMax.trim() === '' ? null : Number(mlMax);
      if (a !== null && b !== null && a > b) { const s = a; a = b; b = s; }
      if (a !== null && !Number.isNaN(a)) f.ml_min = a;
      if (b !== null && !Number.isNaN(b)) f.ml_max = b; }
    const tcfg = TOTAL_CFG[betType];
    if (tcfg) {
      if (lineRange[0] > tcfg.min) f[tcfg.mk] = lineRange[0];
      if (lineRange[1] < tcfg.max) f[tcfg.xk] = lineRange[1];
    }
    if (primetime !== null) f.primetime = primetime;
    if (division !== null) f.division = division;
    if (dome !== 'any') f.dome = dome === 'dome';
    if (tempRange[0] > -10) f.temp_min = tempRange[0];
    if (tempRange[1] < 100) f.temp_max = tempRange[1];
    if (windMax < 60) f.wind_max = windMax;
    if (precip !== 'any') f.precip = precip;
    if (restBye === 'off_bye') f.rest_min = 13;
    else if (restBye === 'short') f.rest_max = 4;
    else if (restBye === 'pre_bye') f.pre_bye = true;
    if (coach !== 'any') f.coach = coach;
    if (referee !== 'any') f.referee = referee;
    // "Last game" filters — the team's previous game
    if (lastResult !== 'any') f.last_won = lastResult === 'won' ? 1 : 0;
    if (lastAts !== 'any') f.last_covered = lastAts === 'covered' ? 1 : 0;
    if (lastTotal !== 'any') f.last_over = lastTotal === 'over' ? 1 : 0;
    if (lastRole !== 'any') f.last_favorite = lastRole === 'favorite';
    if (lastOt !== null) f.last_overtime = lastOt;
    applyNumRange(f, 'last_margin', lastMargin, [-60, 60]);
    if (oppLastResult !== 'any') f.opp_last_won = oppLastResult === 'won' ? 1 : 0;
    if (oppLastAts !== 'any') f.opp_last_covered = oppLastAts === 'covered' ? 1 : 0;
    if (oppLastTotal !== 'any') f.opp_last_over = oppLastTotal === 'over' ? 1 : 0;
    if (oppLastRole !== 'any') f.opp_last_favorite = oppLastRole === 'favorite';
    if (oppLastOt !== null) f.opp_last_overtime = oppLastOt;
    applyNumRange(f, 'opp_last_margin', oppLastMargin, [-60, 60]);

    // As-of Systems filters (05_LIVE_FILTER_KEYS.md) — percents sent as 0–1
    applyPctRange(f, 'win_pct', winPct);
    applyNumRange(f, 'win_streak', winStreak, D.winStreak);
    applyNumRange(f, 'loss_streak', lossStreak, D.lossStreak);
    if (above500 !== null) f.above_500 = above500;
    if (winPctGtOpp !== null) f.win_pct_gt_opp = winPctGtOpp;
    applyNumRange(f, 'ppg', ppg, D.ppg);
    applyNumRange(f, 'pa_pg', paPg, D.paPg);
    applyNumRange(f, 'point_diff_pg', pointDiffPg, D.pointDiffPg);
    if (minGames > 0) f.min_games = minGames;
    applyPctRange(f, 'ats_win_pct', atsWinPct);
    applyNumRange(f, 'ats_win_streak', atsWinStreak, D.atsWinStreak);
    applyNumRange(f, 'avg_cover_margin', avgCoverMargin, D.avgCoverMargin);
    applyPctRange(f, 'over_pct', overPct);
    applyNumRange(f, 'over_streak', overStreak, D.overStreak);
    applyNumRange(f, 'under_streak', underStreak, D.underStreak);
    applyNumRange(f, 'prev_wins', prevWins, D.prevWins);
    applyPctRange(f, 'prev_win_pct', prevWinPct);
    if (madePlayoffsPrev !== null) f.made_playoffs_prev = madePlayoffsPrev;
    if (moreWinsThanOppPrev !== null) f.more_wins_than_opp_prev = moreWinsThanOppPrev;
    if (h2hLastWin !== 'any') f.h2h_last_win = h2hLastWin === 'yes' ? 1 : 0;
    if (h2hLastAts !== 'any') f.h2h_last_ats_win = h2hLastAts === 'yes' ? 1 : 0;
    if (h2hLastOver !== 'any') f.h2h_last_over = h2hLastOver === 'yes' ? 1 : 0;
    if (h2hLastHome !== null) f.h2h_last_home = h2hLastHome;
    if (h2hLastFav !== null) f.h2h_last_fav = h2hLastFav;
    if (h2hSameSeason !== null) f.h2h_same_season = h2hSameSeason;
    if (h2hSpreadCmp === 'lower') f.h2h_spread_lower = true;
    else if (h2hSpreadCmp === 'higher') f.h2h_spread_higher = true;
    applyPctRange(f, 'opp_win_pct', oppWinPct);
    applyPctRange(f, 'opp_over_pct', oppOverPct);
    applyNumRange(f, 'opp_win_streak', oppWinStreak, D.oppWinStreak);
    applyPctRange(f, 'opp_prev_win_pct', oppPrevWinPct);

    return f;
  }, [betType, seasons, weeks, side, teams, opponents, seasonType, playoffRound, favDog, spreadSide, spreadSize, lineRange, mlMin, mlMax, primetime, division, dome, tempRange, windMax, precip, restBye, coach, referee, lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin, seasonFloor, winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames, atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak, prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev, h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp, oppWinPct, oppOverPct, oppWinStreak, oppPrevWinPct, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin, daysOfWeek, teamDivisions]);

  const resetAll = () => {
    setSeasons([seasonFloor, 2025]); setWeeks([1, 18]); setSide('any'); setSeasonType('any'); setPlayoffRound('any'); setFavDog('any');
    setTeams([]); setOpponents([]); setDaysOfWeek([]); setTeamDivisions([]);
    setSpreadSide('any'); setSpreadSize([0, SPREAD_CFG[betType]?.max ?? 20]); setMlMin(''); setMlMax('');
    const t = TOTAL_CFG[betType]; setLineRange(t ? [t.min, t.max] : [30, 60]);
    setPrimetime(null); setDivision(null); setDome('any'); setTempRange([-10, 100]);
    setWindMax(60); setPrecip('any'); setRestBye('any'); setCoach('any'); setReferee('any');
    setLastResult('any'); setLastAts('any'); setLastTotal('any'); setLastRole('any'); setLastOt(null); setLastMargin([-60, 60]);
    setOppLastResult('any'); setOppLastAts('any'); setOppLastTotal('any'); setOppLastRole('any'); setOppLastOt(null); setOppLastMargin([-60, 60]);
    setWinPct(D.winPct); setWinStreak(D.winStreak); setLossStreak(D.lossStreak);
    setAbove500(null); setWinPctGtOpp(null);
    setPpg(D.ppg); setPaPg(D.paPg); setPointDiffPg(D.pointDiffPg); setMinGames(0);
    setAtsWinPct(D.atsWinPct); setAtsWinStreak(D.atsWinStreak); setAvgCoverMargin(D.avgCoverMargin);
    setOverPct(D.overPct); setOverStreak(D.overStreak); setUnderStreak(D.underStreak);
    setPrevWins(D.prevWins); setPrevWinPct(D.prevWinPct);
    setMadePlayoffsPrev(null); setMoreWinsThanOppPrev(null);
    setH2hLastWin('any'); setH2hLastAts('any'); setH2hLastOver('any');
    setH2hLastHome(null); setH2hLastFav(null); setH2hSameSeason(null); setH2hSpreadCmp('any');
    setOppWinPct(D.oppWinPct); setOppOverPct(D.oppOverPct);
    setOppWinStreak(D.oppWinStreak); setOppPrevWinPct(D.oppPrevWinPct);
  };

  // active (non-default) filters as removable chips — makes a stuck filter visible
  const chips = useMemo(() => {
    const c: { label: string; clear: () => void }[] = [];
    if (seasons[0] !== seasonFloor || seasons[1] !== 2025) c.push({ label: `Seasons ${seasons[0]}–${seasons[1]}`, clear: () => setSeasons([seasonFloor, 2025]) });
    if (seasonType !== 'any') c.push({ label: seasonType === 'regular' ? 'Regular season' : 'Playoffs', clear: () => { setSeasonType('any'); setPlayoffRound('any'); } });
    if (seasonType === 'regular' && (weeks[0] !== 1 || weeks[1] !== 18)) c.push({ label: `Weeks ${weeks[0]}–${weeks[1]}`, clear: () => setWeeks([1, 18]) });
    if (seasonType === 'postseason' && playoffRound !== 'any') c.push({ label: `Round: ${playoffRound}`, clear: () => setPlayoffRound('any') });
    if (side !== 'any') c.push({ label: side === 'home' ? 'Home' : 'Away', clear: () => setSide('any') });
    if (teams.length) c.push({ label: `Team: ${teams.join(', ')}`, clear: () => setTeams([]) });
    if (opponents.length) c.push({ label: `Opp: ${opponents.join(', ')}`, clear: () => setOpponents([]) });
    if (daysOfWeek.length) c.push({ label: `Days: ${daysOfWeek.join(', ')}`, clear: () => setDaysOfWeek([]) });
    if (teamDivisions.length) c.push({ label: `Division: ${teamDivisions.join(', ')}`, clear: () => setTeamDivisions([]) });
    if ((betType === 'team_total') && favDog !== 'any') c.push({ label: favDog === 'favorite' ? 'Favorites' : 'Underdogs', clear: () => setFavDog('any') });
    const scfg = SPREAD_CFG[betType];
    if (scfg) {
      if (spreadSide !== 'any') c.push({ label: `${spreadSide === 'favorite' ? 'Favored by' : 'Getting'} ${spreadSize[0]}–${spreadSize[1]}`, clear: () => { setSpreadSide('any'); setSpreadSize([0, scfg.max]); } });
      else if (spreadSize[0] !== 0 || spreadSize[1] !== scfg.max) c.push({ label: `Spread ${spreadSize[0]}–${spreadSize[1]}`, clear: () => setSpreadSize([0, scfg.max]) });
    }
    const t = TOTAL_CFG[betType];
    if (t && (lineRange[0] !== t.min || lineRange[1] !== t.max)) c.push({ label: `${t.label} ${lineRange[0]}–${lineRange[1]}`, clear: () => setLineRange([t.min, t.max]) });
    if (mlMin.trim() !== '' || mlMax.trim() !== '') {
      const fmt = (s: string) => { const n = Number(s); return n > 0 ? `+${n}` : `${n}`; };
      const lbl = mlMin.trim() !== '' && mlMax.trim() !== '' ? `ML ${fmt(mlMin)} to ${fmt(mlMax)}` : mlMin.trim() !== '' ? `ML ≥ ${fmt(mlMin)}` : `ML ≤ ${fmt(mlMax)}`;
      c.push({ label: lbl, clear: () => { setMlMin(''); setMlMax(''); } });
    }
    if (primetime !== null) c.push({ label: `Primetime: ${primetime ? 'Yes' : 'No'}`, clear: () => setPrimetime(null) });
    if (division !== null) c.push({ label: `Divisional: ${division ? 'Yes' : 'No'}`, clear: () => setDivision(null) });
    if (dome !== 'any') c.push({ label: dome === 'dome' ? 'Dome' : 'Outdoor', clear: () => setDome('any') });
    if (precip !== 'any') c.push({ label: `Precip: ${precip}`, clear: () => setPrecip('any') });
    if (tempRange[0] !== -10 || tempRange[1] !== 100) c.push({ label: `Temp ${tempRange[0]}–${tempRange[1]}°F`, clear: () => setTempRange([-10, 100]) });
    if (windMax !== 60) c.push({ label: `Wind ≤ ${windMax}`, clear: () => setWindMax(60) });
    if (restBye !== 'any') c.push({ label: ({ off_bye: 'Off a bye', pre_bye: 'Before a bye', short: 'Short rest' } as Record<string, string>)[restBye] || restBye, clear: () => setRestBye('any') });
    if (coach !== 'any') c.push({ label: `Coach: ${coach}`, clear: () => setCoach('any') });
    if (referee !== 'any') c.push({ label: `Ref: ${referee}`, clear: () => setReferee('any') });
    if (lastResult !== 'any') c.push({ label: `Last game: ${lastResult === 'won' ? 'Won' : 'Lost'}`, clear: () => setLastResult('any') });
    if (lastAts !== 'any') c.push({ label: `Last game: ${lastAts === 'covered' ? 'Covered' : "Didn't cover"}`, clear: () => setLastAts('any') });
    if (lastTotal !== 'any') c.push({ label: `Last game: ${lastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setLastTotal('any') });
    if (lastRole !== 'any') c.push({ label: `Last game: ${lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setLastRole('any') });
    if (lastOt !== null) c.push({ label: `Last game OT: ${lastOt ? 'Yes' : 'No'}`, clear: () => setLastOt(null) });
    if (rangeChanged(lastMargin, [-60, 60])) c.push({ label: `Last game margin ${lastMargin[0]} to ${lastMargin[1]}`, clear: () => setLastMargin([-60, 60]) });
    if (oppLastResult !== 'any') c.push({ label: `Opp last game: ${oppLastResult === 'won' ? 'Won' : 'Lost'}`, clear: () => setOppLastResult('any') });
    if (oppLastAts !== 'any') c.push({ label: `Opp last game: ${oppLastAts === 'covered' ? 'Covered' : "Didn't cover"}`, clear: () => setOppLastAts('any') });
    if (oppLastTotal !== 'any') c.push({ label: `Opp last game: ${oppLastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setOppLastTotal('any') });
    if (oppLastRole !== 'any') c.push({ label: `Opp last game: ${oppLastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setOppLastRole('any') });
    if (oppLastOt !== null) c.push({ label: `Opp last game OT: ${oppLastOt ? 'Yes' : 'No'}`, clear: () => setOppLastOt(null) });
    if (rangeChanged(oppLastMargin, [-60, 60])) c.push({ label: `Opp last game margin ${oppLastMargin[0]} to ${oppLastMargin[1]}`, clear: () => setOppLastMargin([-60, 60]) });
    if (rangeChanged(winPct, D.winPct)) c.push({ label: `Win% ${winPct[0]}–${winPct[1]}`, clear: () => setWinPct(D.winPct) });
    if (rangeChanged(winStreak, D.winStreak)) c.push({ label: `Win streak ${winStreak[0]}–${winStreak[1]}`, clear: () => setWinStreak(D.winStreak) });
    if (rangeChanged(lossStreak, D.lossStreak)) c.push({ label: `Loss streak ${lossStreak[0]}–${lossStreak[1]}`, clear: () => setLossStreak(D.lossStreak) });
    if (above500 !== null) c.push({ label: above500 ? 'Winning record' : 'Losing / .500', clear: () => setAbove500(null) });
    if (winPctGtOpp !== null) c.push({ label: winPctGtOpp ? 'Win% > opp' : 'Win% ≤ opp', clear: () => setWinPctGtOpp(null) });
    if (rangeChanged(ppg, D.ppg)) c.push({ label: `PPG ${ppg[0]}–${ppg[1]}`, clear: () => setPpg(D.ppg) });
    if (rangeChanged(paPg, D.paPg)) c.push({ label: `PA/g ${paPg[0]}–${paPg[1]}`, clear: () => setPaPg(D.paPg) });
    if (rangeChanged(pointDiffPg, D.pointDiffPg)) c.push({ label: `Pt diff ${pointDiffPg[0]}–${pointDiffPg[1]}`, clear: () => setPointDiffPg(D.pointDiffPg) });
    if (minGames > 0) c.push({ label: `Min ${minGames} games`, clear: () => setMinGames(0) });
    if (rangeChanged(atsWinPct, D.atsWinPct)) c.push({ label: `ATS% ${atsWinPct[0]}–${atsWinPct[1]}`, clear: () => setAtsWinPct(D.atsWinPct) });
    if (rangeChanged(atsWinStreak, D.atsWinStreak)) c.push({ label: `ATS streak ${atsWinStreak[0]}–${atsWinStreak[1]}`, clear: () => setAtsWinStreak(D.atsWinStreak) });
    if (rangeChanged(avgCoverMargin, D.avgCoverMargin)) c.push({ label: `Cover margin ${avgCoverMargin[0]}–${avgCoverMargin[1]}`, clear: () => setAvgCoverMargin(D.avgCoverMargin) });
    if (rangeChanged(overPct, D.overPct)) c.push({ label: `Over% ${overPct[0]}–${overPct[1]}`, clear: () => setOverPct(D.overPct) });
    if (rangeChanged(overStreak, D.overStreak)) c.push({ label: `Over streak ${overStreak[0]}–${overStreak[1]}`, clear: () => setOverStreak(D.overStreak) });
    if (rangeChanged(underStreak, D.underStreak)) c.push({ label: `Under streak ${underStreak[0]}–${underStreak[1]}`, clear: () => setUnderStreak(D.underStreak) });
    if (rangeChanged(prevWins, D.prevWins)) c.push({ label: `Prev wins ${prevWins[0]}–${prevWins[1]}`, clear: () => setPrevWins(D.prevWins) });
    if (rangeChanged(prevWinPct, D.prevWinPct)) c.push({ label: `Prev win% ${prevWinPct[0]}–${prevWinPct[1]}`, clear: () => setPrevWinPct(D.prevWinPct) });
    if (madePlayoffsPrev !== null) c.push({ label: madePlayoffsPrev ? 'Made playoffs last yr' : 'Missed playoffs last yr', clear: () => setMadePlayoffsPrev(null) });
    if (moreWinsThanOppPrev !== null) c.push({ label: moreWinsThanOppPrev ? 'More wins than opp last yr' : '≤ opp wins last yr', clear: () => setMoreWinsThanOppPrev(null) });
    if (h2hLastWin !== 'any') c.push({ label: `H2H: ${h2hLastWin === 'yes' ? 'Won last' : 'Lost last'}`, clear: () => setH2hLastWin('any') });
    if (h2hLastAts !== 'any') c.push({ label: `H2H: ${h2hLastAts === 'yes' ? 'Covered last' : "Didn't cover last"}`, clear: () => setH2hLastAts('any') });
    if (h2hLastOver !== 'any') c.push({ label: `H2H: ${h2hLastOver === 'yes' ? 'Over last' : 'Under last'}`, clear: () => setH2hLastOver('any') });
    if (h2hLastHome !== null) c.push({ label: `H2H home: ${h2hLastHome ? 'Yes' : 'No'}`, clear: () => setH2hLastHome(null) });
    if (h2hLastFav !== null) c.push({ label: `H2H fav: ${h2hLastFav ? 'Yes' : 'No'}`, clear: () => setH2hLastFav(null) });
    if (h2hSameSeason !== null) c.push({ label: `H2H same season: ${h2hSameSeason ? 'Yes' : 'No'}`, clear: () => setH2hSameSeason(null) });
    if (h2hSpreadCmp !== 'any') c.push({ label: h2hSpreadCmp === 'lower' ? 'Spread lower vs H2H' : 'Spread higher vs H2H', clear: () => setH2hSpreadCmp('any') });
    if (rangeChanged(oppWinPct, D.oppWinPct)) c.push({ label: `Opp win% ${oppWinPct[0]}–${oppWinPct[1]}`, clear: () => setOppWinPct(D.oppWinPct) });
    if (rangeChanged(oppOverPct, D.oppOverPct)) c.push({ label: `Opp over% ${oppOverPct[0]}–${oppOverPct[1]}`, clear: () => setOppOverPct(D.oppOverPct) });
    if (rangeChanged(oppWinStreak, D.oppWinStreak)) c.push({ label: `Opp win streak ${oppWinStreak[0]}–${oppWinStreak[1]}`, clear: () => setOppWinStreak(D.oppWinStreak) });
    if (rangeChanged(oppPrevWinPct, D.oppPrevWinPct)) c.push({ label: `Opp prev win% ${oppPrevWinPct[0]}–${oppPrevWinPct[1]}`, clear: () => setOppPrevWinPct(D.oppPrevWinPct) });
    return c;
  }, [betType, seasons, weeks, side, teams, opponents, seasonType, playoffRound, favDog, spreadSide, spreadSize, lineRange, mlMin, mlMax, primetime, division, dome, precip, tempRange, windMax, restBye, coach, referee, lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin, seasonFloor, winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames, atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak, prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev, h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp, oppWinPct, oppOverPct, oppWinStreak, oppPrevWinPct, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin, daysOfWeek, teamDivisions]);

  // load coach/ref + NFL team option lists once
  useEffect(() => {
    collegeFootballSupabase.rpc('nfl_analysis', { p_bet_type: 'fg_spread', p_filters: {} }).then(({ data }) => {
      if (data) {
        setCoaches((data.by_coach || []).map((c: any) => c.coach).sort());
        setRefs((data.by_referee || []).map((r: any) => r.referee).sort());
      }
    });
    collegeFootballSupabase
      .from('nfl_teams')
      .select('team_abbr, team_name')
      .then(({ data }) => {
        if (!data?.length) return;
        setTeamOptions(
          (data as { team_abbr?: string; team_name?: string }[])
            .map((r) => {
              const raw = String(r.team_abbr || '').toUpperCase();
              const abbr = toRpcTeam(raw); // LA → LAR so filters match nfl_analysis_base
              return { id: abbr, name: String(r.team_name || abbr), logo: logoFor(abbr) };
            })
            .filter((t) => t.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      });
  }, []);

  // fetch on any change (debounced)
  useEffect(() => {
    setLoading(true);
    const filters = buildFilters();
    const t = setTimeout(async () => {
      const [a, u] = await Promise.all([
        collegeFootballSupabase.rpc('nfl_analysis', { p_bet_type: betType, p_filters: filters }),
        collegeFootballSupabase.rpc('nfl_analysis_upcoming', { p_bet_type: betType, p_filters: filters }),
      ]);
      setData(a.data as Analysis);
      setUpcoming((u.data as any[]) || []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [betType, buildFilters]);

  const applyPreset = (p: typeof PRESETS[0]) => {
    setBetType(p.betType);
    const f = p.filters;
    setSide(f.side || 'any'); setFavDog(f.favDog || 'any');
    setSpreadSide(f.spreadSide || 'any');
    setPrimetime(f.primetime ?? null); setDivision(f.division ?? null);
    setTempRange([-10, f.tempMax ?? 100]);
    // spread size is reset by the bet-type effect; apply the preset's after it runs
    if (f.spreadSize) setTimeout(() => setSpreadSize(f.spreadSize), 0);
  };

  // secondary context splits — only shown when it's a genuine two-sided comparison. A tiny side
  // (<10% of the split, e.g. a lone "underdog" inside a favorite-only moneyline filter) is a pinned/
  // degenerate dimension or a stray data mismatch — hide it rather than headline a 1-of-1 100%/ROI.
  const isTotalMkt = !!TOTAL_CFG[betType] && betType !== 'team_total';
  // Recover game-total overall when RPC's is_home de-dupe emptied it but team-perspective filters matched.
  const overall = useMemo(() => {
    if (!data) return null;
    if (data.overall && data.overall.n > 0) return data.overall;
    if (isTotalMkt) return recoverGameLevelOverall(data);
    return data.overall;
  }, [data, isTotalMkt]);

  const shownBars = useMemo(() => {
    if (!data) return [];
    let bars = data.bars || [];
    const barN = bars.reduce((s, b) => s + b.options.reduce((t, o) => t + (o?.n || 0), 0), 0);
    if (isTotalMkt && overall && overall.n > 0 && barN === 0) {
      bars = recoverTotalBars(overall);
    }
    return bars.filter(bar => {
      const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
      return total > 0 && bar.options.every(o => o && o.n > 0 && o.n / total >= 0.1);
    });
  }, [data, isTotalMkt, overall]);
  // plain-English subject for the headline, built from the active filters (never empty/degenerate)
  const subject = useMemo(() => {
    const parts: string[] = [];
    if (side !== 'any') parts.push(side === 'home' ? 'Home' : 'Road');
    const dir = SPREAD_CFG[betType] ? spreadSide : favDog;
    if (dir && dir !== 'any') parts.push(dir === 'favorite' ? 'favorites' : 'underdogs');
    const situation = parts.join(' ');
    if (coach !== 'any') return `${coach}'s teams${situation ? ` (${situation.toLowerCase()})` : ''}`;
    if (situation) return situation.charAt(0).toUpperCase() + situation.slice(1);
    return isTotalMkt ? 'Games' : 'Teams';
  }, [betType, side, spreadSide, favDog, coach, isTotalMkt]);

  // dynamic "here's what you're looking at" caption for the headline
  const scopeNote = useMemo(() => {
    const bits: string[] = [];
    if (coach !== 'any') bits.push(`${coach}-coached teams`);
    if (referee !== 'any') bits.push(`games officiated by ${referee}`);
    const who = bits.length ? bits.join(' · ') : 'all teams';
    return `${who} in every past game that matches your filters.`;
  }, [coach, referee]);

  const cov = data?.coverage;
  const limited = LIMITED_MARKETS.has(betType);
  // Two-sided-market tautology guard: with only game-level filters, "all teams" is forced ~50% —
  // lead with the real side splits instead (see filterSchema.isSideSymmetric).
  const symmetricSlices = data && isSideSymmetric(snapshot()) ? (() => { const sl = pickSideSlices(data.bars); return sl.length ? sl : null; })() : null;
  const focusSide = (dimension: string, sideVal: string) => {
    if (dimension === 'home_away') setSide(sideVal);
    else if (dimension === 'fav_dog') setSpreadSide(sideVal);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">NFL Historical Analysis</h1>
        <p className="text-sm text-muted-foreground">Pick a bet type, set the situation, and see how it's played out — plus this week's games that match.</p>
      </div>

      {/* ── Bet-type spine ── */}
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

      {/* presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map(p => (
          <Badge key={p.label} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset(p)}>{p.label}</Badge>
        ))}
      </div>

      {/* saved filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!user ? (
          <span className="text-xs text-muted-foreground">Sign in to save filters you want to track this season.</span>
        ) : (
          <>
            {saved.length > 0 && (
              <Select onValueChange={(id) => { const s = saved.find(x => x.id === id); if (s) restore(s.filters, s.bet_type); }}>
                <SelectTrigger className="h-8 w-56 text-xs"><Bookmark className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder={`Saved filters (${saved.length})`} /></SelectTrigger>
                <SelectContent>
                  {saved.map(s => (
                    <div key={s.id} className="flex items-center">
                      <SelectItem value={s.id} className="flex-1">{s.name}</SelectItem>
                      <button className="px-2 text-muted-foreground hover:text-red-500" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSaved(s.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* active-filter chips + reset */}
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
        {/* ── RESULTS (kept mounted across refetches so the page height never collapses) ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* NL filter chat — above the dimmed results so typing stays readable during refetch */}
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
                  <div className="flex gap-2">
                    <Input
                      value={nlInput}
                      onChange={(e) => setNlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitNlFilter();
                        }
                      }}
                      placeholder='e.g. "home favorites off a loss, weeks 2-10"'
                      className="h-9 text-sm"
                      disabled={nlLoading}
                      maxLength={500}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 shrink-0"
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
          {/* coverage readout */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              {cov ? `Based on ${cov.n_games} games, ${cov.season_min}–${cov.season_max}` : loading ? 'Loading…' : 'No games match'}
            </Badge>
            {limited && <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">Limited history (2023+)</Badge>}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* Hero verdict — single dominant hit-rate with context under it */}
          {!data ? <Skeleton className="h-28 w-full" /> : symmetricSlices ? (
            <SymmetricSplitHero betType={betType} slices={symmetricSlices} cov={cov} onFocus={focusSide} />
          ) : overall && cov && overall.n > 0 ? (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  {overall.hit_pct >= 50
                    ? <TrendingUp className="w-6 h-6 text-emerald-500 mt-1 shrink-0" />
                    : <TrendingDown className="w-6 h-6 text-red-500 mt-1 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-4xl sm:text-5xl font-bold tracking-tight text-primary tabular-nums leading-none">
                        {overall.hit_pct}%
                      </span>
                      {overall.roi != null && (
                        <span className={`text-lg font-semibold tabular-nums ${overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {overall.roi >= 0 ? '+' : ''}{overall.roi}% ROI
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">
                      {subject} {VERB[betType]}{' '}
                      <span className="text-primary">{overall.hit_pct}%</span>
                      {' '}
                      <span className="font-normal text-muted-foreground">
                        ({overall.wins} of {overall.n} {nounFor(betType)}
                        {cov ? ` · ${cov.season_min}–${cov.season_max}` : ''})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(overall.hit_pct - data.baseline_pct >= 0 ? '+' : '')}
                      {(overall.hit_pct - data.baseline_pct).toFixed(1)} pts vs the {data.baseline_pct}% baseline
                      {' · '}{significance(overall.n, overall.hit_pct).label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">{scopeNote}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No games match these filters — try widening them.</CardContent></Card>
          )}

          {/* Breakdowns — progressive disclosure; collapsed by default */}
          {data && (shownBars.length > 0 || data.by_team?.length || data.by_coach?.length || data.by_referee?.length) && (
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
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">The same {overall?.n ?? data.overall.n} {nounFor(betType)}, split by situation.</p>
                    </div>
                    {shownBars.map((bar, i) => <ResultBar key={i} betType={betType} bar={bar} baseline={data.baseline_pct} />)}
                  </CardContent></Card>
                )}

                <Card><CardContent className="py-4">
                  <Tabs defaultValue="team">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="team">By Team</TabsTrigger>
                      <TabsTrigger value="coach">By Coach</TabsTrigger>
                      <TabsTrigger value="ref">By Referee</TabsTrigger>
                    </TabsList>
                    <TabsContent value="team"><BreakdownTable betType={betType} rows={data.by_team} keyName="team" /></TabsContent>
                    <TabsContent value="coach"><BreakdownTable betType={betType} rows={data.by_coach} keyName="coach" /></TabsContent>
                    <TabsContent value="ref"><BreakdownTable betType={betType} rows={data.by_referee} keyName="referee" /></TabsContent>
                  </Tabs>
                </CardContent></Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* upcoming match — stays visible, not behind the expander */}
          {data && upcoming.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3 font-semibold text-sm"><CalendarClock className="w-4 h-4 text-primary" /> This week's games that match ({upcoming.length})</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {upcoming.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <img src={logoFor(g.team)} alt="" className="w-6 h-6" onError={e => (e.currentTarget.style.visibility = 'hidden')} />
                      <div className="flex-1">
                        <div className="font-medium">{g.matchup}</div>
                        <div className="text-xs font-medium text-foreground/80">{lineForBet(betType, g)}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtKick(g.kickoff)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </div>

        {/* ── FILTERS (adaptive) ── */}
        <div className="xl:sticky xl:top-4 h-fit space-y-3">
          <Card><CardContent className="py-4 space-y-4">
            <div className="text-sm font-semibold">Situation</div>
            <RangeRow label={`Seasons: ${seasons[0]}–${seasons[1]}`} min={seasonFloor} max={2025} step={1} value={seasons} onChange={setSeasons} />
            <SelectRow label="Season type" value={seasonType} onChange={setSeasonType} options={[['any', 'Regular + Playoffs'], ['regular', 'Regular season'], ['postseason', 'Playoffs only']]} />
            {/* week vs round is contextual: regular → weeks slider, playoffs → round picker, neither until a type is chosen */}
            {seasonType === 'regular' && (
              <RangeRow label={`Weeks: ${weeks[0]}–${weeks[1]}`} min={1} max={18} step={1} value={weeks} onChange={setWeeks} />
            )}
            {seasonType === 'postseason' && (
              <SelectRow label="Playoff round" value={playoffRound} onChange={setPlayoffRound}
                options={[['any', 'All rounds'], ['Wild Card', 'Wild Card'], ['Divisional', 'Divisional'], ['Conference', 'Conference'], ['Super Bowl', 'Super Bowl']]} />
            )}
            <SelectRow label="Side" value={side} onChange={setSide} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
            <TeamMultiSelect label="Team" options={teamOptions} value={teams} onChange={setTeams} />
            <TeamMultiSelect label="Opponent" options={teamOptions} value={opponents} onChange={setOpponents} emptyLabel="Any opponent" />
            <MultiToggle label="Days of week" options={NFL_DAYS} value={daysOfWeek} onChange={setDaysOfWeek} />

            {SPREAD_CFG[betType] && (
              <>
                <SelectRow label={betType === 'h1_spread' ? '1H spread side' : 'Spread side'} value={spreadSide} onChange={setSpreadSide}
                  options={[['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']]} />
                <RangeRow label={`${spreadSide === 'favorite' ? 'Favored by' : spreadSide === 'underdog' ? 'Getting' : 'Spread'}: ${spreadSize[0]}–${spreadSize[1]} pts`}
                  min={0} max={SPREAD_CFG[betType].max} step={0.5} value={spreadSize} onChange={setSpreadSize} />
              </>
            )}
            {/* moneyline odds — exact American-odds bounds. Negative = favorite, positive = underdog.
                Same value in both = an exact line (e.g. -102 & -102); leave one blank for one-sided. */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Moneyline odds (American)</div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={mlMin} onChange={e => setMlMin(e.target.value)} placeholder="min e.g. -200" className="h-9" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="number" inputMode="numeric" value={mlMax} onChange={e => setMlMax(e.target.value)} placeholder="max e.g. -120" className="h-9" />
              </div>
            </div>
            {(betType === 'team_total') && (
              <SelectRow label="Favorite / Underdog" value={favDog} onChange={setFavDog} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
            )}
            {TOTAL_CFG[betType] && (
              <RangeRow label={`${TOTAL_CFG[betType].label}: ${lineRange[0]}–${lineRange[1]}`}
                min={TOTAL_CFG[betType].min} max={TOTAL_CFG[betType].max} step={0.5} value={lineRange} onChange={setLineRange} />
            )}
          </CardContent></Card>

          {/* Matchup = game-setup context (not weather). Split out of the old "Conditions" grab-bag. */}
          <FilterSection title="Matchup">
            <TriRow label="Primetime" value={primetime} onChange={setPrimetime} />
            <TriRow label="Divisional" value={division} onChange={setDivision} />
            <MultiToggle label="Team division" options={NFL_DIVISIONS} value={teamDivisions} onChange={setTeamDivisions} />
            <SelectRow label="Rest / Bye" value={restBye} onChange={setRestBye}
              options={[['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short rest (Thu)']]} />
          </FilterSection>

          <FilterSection title="Weather">
            <SelectRow label="Venue" value={dome} onChange={setDome} options={[['any', 'Any'], ['dome', 'Dome'], ['outdoor', 'Outdoor']]} />
            <SelectRow label="Precipitation" value={precip} onChange={setPrecip} options={[['any', 'Any'], ['none', 'None'], ['rain', 'Rain'], ['snow', 'Snow']]} />
            <RangeRow label={`Temp: ${tempRange[0]}–${tempRange[1]}°F`} min={-10} max={100} step={1} value={tempRange} onChange={setTempRange} />
            <div><div className="text-xs text-muted-foreground mb-1">Max wind: {windMax} mph</div><Slider min={0} max={60} step={1} value={[windMax]} onValueChange={([v]) => setWindMax(v)} /></div>
          </FilterSection>

          <FilterSection title="Context">
            <SelectRow label="Coach" value={coach} onChange={setCoach} options={[['any', 'Any coach'], ...coaches.map(c => [c, c] as [string, string])]} />
            <SelectRow label="Referee" value={referee} onChange={setReferee} options={[['any', 'Any referee'], ...refs.map(r => [r, r] as [string, string])]} />
          </FilterSection>

          <FilterSection title="Last game">
            <SelectRow label="Result" value={lastResult} onChange={setLastResult} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="ATS" value={lastAts} onChange={setLastAts} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Total" value={lastTotal} onChange={setLastTotal} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Was" value={lastRole} onChange={setLastRole} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <RangeRow label={`Last game margin: ${lastMargin[0]} to ${lastMargin[1]} pts (+ = won by, − = lost by)`} min={-60} max={60} step={1} value={lastMargin} onChange={setLastMargin} />
            <TriRow label="Went to overtime" value={lastOt} onChange={setLastOt} />
          </FilterSection>

          <FilterSection title="Opponent last game">
            <SelectRow label="Result" value={oppLastResult} onChange={setOppLastResult} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="ATS" value={oppLastAts} onChange={setOppLastAts} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Total" value={oppLastTotal} onChange={setOppLastTotal} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Was" value={oppLastRole} onChange={setOppLastRole} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <RangeRow label={`Opponent last game margin: ${oppLastMargin[0]} to ${oppLastMargin[1]} pts (+ = won by, − = lost by)`} min={-60} max={60} step={1} value={oppLastMargin} onChange={setOppLastMargin} />
            <TriRow label="Went to overtime" value={oppLastOt} onChange={setOppLastOt} />
          </FilterSection>

          <FilterSection title="Season Record">
            <RangeRow label={`Win%: ${winPct[0]}–${winPct[1]}%`} min={0} max={100} step={1} value={winPct} onChange={setWinPct} />
            <RangeRow label={`Win streak: ${winStreak[0]}–${winStreak[1]}`} min={0} max={16} step={1} value={winStreak} onChange={setWinStreak} />
            <RangeRow label={`Loss streak: ${lossStreak[0]}–${lossStreak[1]}`} min={0} max={16} step={1} value={lossStreak} onChange={setLossStreak} />
            <TriRow label="Winning record (>.500)" value={above500} onChange={setAbove500} />
            <TriRow label="Win% better than opponent" value={winPctGtOpp} onChange={setWinPctGtOpp} />
            <RangeRow label={`PPG: ${ppg[0]}–${ppg[1]}`} min={0} max={40} step={0.5} value={ppg} onChange={setPpg} />
            <RangeRow label={`PA/g: ${paPg[0]}–${paPg[1]}`} min={0} max={40} step={0.5} value={paPg} onChange={setPaPg} />
            <RangeRow label={`Point diff/g: ${pointDiffPg[0]}–${pointDiffPg[1]}`} min={-20} max={20} step={0.5} value={pointDiffPg} onChange={setPointDiffPg} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Min games this season: {minGames === 0 ? 'Any' : minGames}</div>
              <Slider min={0} max={10} step={1} value={[minGames]} onValueChange={([v]) => setMinGames(v)} />
            </div>
          </FilterSection>

          <FilterSection title="Cover Profile">
            <RangeRow label={`ATS win%: ${atsWinPct[0]}–${atsWinPct[1]}%`} min={0} max={100} step={1} value={atsWinPct} onChange={setAtsWinPct} />
            <RangeRow label={`ATS win streak: ${atsWinStreak[0]}–${atsWinStreak[1]}`} min={0} max={16} step={1} value={atsWinStreak} onChange={setAtsWinStreak} />
            <RangeRow label={`Avg cover margin: ${avgCoverMargin[0]}–${avgCoverMargin[1]}`} min={-15} max={15} step={0.5} value={avgCoverMargin} onChange={setAvgCoverMargin} />
          </FilterSection>

          <FilterSection title="Total Profile">
            <RangeRow label={`Over%: ${overPct[0]}–${overPct[1]}%`} min={0} max={100} step={1} value={overPct} onChange={setOverPct} />
            <RangeRow label={`Over streak: ${overStreak[0]}–${overStreak[1]}`} min={0} max={16} step={1} value={overStreak} onChange={setOverStreak} />
            <RangeRow label={`Under streak: ${underStreak[0]}–${underStreak[1]}`} min={0} max={16} step={1} value={underStreak} onChange={setUnderStreak} />
          </FilterSection>

          <FilterSection title="Prior Year">
            <RangeRow label={`Last season wins: ${prevWins[0]}–${prevWins[1]}`} min={0} max={16} step={1} value={prevWins} onChange={setPrevWins} />
            <RangeRow label={`Last season win%: ${prevWinPct[0]}–${prevWinPct[1]}%`} min={0} max={100} step={1} value={prevWinPct} onChange={setPrevWinPct} />
            <TriRow label="Made playoffs last year" value={madePlayoffsPrev} onChange={setMadePlayoffsPrev} />
            <TriRow label="More wins than opponent last year" value={moreWinsThanOppPrev} onChange={setMoreWinsThanOppPrev} />
          </FilterSection>

          <FilterSection title="Head-to-Head">
            <SelectRow label="Won last meeting" value={h2hLastWin} onChange={setH2hLastWin} options={[['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']]} />
            <SelectRow label="Covered last meeting" value={h2hLastAts} onChange={setH2hLastAts} options={[['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]]} />
            <SelectRow label="Last meeting total" value={h2hLastOver} onChange={setH2hLastOver} options={[['any', 'Any'], ['yes', 'Over'], ['no', 'Under']]} />
            <TriRow label="Was home last meeting" value={h2hLastHome} onChange={setH2hLastHome} />
            <TriRow label="Was favorite last meeting" value={h2hLastFav} onChange={setH2hLastFav} />
            <TriRow label="Same season as last meeting" value={h2hSameSeason} onChange={setH2hSameSeason} />
            <SelectRow label="Spread vs last meeting" value={h2hSpreadCmp} onChange={setH2hSpreadCmp}
              options={[['any', 'Any'], ['lower', 'Lower (more favored / less pts)'], ['higher', 'Higher (less favored / more pts)']]} />
          </FilterSection>

          <FilterSection title="Opponent Record">
            <RangeRow label={`Opp win%: ${oppWinPct[0]}–${oppWinPct[1]}%`} min={0} max={100} step={1} value={oppWinPct} onChange={setOppWinPct} />
            <RangeRow label={`Opp over%: ${oppOverPct[0]}–${oppOverPct[1]}%`} min={0} max={100} step={1} value={oppOverPct} onChange={setOppOverPct} />
            <RangeRow label={`Opp win streak: ${oppWinStreak[0]}–${oppWinStreak[1]}`} min={0} max={16} step={1} value={oppWinStreak} onChange={setOppWinStreak} />
            <RangeRow label={`Opp prev win%: ${oppPrevWinPct[0]}–${oppPrevWinPct[1]}%`} min={0} max={100} step={1} value={oppPrevWinPct} onChange={setOppPrevWinPct} />
          </FilterSection>
        </div>
      </div>
    </div>
  );
}

// ── small filter primitives ──
function RangeRow({ label, min, max, step, value, onChange }: any) {
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <Slider min={min} max={max} step={step} value={value} onValueChange={(v: number[]) => onChange([v[0], v[1]])} minStepsBetweenThumbs={0} /></div>;
}
function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>;
}
function MultiToggle({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className="flex flex-wrap gap-1">{options.map((o) => (
      <Button key={o} size="sm" variant={value.includes(o) ? 'default' : 'outline'} className="h-7 text-xs px-2" onClick={() => toggle(o)}>{o}</Button>
    ))}</div></div>;
}
function TriRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts: [string, boolean | null][] = [['Any', null], ['Yes', true], ['No', false]];
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className="flex gap-1">{opts.map(([l, v]) => <Button key={l} size="sm" variant={value === v ? 'default' : 'outline'} className="h-7 flex-1 text-xs" onClick={() => onChange(v)}>{l}</Button>)}</div></div>;
}
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <Card><CardContent className="py-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold">
        {title}<ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">{children}</CollapsibleContent>
    </CardContent></Card>
  </Collapsible>;
}
