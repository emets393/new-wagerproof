/** MLB Historical Analysis — warehouse RPC contracts. */

export type MlbAnalysisBetType =
  | 'ml'
  | 'rl'
  | 'total'
  | 'f5_ml'
  | 'f5_rl'
  | 'f5_total';

export const MLB_BET_GROUPS: { group: string; items: { key: MlbAnalysisBetType; label: string }[] }[] = [
  {
    group: 'Full Game',
    items: [
      { key: 'ml', label: 'Moneyline' },
      { key: 'rl', label: 'Run Line' },
      { key: 'total', label: 'Total' },
    ],
  },
  {
    group: 'First Five',
    items: [
      { key: 'f5_ml', label: 'F5 ML' },
      { key: 'f5_rl', label: 'F5 RL' },
      { key: 'f5_total', label: 'F5 Total' },
    ],
  },
];

export const MLB_NO_ROI = new Set<string>(['f5_ml']);
export const MLB_SEASON_FLOOR = 2023;
export const MLB_SEASON_MAX = 2026;

export interface MlbAnalysisCoverage {
  season_min: number;
  season_max: number;
  n_bets: number;
  n_games: number;
}

export interface MlbAnalysisOverall {
  n: number;
  wins: number;
  hit_pct: number;
  roi: number | null;
}

export interface MlbAnalysisBarOption {
  side: string;
  n: number;
  wins: number;
  hit_pct: number;
  roi: number | null;
}

export interface MlbAnalysisBar {
  dimension: string;
  options: MlbAnalysisBarOption[];
}

export interface MlbAnalysisBreakdownRow {
  team?: string;
  venue?: string;
  n: number;
  hit_pct: number;
  roi: number | null;
}

export interface MlbAnalysisResponse {
  bet_type: string;
  coverage: MlbAnalysisCoverage;
  baseline_pct: number;
  overall: MlbAnalysisOverall;
  bars: MlbAnalysisBar[];
  by_team: MlbAnalysisBreakdownRow[];
  by_venue: MlbAnalysisBreakdownRow[];
}

export interface MlbAnalysisUpcomingGame {
  game_pk: number;
  game_date: string;
  time_et?: string;
  matchup: string;
  team: string;
  opponent: string;
  is_home: boolean;
  is_favorite: boolean;
  ml?: number | null;
  total?: number | null;
  f5_total?: number | null;
  series_game?: number | null;
  trip_series_index?: number | null;
  is_switch_game?: boolean;
  prev_result?: string | null;
  days_rest?: number | null;
  day_of_week?: string | null;
  is_doubleheader?: boolean;
  sp_hand?: string | null;
  opp_sp_hand?: string | null;
  sp_id?: number | null;
  sp_name?: string | null;
  opp_sp_id?: number | null;
  opp_sp_name?: string | null;
  venue?: string | null;
}

export interface MlbPitcherOption {
  id: number;
  name: string;
  hand: string | null;
  team: string | null;
}

export interface MlbAnalysisFilterState {
  seasonMin: number;
  seasonMax: number;
  monthMin: number;
  monthMax: number;
  teams: string[];
  opponents: string[];
  division: boolean | null;
  interleague: boolean | null;
  side: 'any' | 'home' | 'away';
  favDog: 'any' | 'favorite' | 'underdog';
  mlMin: string;
  mlMax: string;
  totalMin: number | null;
  totalMax: number | null;
  timeMin: string;
  timeMax: string;
  dayOfWeek: string;
  doubleheader: boolean | null;
  seriesGameMin: number | null;
  seriesGameMax: number | null;
  tripMin: number | null;
  tripMax: number | null;
  switchGame: boolean | null;
  restMin: number | null;
  restMax: number | null;
  streakMin: string;
  streakMax: string;
  lastResult: 'any' | 'won' | 'lost';
  lastMarginMin: string;
  lastMarginMax: string;
  sp: MlbPitcherOption[];
  oppSp: MlbPitcherOption[];
  spHand: 'any' | 'L' | 'R';
  oppSpHand: 'any' | 'L' | 'R';
  spXfipMin: number | null;
  spXfipMax: number | null;
  oppSpXfipMin: number | null;
  oppSpXfipMax: number | null;
  bpIpMin: number | null;
  bpIpMax: number | null;
  bpXfipMin: number | null;
  bpXfipMax: number | null;
  tempMin: number | null;
  tempMax: number | null;
  windMin: number | null;
  windMax: number | null;
  windDir: 'any' | 'out' | 'in' | 'cross' | 'none';
  dome: boolean | null;
  pfRunsMin: number | null;
  pfRunsMax: number | null;
}

export function defaultMlbFilters(): MlbAnalysisFilterState {
  return {
    seasonMin: MLB_SEASON_FLOOR,
    seasonMax: MLB_SEASON_MAX,
    monthMin: 3,
    monthMax: 11,
    teams: [],
    opponents: [],
    division: null,
    interleague: null,
    side: 'any',
    favDog: 'any',
    mlMin: '',
    mlMax: '',
    totalMin: null,
    totalMax: null,
    timeMin: '',
    timeMax: '',
    dayOfWeek: 'any',
    doubleheader: null,
    seriesGameMin: null,
    seriesGameMax: null,
    tripMin: null,
    tripMax: null,
    switchGame: null,
    restMin: null,
    restMax: null,
    streakMin: '',
    streakMax: '',
    lastResult: 'any',
    lastMarginMin: '',
    lastMarginMax: '',
    sp: [],
    oppSp: [],
    spHand: 'any',
    oppSpHand: 'any',
    spXfipMin: null,
    spXfipMax: null,
    oppSpXfipMin: null,
    oppSpXfipMax: null,
    bpIpMin: null,
    bpIpMax: null,
    bpXfipMin: null,
    bpXfipMax: null,
    tempMin: null,
    tempMax: null,
    windMin: null,
    windMax: null,
    windDir: 'any',
    dome: null,
    pfRunsMin: null,
    pfRunsMax: null,
  };
}

/** Build RPC p_filters object (omit unset keys). */
export function buildMlbRpcFilters(
  f: MlbAnalysisFilterState,
  betType: MlbAnalysisBetType,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.seasonMin > MLB_SEASON_FLOOR) out.season_min = f.seasonMin;
  if (f.seasonMax < MLB_SEASON_MAX) out.season_max = f.seasonMax;
  if (f.monthMin > 3) out.month_min = f.monthMin;
  if (f.monthMax < 11) out.month_max = f.monthMax;
  if (f.teams.length) out.team = f.teams;
  if (f.opponents.length) out.opponent = f.opponents;
  if (f.division !== null) out.division = f.division;
  if (f.interleague !== null) out.interleague = f.interleague;
  if (f.side !== 'any') out.side = f.side;
  if (f.favDog !== 'any') out.fav_dog = f.favDog;
  // Moneyline — only send bounds the user typed (no auto-swap inventing the other key)
  {
    const a = f.mlMin.trim() === '' ? null : Number(f.mlMin);
    const b = f.mlMax.trim() === '' ? null : Number(f.mlMax);
    if (a !== null && !Number.isNaN(a)) out.ml_min = a;
    if (b !== null && !Number.isNaN(b)) out.ml_max = b;
  }
  if (betType === 'total' || betType === 'f5_total') {
    const mk = betType === 'total' ? 'total_min' : 'f5_total_min';
    const xk = betType === 'total' ? 'total_max' : 'f5_total_max';
    // Only emit bounds that were explicitly set (null = unset)
    if (f.totalMin != null) out[mk] = f.totalMin;
    if (f.totalMax != null) out[xk] = f.totalMax;
  }
  if (f.timeMin) out.time_min = f.timeMin;
  if (f.timeMax) out.time_max = f.timeMax;
  if (f.dayOfWeek !== 'any') out.day_of_week = f.dayOfWeek;
  if (f.doubleheader !== null) out.doubleheader = f.doubleheader;
  if (f.seriesGameMin != null) out.series_game_min = f.seriesGameMin;
  if (f.seriesGameMax != null) out.series_game_max = f.seriesGameMax;
  if (f.tripMin != null) out.trip_min = f.tripMin;
  if (f.tripMax != null) out.trip_max = f.tripMax;
  if (f.switchGame !== null) out.switch_game = f.switchGame;
  if (f.restMin != null) out.rest_min = f.restMin;
  if (f.restMax != null) out.rest_max = f.restMax;
  {
    const a = f.streakMin.trim() === '' ? null : Number(f.streakMin);
    const b = f.streakMax.trim() === '' ? null : Number(f.streakMax);
    if (a !== null && !Number.isNaN(a)) out.streak_min = a;
    if (b !== null && !Number.isNaN(b)) out.streak_max = b;
  }
  if (f.lastResult !== 'any') out.last_result = f.lastResult;
  // Signed margin: only include keys the user set. Do NOT invent the other end.
  {
    const a = f.lastMarginMin.trim() === '' ? null : Number(f.lastMarginMin);
    const b = f.lastMarginMax.trim() === '' ? null : Number(f.lastMarginMax);
    if (a !== null && !Number.isNaN(a)) out.last_margin_min = a;
    if (b !== null && !Number.isNaN(b)) out.last_margin_max = b;
  }
  if (f.sp.length) out.sp = f.sp.map(p => p.id);
  if (f.oppSp.length) out.opp_sp = f.oppSp.map(p => p.id);
  if (f.spHand !== 'any') out.sp_hand = f.spHand;
  if (f.oppSpHand !== 'any') out.opp_sp_hand = f.oppSpHand;
  if (f.spXfipMin != null) out.sp_xfip_min = f.spXfipMin;
  if (f.spXfipMax != null) out.sp_xfip_max = f.spXfipMax;
  if (f.oppSpXfipMin != null) out.opp_sp_xfip_min = f.oppSpXfipMin;
  if (f.oppSpXfipMax != null) out.opp_sp_xfip_max = f.oppSpXfipMax;
  if (f.bpIpMin != null) out.bp_ip3d_min = f.bpIpMin;
  if (f.bpIpMax != null) out.bp_ip3d_max = f.bpIpMax;
  if (f.bpXfipMin != null) out.bp_xfip_min = f.bpXfipMin;
  if (f.bpXfipMax != null) out.bp_xfip_max = f.bpXfipMax;
  if (f.tempMin != null) out.temp_min = f.tempMin;
  if (f.tempMax != null) out.temp_max = f.tempMax;
  if (f.windMin != null) out.wind_min = f.windMin;
  if (f.windMax != null) out.wind_max = f.windMax;
  if (f.windDir !== 'any') out.wind_dir = f.windDir;
  if (f.dome !== null) out.dome = f.dome;
  if (f.pfRunsMin != null) out.pf_runs_min = f.pfRunsMin;
  if (f.pfRunsMax != null) out.pf_runs_max = f.pfRunsMax;
  return out;
}

export function mlbFiltersWeatherOnly(filters: Record<string, unknown>): boolean {
  const keys = Object.keys(filters);
  if (!keys.length) return false;
  const weather = new Set(['temp_min', 'temp_max', 'wind_min', 'wind_max', 'wind_dir']);
  return keys.every(k => weather.has(k));
}

export const MLB_VERB: Record<string, string> = {
  ml: 'won',
  rl: 'covered the run line',
  total: 'went over',
  f5_ml: 'won the F5',
  f5_rl: 'covered the F5 run line',
  f5_total: 'went over the F5 total',
};

export function mlbSideLabel(betType: string, side: string): string {
  if (side === 'over') return 'Over';
  if (side === 'under') return 'Under';
  const verb = betType === 'ml' || betType === 'f5_ml' ? 'won' : 'covered';
  if (side === 'home') return `Home ${verb}`;
  if (side === 'away') return `Away ${verb}`;
  if (side === 'favorite') return `Favorites ${verb}`;
  if (side === 'underdog') return `Underdogs ${verb}`;
  return side;
}

export function mlbLineForBet(betType: string, g: MlbAnalysisUpcomingGame): string {
  if (betType === 'ml') return `${g.team} ML (${g.is_favorite ? 'fav' : 'dog'})`;
  if (betType === 'rl') return `${g.team} RL ${g.is_favorite ? '−1.5' : '+1.5'}`;
  if (betType === 'total') return `Total O/U ${g.total ?? '—'}`;
  if (betType === 'f5_ml') return `${g.team} F5 ML`;
  if (betType === 'f5_rl') return `${g.team} F5 RL ${g.is_favorite ? '−0.5' : '+0.5'}`;
  if (betType === 'f5_total') return `F5 Total O/U ${g.f5_total ?? '—'}`;
  return '';
}

export function mlbUpcomingChips(g: MlbAnalysisUpcomingGame): string[] {
  const chips: string[] = [];
  if (g.series_game != null) chips.push(`Series G${g.series_game >= 4 ? '4+' : g.series_game}`);
  if (g.trip_series_index != null) {
    const t = g.trip_series_index;
    chips.push(t >= 3 ? '3rd+ series of trip' : t === 2 ? '2nd series of trip' : '1st series of trip');
  }
  if (g.is_switch_game) chips.push('Switch');
  if (g.opp_sp_hand) chips.push(`vs ${g.opp_sp_hand}HP`);
  if (g.opp_sp_name) chips.push(g.opp_sp_name);
  if (g.is_doubleheader) chips.push('DH');
  return chips;
}

export function mlbSignificance(n: number, hit: number): string {
  const dev = Math.abs(hit - 50);
  if (n < 20) return 'Thin sample';
  if (n >= 60 && dev >= 5) return 'Strong';
  if (n >= 30 && dev >= 3) return 'Solid';
  return 'Neutral';
}
