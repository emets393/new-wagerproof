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
import { Textarea } from "@/components/ui/textarea";
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCFBTeamColors, getCFBTeamInitials } from '@/utils/teamColors';
import { normalizeCfbSavedFilterSnapshot, CFB_ASOF_DEFAULTS, type CfbWebFilterSnapshot } from '@/features/analysis/normalizeSavedFilterSnapshot';
import { CFB_SPORT_CONFIG, DEFAULT_CFB_SNAPSHOT, isSideSymmetricCfb } from '@/features/analysis/filterSchemaCfb';
import { applySportFilterPatch } from '@/features/analysis/sportFilterEngine';
import { rewriteCfbFavDogOps } from '@/features/analysis/cfbNlFavDogRewrite';
import { rewriteSpreadVsTtLineOps } from '@/features/analysis/rewriteSpreadVsTtLine';
import { NFL_DAYS } from '@/features/analysis/filterSchema';
import { TeamMultiSelect, type TeamOption } from '@/features/analysis/TeamMultiSelect';
import {
  FG_SPREAD_CFB, H1_SPREAD_CFB, FG_TOTAL_CFB, H1_TOTAL_CFB, TT_LINE_CFB,
  emitSpreadLine, emitTotalLine, emitMlOdds, emitWindRange, windLabel,
  type SpreadSide,
} from '@/features/analysis/footballMarketLines';

const NL_FILTER_EXAMPLES = [
  'Michigan as underdogs',
  'SEC home favorites laying 10+ in conference play',
  'make it the moneyline for Ohio State as a dog',
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

// signed last-game margin bounds (+ = won by, − = lost by); CFB blowouts run past 60
const MARGIN_BOUNDS = DEFAULT_CFB_SNAPSHOT.lastMargin;

// ── Bet-type spine — the FIRST choice; everything downstream speaks this one market ──
const BET_GROUPS = [
  { group: 'Full Game', items: [
    { key: 'fg_spread', label: 'Spread' }, { key: 'fg_ml', label: 'Moneyline' },
    { key: 'fg_total', label: 'Total' }, { key: 'team_total', label: 'Team Total' }] },
  { group: 'First Half', items: [
    { key: 'h1_spread', label: '1H Spread' }, { key: 'h1_ml', label: '1H Moneyline' },
    { key: 'h1_total', label: '1H Total' }] },
];
const ML_MARKETS = new Set(['fg_ml', 'h1_ml']);
const LIMITED_MARKETS = new Set(['h1_spread', 'h1_ml', 'h1_total', 'team_total']); // 2023+ only
const SEASON_MAX = 2025;
const WEEK_MAX = 16;

// Kept for subject headline only (result market ≠ filter lines).
const TOTAL_CFG: Record<string, { min: number; max: number; label: string }> = {
  fg_total: { min: 30, max: 80, label: 'Game total' },
  h1_total: { min: 15, max: 45, label: '1H total' },
  team_total: { min: 10, max: 55, label: 'Team total line' },
};

function conferenceHeadlineSubject(conferences: string[], situation: string): string {
  const names = conferences.join(', ');
  const base = `${names} schools`;
  return situation ? `${base} (${situation.toLowerCase()})` : base;
}

function conferenceScopeNote(conferences: string[], conferenceGame: boolean | null): string {
  if (conferences.length === 0) {
    return 'All FBS teams in every past game that matches your filters.';
  }
  const names = conferences.length === 1 ? conferences[0] : conferences.join(', ');
  if (conferenceGame === true) {
    return `${names} conference games only — matchups between schools in that conference.`;
  }
  if (conferenceGame === false) {
    return `${names} schools in non-conference games only.`;
  }
  if (conferences.length === 1) {
    return `Every game a ${names} school played — non-conference, bowls, and more. Not ${names}-only matchups.`;
  }
  return `Every game involving a ${names} school — non-conference, bowls, and more.`;
}

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

// CFB logo: cfb_team_mapping.api → logo, fetched on mount. Fallback = colored initials avatar.
function TeamAvatar({ team, logo, size = 24 }: { team?: string; logo?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) return <img src={logo} alt={team || ''} width={size} height={size} className="shrink-0 object-contain" onError={() => setFailed(true)} />;
  const c = getCFBTeamColors(team || '');
  return (
    <div className="shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
      style={{ width: size, height: size, backgroundColor: c.primary }}>{getCFBTeamInitials(team || '')}</div>
  );
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
  by_conference: { conference: string; n: number; hit_pct: number; roi: number | null }[];
};

// significance: sample size + deviation from break-even
function significance(n: number, hit: number): { label: string; tone: string } {
  const dev = Math.abs(hit - 50);
  if (n < 20) return { label: 'Thin sample', tone: 'bg-muted text-muted-foreground' };
  if (n >= 60 && dev >= 5) return { label: 'Strong', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (n >= 30 && dev >= 3) return { label: 'Solid', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
  return { label: 'Neutral', tone: 'bg-muted text-muted-foreground' };
}

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
  { label: 'Conference underdogs', betType: 'fg_spread', filters: { conferenceGame: true, spreadSide: 'underdog' } },
  { label: 'Non-conference unders', betType: 'fg_total', filters: { conferenceGame: false } },
  { label: 'Neutral-site games', betType: 'fg_spread', filters: { neutralSite: true } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', favDog: 'favorite', spreadSize: [10, 28] } },
];

const DIM_LABEL: Record<string, string> = { over_under: 'Over / Under', home_away: 'Home vs Away', fav_dog: 'Favorite vs Underdog' };

// ── Symmetric side-market hero ──────────────────────────────────────────────────────────────
// On the two-sided markets, mirror-row bookkeeping forces "all teams" to ~50% whenever only
// game-level filters are active (see isSideSymmetricCfb). Never headline that tautology — lead
// with the most extreme REAL side split instead.
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

function BreakdownTable({ betType, rows, keyName, logos }: { betType: string; rows: any[]; keyName: string; logos?: Record<string, string> }) {
  const [sort, setSort] = useState<'roi' | 'hit' | 'n'>('n');
  const sorted = useMemo(() => [...(rows || [])].sort((x, y) =>
    sort === 'n' ? y.n - x.n : sort === 'hit' ? y.hit_pct - x.hit_pct : (y.roi ?? -999) - (x.roi ?? -999)), [rows, sort]);
  const isTeam = keyName === 'team';
  const isML = ML_MARKETS.has(betType);
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
              {isTeam ? <TeamAvatar team={r.team} logo={logos?.[r.team]} /> : <div className="w-6 shrink-0" />}
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

export default function CFBAnalytics() {
  const [betType, setBetType] = useState('fg_spread');
  const [data, setData] = useState<Analysis | null>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [conferences, setConferences] = useState<string[]>([]);
  const [conferenceTeamMap, setConferenceTeamMap] = useState<Record<string, string[]>>({});

  // filter state (UI-shaped; translated to RPC keys in buildFilters)
  const [seasons, setSeasons] = useState<[number, number]>([2016, SEASON_MAX]);
  const [weeks, setWeeks] = useState<[number, number]>([1, WEEK_MAX]);
  const [side, setSide] = useState('any');
  const [favDog, setFavDog] = useState('any');
  const [gameType, setGameType] = useState('any'); // any | regular | bowl | playoff | postseason
  const [rankedMatchup, setRankedMatchup] = useState('any'); // any | both | neither | home_ranked | away_ranked | either
  const [spreadSide, setSpreadSide] = useState<SpreadSide>('any');
  const [spreadSize, setSpreadSize] = useState<[number, number]>([0, 50]);
  const [lineRange, setLineRange] = useState<[number, number]>([30, 80]);
  const [h1SpreadSide, setH1SpreadSide] = useState<SpreadSide>('any');
  const [h1SpreadSize, setH1SpreadSize] = useState<[number, number]>([0, 28]);
  const [h1TotalRange, setH1TotalRange] = useState<[number, number]>([15, 45]);
  const [ttLineRange, setTtLineRange] = useState<[number, number]>([10, 55]);
  const [mlMin, setMlMin] = useState<string>('');
  const [mlMax, setMlMax] = useState<string>('');
  const [h1MlMin, setH1MlMin] = useState('');
  const [h1MlMax, setH1MlMax] = useState('');
  const [oppSpreadSide, setOppSpreadSide] = useState<SpreadSide>('any');
  const [oppSpreadSize, setOppSpreadSize] = useState<[number, number]>([0, 50]);
  const [oppMlMin, setOppMlMin] = useState('');
  const [oppMlMax, setOppMlMax] = useState('');
  const [oppTtLineRange, setOppTtLineRange] = useState<[number, number]>([10, 55]);
  const [primetime, setPrimetime] = useState<boolean | null>(null);
  const [conferenceGame, setConferenceGame] = useState<boolean | null>(null);
  const [neutralSite, setNeutralSite] = useState<boolean | null>(null);
  const [selectedConferences, setSelectedConferences] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [tempRange, setTempRange] = useState<[number, number]>([-10, 110]);
  const [windRange, setWindRange] = useState<[number, number]>([0, 60]);
  const [weather, setWeather] = useState('any'); // any | clear | cloudy | rain | snow (CFBD weatherCondition)
  const [dome, setDome] = useState('any');        // any | dome | outdoor (CFBD gameIndoors)
  // "Last game" filters — each describes the team's PREVIOUS game (derived server-side via last_* columns)
  const [lastResult, setLastResult] = useState('any');   // won | lost
  const [lastAts, setLastAts] = useState('any');         // covered | not
  const [lastTotal, setLastTotal] = useState('any');     // over | under
  const [lastRole, setLastRole] = useState('any');       // favorite | underdog
  const [lastOt, setLastOt] = useState<boolean | null>(null);
  const [lastMargin, setLastMargin] = useState<[number, number]>(MARGIN_BOUNDS);
  // "Opponent last game" filters — the OPPONENT's previous game (opp_last_* columns)
  const [oppLastResult, setOppLastResult] = useState('any');
  const [oppLastAts, setOppLastAts] = useState('any');
  const [oppLastTotal, setOppLastTotal] = useState('any');
  const [oppLastRole, setOppLastRole] = useState('any');
  const [oppLastOt, setOppLastOt] = useState<boolean | null>(null);
  const [oppLastMargin, setOppLastMargin] = useState<[number, number]>(MARGIN_BOUNDS);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [restBye, setRestBye] = useState('any'); // any | off_bye | pre_bye | short

  // As-of Systems filters (season-to-date at game time) — mirrors NFL, CFB bounds
  const D = CFB_ASOF_DEFAULTS;
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
  const [oppLossStreak, setOppLossStreak] = useState<[number, number]>(D.oppLossStreak);
  const [oppPpg, setOppPpg] = useState<[number, number]>(D.oppPpg);
  const [oppPaPg, setOppPaPg] = useState<[number, number]>(D.oppPaPg);
  const [oppPrevWinPct, setOppPrevWinPct] = useState<[number, number]>(D.oppPrevWinPct);

  // saved filters (per authed user, main project)
  const { user } = useAuth();
  const [saved, setSaved] = useState<any[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  // NL filter chat (patches via nl-filter-patch → applySportFilterPatch → restore)
  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlTurns, setNlTurns] = useState<NlChatTurn[]>([]);
  const nlTurnId = React.useRef(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const snapshot = (): CfbWebFilterSnapshot => ({
    betType, seasons, weeks, side, favDog, gameType, rankedMatchup,
    spreadSide, spreadSize, lineRange, h1SpreadSide, h1SpreadSize, h1TotalRange, ttLineRange,
    mlMin, mlMax, h1MlMin, h1MlMax,
    oppSpreadSide, oppSpreadSize, oppMlMin, oppMlMax, oppTtLineRange,
    primetime, conferenceGame, neutralSite, selectedConferences, tempRange, windRange,
    weather, dome, restBye, lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin,
    teams, opponents, daysOfWeek,
    oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin,
    winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames,
    atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak,
    prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev,
    h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp,
    oppWinPct, oppOverPct, oppWinStreak, oppLossStreak, oppPpg, oppPaPg, oppPrevWinPct,
  });
  const restore = (raw: unknown, rowBetType?: string) => {
    const s = normalizeCfbSavedFilterSnapshot(
      raw as Record<string, unknown> | null | undefined,
      rowBetType,
    );
    setBetType(s.betType);
    setSeasons(s.seasons);
    setWeeks(s.weeks);
    setSide(s.side);
    setFavDog(s.favDog);
    setGameType(s.gameType);
    setRankedMatchup(s.rankedMatchup);
    setSpreadSide(s.spreadSide as SpreadSide);
    setH1SpreadSide(s.h1SpreadSide as SpreadSide);
    setOppSpreadSide(s.oppSpreadSide as SpreadSide);
    setPrimetime(s.primetime);
    setConferenceGame(s.conferenceGame);
    setNeutralSite(s.neutralSite);
    setSelectedConferences(s.selectedConferences);
    setTempRange(s.tempRange);
    setWindRange(s.windRange);
    setWeather(s.weather);
    setDome(s.dome);
    setMlMin(s.mlMin);
    setMlMax(s.mlMax);
    setH1MlMin(s.h1MlMin);
    setH1MlMax(s.h1MlMax);
    setOppMlMin(s.oppMlMin);
    setOppMlMax(s.oppMlMax);
    setRestBye(s.restBye);
    setLastResult(s.lastResult);
    setLastAts(s.lastAts);
    setLastTotal(s.lastTotal);
    setLastRole(s.lastRole);
    setLastOt(s.lastOt);
    setLastMargin(s.lastMargin);
    setOppLastResult(s.oppLastResult); setOppLastAts(s.oppLastAts); setOppLastTotal(s.oppLastTotal);
    setOppLastRole(s.oppLastRole); setOppLastOt(s.oppLastOt); setOppLastMargin(s.oppLastMargin);
    setTeams(s.teams);
    setOpponents(s.opponents);
    setDaysOfWeek(s.daysOfWeek);
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
    setOppWinStreak(s.oppWinStreak); setOppLossStreak(s.oppLossStreak);
    setOppPpg(s.oppPpg); setOppPaPg(s.oppPaPg); setOppPrevWinPct(s.oppPrevWinPct);
    setTimeout(() => {
      setSpreadSize(s.spreadSize);
      setLineRange(s.lineRange);
      setH1SpreadSize(s.h1SpreadSize);
      setH1TotalRange(s.h1TotalRange);
      setTtLineRange(s.ttLineRange);
      setOppSpreadSize(s.oppSpreadSize);
      setOppTtLineRange(s.oppTtLineRange);
    }, 0);
  };
  const loadSaved = useCallback(async () => {
    if (!user) { setSaved([]); return; }
    const { data } = await supabase.from('cfb_analysis_saved_filters').select('*').order('created_at', { ascending: false });
    setSaved(data || []);
  }, [user]);
  useEffect(() => { loadSaved(); }, [loadSaved]);
  const saveCurrent = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase.from('cfb_analysis_saved_filters')
      .insert({ user_id: user.id, name: saveName.trim(), bet_type: betType, filters: snapshot() });
    if (error) { alert(error.message); return; }
    setSaveName(''); setShowSave(false); loadSaved();
  };
  const deleteSaved = async (id: string) => { await supabase.from('cfb_analysis_saved_filters').delete().eq('id', id); loadSaved(); };

  const submitNlFilter = async (raw?: string) => {
    const sentence = (raw ?? nlInput).trim();
    if (!sentence || nlLoading || !user) return;
    setNlLoading(true);
    setNlInput('');
    const lines: string[] = [];
    try {
      const current = snapshot();
      const currentFilter: Record<string, unknown> = { betType: current.betType };
      for (const k of Object.keys(DEFAULT_CFB_SNAPSHOT) as Array<keyof typeof DEFAULT_CFB_SNAPSHOT>) {
        if (k === 'betType') continue;
        if (JSON.stringify(current[k as keyof CfbWebFilterSnapshot]) !== JSON.stringify(DEFAULT_CFB_SNAPSHOT[k])) {
          currentFilter[k] = current[k as keyof CfbWebFilterSnapshot];
        }
      }
      const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
        body: { sentence, currentFilter, sport: 'cfb' },
      });
      if (error || data?.error) {
        lines.push("Couldn't process that, try again.");
      } else {
        const rewrittenOps = rewriteCfbFavDogOps(
          String(current.betType),
          rewriteSpreadVsTtLineOps(sentence, data?.ops ?? [], { spreadMax: 50 }),
        );
        const result = applySportFilterPatch(CFB_SPORT_CONFIG, current, { ops: rewrittenOps });
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
  const seasonFloor = LIMITED_MARKETS.has(betType) ? 2023 : 2016;
  const isSpreadMkt = betType === 'fg_spread' || betType === 'h1_spread';
  const isMlMkt = betType === 'fg_ml' || betType === 'h1_ml';
  const isGameTotal = betType === 'fg_total' || betType === 'h1_total';
  const isTeamTotal = betType === 'team_total';
  useEffect(() => {
    if (seasons[0] < seasonFloor) setSeasons([seasonFloor, seasons[1]]);
  }, [betType]); // eslint-disable-line

  const buildFilters = useCallback(() => {
    const f: any = {};
    if (seasons[0] > seasonFloor) f.season_min = seasons[0];
    if (seasons[1] < SEASON_MAX) f.season_max = seasons[1];
    if (gameType !== 'any') f.game_type = gameType;
    if (rankedMatchup !== 'any') f.ranked_matchup = rankedMatchup;
    // weeks apply to regular-season games (1-16); bowls/playoffs sit at week 17, so a narrowed week
    // range naturally excludes them. Only hide/skip weeks when the filter is purely postseason.
    if (gameType === 'any' || gameType === 'regular') {
      if (weeks[0] > 1) f.week_min = weeks[0];
      if (weeks[1] < WEEK_MAX) f.week_max = weeks[1];
    }
    // Side is per-team; on a game total it returns 0 (away) or does nothing (home), so skip it there.
    if (side !== 'any' && !isGameTotal) f.side = side;
    if (teams.length) f.team = teams;
    if (opponents.length) f.opponent = opponents;
    if (daysOfWeek.length) f.day_of_week = daysOfWeek;
    // Cross-market lines — always emitted, independent of result market
    emitSpreadLine(f, spreadSide, spreadSize, FG_SPREAD_CFB);
    emitSpreadLine(f, h1SpreadSide, h1SpreadSize, H1_SPREAD_CFB);
    emitSpreadLine(f, oppSpreadSide, oppSpreadSize, FG_SPREAD_CFB, { invert: true });
    emitMlOdds(f, mlMin, mlMax);
    emitMlOdds(f, h1MlMin, h1MlMax, { min: 'h1_ml_min', max: 'h1_ml_max' });
    emitMlOdds(f, oppMlMin, oppMlMax, { min: 'opp_ml_min', max: 'opp_ml_max' });
    emitTotalLine(f, lineRange, FG_TOTAL_CFB);
    emitTotalLine(f, h1TotalRange, H1_TOTAL_CFB);
    emitTotalLine(f, ttLineRange, TT_LINE_CFB);
    emitTotalLine(f, oppTtLineRange, { ...TT_LINE_CFB, mk: 'opp_tt_min', xk: 'opp_tt_max' });
    if (favDog !== 'any' && (isMlMkt || isTeamTotal)) f.fav_dog = favDog;
    if (primetime !== null) f.primetime = primetime;
    if (conferenceGame !== null) f.conference_game = conferenceGame;
    if (neutralSite !== null) f.neutral_site = neutralSite;
    const picked = selectedConferences.filter(Boolean);
    // Explicit Team dropdown wins over conference→team expansion.
    if (!teams.length) {
      if (picked.length === 1) {
        f.conference = picked[0];
      } else if (picked.length > 1) {
        const confTeams = Array.from(new Set(picked.flatMap((c) => conferenceTeamMap[c] ?? []))).sort();
        if (confTeams.length > 0) f.team = confTeams;
      }
    } else if (picked.length === 1) {
      f.conference = picked[0];
    }
    if (tempRange[0] > -10) f.temp_min = tempRange[0];
    if (tempRange[1] < 110) f.temp_max = tempRange[1];
    emitWindRange(f, windRange);
    if (weather !== 'any') f.weather = weather;          // CFBD weatherCondition bucket
    if (dome !== 'any') f.dome = dome === 'dome';         // CFBD gameIndoors
    // Rest/Bye — CFB "short week" = a weekday game <7 days after a Saturday (rest_max 6, not NFL's 4)
    if (restBye === 'off_bye') f.rest_min = 13;
    else if (restBye === 'short') f.rest_max = 6;
    else if (restBye === 'pre_bye') f.pre_bye = true;
    // "Last game" filters — the team's previous game
    if (lastResult !== 'any') f.last_won = lastResult === 'won' ? 1 : 0;
    if (lastAts !== 'any') f.last_covered = lastAts === 'covered' ? 1 : 0;
    if (lastTotal !== 'any') f.last_over = lastTotal === 'over' ? 1 : 0;
    if (lastRole !== 'any') f.last_favorite = lastRole === 'favorite';
    if (lastOt !== null) f.last_overtime = lastOt;
    applyNumRange(f, 'last_margin', lastMargin, MARGIN_BOUNDS);
    if (oppLastResult !== 'any') f.opp_last_won = oppLastResult === 'won' ? 1 : 0;
    if (oppLastAts !== 'any') f.opp_last_covered = oppLastAts === 'covered' ? 1 : 0;
    if (oppLastTotal !== 'any') f.opp_last_over = oppLastTotal === 'over' ? 1 : 0;
    if (oppLastRole !== 'any') f.opp_last_favorite = oppLastRole === 'favorite';
    if (oppLastOt !== null) f.opp_last_overtime = oppLastOt;
    applyNumRange(f, 'opp_last_margin', oppLastMargin, MARGIN_BOUNDS);

    // As-of Systems filters — percents sent as 0–1 (see filterSchemaCfb rpcNotes)
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
    applyNumRange(f, 'opp_loss_streak', oppLossStreak, D.oppLossStreak);
    applyNumRange(f, 'opp_ppg', oppPpg, D.oppPpg);
    applyNumRange(f, 'opp_pa_pg', oppPaPg, D.oppPaPg);
    applyPctRange(f, 'opp_prev_win_pct', oppPrevWinPct);
    return f;
  }, [betType, seasons, weeks, side, teams, opponents, daysOfWeek, favDog, gameType, rankedMatchup, spreadSide, spreadSize, lineRange, h1SpreadSide, h1SpreadSize, h1TotalRange, ttLineRange, mlMin, mlMax, h1MlMin, h1MlMax, oppSpreadSide, oppSpreadSize, oppMlMin, oppMlMax, oppTtLineRange, primetime, conferenceGame, neutralSite, selectedConferences, conferenceTeamMap, tempRange, windRange, weather, dome, restBye, lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin, seasonFloor, isGameTotal, isMlMkt, isTeamTotal, winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames, atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak, prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev, h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp, oppWinPct, oppOverPct, oppWinStreak, oppLossStreak, oppPpg, oppPaPg, oppPrevWinPct]);

  const resetAll = () => {
    setSeasons([seasonFloor, SEASON_MAX]); setWeeks([1, WEEK_MAX]); setSide('any'); setFavDog('any'); setGameType('any'); setRankedMatchup('any');
    setTeams([]); setOpponents([]);
    setSpreadSide('any'); setSpreadSize([0, 50]); setLineRange([30, 80]);
    setH1SpreadSide('any'); setH1SpreadSize([0, 28]); setH1TotalRange([15, 45]); setTtLineRange([10, 55]);
    setMlMin(''); setMlMax(''); setH1MlMin(''); setH1MlMax('');
    setOppSpreadSide('any'); setOppSpreadSize([0, 50]); setOppMlMin(''); setOppMlMax(''); setOppTtLineRange([10, 55]);
    setPrimetime(null); setConferenceGame(null); setNeutralSite(null); setSelectedConferences([]);
    setTempRange([-10, 110]); setWindRange([0, 60]); setWeather('any'); setDome('any');
    setDaysOfWeek([]); setRestBye('any');
    setLastResult('any'); setLastAts('any'); setLastTotal('any'); setLastRole('any'); setLastOt(null); setLastMargin(MARGIN_BOUNDS);
    setOppLastResult('any'); setOppLastAts('any'); setOppLastTotal('any'); setOppLastRole('any'); setOppLastOt(null); setOppLastMargin(MARGIN_BOUNDS);
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
    setOppWinStreak(D.oppWinStreak); setOppLossStreak(D.oppLossStreak);
    setOppPpg(D.oppPpg); setOppPaPg(D.oppPaPg); setOppPrevWinPct(D.oppPrevWinPct);
  };

  // active (non-default) filters as removable chips — makes a stuck filter visible
  const chips = useMemo(() => {
    const c: { label: string; clear: () => void }[] = [];
    if (seasons[0] !== seasonFloor || seasons[1] !== SEASON_MAX) c.push({ label: `Seasons ${seasons[0]}–${seasons[1]}`, clear: () => setSeasons([seasonFloor, SEASON_MAX]) });
    if (gameType !== 'any') c.push({ label: ({ regular: 'Regular season', bowl: 'Bowl games', playoff: 'Playoff', postseason: 'All postseason' } as Record<string, string>)[gameType], clear: () => setGameType('any') });
    if (rankedMatchup !== 'any') c.push({ label: ({ both: 'Both ranked', neither: 'Neither ranked', home_ranked: 'Home ranked / away unranked', away_ranked: 'Away ranked / home unranked', either: 'Either ranked' } as Record<string, string>)[rankedMatchup], clear: () => setRankedMatchup('any') });
    if ((gameType === 'any' || gameType === 'regular') && (weeks[0] !== 1 || weeks[1] !== WEEK_MAX)) c.push({ label: `Weeks ${weeks[0]}–${weeks[1]}`, clear: () => setWeeks([1, WEEK_MAX]) });
    if (side !== 'any' && !isGameTotal) c.push({ label: side === 'home' ? 'Home' : 'Away', clear: () => setSide('any') });
    if (teams.length) c.push({ label: `Team: ${teams.join(', ')}`, clear: () => setTeams([]) });
    if (opponents.length) c.push({ label: `Opp: ${opponents.join(', ')}`, clear: () => setOpponents([]) });
    if (daysOfWeek.length) c.push({ label: `Days: ${daysOfWeek.join(', ')}`, clear: () => setDaysOfWeek([]) });
    if ((isMlMkt || isTeamTotal) && favDog !== 'any') c.push({ label: favDog === 'favorite' ? 'Favorites' : 'Underdogs', clear: () => setFavDog('any') });
    const pushSpreadChip = (
      label: string, side: SpreadSide, size: [number, number], max: number,
      clearSide: () => void, clearSize: () => void,
    ) => {
      if (side !== 'any') c.push({ label: `${label} ${side === 'favorite' ? 'fav' : 'dog'} ${size[0]}–${size[1]}`, clear: () => { clearSide(); clearSize(); } });
      else if (size[0] !== 0 || size[1] !== max) c.push({ label: `${label} ${size[0]}–${size[1]}`, clear: clearSize });
    };
    pushSpreadChip('FG spread', spreadSide, spreadSize, 50, () => setSpreadSide('any'), () => setSpreadSize([0, 50]));
    pushSpreadChip('1H spread', h1SpreadSide, h1SpreadSize, 28, () => setH1SpreadSide('any'), () => setH1SpreadSize([0, 28]));
    pushSpreadChip('Opp FG spread', oppSpreadSide, oppSpreadSize, 50, () => setOppSpreadSide('any'), () => setOppSpreadSize([0, 50]));
    if (rangeChanged(lineRange, [30, 80])) c.push({ label: `Game total ${lineRange[0]}–${lineRange[1]}`, clear: () => setLineRange([30, 80]) });
    if (rangeChanged(h1TotalRange, [15, 45])) c.push({ label: `1H total ${h1TotalRange[0]}–${h1TotalRange[1]}`, clear: () => setH1TotalRange([15, 45]) });
    if (rangeChanged(ttLineRange, [10, 55])) c.push({ label: `TT ${ttLineRange[0]}–${ttLineRange[1]}`, clear: () => setTtLineRange([10, 55]) });
    if (rangeChanged(oppTtLineRange, [10, 55])) c.push({ label: `Opp TT ${oppTtLineRange[0]}–${oppTtLineRange[1]}`, clear: () => setOppTtLineRange([10, 55]) });
    if (mlMin.trim() !== '' || mlMax.trim() !== '') {
      const fmt = (s: string) => { const n = Number(s); return n > 0 ? `+${n}` : `${n}`; };
      const lbl = mlMin.trim() !== '' && mlMax.trim() !== '' ? `ML ${fmt(mlMin)} to ${fmt(mlMax)}` : mlMin.trim() !== '' ? `ML ≥ ${fmt(mlMin)}` : `ML ≤ ${fmt(mlMax)}`;
      c.push({ label: lbl, clear: () => { setMlMin(''); setMlMax(''); } });
    }
    if (h1MlMin.trim() !== '' || h1MlMax.trim() !== '') {
      const fmt = (s: string) => { const n = Number(s); return n > 0 ? `+${n}` : `${n}`; };
      const lbl = h1MlMin.trim() && h1MlMax.trim() ? `1H ML ${fmt(h1MlMin)}–${fmt(h1MlMax)}` : h1MlMin.trim() ? `1H ML ≥ ${fmt(h1MlMin)}` : `1H ML ≤ ${fmt(h1MlMax)}`;
      c.push({ label: lbl, clear: () => { setH1MlMin(''); setH1MlMax(''); } });
    }
    if (oppMlMin.trim() !== '' || oppMlMax.trim() !== '') {
      const fmt = (s: string) => { const n = Number(s); return n > 0 ? `+${n}` : `${n}`; };
      const lbl = oppMlMin.trim() && oppMlMax.trim() ? `Opp ML ${fmt(oppMlMin)}–${fmt(oppMlMax)}` : oppMlMin.trim() ? `Opp ML ≥ ${fmt(oppMlMin)}` : `Opp ML ≤ ${fmt(oppMlMax)}`;
      c.push({ label: lbl, clear: () => { setOppMlMin(''); setOppMlMax(''); } });
    }
    if (primetime !== null) c.push({ label: `Primetime: ${primetime ? 'Yes' : 'No'}`, clear: () => setPrimetime(null) });
    if (conferenceGame !== null) c.push({ label: `Conference game: ${conferenceGame ? 'Yes' : 'No'}`, clear: () => setConferenceGame(null) });
    if (neutralSite !== null) c.push({ label: `Neutral site: ${neutralSite ? 'Yes' : 'No'}`, clear: () => setNeutralSite(null) });
    for (const conf of selectedConferences) {
      c.push({
        label: conf,
        clear: () => setSelectedConferences((prev) => prev.filter((x) => x !== conf)),
      });
    }
    if (weather !== 'any') c.push({ label: `Weather: ${({ clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow' } as Record<string, string>)[weather]}`, clear: () => setWeather('any') });
    if (dome !== 'any') c.push({ label: dome === 'dome' ? 'Indoors / dome' : 'Outdoors', clear: () => setDome('any') });
    if (tempRange[0] !== -10 || tempRange[1] !== 110) c.push({ label: `Temp ${tempRange[0]}–${tempRange[1]}°F`, clear: () => setTempRange([-10, 110]) });
    if (windLabel(windRange)) c.push({ label: windLabel(windRange)!, clear: () => setWindRange([0, 60]) });
    if (restBye !== 'any') c.push({ label: ({ off_bye: 'Off a bye', pre_bye: 'Before a bye', short: 'Short week' } as Record<string, string>)[restBye] || restBye, clear: () => setRestBye('any') });
    if (lastResult !== 'any') c.push({ label: `Last game: ${lastResult === 'won' ? 'Won' : 'Lost'}`, clear: () => setLastResult('any') });
    if (lastAts !== 'any') c.push({ label: `Last game: ${lastAts === 'covered' ? 'Covered' : "Didn't cover"}`, clear: () => setLastAts('any') });
    if (lastTotal !== 'any') c.push({ label: `Last game: ${lastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setLastTotal('any') });
    if (lastRole !== 'any') c.push({ label: `Last game: ${lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setLastRole('any') });
    if (lastOt !== null) c.push({ label: `Last game OT: ${lastOt ? 'Yes' : 'No'}`, clear: () => setLastOt(null) });
    if (rangeChanged(lastMargin, MARGIN_BOUNDS)) c.push({ label: `Last game margin ${lastMargin[0]} to ${lastMargin[1]}`, clear: () => setLastMargin(MARGIN_BOUNDS) });
    if (oppLastResult !== 'any') c.push({ label: `Opp last game: ${oppLastResult === 'won' ? 'Won' : 'Lost'}`, clear: () => setOppLastResult('any') });
    if (oppLastAts !== 'any') c.push({ label: `Opp last game: ${oppLastAts === 'covered' ? 'Covered' : "Didn't cover"}`, clear: () => setOppLastAts('any') });
    if (oppLastTotal !== 'any') c.push({ label: `Opp last game: ${oppLastTotal === 'over' ? 'Over' : 'Under'}`, clear: () => setOppLastTotal('any') });
    if (oppLastRole !== 'any') c.push({ label: `Opp last game: ${oppLastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, clear: () => setOppLastRole('any') });
    if (oppLastOt !== null) c.push({ label: `Opp last game OT: ${oppLastOt ? 'Yes' : 'No'}`, clear: () => setOppLastOt(null) });
    if (rangeChanged(oppLastMargin, MARGIN_BOUNDS)) c.push({ label: `Opp last game margin ${oppLastMargin[0]} to ${oppLastMargin[1]}`, clear: () => setOppLastMargin(MARGIN_BOUNDS) });
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
    if (madePlayoffsPrev !== null) c.push({ label: madePlayoffsPrev ? 'Made bowl/playoff last yr' : 'No bowl/playoff last yr', clear: () => setMadePlayoffsPrev(null) });
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
    if (rangeChanged(oppLossStreak, D.oppLossStreak)) c.push({ label: `Opp loss streak ${oppLossStreak[0]}–${oppLossStreak[1]}`, clear: () => setOppLossStreak(D.oppLossStreak) });
    if (rangeChanged(oppPpg, D.oppPpg)) c.push({ label: `Opp PPG ${oppPpg[0]}–${oppPpg[1]}`, clear: () => setOppPpg(D.oppPpg) });
    if (rangeChanged(oppPaPg, D.oppPaPg)) c.push({ label: `Opp PA/G ${oppPaPg[0]}–${oppPaPg[1]}`, clear: () => setOppPaPg(D.oppPaPg) });
    if (rangeChanged(oppPrevWinPct, D.oppPrevWinPct)) c.push({ label: `Opp prev win% ${oppPrevWinPct[0]}–${oppPrevWinPct[1]}`, clear: () => setOppPrevWinPct(D.oppPrevWinPct) });
    return c;
  }, [betType, seasons, weeks, side, teams, opponents, daysOfWeek, favDog, gameType, rankedMatchup, spreadSide, spreadSize, lineRange, h1SpreadSide, h1SpreadSize, h1TotalRange, ttLineRange, mlMin, mlMax, h1MlMin, h1MlMax, oppSpreadSide, oppSpreadSize, oppMlMin, oppMlMax, oppTtLineRange, primetime, conferenceGame, neutralSite, selectedConferences, tempRange, windRange, weather, dome, restBye, lastResult, lastAts, lastTotal, lastRole, lastOt, lastMargin, oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin, seasonFloor, isGameTotal, isMlMkt, isTeamTotal, winPct, winStreak, lossStreak, above500, winPctGtOpp, ppg, paPg, pointDiffPg, minGames, atsWinPct, atsWinStreak, avgCoverMargin, overPct, overStreak, underStreak, prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev, h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav, h2hSameSeason, h2hSpreadCmp, oppWinPct, oppOverPct, oppWinStreak, oppLossStreak, oppPpg, oppPaPg, oppPrevWinPct]);

  // load logo map, conference list, and conference→team map once
  useEffect(() => {
    collegeFootballSupabase.from('cfb_team_mapping').select('api,logo_light,logo_dark').then(({ data }) => {
      if (data) setLogos(Object.fromEntries(data.filter((t: any) => t.api && t.logo_light).map((t: any) => [t.api, t.logo_light])));
    });
    collegeFootballSupabase.from('cfb_teams').select('team_name,conference').then(({ data }) => {
      if (!data) return;
      const map: Record<string, string[]> = {};
      for (const row of data as { team_name: string; conference: string | null }[]) {
        if (!row.conference) continue;
        (map[row.conference] ??= []).push(row.team_name);
      }
      for (const key of Object.keys(map)) map[key].sort();
      setConferenceTeamMap(map);
      setTeamOptions(
        Array.from(new Set((data as { team_name: string }[]).map((r) => r.team_name).filter(Boolean)))
          .sort()
          .map((name) => ({ id: name, name })),
      );
    });
    collegeFootballSupabase.rpc('cfb_analysis', { p_bet_type: 'fg_spread', p_filters: {} }).then(({ data }) => {
      if (data) setConferences((data.by_conference || []).map((c: any) => c.conference).filter(Boolean).sort());
    });
  }, []);

  // fetch on any change (debounced)
  useEffect(() => {
    setLoading(true);
    const filters = buildFilters();
    const t = setTimeout(async () => {
      const [a, u] = await Promise.all([
        collegeFootballSupabase.rpc('cfb_analysis', { p_bet_type: betType, p_filters: filters }),
        collegeFootballSupabase.rpc('cfb_analysis_upcoming', { p_bet_type: betType, p_filters: filters }),
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
    setPrimetime(f.primetime ?? null); setConferenceGame(f.conferenceGame ?? null); setNeutralSite(f.neutralSite ?? null);
    if (f.spreadSize) setSpreadSize(f.spreadSize);
  };

  // Two-sided-market tautology guard: with only game-level filters, "all teams" is forced ~50% —
  // lead with the real side splits instead (see filterSchemaCfb.isSideSymmetricCfb).
  const symmetricSlices = data && isSideSymmetricCfb(snapshot())
    ? (() => { const sl = pickSideSlices(data.bars); return sl.length ? sl : null; })()
    : null;
  const focusSide = (dimension: string, sideVal: string) => {
    if (dimension === 'home_away') setSide(sideVal);
    // fav/dog lives on spreadSide for spread markets, favDog for ML markets (CFB ML has no spread control)
    else if (dimension === 'fav_dog') { if (isSpreadMkt) setSpreadSide(sideVal); else setFavDog(sideVal); }
  };

  // Secondary context splits — only genuine two-sided comparisons (≥10% each side). When the
  // symmetric split hero already owns home_away + fav_dog, drop those from the breakdown.
  const shownBars = useMemo(() => {
    const hideSide = !!symmetricSlices;
    return (data?.bars || []).filter(bar => {
      if (hideSide && (bar.dimension === 'home_away' || bar.dimension === 'fav_dog')) return false;
      const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
      return total > 0 && bar.options.every(o => o && o.n > 0 && o.n / total >= 0.1);
    });
  }, [data, symmetricSlices]);
  // plain-English subject for the headline, built from the active filters (never empty/degenerate)
  const isTotalMkt = !!TOTAL_CFG[betType] && betType !== 'team_total';
  const subject = useMemo(() => {
    const parts: string[] = [];
    if (side !== 'any' && !isGameTotal) parts.push(side === 'home' ? 'Home' : 'Road');
    const dir = isSpreadMkt ? spreadSide : ((isMlMkt || isTeamTotal) ? favDog : 'any');
    if (dir && dir !== 'any') parts.push(dir === 'favorite' ? 'favorites' : 'underdogs');
    const situation = parts.join(' ');
    if (selectedConferences.length > 0) {
      return conferenceHeadlineSubject(selectedConferences, situation);
    }
    if (situation) return situation.charAt(0).toUpperCase() + situation.slice(1);
    return isTotalMkt ? 'Games' : 'Teams';
  }, [betType, side, spreadSide, favDog, selectedConferences, isTotalMkt, isGameTotal, isSpreadMkt, isMlMkt, isTeamTotal]);

  const scopeNote = useMemo(
    () => conferenceScopeNote(selectedConferences, conferenceGame),
    [selectedConferences, conferenceGame],
  );

  const cov = data?.coverage;
  const limited = LIMITED_MARKETS.has(betType);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">CFB Historical Analysis</h1>
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
                      placeholder='e.g. "SEC home favorites laying 10+ in conference play"'
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
          {/* coverage readout */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              {cov ? `Based on ${cov.n_games} games, ${cov.season_min}–${cov.season_max}` : loading ? 'Loading…' : 'No games match'}
            </Badge>
            {limited && <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">Limited history (2023+)</Badge>}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* Hero verdict — side-symmetric → extreme split; else big single hit-rate */}
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
                      {data.overall.roi != null && (
                        <span className={`text-lg font-semibold tabular-nums ${data.overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {data.overall.roi >= 0 ? '+' : ''}{data.overall.roi}% ROI
                        </span>
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

          {/* Breakdowns — progressive disclosure; collapsed by default (NFL parity) */}
          {data && (shownBars.length > 0 || data.by_team?.length || data.by_conference?.length) && (
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
                      <TabsTrigger value="conf">By Conference</TabsTrigger>
                    </TabsList>
                    <TabsContent value="team"><BreakdownTable betType={betType} rows={data.by_team} keyName="team" logos={logos} /></TabsContent>
                    <TabsContent value="conf"><BreakdownTable betType={betType} rows={data.by_conference} keyName="conference" /></TabsContent>
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
                      <TeamAvatar team={g.team} logo={logos[g.team]} />
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

        {/* ── FILTERS ── */}
        <div className="xl:sticky xl:top-4 h-fit space-y-3">
          <Card><CardContent className="py-4 space-y-4">
            <div className="text-sm font-semibold">Situation</div>
            <RangeRow label={`Seasons: ${seasons[0]}–${seasons[1]}`} min={seasonFloor} max={SEASON_MAX} step={1} value={seasons} onChange={setSeasons} />
            <SelectRow label="Game type" value={gameType} onChange={setGameType}
              options={[['any', 'All games'], ['regular', 'Regular season'], ['bowl', 'Bowl games'], ['playoff', 'Playoff'], ['postseason', 'All postseason']]} />
            {(gameType === 'any' || gameType === 'regular') && (
              <RangeRow label={`Weeks: ${weeks[0]}–${weeks[1]}`} min={1} max={WEEK_MAX} step={1} value={weeks} onChange={setWeeks} />
            )}
            <SelectRow label="Ranked matchup" value={rankedMatchup} onChange={setRankedMatchup}
              options={[['any', 'Any'], ['both', 'Both ranked'], ['neither', 'Neither ranked'], ['home_ranked', 'Home ranked, away unranked'], ['away_ranked', 'Away ranked, home unranked'], ['either', 'Either ranked']]} />
            {!isGameTotal && (
              <SelectRow label="Side" value={side} onChange={setSide} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
            )}
            <TeamMultiSelect label="Team" options={teamOptions} value={teams} onChange={setTeams} />
            <TeamMultiSelect label="Opponent" options={teamOptions} value={opponents} onChange={setOpponents} emptyLabel="Any opponent" />
            <MultiToggle label="Days of week" options={NFL_DAYS} value={daysOfWeek} onChange={setDaysOfWeek} />
            {(isMlMkt || isTeamTotal) && (
              <SelectRow label="Favorite / Underdog" value={favDog} onChange={setFavDog} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
            )}
            <TriRow label="Primetime (7pm+ ET)" value={primetime} onChange={setPrimetime} />
            <TriRow label="Conference game" value={conferenceGame} onChange={setConferenceGame} />
            <TriRow label="Neutral site" value={neutralSite} onChange={setNeutralSite} />
            <SelectRow label="Rest / Bye" value={restBye} onChange={setRestBye}
              options={[['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short week (<7 days)']]} />
          </CardContent></Card>

          <FilterSection title="Lines & odds" defaultOpen>
            <div className="text-[11px] text-muted-foreground -mt-1">Independent of the result market above — filter the sample by any posted line.</div>
            <SelectRow label="FG spread (team)" value={spreadSide} onChange={(v: string) => setSpreadSide(v as SpreadSide)}
              options={[['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']]} />
            <RangeRow label={`${spreadSide === 'favorite' ? 'Favored by' : spreadSide === 'underdog' ? 'Getting' : 'FG spread'}: ${spreadSize[0]}–${spreadSize[1]} pts`}
              min={0} max={50} step={0.5} value={spreadSize} onChange={setSpreadSize} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">FG moneyline (team, American)</div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={mlMin} onChange={e => setMlMin(e.target.value)} placeholder="min e.g. -200" className="h-9" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="number" inputMode="numeric" value={mlMax} onChange={e => setMlMax(e.target.value)} placeholder="max e.g. -120" className="h-9" />
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">CFB moneyline odds cover 2021+.</p>
            </div>
            <RangeRow label={`Game total: ${lineRange[0]}–${lineRange[1]}`} min={30} max={80} step={0.5} value={lineRange} onChange={setLineRange} />
            <RangeRow label={`Team total line: ${ttLineRange[0]}–${ttLineRange[1]}`} min={10} max={55} step={0.5} value={ttLineRange} onChange={setTtLineRange} />
            <SelectRow label="1H spread (team)" value={h1SpreadSide} onChange={(v: string) => setH1SpreadSide(v as SpreadSide)}
              options={[['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']]} />
            <RangeRow label={`${h1SpreadSide === 'favorite' ? '1H favored by' : h1SpreadSide === 'underdog' ? '1H getting' : '1H spread'}: ${h1SpreadSize[0]}–${h1SpreadSize[1]} pts`}
              min={0} max={28} step={0.5} value={h1SpreadSize} onChange={setH1SpreadSize} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">1H moneyline (team, American)</div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={h1MlMin} onChange={e => setH1MlMin(e.target.value)} placeholder="min" className="h-9" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="number" inputMode="numeric" value={h1MlMax} onChange={e => setH1MlMax(e.target.value)} placeholder="max" className="h-9" />
              </div>
            </div>
            <RangeRow label={`1H total: ${h1TotalRange[0]}–${h1TotalRange[1]}`} min={15} max={45} step={0.5} value={h1TotalRange} onChange={setH1TotalRange} />
            <SelectRow label="FG spread (opponent)" value={oppSpreadSide} onChange={(v: string) => setOppSpreadSide(v as SpreadSide)}
              options={[['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']]} />
            <RangeRow label={`${oppSpreadSide === 'favorite' ? 'Opp favored by' : oppSpreadSide === 'underdog' ? 'Opp getting' : 'Opp FG spread'}: ${oppSpreadSize[0]}–${oppSpreadSize[1]} pts`}
              min={0} max={50} step={0.5} value={oppSpreadSize} onChange={setOppSpreadSize} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">FG moneyline (opponent, American)</div>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" value={oppMlMin} onChange={e => setOppMlMin(e.target.value)} placeholder="min" className="h-9" />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input type="number" inputMode="numeric" value={oppMlMax} onChange={e => setOppMlMax(e.target.value)} placeholder="max" className="h-9" />
              </div>
            </div>
            <RangeRow label={`Opp team total: ${oppTtLineRange[0]}–${oppTtLineRange[1]}`} min={10} max={55} step={0.5} value={oppTtLineRange} onChange={setOppTtLineRange} />
          </FilterSection>

          <FilterSection title="Game conditions">
            <SelectRow label="Weather" value={weather} onChange={setWeather}
              options={[['any', 'Any'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']]} />
            <SelectRow label="Venue" value={dome} onChange={setDome} options={[['any', 'Any'], ['dome', 'Dome / indoors'], ['outdoor', 'Outdoors']]} />
            <RangeRow label={`Temp: ${tempRange[0]}–${tempRange[1]}°F`} min={-10} max={110} step={1} value={tempRange} onChange={setTempRange} />
            <RangeRow label={`Wind: ${windRange[0]}–${windRange[1]} mph`} min={0} max={60} step={1} value={windRange} onChange={setWindRange} />
            <p className="text-[10px] text-muted-foreground/70">Weather conditions are complete for 2022+, partial for 2018–2021, and sparse in 2016–2017.</p>
          </FilterSection>

          <FilterSection title="Conference">
            <ConferenceMultiSelect
              conferences={conferences}
              selected={selectedConferences}
              onToggle={(name) => {
                setSelectedConferences((prev) => {
                  if (prev.includes(name)) return prev.filter((c) => c !== name);
                  return [...prev, name].sort();
                });
              }}
              onClear={() => setSelectedConferences([])}
            />
          </FilterSection>

          <FilterSection title="Last game">
            <SelectRow label="Result" value={lastResult} onChange={setLastResult} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="ATS" value={lastAts} onChange={setLastAts} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Total" value={lastTotal} onChange={setLastTotal} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Was" value={lastRole} onChange={setLastRole} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <RangeRow label={`Last game margin: ${lastMargin[0]} to ${lastMargin[1]} pts (+ = won by, − = lost by)`} min={MARGIN_BOUNDS[0]} max={MARGIN_BOUNDS[1]} step={1} value={lastMargin} onChange={setLastMargin} />
            <TriRow label="Went to overtime" value={lastOt} onChange={setLastOt} />
          </FilterSection>

          <FilterSection title="Opponent last game">
            <SelectRow label="Result" value={oppLastResult} onChange={setOppLastResult} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
            <SelectRow label="ATS" value={oppLastAts} onChange={setOppLastAts} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
            <SelectRow label="Total" value={oppLastTotal} onChange={setOppLastTotal} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
            <SelectRow label="Was" value={oppLastRole} onChange={setOppLastRole} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
            <RangeRow label={`Opponent last game margin: ${oppLastMargin[0]} to ${oppLastMargin[1]} pts (+ = won by, − = lost by)`} min={MARGIN_BOUNDS[0]} max={MARGIN_BOUNDS[1]} step={1} value={oppLastMargin} onChange={setOppLastMargin} />
            <TriRow label="Went to overtime" value={oppLastOt} onChange={setOppLastOt} />
          </FilterSection>

          <FilterSection title="Season Record">
            <RangeRow label={`Win%: ${winPct[0]}–${winPct[1]}%`} min={0} max={100} step={1} value={winPct} onChange={setWinPct} />
            <RangeRow label={`Win streak: ${winStreak[0]}–${winStreak[1]}`} min={0} max={16} step={1} value={winStreak} onChange={setWinStreak} />
            <RangeRow label={`Loss streak: ${lossStreak[0]}–${lossStreak[1]}`} min={0} max={16} step={1} value={lossStreak} onChange={setLossStreak} />
            <TriRow label="Winning record (>.500)" value={above500} onChange={setAbove500} />
            <TriRow label="Win% better than opponent" value={winPctGtOpp} onChange={setWinPctGtOpp} />
            <RangeRow label={`PPG: ${ppg[0]}–${ppg[1]}`} min={0} max={60} step={0.5} value={ppg} onChange={setPpg} />
            <RangeRow label={`PA/g: ${paPg[0]}–${paPg[1]}`} min={0} max={60} step={0.5} value={paPg} onChange={setPaPg} />
            <RangeRow label={`Point diff/g: ${pointDiffPg[0]}–${pointDiffPg[1]}`} min={-40} max={40} step={0.5} value={pointDiffPg} onChange={setPointDiffPg} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Min games this season: {minGames === 0 ? 'Any' : minGames}</div>
              <Slider min={0} max={10} step={1} value={[minGames]} onValueChange={([v]) => setMinGames(v)} />
            </div>
          </FilterSection>

          <FilterSection title="Cover Profile">
            <RangeRow label={`ATS win%: ${atsWinPct[0]}–${atsWinPct[1]}%`} min={0} max={100} step={1} value={atsWinPct} onChange={setAtsWinPct} />
            <RangeRow label={`ATS win streak: ${atsWinStreak[0]}–${atsWinStreak[1]}`} min={0} max={16} step={1} value={atsWinStreak} onChange={setAtsWinStreak} />
            <RangeRow label={`Avg cover margin: ${avgCoverMargin[0]}–${avgCoverMargin[1]}`} min={-30} max={30} step={0.5} value={avgCoverMargin} onChange={setAvgCoverMargin} />
          </FilterSection>

          <FilterSection title="Total Profile">
            <RangeRow label={`Over%: ${overPct[0]}–${overPct[1]}%`} min={0} max={100} step={1} value={overPct} onChange={setOverPct} />
            <RangeRow label={`Over streak: ${overStreak[0]}–${overStreak[1]}`} min={0} max={16} step={1} value={overStreak} onChange={setOverStreak} />
            <RangeRow label={`Under streak: ${underStreak[0]}–${underStreak[1]}`} min={0} max={16} step={1} value={underStreak} onChange={setUnderStreak} />
          </FilterSection>

          <FilterSection title="Prior Year">
            <RangeRow label={`Last season wins: ${prevWins[0]}–${prevWins[1]}`} min={0} max={15} step={1} value={prevWins} onChange={setPrevWins} />
            <RangeRow label={`Last season win%: ${prevWinPct[0]}–${prevWinPct[1]}%`} min={0} max={100} step={1} value={prevWinPct} onChange={setPrevWinPct} />
            <TriRow label="Made a bowl/playoff last year" value={madePlayoffsPrev} onChange={setMadePlayoffsPrev} />
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
            <RangeRow label={`Opp loss streak: ${oppLossStreak[0]}–${oppLossStreak[1]}`} min={0} max={16} step={1} value={oppLossStreak} onChange={setOppLossStreak} />
            <RangeRow label={`Opp PPG: ${oppPpg[0]}–${oppPpg[1]}`} min={0} max={60} step={0.5} value={oppPpg} onChange={setOppPpg} />
            <RangeRow label={`Opp PA/G: ${oppPaPg[0]}–${oppPaPg[1]}`} min={0} max={60} step={0.5} value={oppPaPg} onChange={setOppPaPg} />
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
function ConferenceMultiSelect({
  conferences,
  selected,
  onToggle,
  onClear,
}: {
  conferences: string[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0 ? 'All conferences' : `${selected.length} selected`}
        </span>
        {selected.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
        {conferences.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => onToggle(name)}
              className="rounded border-border"
            />
            <span className="text-sm">{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
function FilterSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <Card><CardContent className="py-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold">
        {title}<ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">{children}</CollapsibleContent>
    </CardContent></Card>
  </Collapsible>;
}
