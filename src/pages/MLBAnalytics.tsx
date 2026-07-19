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
  Bookmark, Trash2, X, Search,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';

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
const nounFor = () => 'games';

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

function ResultBar({ betType, bar, baseline }: { betType: string; bar: Bar; baseline: number }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIM_LABEL[bar.dimension] || bar.dimension}</div>
      {bar.options.map((opt, i) => <OptionRow key={i} betType={betType} opt={opt} baseline={baseline} />)}
    </div>
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
  const [seasons, setSeasons] = useState<[number, number]>([SEASON_FLOOR, SEASON_MAX]);
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

  const { user } = useAuth();
  const [saved, setSaved] = useState<Record<string, unknown>[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  // Load MLB team list
  useEffect(() => {
    collegeFootballSupabase
      .from('mlb_team_mapping')
      .select('team, team_name')
      .then(({ data: rows }) => {
        const opts = (rows || [])
          .map((r: { team?: string; team_name?: string }) => ({
            abbr: String(r.team || '').toUpperCase(),
            name: String(r.team_name || r.team || ''),
          }))
          .filter(t => t.abbr)
          .sort((a, b) => a.abbr.localeCompare(b.abbr));
        // de-dupe by abbr
        const seen = new Set<string>();
        setTeamOptions(opts.filter(t => (seen.has(t.abbr) ? false : (seen.add(t.abbr), true))));
      });
  }, []);

  useEffect(() => {
    const t = TOTAL_CFG[betType];
    if (t) setLineRange([t.min, t.max]);
    setTotalBounds(null);
  }, [betType]);

  const snapshot = () => ({
    betType, seasons, months, teams, opponents, division, interleague,
    side, favDog, mlMin, mlMax, lineRange, totalBounds, timeMin, timeMax, dayOfWeek, doubleheader,
    seriesGame, trip, switchGame, restRange, streakMin, streakMax, lastResult, lastMarginMin, lastMarginMax,
    sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
  });

  const restore = (raw: Record<string, unknown>, rowBetType?: string) => {
    if (rowBetType) setBetType(rowBetType);
    else if (typeof raw.betType === 'string') setBetType(raw.betType);
    if (Array.isArray(raw.seasons)) setSeasons(raw.seasons as [number, number]);
    if (Array.isArray(raw.months)) setMonths(raw.months as [number, number]);
    if (Array.isArray(raw.teams)) setTeams(raw.teams as string[]);
    if (Array.isArray(raw.opponents)) setOpponents(raw.opponents as string[]);
    if ('division' in raw) setDivision(raw.division as boolean | null);
    if ('interleague' in raw) setInterleague(raw.interleague as boolean | null);
    if (typeof raw.side === 'string') setSide(raw.side);
    if (typeof raw.favDog === 'string') setFavDog(raw.favDog);
    if (typeof raw.mlMin === 'string') setMlMin(raw.mlMin);
    if (typeof raw.mlMax === 'string') setMlMax(raw.mlMax);
    if (Array.isArray(raw.lineRange)) setTimeout(() => setLineRange(raw.lineRange as [number, number]), 0);
    if (raw.totalBounds && typeof raw.totalBounds === 'object') setTotalBounds(raw.totalBounds as OptRange);
    else setTotalBounds(null);
    if (typeof raw.timeMin === 'string') setTimeMin(raw.timeMin);
    if (typeof raw.timeMax === 'string') setTimeMax(raw.timeMax);
    if (typeof raw.dayOfWeek === 'string') setDayOfWeek(raw.dayOfWeek);
    if ('doubleheader' in raw) setDoubleheader(raw.doubleheader as boolean | null);
    if ('seriesGame' in raw) setSeriesGame(raw.seriesGame as [number, number] | null);
    if ('trip' in raw) setTrip(raw.trip as [number, number] | null);
    if ('switchGame' in raw) setSwitchGame(raw.switchGame as boolean | null);
    if (Array.isArray(raw.restRange)) setRestRange(raw.restRange as [number, number]);
    if (typeof raw.streakMin === 'string') setStreakMin(raw.streakMin);
    if (typeof raw.streakMax === 'string') setStreakMax(raw.streakMax);
    if (typeof raw.lastResult === 'string') setLastResult(raw.lastResult);
    if (typeof raw.lastMarginMin === 'string') setLastMarginMin(raw.lastMarginMin);
    if (typeof raw.lastMarginMax === 'string') setLastMarginMax(raw.lastMarginMax);
    if (Array.isArray(raw.sp)) setSp(raw.sp as PitcherOpt[]);
    if (Array.isArray(raw.oppSp)) setOppSp(raw.oppSp as PitcherOpt[]);
    if (typeof raw.spHand === 'string') setSpHand(raw.spHand);
    if (typeof raw.oppSpHand === 'string') setOppSpHand(raw.oppSpHand);
    // OptRange fields — accept object form; ignore legacy [min,max] tuples that forced both ends
    const asOpt = (v: unknown): OptRange | null => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
      const o = v as OptRange;
      const out: OptRange = {};
      if (typeof o.min === 'number' && Number.isFinite(o.min)) out.min = o.min;
      if (typeof o.max === 'number' && Number.isFinite(o.max)) out.max = o.max;
      return out.min != null || out.max != null ? out : null;
    };
    if ('spXfip' in raw) setSpXfip(asOpt(raw.spXfip));
    if ('oppSpXfip' in raw) setOppSpXfip(asOpt(raw.oppSpXfip));
    if ('bpIp' in raw) setBpIp(asOpt(raw.bpIp));
    if ('bpXfip' in raw) setBpXfip(asOpt(raw.bpXfip));
    if (Array.isArray(raw.tempRange)) setTempRange(raw.tempRange as [number, number]);
    if (Array.isArray(raw.windRange)) setWindRange(raw.windRange as [number, number]);
    if (typeof raw.windDir === 'string') setWindDir(raw.windDir);
    if ('dome' in raw) setDome(raw.dome as boolean | null);
    if ('pfRuns' in raw) setPfRuns(asOpt(raw.pfRuns));
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

  const buildFilters = useCallback(() => {
    const f: Record<string, unknown> = {};
    if (seasons[0] > SEASON_FLOOR) f.season_min = seasons[0];
    if (seasons[1] < SEASON_MAX) f.season_max = seasons[1];
    if (months[0] > 3) f.month_min = months[0];
    if (months[1] < 11) f.month_max = months[1];
    if (teams.length) f.team = teams;
    if (opponents.length) f.opponent = opponents;
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

    const tcfg = TOTAL_CFG[betType];
    if (tcfg) {
      // Band chips set totalBounds (one-sided). Slider only contributes when
      // totalBounds is unset and the thumb isn't at the full default span.
      if (totalBounds) {
        assignRange(f, tcfg.mk, tcfg.xk, totalBounds);
      } else {
        if (lineRange[0] > tcfg.min) f[tcfg.mk] = lineRange[0];
        if (lineRange[1] < tcfg.max) f[tcfg.xk] = lineRange[1];
      }
    }

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
    assignOptionalNumber(f, 'last_margin_min', lastMarginMin);
    assignOptionalNumber(f, 'last_margin_max', lastMarginMax);

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

    return f;
  }, [
    betType, seasons, months, teams, opponents, division, interleague,
    side, favDog, mlMin, mlMax, lineRange, totalBounds, timeMin, timeMax, dayOfWeek, doubleheader,
    seriesGame, trip, switchGame, restRange, streakMin, streakMax, lastResult, lastMarginMin, lastMarginMax,
    sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
  ]);

  const weatherOnlyUpcoming = useMemo(() => {
    const f = buildFilters();
    const keys = Object.keys(f);
    if (keys.length === 0) return false;
    const weatherKeys = new Set(['temp_min', 'temp_max', 'wind_min', 'wind_max', 'wind_dir']);
    return keys.every(k => weatherKeys.has(k));
  }, [buildFilters]);

  const resetAll = () => {
    setSeasons([SEASON_FLOOR, SEASON_MAX]); setMonths([3, 11]); setTeams([]); setOpponents([]);
    setDivision(null); setInterleague(null); setSide('any'); setFavDog('any');
    setMlMin(''); setMlMax('');
    const t = TOTAL_CFG[betType]; setLineRange(t ? [t.min, t.max] : [5, 14]); setTotalBounds(null);
    setTimeMin(''); setTimeMax(''); setDayOfWeek('any'); setDoubleheader(null);
    setSeriesGame(null); setTrip(null); setSwitchGame(null); setRestRange([0, 10]);
    setStreakMin(''); setStreakMax(''); setLastResult('any'); setLastMarginMin(''); setLastMarginMax('');
    setSp([]); setOppSp([]); setSpHand('any'); setOppSpHand('any'); setSpXfip(null); setOppSpXfip(null);
    setBpIp(null); setBpXfip(null);
    setTempRange([30, 110]); setWindRange([0, 40]); setWindDir('any'); setDome(null); setPfRuns(null);
  };

  const chips = useMemo(() => {
    const c: { label: string; clear: () => void }[] = [];
    if (seasons[0] !== SEASON_FLOOR || seasons[1] !== SEASON_MAX) {
      c.push({ label: `Seasons ${seasons[0]}–${seasons[1]}`, clear: () => setSeasons([SEASON_FLOOR, SEASON_MAX]) });
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
    const t = TOTAL_CFG[betType];
    if (totalBounds && (totalBounds.min != null || totalBounds.max != null)) {
      const lo = totalBounds.min != null ? String(totalBounds.min) : '…';
      const hi = totalBounds.max != null ? String(totalBounds.max) : '…';
      c.push({ label: `${t?.label ?? 'Total'} ${lo}–${hi}`, clear: () => setTotalBounds(null) });
    } else if (t && (lineRange[0] !== t.min || lineRange[1] !== t.max)) {
      c.push({ label: `${t.label} ${lineRange[0]}–${lineRange[1]}`, clear: () => setLineRange([t.min, t.max]) });
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
    return c;
  }, [
    betType, seasons, months, teams, opponents, division, interleague, side, favDog, mlMin, mlMax, lineRange, totalBounds,
    timeMin, timeMax, dayOfWeek, doubleheader, seriesGame, trip, switchGame, restRange, streakMin, streakMax,
    lastResult, lastMarginMin, lastMarginMax, sp, oppSp, spHand, oppSpHand, spXfip, oppSpXfip, bpIp, bpXfip,
    tempRange, windRange, windDir, dome, pfRuns,
  ]);

  useEffect(() => {
    setLoading(true);
    const filters = buildFilters();
    const upcomingFilters = weatherOnlyUpcoming ? {} : filters;
    console.log('[mlb-analytics] mlb_analysis p_filters', JSON.stringify(filters));
    const t = setTimeout(async () => {
      const [a, u] = await Promise.all([
        collegeFootballSupabase.rpc('mlb_analysis', { p_bet_type: betType, p_filters: filters }),
        collegeFootballSupabase.rpc('mlb_analysis_upcoming', { p_bet_type: betType, p_filters: upcomingFilters }),
      ]);
      if (a.error) {
        console.error('[mlb-analytics] mlb_analysis error', a.error);
        setData(null);
      } else {
        setData(a.data as Analysis);
      }
      if (u.error) {
        console.error('[mlb-analytics] mlb_analysis_upcoming error', u.error);
        setUpcoming([]);
      } else {
        setUpcoming((u.data as Record<string, unknown>[]) || []);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
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

  const shownBars = useMemo(() => (data?.bars || []).filter(bar => {
    const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
    return total > 0 && bar.options.every(o => o && o.n > 0 && o.n / total >= 0.1);
  }), [data]);

  const isTotalMkt = TOTAL_MARKETS.has(betType);
  const subject = useMemo(() => {
    const parts: string[] = [];
    if (side !== 'any') parts.push(side === 'home' ? 'Home' : 'Road');
    if (favDog !== 'any') parts.push(favDog === 'favorite' ? 'favorites' : 'underdogs');
    if (teams.length === 1) return `${teams[0]}${parts.length ? ` (${parts.join(' ').toLowerCase()})` : ''}`;
    if (parts.length) return parts.join(' ').replace(/^\w/, c => c.toUpperCase());
    return isTotalMkt ? 'Games' : 'Teams';
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
        <div className={`xl:col-span-2 space-y-4 transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
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

          {!data ? <Skeleton className="h-20 w-full" /> : data.overall && cov && data.overall.n > 0 ? (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {data.overall.hit_pct >= 50
                    ? <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5" />
                    : <TrendingDown className="w-5 h-5 text-red-500 mt-0.5" />}
                  <div>
                    <p className="font-semibold leading-snug">
                      {subject} {VERB[betType]} <span className="text-primary">{data.overall.hit_pct}%</span>
                      {' '}<span className="text-sm font-normal text-muted-foreground">
                        ({data.overall.wins} of {data.overall.n} {nounFor()})
                      </span>
                      {betType === 'ml' && data.overall.roi != null && (
                        <> · <span className={data.overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {data.overall.roi >= 0 ? '+' : ''}{data.overall.roi}% ROI
                        </span></>
                      )}
                      {betType !== 'ml' && !NO_ROI_MARKETS.has(betType) && data.overall.roi != null && (
                        <> · <span className={data.overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {data.overall.roi >= 0 ? '+' : ''}{data.overall.roi}% ROI
                        </span></>
                      )}
                      {NO_ROI_MARKETS.has(betType) && (
                        <> · <RoiSlot roi={null} betType={betType} /></>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(data.overall.hit_pct - data.baseline_pct >= 0 ? '+' : '')}
                      {(data.overall.hit_pct - data.baseline_pct).toFixed(1)} pts vs the {data.baseline_pct}% baseline
                      · {significance(data.overall.n, data.overall.hit_pct).label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">{scopeNote}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No games match these filters — try widening them.</CardContent></Card>
          )}

          {data && shownBars.length > 0 && (
            <Card><CardContent className="py-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdown</div>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">The same {data.overall.n} {nounFor()}, split by situation.</p>
              </div>
              {shownBars.map((bar, i) => <ResultBar key={i} betType={betType} bar={bar} baseline={data.baseline_pct} />)}
            </CardContent></Card>
          )}

          {data && (
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
            {TOTAL_CFG[betType] && (
              <>
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
                          // Keep slider visually in sync without inventing the other RPC bound
                          const cfg = TOTAL_CFG[betType];
                          setLineRange([b.min ?? cfg.min, b.max ?? cfg.max]);
                        }}>
                        {b.label}
                      </Badge>
                    );
                  })}
                </div>
                <RangeRow label={`${TOTAL_CFG[betType].label}: ${lineRange[0]}–${lineRange[1]}`}
                  min={TOTAL_CFG[betType].min} max={TOTAL_CFG[betType].max} step={0.5}
                  value={lineRange}
                  onChange={(v) => { setTotalBounds(null); setLineRange(v); }} />
              </>
            )}
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

          <FilterSection title="Pitching Matchup">
            <PitcherTypeahead label="Team starter (SP)" selected={sp} onChange={setSp} />
            <PitcherTypeahead label="Opposing starter" selected={oppSp} onChange={setOppSp} />
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
  label, selected, onChange,
}: {
  label: string;
  selected: PitcherOpt[];
  onChange: (v: PitcherOpt[]) => void;
}) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<PitcherOpt[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { data } = await collegeFootballSupabase.rpc('mlb_pitcher_options', {
        p_q: q.trim() || null,
      });
      setOpts((data as PitcherOpt[]) || []);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const add = (p: PitcherOpt) => {
    if (selected.some(s => s.id === p.id)) return;
    onChange([...selected, p]);
    setQ('');
    setOpen(false);
  };
  const remove = (id: number) => onChange(selected.filter(s => s.id !== id));

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map(p => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1 text-[10px]">
              {p.name}{p.team ? ` (${p.team})` : ''}{p.hand ? ` · ${p.hand}` : ''}
              <button onClick={() => remove(p.id)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search pitchers…"
          className="h-9 pl-7 text-xs"
        />
        {open && opts.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {opts.slice(0, 40).map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between gap-2"
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
