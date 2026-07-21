import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { mlbAnalysisTeamLabel, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';
import { filterPitchers, foldSearchText } from '@/utils/mlbPitcherSearch';
import { loadMlbPitcherCatalog, mlbPitcherCatalogNames } from '@/utils/mlbPitcherCatalog';
import { isSideSymmetricMlb, MLB_SPORT_CONFIG } from '@/features/analysis/filterSchemaMlb';
import { applySportFilterPatch, type FilterPatchOp } from '@/features/analysis/sportFilterEngine';
import { rewriteMlbPitcherAgainstTeamOps } from '@/features/analysis/mlbNlPitcherTeamRewrite';
import {
  normalizeMlbSavedFilterSnapshot,
  MLB_SNAPSHOT_DEFAULTS,
} from '@/features/analysis/normalizeSavedFilterSnapshot';
import { TeamMultiSelect, type TeamOption } from '@/features/analysis/TeamMultiSelect';
import { RangeRow, ScalarRow, SelectRow, TriRow, NumPairRow, BandChips, FilterGroup } from '../FilterControls';
import type {
  AdapterData,
  AnalysisResponse,
  BreakdownRow,
  BreakdownTabDef,
  ChatResult,
  TrendsSportAdapter,
  UpcomingGame,
} from './types';
import { applyNumRange, applyPctRange, rangeChanged, fmtKickMlb, fmtMlOdds } from './shared';

type OptRange = { min?: number; max?: number };
type PitcherOpt = { id: number; name: string; hand: string | null; team: string | null };

/** The legacy MLBAnalytics page snapshot shape — bridged to the canonical MlbFilterSnapshot in applyChat. */
export interface MlbPageSnapshot {
  betType: string;
  seasons: [number, number];
  months: [number, number];
  teams: string[];
  opponents: string[];
  division: boolean | null;
  interleague: boolean | null;
  side: string;
  favDog: string;
  mlMin: string;
  mlMax: string;
  lineRange: [number, number];
  f5TotalRange: [number, number];
  totalBounds: OptRange | null;
  timeMin: string;
  timeMax: string;
  dayOfWeek: string;
  doubleheader: boolean | null;
  seriesGame: [number, number] | null;
  trip: [number, number] | null;
  switchGame: boolean | null;
  restRange: [number, number];
  streakMin: string;
  streakMax: string;
  lastResult: string;
  lastMarginMin: string;
  lastMarginMax: string;
  sp: PitcherOpt[];
  oppSp: PitcherOpt[];
  spHand: string;
  oppSpHand: string;
  spXfip: OptRange | null;
  oppSpXfip: OptRange | null;
  bpIp: OptRange | null;
  bpXfip: OptRange | null;
  tempRange: [number, number];
  windRange: [number, number];
  windDir: string;
  dome: boolean | null;
  pfRuns: OptRange | null;
  lastAts: string;
  lastTotal: string;
  lastRole: string;
  oppLastResult: string;
  oppLastAts: string;
  oppLastTotal: string;
  oppLastRole: string;
  oppLastMargin: [number, number];
  winPct: [number, number];
  winStreak: [number, number];
  lossStreak: [number, number];
  rpg: [number, number];
  rapg: [number, number];
  runDiffPg: [number, number];
  minGames: number;
  rlCoverPct: [number, number];
  rlStreak: [number, number];
  overPct: [number, number];
  overStreak: [number, number];
  underStreak: [number, number];
  prevWins: [number, number];
  prevWinPct: [number, number];
  h2hLastWin: string;
  h2hLastAts: string;
  h2hLastOver: string;
  h2hLastMargin: [number, number];
  h2hLastHome: boolean | null;
  h2hLastFav: boolean | null;
  h2hSameSeason: boolean | null;
  oppWinPct: [number, number];
  oppOverPct: [number, number];
  oppRlCoverPct: [number, number];
  oppWinStreak: [number, number];
  oppLossStreak: [number, number];
  oppRpg: [number, number];
  oppRapg: [number, number];
  oppPrevWinPct: [number, number];
}

type S = MlbPageSnapshot;

const D = MLB_SNAPSHOT_DEFAULTS;
const SEASON_FLOOR = 2023;
const SEASON_MAX = 2026;
const DEFAULT_SEASONS: [number, number] = [Math.max(SEASON_FLOOR, SEASON_MAX - 1), SEASON_MAX];

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
const NO_ROI_MARKETS = new Set(['f5_ml']);
const TOTAL_MARKETS = new Set(['total', 'f5_total']);

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
const XFIP_TIERS = [
  { label: 'Ace ≤3.50', max: 3.5 },
  { label: 'Good 3.51–4.00', min: 3.51, max: 4.0 },
  { label: 'Avg 4.01–4.50', min: 4.01, max: 4.5 },
  { label: 'Weak >4.50', min: 4.51 },
];
const BP_IP_PRESETS = [
  { label: 'Rested ≤6', max: 6 },
  { label: 'Normal', min: 6.1, max: 11.9 },
  { label: 'Gassed ≥12', min: 12 },
];
const PF_PRESETS = [
  { label: 'Hitter park ≥103', min: 103 },
  { label: 'Neutral', min: 97.1, max: 102.9 },
  { label: 'Pitcher park ≤97', max: 97 },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const VERB: Record<string, string> = {
  ml: 'won',
  rl: 'covered the run line',
  total: 'went over',
  f5_ml: 'won the F5',
  f5_rl: 'covered the F5 run line',
  f5_total: 'went over the F5 total',
};
const OUTCOME: Record<string, string> = {
  ml: 'Win',
  rl: 'Cover',
  total: 'Over',
  f5_ml: 'Win',
  f5_rl: 'Cover',
  f5_total: 'Over',
};

const PRESETS = [
  { label: 'Home underdogs', betType: 'ml', filters: { side: 'home', favDog: 'underdog' } },
  { label: 'Away after switch', betType: 'ml', filters: { side: 'away', switchGame: true } },
  { label: 'Series G1 unders', betType: 'total', filters: { seriesGame: [1, 1] } },
  { label: 'vs LHP', betType: 'ml', filters: { oppSpHand: 'L' } },
  { label: 'Gassed bullpen overs', betType: 'total', filters: { bpIp: { min: 12 } } },
  { label: 'Hitter-park overs', betType: 'total', filters: { pfRuns: { min: 103 } } },
];

const logoForAbbr = (abbr?: string) => (abbr ? espnMlb500LogoUrlFromAbbrev(abbr) : null);

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

// ── p_filters helpers (from the retired MLB page) ─────────────────────────────────────────────
function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === '' || t === '-' || t === '+' || t === '.' || t === '-.' || t === '+.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function assignRange(f: Record<string, unknown>, minKey: string, maxKey: string, range: OptRange | null | undefined) {
  if (!range) return;
  if (range.min != null && Number.isFinite(range.min)) f[minKey] = range.min;
  if (range.max != null && Number.isFinite(range.max)) f[maxKey] = range.max;
}
function assignOptionalNumber(f: Record<string, unknown>, key: string, raw: string) {
  const n = parseOptionalNumber(raw);
  if (n != null) f[key] = n;
}

function reset(betType: string): S {
  return {
    betType,
    seasons: DEFAULT_SEASONS,
    months: [3, 11],
    teams: [],
    opponents: [],
    division: null,
    interleague: null,
    side: 'any',
    favDog: 'any',
    mlMin: '',
    mlMax: '',
    lineRange: [5, 14],
    f5TotalRange: [2, 8],
    totalBounds: null,
    timeMin: '',
    timeMax: '',
    dayOfWeek: 'any',
    doubleheader: null,
    seriesGame: null,
    trip: null,
    switchGame: null,
    restRange: [0, 10],
    streakMin: '',
    streakMax: '',
    lastResult: 'any',
    lastMarginMin: '',
    lastMarginMax: '',
    sp: [],
    oppSp: [],
    spHand: 'any',
    oppSpHand: 'any',
    spXfip: null,
    oppSpXfip: null,
    bpIp: null,
    bpXfip: null,
    tempRange: [30, 110],
    windRange: [0, 40],
    windDir: 'any',
    dome: null,
    pfRuns: null,
    lastAts: 'any',
    lastTotal: 'any',
    lastRole: 'any',
    oppLastResult: 'any',
    oppLastAts: 'any',
    oppLastTotal: 'any',
    oppLastRole: 'any',
    oppLastMargin: D.oppLastMargin,
    winPct: D.winPct,
    winStreak: D.winStreak,
    lossStreak: D.lossStreak,
    rpg: D.rpg,
    rapg: D.rapg,
    runDiffPg: D.runDiffPg,
    minGames: 0,
    rlCoverPct: D.rlCoverPct,
    rlStreak: D.rlStreak,
    overPct: D.overPct,
    overStreak: D.overStreak,
    underStreak: D.underStreak,
    prevWins: D.prevWins,
    prevWinPct: D.prevWinPct,
    h2hLastWin: 'any',
    h2hLastAts: 'any',
    h2hLastOver: 'any',
    h2hLastMargin: D.h2hLastMargin,
    h2hLastHome: null,
    h2hLastFav: null,
    h2hSameSeason: null,
    oppWinPct: D.oppWinPct,
    oppOverPct: D.oppOverPct,
    oppRlCoverPct: D.oppRlCoverPct,
    oppWinStreak: D.oppWinStreak,
    oppLossStreak: D.oppLossStreak,
    oppRpg: D.oppRpg,
    oppRapg: D.oppRapg,
    oppPrevWinPct: D.oppPrevWinPct,
  };
}

/** Canonical (or saved-raw) snapshot → the page shape. Pure version of the old `restore`. */
function normalizeMlbPage(raw: Record<string, unknown>, rowBetType?: string): S {
  const s = normalizeMlbSavedFilterSnapshot(raw, rowBetType);
  const def = MLB_SNAPSHOT_DEFAULTS;
  const narrowed = (pair: [number, number], d: [number, number]): [number, number] | null =>
    pair[0] !== d[0] || pair[1] !== d[1] ? pair : null;
  const toOpt = (pair: [number, number], d: [number, number]): OptRange | null =>
    pair[0] === d[0] && pair[1] === d[1] ? null : { min: pair[0], max: pair[1] };
  return {
    betType: rowBetType || s.betType,
    seasons: s.seasons,
    months: s.months,
    teams: s.teams,
    opponents: s.opponents,
    division: s.division,
    interleague: s.interleague,
    side: s.side,
    favDog: s.favDog,
    mlMin: s.mlMin,
    mlMax: s.mlMax,
    lineRange: s.lineRange,
    f5TotalRange: s.f5TotalRange,
    totalBounds:
      raw.totalBounds && typeof raw.totalBounds === 'object' && !Array.isArray(raw.totalBounds)
        ? (raw.totalBounds as OptRange)
        : null,
    timeMin: s.timeMin,
    timeMax: s.timeMax,
    dayOfWeek: s.daysOfWeek.length ? s.daysOfWeek[0] : typeof raw.dayOfWeek === 'string' ? raw.dayOfWeek : 'any',
    doubleheader: s.doubleheader,
    seriesGame: narrowed(s.seriesGame, def.seriesGame),
    trip: narrowed(s.trip, def.trip),
    switchGame: s.switchGame,
    restRange: s.restRange,
    streakMin: s.winLossStreak[0] !== def.winLossStreak[0] ? String(s.winLossStreak[0]) : '',
    streakMax: s.winLossStreak[1] !== def.winLossStreak[1] ? String(s.winLossStreak[1]) : '',
    lastResult: s.lastResult,
    lastMarginMin: s.lastMargin[0] !== def.lastMargin[0] ? String(s.lastMargin[0]) : '',
    lastMarginMax: s.lastMargin[1] !== def.lastMargin[1] ? String(s.lastMargin[1]) : '',
    sp: Array.isArray(raw.sp) ? (raw.sp as PitcherOpt[]) : [],
    oppSp: Array.isArray(raw.oppSp) ? (raw.oppSp as PitcherOpt[]) : [],
    spHand: s.spHand,
    oppSpHand: s.oppSpHand,
    spXfip: toOpt(s.spXfip, def.spXfip),
    oppSpXfip: toOpt(s.oppSpXfip, def.oppSpXfip),
    bpIp: toOpt(s.bpIp, def.bpIp),
    bpXfip: toOpt(s.bpXfip, def.bpXfip),
    tempRange: s.tempRange,
    windRange: s.windRange,
    windDir: s.windDir,
    dome: s.dome,
    pfRuns: toOpt(s.pfRuns, def.pfRuns),
    lastAts: s.lastAts,
    lastTotal: s.lastTotal,
    lastRole: s.lastRole,
    oppLastResult: s.oppLastResult,
    oppLastAts: s.oppLastAts,
    oppLastTotal: s.oppLastTotal,
    oppLastRole: s.oppLastRole,
    oppLastMargin: s.oppLastMargin,
    winPct: s.winPct,
    winStreak: s.winStreak,
    lossStreak: s.lossStreak,
    rpg: s.rpg,
    rapg: s.rapg,
    runDiffPg: s.runDiffPg,
    minGames: s.minGames,
    rlCoverPct: s.rlCoverPct,
    rlStreak: s.rlStreak,
    overPct: s.overPct,
    overStreak: s.overStreak,
    underStreak: s.underStreak,
    prevWins: s.prevWins,
    prevWinPct: s.prevWinPct,
    h2hLastWin: s.h2hLastWin,
    h2hLastAts: s.h2hLastAts,
    h2hLastOver: s.h2hLastOver,
    h2hLastMargin: s.h2hLastMargin,
    h2hLastHome: s.h2hLastHome,
    h2hLastFav: s.h2hLastFav,
    h2hSameSeason: s.h2hSameSeason,
    oppWinPct: s.oppWinPct,
    oppOverPct: s.oppOverPct,
    oppRlCoverPct: s.oppRlCoverPct,
    oppWinStreak: s.oppWinStreak,
    oppLossStreak: s.oppLossStreak,
    oppRpg: s.oppRpg,
    oppRapg: s.oppRapg,
    oppPrevWinPct: s.oppPrevWinPct,
  };
}

function toRpcFilters(s: S): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (s.seasons[0] > SEASON_FLOOR) f.season_min = s.seasons[0];
  if (s.seasons[1] < SEASON_MAX) f.season_max = s.seasons[1];
  if (s.months[0] > 3) f.month_min = s.months[0];
  if (s.months[1] < 11) f.month_max = s.months[1];
  if (s.teams.length) f.team = [...new Set(s.teams.map(toF5SplitTeamAbbr))];
  if (s.opponents.length) f.opponent = [...new Set(s.opponents.map(toF5SplitTeamAbbr))];
  if (s.division !== null) f.division = s.division;
  if (s.interleague !== null) f.interleague = s.interleague;
  if (s.side !== 'any') f.side = s.side;
  if (s.favDog !== 'any') f.fav_dog = s.favDog;
  {
    let a = parseOptionalNumber(s.mlMin);
    let b = parseOptionalNumber(s.mlMax);
    if (a !== null && b !== null && a > b) {
      const t = a;
      a = b;
      b = t;
    }
    if (a !== null) f.ml_min = a;
    if (b !== null) f.ml_max = b;
  }
  if (s.totalBounds) {
    assignRange(f, 'total_min', 'total_max', s.totalBounds);
  } else {
    if (s.lineRange[0] > 5) f.total_min = s.lineRange[0];
    if (s.lineRange[1] < 14) f.total_max = s.lineRange[1];
  }
  if (s.f5TotalRange[0] > 2) f.f5_total_min = s.f5TotalRange[0];
  if (s.f5TotalRange[1] < 8) f.f5_total_max = s.f5TotalRange[1];
  if (s.timeMin) f.time_min = s.timeMin;
  if (s.timeMax) f.time_max = s.timeMax;
  // RPC does jsonb_array_elements on day_of_week — a scalar string errors the whole query.
  if (s.dayOfWeek !== 'any') f.day_of_week = [s.dayOfWeek];
  if (s.doubleheader !== null) f.doubleheader = s.doubleheader;
  if (s.seriesGame) {
    f.series_game_min = s.seriesGame[0];
    f.series_game_max = s.seriesGame[1];
  }
  if (s.trip) {
    f.trip_min = s.trip[0];
    f.trip_max = s.trip[1];
  }
  if (s.switchGame !== null) f.switch_game = s.switchGame;
  if (s.restRange[0] > 0) f.rest_min = s.restRange[0];
  if (s.restRange[1] < 10) f.rest_max = s.restRange[1];
  assignOptionalNumber(f, 'streak_min', s.streakMin);
  assignOptionalNumber(f, 'streak_max', s.streakMax);
  if (s.lastResult !== 'any') f.last_result = s.lastResult;
  if (s.lastAts !== 'any') f.last_covered = s.lastAts === 'covered' ? 1 : 0;
  if (s.lastTotal !== 'any') f.last_over = s.lastTotal === 'over' ? 1 : 0;
  if (s.lastRole !== 'any') f.last_favorite = s.lastRole === 'favorite';
  assignOptionalNumber(f, 'last_margin_min', s.lastMarginMin);
  assignOptionalNumber(f, 'last_margin_max', s.lastMarginMax);
  if (s.oppLastResult !== 'any') f.opp_last_result = s.oppLastResult;
  if (s.oppLastAts !== 'any') f.opp_last_covered = s.oppLastAts === 'covered' ? 1 : 0;
  if (s.oppLastTotal !== 'any') f.opp_last_over = s.oppLastTotal === 'over' ? 1 : 0;
  if (s.oppLastRole !== 'any') f.opp_last_favorite = s.oppLastRole === 'favorite';
  applyNumRange(f, 'opp_last_margin', s.oppLastMargin, D.oppLastMargin);
  if (s.sp.length) f.sp = s.sp.map((p) => p.id);
  if (s.oppSp.length) f.opp_sp = s.oppSp.map((p) => p.id);
  if (s.spHand !== 'any') f.sp_hand = s.spHand;
  if (s.oppSpHand !== 'any') f.opp_sp_hand = s.oppSpHand;
  assignRange(f, 'sp_xfip_min', 'sp_xfip_max', s.spXfip);
  assignRange(f, 'opp_sp_xfip_min', 'opp_sp_xfip_max', s.oppSpXfip);
  assignRange(f, 'bp_ip3d_min', 'bp_ip3d_max', s.bpIp);
  assignRange(f, 'bp_xfip_min', 'bp_xfip_max', s.bpXfip);
  if (s.tempRange[0] > 30) f.temp_min = s.tempRange[0];
  if (s.tempRange[1] < 110) f.temp_max = s.tempRange[1];
  if (s.windRange[0] > 0) f.wind_min = s.windRange[0];
  if (s.windRange[1] < 40) f.wind_max = s.windRange[1];
  if (s.windDir !== 'any') f.wind_dir = s.windDir;
  if (s.dome !== null) f.dome = s.dome;
  assignRange(f, 'pf_runs_min', 'pf_runs_max', s.pfRuns);
  applyPctRange(f, 'win_pct', s.winPct);
  applyNumRange(f, 'win_streak', s.winStreak, D.winStreak);
  applyNumRange(f, 'loss_streak', s.lossStreak, D.lossStreak);
  applyNumRange(f, 'rpg', s.rpg, D.rpg);
  applyNumRange(f, 'rapg', s.rapg, D.rapg);
  applyNumRange(f, 'run_diff_pg', s.runDiffPg, D.runDiffPg);
  if (s.minGames > 0) f.min_games = s.minGames;
  applyPctRange(f, 'rl_cover_pct', s.rlCoverPct);
  applyNumRange(f, 'rl_streak', s.rlStreak, D.rlStreak);
  applyPctRange(f, 'over_pct', s.overPct);
  applyNumRange(f, 'over_streak', s.overStreak, D.overStreak);
  applyNumRange(f, 'under_streak', s.underStreak, D.underStreak);
  applyNumRange(f, 'prev_wins', s.prevWins, D.prevWins);
  applyPctRange(f, 'prev_win_pct', s.prevWinPct);
  if (s.h2hLastWin !== 'any') f.h2h_last_win = s.h2hLastWin === 'yes' ? 1 : 0;
  if (s.h2hLastAts !== 'any') f.h2h_last_ats_win = s.h2hLastAts === 'yes' ? 1 : 0;
  if (s.h2hLastOver !== 'any') f.h2h_last_over = s.h2hLastOver === 'yes' ? 1 : 0;
  applyNumRange(f, 'h2h_last_margin', s.h2hLastMargin, D.h2hLastMargin);
  if (s.h2hLastHome !== null) f.h2h_last_home = s.h2hLastHome;
  if (s.h2hLastFav !== null) f.h2h_last_fav = s.h2hLastFav;
  if (s.h2hSameSeason !== null) f.h2h_same_season = s.h2hSameSeason;
  applyPctRange(f, 'opp_win_pct', s.oppWinPct);
  applyPctRange(f, 'opp_over_pct', s.oppOverPct);
  applyPctRange(f, 'opp_rl_cover_pct', s.oppRlCoverPct);
  applyNumRange(f, 'opp_win_streak', s.oppWinStreak, D.oppWinStreak);
  applyNumRange(f, 'opp_loss_streak', s.oppLossStreak, D.oppLossStreak);
  applyNumRange(f, 'opp_rpg', s.oppRpg, D.oppRpg);
  applyNumRange(f, 'opp_rapg', s.oppRapg, D.oppRapg);
  applyPctRange(f, 'opp_prev_win_pct', s.oppPrevWinPct);
  return f;
}

const WEATHER_KEYS = new Set(['temp_min', 'temp_max', 'wind_min', 'wind_max', 'wind_dir']);
function isWeatherOnly(rpc: Record<string, unknown>): boolean {
  const keys = Object.keys(rpc);
  if (keys.length === 0) return false;
  return keys.every((k) => WEATHER_KEYS.has(k));
}

function resolvePitchers(names: string[], catalog: PitcherOpt[]): PitcherOpt[] {
  const out: PitcherOpt[] = [];
  for (const name of names) {
    const q = name.trim();
    if (!q) continue;
    const rows = filterPitchers(catalog, q, 5);
    const match = rows.find((p) => foldSearchText(p.name) === foldSearchText(q)) ?? rows[0];
    if (match) out.push(match as PitcherOpt);
  }
  return out;
}

// ── Pitcher typeahead (sport-local; ported from the retired page) ──────────────────────────────
function PitcherTypeahead({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: PitcherOpt[];
  onChange: (v: PitcherOpt[]) => void;
}) {
  const [q, setQ] = React.useState('');
  const [catalog, setCatalog] = React.useState<PitcherOpt[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadOnce = React.useRef<Promise<PitcherOpt[]> | null>(null);

  const ensureCatalog = React.useCallback(async () => {
    if (catalog) return catalog;
    if (loadOnce.current) return loadOnce.current;
    setLoading(true);
    setLoadError(false);
    loadOnce.current = loadMlbPitcherCatalog() as Promise<PitcherOpt[]>;
    try {
      const rows = await loadOnce.current;
      setCatalog(rows);
      return rows;
    } catch {
      loadOnce.current = null;
      setLoadError(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, [catalog]);

  const opts = React.useMemo(() => filterPitchers(catalog ?? [], q, 40), [catalog, q]);
  const add = (p: PitcherOpt) => {
    if (selected.some((sel) => sel.id === p.id)) return;
    onChange([...selected, p]);
    setQ('');
    setOpen(true);
  };
  const remove = (id: number) => onChange(selected.filter((sel) => sel.id !== id));
  const showPanel = open && (loading || loadError || catalog !== null);

  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {selected.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {selected.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1 text-[10px]">
              {p.name}
              {p.team ? ` (${p.team})` : ''}
              {p.hand ? ` · ${p.hand}` : ''}
              <button type="button" onClick={() => remove(p.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
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
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Search pitchers… (accents optional)"
          className="h-9 rounded-xl pl-7 text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        {showPanel && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
            {loading && !catalog && <div className="px-3 py-2 text-xs text-muted-foreground">Loading pitchers…</div>}
            {loadError && !catalog && <div className="px-3 py-2 text-xs text-muted-foreground">Couldn’t load pitchers — try again</div>}
            {!loading && catalog && opts.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{q.trim() ? 'No pitchers match' : 'No pitchers available'}</div>
            )}
            {opts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p as PitcherOpt)}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-muted-foreground">{[p.team, p.hand].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RailSections({
  snapshot: s,
  update,
}: {
  snapshot: S;
  update: (patch: Partial<S>) => void;
  data: AdapterData;
}) {
  const [showCustomTime, setShowCustomTime] = React.useState(false);
  const teamOptions: TeamOption[] = React.useContext(MlbTeamOptionsCtx);
  return (
    <>
      <FilterGroup title="Scope" defaultOpen>
        <RangeRow label={`Seasons: ${s.seasons[0]}–${s.seasons[1]}`} min={SEASON_FLOOR} max={SEASON_MAX} step={1} value={s.seasons} onChange={(v) => update({ seasons: v })} />
        <RangeRow label={`Months: ${s.months[0]}–${s.months[1]}`} min={3} max={11} step={1} value={s.months} onChange={(v) => update({ months: v })} />
        <TeamMultiSelect label="Team" options={teamOptions} value={s.teams} onChange={(v) => update({ teams: v })} />
        <TeamMultiSelect label="Opponent" options={teamOptions} value={s.opponents} onChange={(v) => update({ opponents: v })} emptyLabel="Any opponent" />
        <TriRow label="Divisional" value={s.division} onChange={(v) => update({ division: v })} />
        <TriRow label="Interleague" value={s.interleague} onChange={(v) => update({ interleague: v })} />
      </FilterGroup>

      <FilterGroup title="Price & Line" defaultOpen>
        <SelectRow label="Side" value={s.side} onChange={(v) => update({ side: v })} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
        <SelectRow label="Favorite / Underdog" value={s.favDog} onChange={(v) => update({ favDog: v })} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Moneyline odds (American)</div>
          <div className="mb-2">
            <BandChips
              bands={ML_BANDS}
              onPick={(b) => update({ mlMin: b.min != null ? String(b.min) : '', mlMax: b.max != null ? String(b.max) : '' })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" value={s.mlMin} onChange={(e) => update({ mlMin: e.target.value })} placeholder="min" className="h-9 rounded-xl" />
            <span className="shrink-0 text-xs text-muted-foreground">to</span>
            <Input type="number" inputMode="numeric" value={s.mlMax} onChange={(e) => update({ mlMax: e.target.value })} placeholder="max" className="h-9 rounded-xl" />
          </div>
        </div>
        <div className="-mt-1 text-[11px] text-muted-foreground">Line filters apply on every result market.</div>
        <BandChips
          bands={TOTAL_BANDS}
          active={(b) => s.totalBounds?.min === b.min && s.totalBounds?.max === b.max}
          onPick={(b) => {
            const next: OptRange = {};
            if (b.min != null) next.min = b.min;
            if (b.max != null) next.max = b.max;
            update({ totalBounds: next, lineRange: [b.min ?? 5, b.max ?? 14] });
          }}
        />
        <RangeRow label={`Game total: ${s.lineRange[0]}–${s.lineRange[1]}`} min={5} max={14} step={0.5} value={s.lineRange} onChange={(v) => update({ totalBounds: null, lineRange: v })} />
        <RangeRow label={`F5 total: ${s.f5TotalRange[0]}–${s.f5TotalRange[1]}`} min={2} max={8} step={0.5} value={s.f5TotalRange} onChange={(v) => update({ f5TotalRange: v })} />
      </FilterGroup>

      <FilterGroup title="Game Time (ET)">
        <div className="flex flex-wrap gap-1">
          {TIME_CHIPS.map((chip) => (
            <Badge
              key={chip.label}
              variant={s.timeMin === (chip.min || '') && s.timeMax === (chip.max || '') ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => update({ timeMin: chip.min || '', timeMax: chip.max || '' })}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowCustomTime((v) => !v)}>
          {showCustomTime ? 'Hide custom range' : 'Custom range'}
        </button>
        {showCustomTime && (
          <div className="flex items-center gap-2">
            <Input type="time" value={s.timeMin} onChange={(e) => update({ timeMin: e.target.value })} className="h-9 rounded-xl" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="time" value={s.timeMax} onChange={(e) => update({ timeMax: e.target.value })} className="h-9 rounded-xl" />
          </div>
        )}
        <SelectRow label="Day of week" value={s.dayOfWeek} onChange={(v) => update({ dayOfWeek: v })} options={[['any', 'Any day'], ...DAYS.map((d) => [d, d] as [string, string])]} />
        <TriRow label="Doubleheader" value={s.doubleheader} onChange={(v) => update({ doubleheader: v })} />
      </FilterGroup>

      <FilterGroup title="Schedule Situation">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Series game</div>
          <div className="flex flex-wrap gap-1">
            {([[1, 1], [2, 2], [3, 3], [4, 9]] as [number, number][]).map(([lo, hi]) => (
              <Badge
                key={`${lo}-${hi}`}
                variant={s.seriesGame?.[0] === lo && s.seriesGame?.[1] === hi ? 'default' : 'outline'}
                className="cursor-pointer text-[10px]"
                onClick={() => update({ seriesGame: s.seriesGame?.[0] === lo && s.seriesGame?.[1] === hi ? null : [lo, hi] })}
              >
                {hi >= 4 ? 'G4+' : `G${lo}`}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Trip series index</div>
          <p className="mb-1 text-[10px] text-muted-foreground/80">e.g. away + G2 + 1st series = game 2 of first away series after a homestand</p>
          <div className="flex flex-wrap gap-1">
            {([[1, 1, '1st'], [2, 2, '2nd'], [3, 9, '3rd+']] as [number, number, string][]).map(([lo, hi, label]) => (
              <Badge
                key={label}
                variant={s.trip?.[0] === lo && s.trip?.[1] === hi ? 'default' : 'outline'}
                className="cursor-pointer text-[10px]"
                onClick={() => update({ trip: s.trip?.[0] === lo && s.trip?.[1] === hi ? null : [lo, hi] })}
              >
                {label} series of trip
              </Badge>
            ))}
          </div>
        </div>
        <TriRow label="Switch game (home↔away flip)" value={s.switchGame} onChange={(v) => update({ switchGame: v })} />
        <RangeRow label={`Days rest: ${s.restRange[0]}–${s.restRange[1]}`} min={0} max={10} step={1} value={s.restRange} onChange={(v) => update({ restRange: v })} />
        <NumPairRow
          label="W/L streak entering (pos = wins, neg = losses)"
          min={s.streakMin}
          max={s.streakMax}
          onMin={(v) => update({ streakMin: v })}
          onMax={(v) => update({ streakMax: v })}
          quickChips={[
            { label: '3+ game skid', min: '', max: '-3' },
            { label: '3+ win streak', min: '3', max: '' },
          ]}
        />
        <SelectRow label="Last result" value={s.lastResult} onChange={(v) => update({ lastResult: v })} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
        <SelectRow label="Last game run line" value={s.lastAts} onChange={(v) => update({ lastAts: v })} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
        <SelectRow label="Last game total" value={s.lastTotal} onChange={(v) => update({ lastTotal: v })} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
        <SelectRow label="Last game role" value={s.lastRole} onChange={(v) => update({ lastRole: v })} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
        <NumPairRow
          label="Last game margin (signed: + won by, − lost by)"
          min={s.lastMarginMin}
          max={s.lastMarginMax}
          onMin={(v) => update({ lastMarginMin: v })}
          onMax={(v) => update({ lastMarginMax: v })}
          minPlaceholder="min e.g. 10"
          maxPlaceholder="max e.g. -10"
          hint="Leave a side blank for open-ended. Lost by 10+ → max −10. Won by 10+ → min 10."
          quickChips={[
            { label: 'Blown out last game', min: '', max: '-5' },
            { label: 'Won big last game', min: '5', max: '' },
          ]}
        />
      </FilterGroup>

      <FilterGroup title="Opponent last game">
        <SelectRow label="Result" value={s.oppLastResult} onChange={(v) => update({ oppLastResult: v })} options={[['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']]} />
        <SelectRow label="Run line" value={s.oppLastAts} onChange={(v) => update({ oppLastAts: v })} options={[['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]]} />
        <SelectRow label="Total" value={s.oppLastTotal} onChange={(v) => update({ oppLastTotal: v })} options={[['any', 'Any'], ['over', 'Over'], ['under', 'Under']]} />
        <SelectRow label="Was" value={s.oppLastRole} onChange={(v) => update({ oppLastRole: v })} options={[['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']]} />
        <RangeRow label={`Opponent last game margin: ${s.oppLastMargin[0]} to ${s.oppLastMargin[1]} runs (+ = won by, − = lost by)`} min={-30} max={30} step={1} value={s.oppLastMargin} onChange={(v) => update({ oppLastMargin: v })} />
      </FilterGroup>

      <FilterGroup title="Pitching Matchup">
        <PitcherTypeahead label="Team starter (SP)" selected={s.sp} onChange={(v) => update({ sp: v })} />
        <PitcherTypeahead label="Opposing starter" selected={s.oppSp} onChange={(v) => update({ oppSp: v })} />
        <SelectRow label="SP hand" value={s.spHand} onChange={(v) => update({ spHand: v })} options={[['any', 'Any'], ['L', 'Left'], ['R', 'Right']]} />
        <SelectRow label="Opp SP hand" value={s.oppSpHand} onChange={(v) => update({ oppSpHand: v })} options={[['any', 'Any'], ['L', 'Left'], ['R', 'Right']]} />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">SP season xFIP</div>
          <BandChips
            bands={XFIP_TIERS}
            active={(b) => s.spXfip?.min === b.min && s.spXfip?.max === b.max}
            onPick={(b) => update({ spXfip: { ...(b.min != null ? { min: b.min } : {}), ...(b.max != null ? { max: b.max } : {}) } })}
            onClear={s.spXfip ? () => update({ spXfip: null }) : undefined}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Opp SP season xFIP</div>
          <BandChips
            bands={XFIP_TIERS}
            active={(b) => s.oppSpXfip?.min === b.min && s.oppSpXfip?.max === b.max}
            onPick={(b) => update({ oppSpXfip: { ...(b.min != null ? { min: b.min } : {}), ...(b.max != null ? { max: b.max } : {}) } })}
            onClear={s.oppSpXfip ? () => update({ oppSpXfip: null }) : undefined}
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Bullpen (opponent)">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Opp BP IP last 3 days</div>
          <BandChips
            bands={BP_IP_PRESETS}
            active={(b) => s.bpIp?.min === b.min && s.bpIp?.max === b.max}
            onPick={(b) => update({ bpIp: { ...(b.min != null ? { min: b.min } : {}), ...(b.max != null ? { max: b.max } : {}) } })}
            onClear={s.bpIp ? () => update({ bpIp: null }) : undefined}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Opp BP season xFIP</div>
          <BandChips
            bands={XFIP_TIERS}
            active={(b) => s.bpXfip?.min === b.min && s.bpXfip?.max === b.max}
            onPick={(b) => update({ bpXfip: { ...(b.min != null ? { min: b.min } : {}), ...(b.max != null ? { max: b.max } : {}) } })}
            onClear={s.bpXfip ? () => update({ bpXfip: null }) : undefined}
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Environment">
        <RangeRow label={`Temp: ${s.tempRange[0]}–${s.tempRange[1]}°F`} min={30} max={110} step={1} value={s.tempRange} onChange={(v) => update({ tempRange: v })} />
        <RangeRow label={`Wind: ${s.windRange[0]}–${s.windRange[1]} mph`} min={0} max={40} step={1} value={s.windRange} onChange={(v) => update({ windRange: v })} />
        <SelectRow label="Wind direction" value={s.windDir} onChange={(v) => update({ windDir: v })} options={[['any', 'Any'], ['out', 'Out'], ['in', 'In'], ['cross', 'Cross'], ['none', 'None']]} />
        <TriRow label="Dome" value={s.dome} onChange={(v) => update({ dome: v })} />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Park run factor (100 = neutral)</div>
          <BandChips
            bands={PF_PRESETS}
            active={(b) => s.pfRuns?.min === b.min && s.pfRuns?.max === b.max}
            onPick={(b) => update({ pfRuns: { ...(b.min != null ? { min: b.min } : {}), ...(b.max != null ? { max: b.max } : {}) } })}
            onClear={s.pfRuns ? () => update({ pfRuns: null }) : undefined}
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Season Record">
        <RangeRow label={`Win%: ${s.winPct[0]}–${s.winPct[1]}%`} min={0} max={100} step={1} value={s.winPct} onChange={(v) => update({ winPct: v })} />
        <RangeRow label={`Win streak: ${s.winStreak[0]}–${s.winStreak[1]}`} min={0} max={25} step={1} value={s.winStreak} onChange={(v) => update({ winStreak: v })} />
        <RangeRow label={`Loss streak: ${s.lossStreak[0]}–${s.lossStreak[1]}`} min={0} max={25} step={1} value={s.lossStreak} onChange={(v) => update({ lossStreak: v })} />
        <RangeRow label={`Runs/game: ${s.rpg[0]}–${s.rpg[1]}`} min={0} max={10} step={0.1} value={s.rpg} onChange={(v) => update({ rpg: v })} />
        <RangeRow label={`Runs allowed/game: ${s.rapg[0]}–${s.rapg[1]}`} min={0} max={10} step={0.1} value={s.rapg} onChange={(v) => update({ rapg: v })} />
        <RangeRow label={`Run diff/game: ${s.runDiffPg[0]}–${s.runDiffPg[1]}`} min={-4} max={4} step={0.1} value={s.runDiffPg} onChange={(v) => update({ runDiffPg: v })} />
        <ScalarRow label={`Min games this season: ${s.minGames === 0 ? 'Any' : s.minGames}`} min={0} max={40} step={1} value={s.minGames} onChange={(v) => update({ minGames: v })} />
      </FilterGroup>

      <FilterGroup title="Run Line Profile">
        <RangeRow label={`RL cover%: ${s.rlCoverPct[0]}–${s.rlCoverPct[1]}%`} min={0} max={100} step={1} value={s.rlCoverPct} onChange={(v) => update({ rlCoverPct: v })} />
        <RangeRow label={`RL cover streak: ${s.rlStreak[0]}–${s.rlStreak[1]}`} min={0} max={25} step={1} value={s.rlStreak} onChange={(v) => update({ rlStreak: v })} />
      </FilterGroup>

      <FilterGroup title="Total Profile">
        <RangeRow label={`Over%: ${s.overPct[0]}–${s.overPct[1]}%`} min={0} max={100} step={1} value={s.overPct} onChange={(v) => update({ overPct: v })} />
        <RangeRow label={`Over streak: ${s.overStreak[0]}–${s.overStreak[1]}`} min={0} max={25} step={1} value={s.overStreak} onChange={(v) => update({ overStreak: v })} />
        <RangeRow label={`Under streak: ${s.underStreak[0]}–${s.underStreak[1]}`} min={0} max={25} step={1} value={s.underStreak} onChange={(v) => update({ underStreak: v })} />
      </FilterGroup>

      <FilterGroup title="Prior Year">
        <RangeRow label={`Last season wins: ${s.prevWins[0]}–${s.prevWins[1]}`} min={0} max={120} step={1} value={s.prevWins} onChange={(v) => update({ prevWins: v })} />
        <RangeRow label={`Last season win%: ${s.prevWinPct[0]}–${s.prevWinPct[1]}%`} min={0} max={100} step={1} value={s.prevWinPct} onChange={(v) => update({ prevWinPct: v })} />
      </FilterGroup>

      <FilterGroup title="Head-to-Head">
        <SelectRow label="Won last meeting" value={s.h2hLastWin} onChange={(v) => update({ h2hLastWin: v })} options={[['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']]} />
        <SelectRow label="Covered RL last meeting" value={s.h2hLastAts} onChange={(v) => update({ h2hLastAts: v })} options={[['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]]} />
        <SelectRow label="Last meeting total" value={s.h2hLastOver} onChange={(v) => update({ h2hLastOver: v })} options={[['any', 'Any'], ['yes', 'Over'], ['no', 'Under']]} />
        <RangeRow label={`Last meeting margin: ${s.h2hLastMargin[0]} to ${s.h2hLastMargin[1]} runs`} min={-30} max={30} step={1} value={s.h2hLastMargin} onChange={(v) => update({ h2hLastMargin: v })} />
        <TriRow label="Was home last meeting" value={s.h2hLastHome} onChange={(v) => update({ h2hLastHome: v })} />
        <TriRow label="Was favorite last meeting" value={s.h2hLastFav} onChange={(v) => update({ h2hLastFav: v })} />
        <TriRow label="Same season as last meeting" value={s.h2hSameSeason} onChange={(v) => update({ h2hSameSeason: v })} />
      </FilterGroup>

      <FilterGroup title="Opponent Record">
        <RangeRow label={`Opp win%: ${s.oppWinPct[0]}–${s.oppWinPct[1]}%`} min={0} max={100} step={1} value={s.oppWinPct} onChange={(v) => update({ oppWinPct: v })} />
        <RangeRow label={`Opp over%: ${s.oppOverPct[0]}–${s.oppOverPct[1]}%`} min={0} max={100} step={1} value={s.oppOverPct} onChange={(v) => update({ oppOverPct: v })} />
        <RangeRow label={`Opp RL cover%: ${s.oppRlCoverPct[0]}–${s.oppRlCoverPct[1]}%`} min={0} max={100} step={1} value={s.oppRlCoverPct} onChange={(v) => update({ oppRlCoverPct: v })} />
        <RangeRow label={`Opp win streak: ${s.oppWinStreak[0]}–${s.oppWinStreak[1]}`} min={0} max={25} step={1} value={s.oppWinStreak} onChange={(v) => update({ oppWinStreak: v })} />
        <RangeRow label={`Opp loss streak: ${s.oppLossStreak[0]}–${s.oppLossStreak[1]}`} min={0} max={25} step={1} value={s.oppLossStreak} onChange={(v) => update({ oppLossStreak: v })} />
        <RangeRow label={`Opp runs/game: ${s.oppRpg[0]}–${s.oppRpg[1]}`} min={0} max={10} step={0.1} value={s.oppRpg} onChange={(v) => update({ oppRpg: v })} />
        <RangeRow label={`Opp runs allowed/game: ${s.oppRapg[0]}–${s.oppRapg[1]}`} min={0} max={10} step={0.1} value={s.oppRapg} onChange={(v) => update({ oppRapg: v })} />
        <RangeRow label={`Opp last-season win%: ${s.oppPrevWinPct[0]}–${s.oppPrevWinPct[1]}%`} min={0} max={100} step={1} value={s.oppPrevWinPct} onChange={(v) => update({ oppPrevWinPct: v })} />
      </FilterGroup>
    </>
  );
}

// team options flow to the rail via context so the RailSections signature stays uniform
const MlbTeamOptionsCtx = React.createContext<TeamOption[]>([]);

function useAdapterData(): AdapterData {
  const [teamOptions, setTeamOptions] = React.useState<TeamOption[]>([]);
  const [pitcherCatalog, setPitcherCatalog] = React.useState<PitcherOpt[]>([]);
  const [pitcherNames, setPitcherNames] = React.useState<string[]>([]);
  React.useEffect(() => {
    collegeFootballSupabase
      .from('mlb_team_mapping')
      .select('team, team_name')
      .then(({ data: rows }) => {
        const opts = (rows || [])
          .map((r: { team?: string; team_name?: string }) => {
            const abbr = toF5SplitTeamAbbr(String(r.team || ''));
            return { id: abbr, name: mlbAnalysisTeamLabel(abbr, String(r.team_name || r.team || '')), logo: espnMlb500LogoUrlFromAbbrev(abbr) };
          })
          .filter((t) => t.id)
          .sort((a, b) => a.id.localeCompare(b.id));
        const seen = new Set<string>();
        setTeamOptions(opts.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))));
      });
    // eager-load pitcher catalog so chat always has an AVAILABLE PITCHERS list
    loadMlbPitcherCatalog()
      .then((rows) => {
        setPitcherCatalog(rows as PitcherOpt[]);
        setPitcherNames(mlbPitcherCatalogNames(rows));
      })
      .catch(() => undefined);
  }, []);
  return { teamOptions, pitcherCatalog, pitcherNames };
}

/** Wrap the rail so the team options reach the RailSections without widening the adapter contract. */
function RailSectionsWithCtx(props: { snapshot: S; update: (patch: Partial<S>) => void; data: AdapterData }) {
  return (
    <MlbTeamOptionsCtx.Provider value={props.data.teamOptions}>
      <RailSections {...props} />
    </MlbTeamOptionsCtx.Provider>
  );
}

export const mlbAdapter: TrendsSportAdapter<S> = {
  sport: 'mlb',
  label: 'MLB',
  betGroups: BET_GROUPS,
  defaultBetType: 'ml',
  limitedBetTypes: new Set<string>(),
  seasonFloorFor: () => SEASON_FLOOR,
  seasonMax: SEASON_MAX,

  reset,
  normalize: (raw, betType) => normalizeMlbPage((raw as Record<string, unknown>) ?? {}, betType),
  withBetType: (s, betType) => ({ ...s, betType, totalBounds: null }),

  analysisRpc: 'mlb_analysis',
  upcomingRpc: 'mlb_analysis_upcoming',
  toRpcFilters,
  upcomingRpcFilters: (_s, rpc) => (isWeatherOnly(rpc) ? {} : rpc),
  upcomingNote: (_s, rpc) =>
    isWeatherOnly(rpc) ? "Weather filters aren't applied to upcoming games (often unconfirmed pregame)." : null,

  toCurrentFilterPayload: (s) => {
    const canonical = normalizeMlbSavedFilterSnapshot(s as unknown as Record<string, unknown>);
    const out: Record<string, unknown> = { betType: canonical.betType };
    for (const k of Object.keys(MLB_SNAPSHOT_DEFAULTS) as Array<keyof typeof MLB_SNAPSHOT_DEFAULTS>) {
      if (k === 'betType') continue;
      if (JSON.stringify(canonical[k]) !== JSON.stringify(MLB_SNAPSHOT_DEFAULTS[k])) {
        out[k] = canonical[k];
      }
    }
    return out;
  },
  chatBodyExtras: (data) => ({ pitchers: data.pitcherNames ?? [] }),
  applyChat: (current, ops: FilterPatchOp[], ctx): ChatResult<S> => {
    const names = ctx.data.pitcherNames ?? [];
    const catalog = (ctx.data.pitcherCatalog as PitcherOpt[]) ?? [];
    const canonical = normalizeMlbSavedFilterSnapshot(current as unknown as Record<string, unknown>);
    const rewritten = rewriteMlbPitcherAgainstTeamOps(ctx.sentence, ops, names);
    const res = applySportFilterPatch(MLB_SPORT_CONFIG, canonical, { ops: rewritten }, { optionOverrides: { mlbPitchers: names } });
    const sp = resolvePitchers(res.snapshot.spNames ?? [], catalog);
    const oppSp = resolvePitchers(res.snapshot.oppSpNames ?? [], catalog);
    const nextPage = normalizeMlbPage({ ...res.snapshot, sp, oppSp } as unknown as Record<string, unknown>, res.snapshot.betType);
    return { snapshot: nextPage, applied: res.applied, rejected: res.rejected, noChange: res.noChange };
  },
  nlExamples: [
    'Home favorites on Fridays',
    'Division games under 8.5',
    'Teams off a loss vs lefties',
    'Day games in summer',
    '2024 season only',
  ],

  isTotalMarket: (bt) => TOTAL_MARKETS.has(bt),
  recoverTotalOverall: false,
  hideSideBarsWhenSymmetric: true,
  isSideSymmetric: (s) => isSideSymmetricMlb(normalizeMlbSavedFilterSnapshot(s as unknown as Record<string, unknown>)),
  showsROI: (bt) => !NO_ROI_MARKETS.has(bt),
  verb: (bt) => VERB[bt] ?? 'hit',
  outcomeWord: (bt) => OUTCOME[bt] ?? 'Hit',
  nounFor: (bt) => (TOTAL_MARKETS.has(bt) ? 'games' : 'bets'),
  sideLabel,
  headlineSubject: (s) => {
    const isTotal = TOTAL_MARKETS.has(s.betType);
    if (isTotal) {
      if (s.teams.length === 1) return `${s.teams[0]} games`;
      if (s.side !== 'any') return s.side === 'home' ? 'Home games' : 'Road games';
      return 'Games';
    }
    const parts: string[] = [];
    if (s.side !== 'any') parts.push(s.side === 'home' ? 'Home' : 'Road');
    if (s.favDog !== 'any') parts.push(s.favDog === 'favorite' ? 'favorites' : 'underdogs');
    if (s.teams.length === 1) return `${s.teams[0]}${parts.length ? ` (${parts.join(' ').toLowerCase()})` : ''}`;
    if (parts.length) return parts.join(' ').replace(/^\w/, (c) => c.toUpperCase());
    return 'Teams';
  },
  scopeNote: (s) => {
    const bits: string[] = [];
    if (s.teams.length) bits.push(s.teams.join('/'));
    if (s.oppSp.length) bits.push(`vs ${s.oppSp.map((p) => p.name).join(', ')}`);
    const who = bits.length ? bits.join(' · ') : 'all teams';
    return `${who} in every past game that matches your filters.`;
  },
  focusSide: (_s, dimension, side) =>
    dimension === 'home_away' ? { side } : dimension === 'fav_dog' ? { favDog: side } : {},

  breakdownTabs: (_s, data): BreakdownTabDef[] => [
    { key: 'team', label: 'By Team', rows: (data.by_team as BreakdownRow[]) ?? [], hasLogos: true, labelKey: 'team' },
    { key: 'venue', label: 'By Ballpark', rows: (data.by_venue as BreakdownRow[]) ?? [], hasLogos: false, labelKey: 'venue' },
  ],
  logoFor: (row) => logoForAbbr(String(row.team ?? '')),
  lineForBet: (betType, g: UpcomingGame) => {
    const t = String(g.team ?? '');
    if (betType === 'ml') return `${t} ML (${g.is_favorite ? 'favorite' : 'underdog'}${g.ml != null ? ` ${fmtMlOdds(String(g.ml))}` : ''})`;
    if (betType === 'rl') return `${t} RL ${g.is_favorite ? '−1.5' : '+1.5'}`;
    if (betType === 'total') return `Total O/U ${g.total ?? '—'}`;
    if (betType === 'f5_ml') return `${t} F5 ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
    if (betType === 'f5_rl') return `${t} F5 RL ${g.is_favorite ? '−0.5' : '+0.5'}`;
    if (betType === 'f5_total') return `F5 Total O/U ${g.f5_total ?? '—'}`;
    return '';
  },
  upcomingLabel: (count) => `Today's matching games (${count})`,
  upcomingTime: (g) => fmtKickMlb(g.time_et as string | undefined, g.game_date as string | undefined),
  upcomingChips: (g) => {
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
  },

  presets: PRESETS,
  applyPreset: (p) => {
    const next = reset(p.betType);
    const f = p.filters as Record<string, unknown>;
    return {
      ...next,
      side: f.side ? String(f.side) : next.side,
      favDog: f.favDog ? String(f.favDog) : next.favDog,
      switchGame: f.switchGame != null ? (f.switchGame as boolean) : next.switchGame,
      seriesGame: f.seriesGame ? (f.seriesGame as [number, number]) : next.seriesGame,
      oppSpHand: f.oppSpHand ? String(f.oppSpHand) : next.oppSpHand,
      bpIp: f.bpIp ? (f.bpIp as OptRange) : next.bpIp,
      pfRuns: f.pfRuns ? (f.pfRuns as OptRange) : next.pfRuns,
    };
  },
  activeChips: (s) => {
    const c: { label: string; patch: Record<string, unknown> }[] = [];
    if (s.seasons[0] !== DEFAULT_SEASONS[0] || s.seasons[1] !== DEFAULT_SEASONS[1]) c.push({ label: `Seasons ${s.seasons[0]}–${s.seasons[1]}`, patch: { seasons: DEFAULT_SEASONS } });
    if (s.months[0] !== 3 || s.months[1] !== 11) c.push({ label: `Months ${s.months[0]}–${s.months[1]}`, patch: { months: [3, 11] } });
    if (s.teams.length) c.push({ label: `Team: ${s.teams.join(', ')}`, patch: { teams: [] } });
    if (s.opponents.length) c.push({ label: `Opp: ${s.opponents.join(', ')}`, patch: { opponents: [] } });
    if (s.division !== null) c.push({ label: `Divisional: ${s.division ? 'Yes' : 'No'}`, patch: { division: null } });
    if (s.interleague !== null) c.push({ label: `Interleague: ${s.interleague ? 'Yes' : 'No'}`, patch: { interleague: null } });
    if (s.side !== 'any') c.push({ label: s.side === 'home' ? 'Home' : 'Away', patch: { side: 'any' } });
    if (s.favDog !== 'any') c.push({ label: s.favDog === 'favorite' ? 'Favorites' : 'Underdogs', patch: { favDog: 'any' } });
    if (s.mlMin || s.mlMax) {
      const lbl = s.mlMin && s.mlMax ? `ML ${fmtMlOdds(s.mlMin)} to ${fmtMlOdds(s.mlMax)}` : s.mlMin ? `ML ≥ ${fmtMlOdds(s.mlMin)}` : `ML ≤ ${fmtMlOdds(s.mlMax)}`;
      c.push({ label: lbl, patch: { mlMin: '', mlMax: '' } });
    }
    if (s.totalBounds && (s.totalBounds.min != null || s.totalBounds.max != null)) {
      const lo = s.totalBounds.min != null ? String(s.totalBounds.min) : '…';
      const hi = s.totalBounds.max != null ? String(s.totalBounds.max) : '…';
      c.push({ label: `Game total ${lo}–${hi}`, patch: { totalBounds: null } });
    } else if (s.lineRange[0] !== 5 || s.lineRange[1] !== 14) {
      c.push({ label: `Game total ${s.lineRange[0]}–${s.lineRange[1]}`, patch: { lineRange: [5, 14] } });
    }
    if (s.f5TotalRange[0] !== 2 || s.f5TotalRange[1] !== 8) c.push({ label: `F5 total ${s.f5TotalRange[0]}–${s.f5TotalRange[1]}`, patch: { f5TotalRange: [2, 8] } });
    if (s.timeMin || s.timeMax) c.push({ label: `Time ${s.timeMin || '…'}–${s.timeMax || '…'}`, patch: { timeMin: '', timeMax: '' } });
    if (s.dayOfWeek !== 'any') c.push({ label: s.dayOfWeek, patch: { dayOfWeek: 'any' } });
    if (s.doubleheader !== null) c.push({ label: `DH: ${s.doubleheader ? 'Yes' : 'No'}`, patch: { doubleheader: null } });
    if (s.seriesGame) c.push({ label: `Series G${s.seriesGame[0]}${s.seriesGame[0] !== s.seriesGame[1] ? `–${s.seriesGame[1]}` : ''}`, patch: { seriesGame: null } });
    if (s.trip) c.push({ label: `Trip series ${s.trip[0]}${s.trip[0] !== s.trip[1] ? `–${s.trip[1]}` : ''}`, patch: { trip: null } });
    if (s.switchGame !== null) c.push({ label: `Switch: ${s.switchGame ? 'Yes' : 'No'}`, patch: { switchGame: null } });
    if (s.restRange[0] !== 0 || s.restRange[1] !== 10) c.push({ label: `Rest ${s.restRange[0]}–${s.restRange[1]}d`, patch: { restRange: [0, 10] } });
    if (s.streakMin || s.streakMax) c.push({ label: `Streak ${s.streakMin || '…'}…${s.streakMax || '…'}`, patch: { streakMin: '', streakMax: '' } });
    if (s.lastResult !== 'any') c.push({ label: `Last: ${s.lastResult}`, patch: { lastResult: 'any' } });
    if (s.lastMarginMin || s.lastMarginMax) c.push({ label: `Last margin ${s.lastMarginMin || '…'}…${s.lastMarginMax || '…'}`, patch: { lastMarginMin: '', lastMarginMax: '' } });
    if (s.sp.length) c.push({ label: `SP: ${s.sp.map((p) => p.name).join(', ')}`, patch: { sp: [] } });
    if (s.oppSp.length) c.push({ label: `Opp SP: ${s.oppSp.map((p) => p.name).join(', ')}`, patch: { oppSp: [] } });
    if (s.spHand !== 'any') c.push({ label: `SP ${s.spHand}HP`, patch: { spHand: 'any' } });
    if (s.oppSpHand !== 'any') c.push({ label: `Opp ${s.oppSpHand}HP`, patch: { oppSpHand: 'any' } });
    if (s.spXfip) c.push({ label: `SP xFIP ${s.spXfip.min ?? '…'}–${s.spXfip.max ?? '…'}`, patch: { spXfip: null } });
    if (s.oppSpXfip) c.push({ label: `Opp xFIP ${s.oppSpXfip.min ?? '…'}–${s.oppSpXfip.max ?? '…'}`, patch: { oppSpXfip: null } });
    if (s.bpIp) c.push({ label: `BP IP ${s.bpIp.min ?? '…'}–${s.bpIp.max ?? '…'}`, patch: { bpIp: null } });
    if (s.bpXfip) c.push({ label: `BP xFIP ${s.bpXfip.min ?? '…'}–${s.bpXfip.max ?? '…'}`, patch: { bpXfip: null } });
    if (s.tempRange[0] !== 30 || s.tempRange[1] !== 110) c.push({ label: `Temp ${s.tempRange[0]}–${s.tempRange[1]}°F`, patch: { tempRange: [30, 110] } });
    if (s.windRange[0] !== 0 || s.windRange[1] !== 40) c.push({ label: `Wind ${s.windRange[0]}–${s.windRange[1]}`, patch: { windRange: [0, 40] } });
    if (s.windDir !== 'any') c.push({ label: `Wind: ${s.windDir}`, patch: { windDir: 'any' } });
    if (s.dome !== null) c.push({ label: s.dome ? 'Dome' : 'Outdoor', patch: { dome: null } });
    if (s.pfRuns) c.push({ label: `Park factor ${s.pfRuns.min ?? '…'}–${s.pfRuns.max ?? '…'}`, patch: { pfRuns: null } });
    if (s.lastAts !== 'any') c.push({ label: `Last game: ${s.lastAts === 'covered' ? 'Covered RL' : "Didn't cover RL"}`, patch: { lastAts: 'any' } });
    if (s.lastTotal !== 'any') c.push({ label: `Last game: ${s.lastTotal === 'over' ? 'Over' : 'Under'}`, patch: { lastTotal: 'any' } });
    if (s.lastRole !== 'any') c.push({ label: `Last game: ${s.lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, patch: { lastRole: 'any' } });
    if (s.oppLastResult !== 'any') c.push({ label: `Opp last game: ${s.oppLastResult === 'won' ? 'Won' : 'Lost'}`, patch: { oppLastResult: 'any' } });
    if (s.oppLastAts !== 'any') c.push({ label: `Opp last game: ${s.oppLastAts === 'covered' ? 'Covered RL' : "Didn't cover RL"}`, patch: { oppLastAts: 'any' } });
    if (s.oppLastTotal !== 'any') c.push({ label: `Opp last game: ${s.oppLastTotal === 'over' ? 'Over' : 'Under'}`, patch: { oppLastTotal: 'any' } });
    if (s.oppLastRole !== 'any') c.push({ label: `Opp last game: ${s.oppLastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, patch: { oppLastRole: 'any' } });
    if (rangeChanged(s.oppLastMargin, D.oppLastMargin)) c.push({ label: `Opp last margin ${s.oppLastMargin[0]} to ${s.oppLastMargin[1]}`, patch: { oppLastMargin: D.oppLastMargin } });
    if (rangeChanged(s.winPct, D.winPct)) c.push({ label: `Win% ${s.winPct[0]}–${s.winPct[1]}`, patch: { winPct: D.winPct } });
    if (rangeChanged(s.winStreak, D.winStreak)) c.push({ label: `Win streak ${s.winStreak[0]}–${s.winStreak[1]}`, patch: { winStreak: D.winStreak } });
    if (rangeChanged(s.lossStreak, D.lossStreak)) c.push({ label: `Loss streak ${s.lossStreak[0]}–${s.lossStreak[1]}`, patch: { lossStreak: D.lossStreak } });
    if (rangeChanged(s.rpg, D.rpg)) c.push({ label: `R/G ${s.rpg[0]}–${s.rpg[1]}`, patch: { rpg: D.rpg } });
    if (rangeChanged(s.rapg, D.rapg)) c.push({ label: `RA/G ${s.rapg[0]}–${s.rapg[1]}`, patch: { rapg: D.rapg } });
    if (rangeChanged(s.runDiffPg, D.runDiffPg)) c.push({ label: `Run diff/g ${s.runDiffPg[0]}–${s.runDiffPg[1]}`, patch: { runDiffPg: D.runDiffPg } });
    if (s.minGames > 0) c.push({ label: `Min ${s.minGames} games`, patch: { minGames: 0 } });
    if (rangeChanged(s.rlCoverPct, D.rlCoverPct)) c.push({ label: `RL cover% ${s.rlCoverPct[0]}–${s.rlCoverPct[1]}`, patch: { rlCoverPct: D.rlCoverPct } });
    if (rangeChanged(s.rlStreak, D.rlStreak)) c.push({ label: `RL streak ${s.rlStreak[0]}–${s.rlStreak[1]}`, patch: { rlStreak: D.rlStreak } });
    if (rangeChanged(s.overPct, D.overPct)) c.push({ label: `Over% ${s.overPct[0]}–${s.overPct[1]}`, patch: { overPct: D.overPct } });
    if (rangeChanged(s.overStreak, D.overStreak)) c.push({ label: `Over streak ${s.overStreak[0]}–${s.overStreak[1]}`, patch: { overStreak: D.overStreak } });
    if (rangeChanged(s.underStreak, D.underStreak)) c.push({ label: `Under streak ${s.underStreak[0]}–${s.underStreak[1]}`, patch: { underStreak: D.underStreak } });
    if (rangeChanged(s.prevWins, D.prevWins)) c.push({ label: `Prev wins ${s.prevWins[0]}–${s.prevWins[1]}`, patch: { prevWins: D.prevWins } });
    if (rangeChanged(s.prevWinPct, D.prevWinPct)) c.push({ label: `Prev win% ${s.prevWinPct[0]}–${s.prevWinPct[1]}`, patch: { prevWinPct: D.prevWinPct } });
    if (s.h2hLastWin !== 'any') c.push({ label: `H2H: ${s.h2hLastWin === 'yes' ? 'Won last' : 'Lost last'}`, patch: { h2hLastWin: 'any' } });
    if (s.h2hLastAts !== 'any') c.push({ label: `H2H: ${s.h2hLastAts === 'yes' ? 'Covered RL last' : "Didn't cover RL last"}`, patch: { h2hLastAts: 'any' } });
    if (s.h2hLastOver !== 'any') c.push({ label: `H2H: ${s.h2hLastOver === 'yes' ? 'Over last' : 'Under last'}`, patch: { h2hLastOver: 'any' } });
    if (rangeChanged(s.h2hLastMargin, D.h2hLastMargin)) c.push({ label: `H2H margin ${s.h2hLastMargin[0]} to ${s.h2hLastMargin[1]}`, patch: { h2hLastMargin: D.h2hLastMargin } });
    if (s.h2hLastHome !== null) c.push({ label: `H2H home: ${s.h2hLastHome ? 'Yes' : 'No'}`, patch: { h2hLastHome: null } });
    if (s.h2hLastFav !== null) c.push({ label: `H2H fav: ${s.h2hLastFav ? 'Yes' : 'No'}`, patch: { h2hLastFav: null } });
    if (s.h2hSameSeason !== null) c.push({ label: `H2H same season: ${s.h2hSameSeason ? 'Yes' : 'No'}`, patch: { h2hSameSeason: null } });
    if (rangeChanged(s.oppWinPct, D.oppWinPct)) c.push({ label: `Opp win% ${s.oppWinPct[0]}–${s.oppWinPct[1]}`, patch: { oppWinPct: D.oppWinPct } });
    if (rangeChanged(s.oppOverPct, D.oppOverPct)) c.push({ label: `Opp over% ${s.oppOverPct[0]}–${s.oppOverPct[1]}`, patch: { oppOverPct: D.oppOverPct } });
    if (rangeChanged(s.oppRlCoverPct, D.oppRlCoverPct)) c.push({ label: `Opp RL cover% ${s.oppRlCoverPct[0]}–${s.oppRlCoverPct[1]}`, patch: { oppRlCoverPct: D.oppRlCoverPct } });
    if (rangeChanged(s.oppWinStreak, D.oppWinStreak)) c.push({ label: `Opp win streak ${s.oppWinStreak[0]}–${s.oppWinStreak[1]}`, patch: { oppWinStreak: D.oppWinStreak } });
    if (rangeChanged(s.oppLossStreak, D.oppLossStreak)) c.push({ label: `Opp loss streak ${s.oppLossStreak[0]}–${s.oppLossStreak[1]}`, patch: { oppLossStreak: D.oppLossStreak } });
    if (rangeChanged(s.oppRpg, D.oppRpg)) c.push({ label: `Opp R/G ${s.oppRpg[0]}–${s.oppRpg[1]}`, patch: { oppRpg: D.oppRpg } });
    if (rangeChanged(s.oppRapg, D.oppRapg)) c.push({ label: `Opp RA/G ${s.oppRapg[0]}–${s.oppRapg[1]}`, patch: { oppRapg: D.oppRapg } });
    if (rangeChanged(s.oppPrevWinPct, D.oppPrevWinPct)) c.push({ label: `Opp prev win% ${s.oppPrevWinPct[0]}–${s.oppPrevWinPct[1]}`, patch: { oppPrevWinPct: D.oppPrevWinPct } });
    return c;
  },
  savedTable: 'mlb_analysis_saved_filters',

  groupFields: {
    Scope: ['seasons', 'months', 'teams', 'opponents', 'division', 'interleague'],
    'Price & Line': ['side', 'favDog', 'mlMin', 'mlMax', 'totalBounds', 'lineRange', 'f5TotalRange'],
    'Game Time (ET)': ['timeMin', 'timeMax', 'dayOfWeek', 'doubleheader'],
    'Schedule Situation': [
      'seriesGame', 'trip', 'switchGame', 'restRange', 'streakMin', 'streakMax',
      'lastResult', 'lastAts', 'lastTotal', 'lastRole', 'lastMarginMin', 'lastMarginMax',
    ],
    'Opponent last game': ['oppLastResult', 'oppLastAts', 'oppLastTotal', 'oppLastRole', 'oppLastMargin'],
    'Pitching Matchup': ['sp', 'oppSp', 'spHand', 'oppSpHand', 'spXfip', 'oppSpXfip'],
    'Bullpen (opponent)': ['bpIp', 'bpXfip'],
    Environment: ['tempRange', 'windRange', 'windDir', 'dome', 'pfRuns'],
    'Season Record': ['winPct', 'winStreak', 'lossStreak', 'rpg', 'rapg', 'runDiffPg', 'minGames'],
    'Run Line Profile': ['rlCoverPct', 'rlStreak'],
    'Total Profile': ['overPct', 'overStreak', 'underStreak'],
    'Prior Year': ['prevWins', 'prevWinPct'],
    'Head-to-Head': ['h2hLastWin', 'h2hLastAts', 'h2hLastOver', 'h2hLastMargin', 'h2hLastHome', 'h2hLastFav', 'h2hSameSeason'],
    'Opponent Record': ['oppWinPct', 'oppOverPct', 'oppRlCoverPct', 'oppWinStreak', 'oppLossStreak', 'oppRpg', 'oppRapg', 'oppPrevWinPct'],
  },

  useAdapterData,
  RailSections: RailSectionsWithCtx,
};
