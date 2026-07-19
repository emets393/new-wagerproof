/**
 * Declarative filter schema for the MLB Historical Analysis / Systems page.
 * Mirrors filterSchema.ts (NFL) / filterSchemaCfb.ts — same guarantees: Record over the canonical
 * snapshot keys (compile-time drift protection), engine-driven validation via MLB_SPORT_CONFIG,
 * side-market symmetry for the 50% tautology (ml/rl/f5_ml/f5_rl). Transcribed from MLBAnalytics.tsx
 * (+ the new Systems dims backed by mlb_analysis). Pitchers are dynamic multiselects (names come
 * from the page/ctx); the page maps names → ids for the RPC.
 */
import { MLB_SNAPSHOT_DEFAULTS, type MlbFilterSnapshot } from './normalizeSavedFilterSnapshot';
import { NFL_DAYS, NFL_DAY_ALIASES } from './filterSchema';
import type { SportFilterConfig, EngineDimension } from './sportFilterEngine';

export const MLB_BET_TYPES = ['ml', 'rl', 'total', 'f5_ml', 'f5_rl', 'f5_total'] as const;
export type MlbBetType = (typeof MLB_BET_TYPES)[number];

export const MLB_TEAM_ABBRS = [
  'ATH', 'ATL', 'AZ', 'BAL', 'BOS', 'CHC', 'CIN', 'CLE', 'COL', 'CWS', 'DET', 'HOU', 'KC', 'LAA',
  'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX',
  'TOR', 'WSH',
] as const;
export const MLB_TEAM_ALIASES: Record<string, string> = {
  ari: 'AZ', oak: 'ATH', oakland: 'ATH', athletics: 'ATH', chw: 'CWS', was: 'WSH', wsn: 'WSH',
  tbr: 'TB', kcr: 'KC', sdp: 'SD', sfg: 'SF',
};

type Dim = EngineDimension;
const TOTAL_BT: readonly MlbBetType[] = ['total', 'f5_total'];
const TIME_PATTERN = '^([01]?\\d|2[0-3]):[0-5]\\d$';

export const DEFAULT_MLB_SNAPSHOT = MLB_SNAPSHOT_DEFAULTS;

export const MLB_FILTER_DIMENSIONS: Record<Exclude<keyof MlbFilterSnapshot, 'betType'>, Dim> = {
  // ── Situation ──
  seasons: { group: 'Situation', kind: 'numRange', min: 2023, max: 2026, step: 1, label: 'Seasons', aliases: ['year', 'years', 'since'], rpcNote: 'season_min/max (MLB data 2023+).' },
  months: { group: 'Situation', kind: 'numRange', min: 3, max: 11, step: 1, label: 'Months', aliases: ['april', 'may', 'summer', 'september', 'month'], rpcNote: 'month_min/max (3=Mar … 11=Nov).' },
  teams: { group: 'Situation', kind: 'multiselect', optionSource: 'mlbTeams', label: 'Team', aliases: ['team'], rpcNote: 'f.team = array of MLB abbreviations.' },
  opponents: { group: 'Situation', kind: 'multiselect', optionSource: 'mlbTeams', label: 'Opponent', aliases: ['opponent', 'against', 'vs'], rpcNote: 'f.opponent = array of MLB abbreviations.' },
  side: { group: 'Situation', kind: 'enum', label: 'Side', options: [['any', 'Either'], ['home', 'Home'], ['away', 'Away']], aliases: ['home', 'away', 'road'], rpcNote: 'f.side.' },
  favDog: { group: 'Situation', kind: 'enum', label: 'Favorite / Underdog', options: [['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']], aliases: ['favorite', 'underdog', 'dog', 'chalk'], rpcNote: 'f.fav_dog.' },
  mlMin: { group: 'Situation', kind: 'mlOdds', bound: 'min', label: 'Moneyline odds (min)', aliases: ['moneyline', 'odds'], rpcNote: 'f.ml_min (American).' },
  mlMax: { group: 'Situation', kind: 'mlOdds', bound: 'max', label: 'Moneyline odds (max)', aliases: ['moneyline', 'odds'], rpcNote: 'f.ml_max.' },
  lineRange: { group: 'Situation', kind: 'numRange', min: 5, max: 14, step: 0.5, boundsByBetType: { total: [5, 14], f5_total: [2, 8] }, availability: { betTypes: TOTAL_BT }, label: 'Total line', aliases: ['total', 'over under', 'o/u'], rpcNote: 'total_min/max (total), f5_total_min/max (f5_total).' },
  timeMin: { group: 'Situation', kind: 'text', pattern: TIME_PATTERN, label: 'Earliest start (ET, HH:MM)', aliases: ['start time', 'day games', 'night games'], rpcNote: 'f.time_min (ET 24h).' },
  timeMax: { group: 'Situation', kind: 'text', pattern: TIME_PATTERN, label: 'Latest start (ET, HH:MM)', rpcNote: 'f.time_max (ET 24h).' },
  daysOfWeek: { group: 'Situation', kind: 'multiselect', optionSource: 'daysOfWeek', label: 'Days of week', aliases: ['day', 'weekend', 'friday', 'sunday'], rpcNote: 'f.day_of_week = array of day names.' },
  doubleheader: { group: 'Situation', kind: 'tristate', label: 'Doubleheader', aliases: ['doubleheader', 'twin bill'], rpcNote: 'f.doubleheader = boolean.' },
  seriesGame: { group: 'Situation', kind: 'numRange', min: 1, max: 6, step: 1, label: 'Series game #', aliases: ['series opener', 'game 1 of series', 'rubber match'], rpcNote: 'series_game_min/max.' },
  trip: { group: 'Situation', kind: 'numRange', min: 1, max: 5, step: 1, label: 'Series # of trip', aliases: ['road trip', 'homestand'], rpcNote: 'trip_min/max (nth series of the current trip/stand).' },
  switchGame: { group: 'Situation', kind: 'tristate', label: 'Switch game', aliases: ['switch game', 'first game after travel'], rpcNote: 'f.switch_game = boolean.' },
  restRange: { group: 'Situation', kind: 'numRange', min: 0, max: 10, step: 1, label: 'Days rest', aliases: ['rest', 'off day'], rpcNote: 'rest_min/max.' },

  // ── Matchup ──
  division: { group: 'Matchup', kind: 'tristate', label: 'Divisional game', aliases: ['divisional', 'division game'], rpcNote: 'f.division = boolean.' },
  interleague: { group: 'Matchup', kind: 'tristate', label: 'Interleague', aliases: ['interleague'], rpcNote: 'f.interleague = boolean.' },

  // ── Weather & park ──
  tempRange: { group: 'Weather & park', kind: 'numRange', min: 30, max: 110, step: 1, unit: '°F', label: 'Temperature', aliases: ['temperature', 'cold', 'hot'], rpcNote: 'temp_min/max.' },
  windRange: { group: 'Weather & park', kind: 'numRange', min: 0, max: 40, step: 1, unit: 'mph', label: 'Wind speed', aliases: ['wind', 'windy'], rpcNote: 'wind_min/max.' },
  windDir: { group: 'Weather & park', kind: 'enum', label: 'Wind direction', options: [['any', 'Any'], ['out', 'Blowing out'], ['in', 'Blowing in'], ['cross', 'Crosswind'], ['none', 'None']], aliases: ['wind out', 'wind in', 'blowing out'], rpcNote: 'f.wind_dir.' },
  dome: { group: 'Weather & park', kind: 'tristate', label: 'Dome', aliases: ['dome', 'indoor', 'roof closed'], rpcNote: 'f.dome = boolean.' },
  pfRuns: { group: 'Weather & park', kind: 'numRange', min: 85, max: 115, step: 1, label: 'Park factor (runs)', aliases: ['park factor', 'hitter park', 'pitcher park'], rpcNote: 'pf_runs_min/max (100 = neutral; hitter ≥103, pitcher ≤97).' },

  // ── Pitching ──
  spNames: { group: 'Pitching', kind: 'multiselect', optionSource: 'mlbPitchers', label: 'Starting pitcher', aliases: ['starter', 'pitcher', 'sp'], rpcNote: 'names → ids client-side → f.sp = array of pitcher ids.' },
  oppSpNames: { group: 'Pitching', kind: 'multiselect', optionSource: 'mlbPitchers', label: 'Opposing starter', aliases: ['opposing pitcher', 'facing'], rpcNote: 'names → ids client-side → f.opp_sp.' },
  spHand: { group: 'Pitching', kind: 'enum', label: 'SP handedness', options: [['any', 'Any'], ['L', 'Lefty'], ['R', 'Righty']], aliases: ['lefty starter', 'righty starter'], rpcNote: 'f.sp_hand.' },
  oppSpHand: { group: 'Pitching', kind: 'enum', label: 'Opp SP handedness', options: [['any', 'Any'], ['L', 'Lefty'], ['R', 'Righty']], aliases: ['vs lefty', 'vs righty', 'vs lhp', 'vs rhp'], rpcNote: 'f.opp_sp_hand.' },
  spXfip: { group: 'Pitching', kind: 'numRange', min: 2, max: 7, step: 0.05, label: 'SP xFIP', aliases: ['ace', 'weak starter', 'xfip'], rpcNote: 'sp_xfip_min/max (Ace ≤3.50, Weak >4.50).' },
  oppSpXfip: { group: 'Pitching', kind: 'numRange', min: 2, max: 7, step: 0.05, label: 'Opp SP xFIP', aliases: ['facing an ace', 'facing a weak starter'], rpcNote: 'opp_sp_xfip_min/max.' },
  bpIp: { group: 'Pitching', kind: 'numRange', min: 0, max: 20, step: 0.1, label: 'Bullpen IP last 3 days', aliases: ['bullpen rested', 'bullpen gassed'], rpcNote: 'bp_ip3d_min/max (Rested ≤6, Gassed ≥12).' },
  bpXfip: { group: 'Pitching', kind: 'numRange', min: 2, max: 7, step: 0.05, label: 'Bullpen xFIP', aliases: ['good bullpen', 'bad bullpen'], rpcNote: 'bp_xfip_min/max.' },

  // ── Last game ──
  lastResult: { group: 'Last game', kind: 'enum', label: 'Last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['off a win', 'off a loss'], rpcNote: "f.last_result ('won'/'lost' → W/L)." },
  lastMargin: { group: 'Last game', kind: 'numRange', min: -30, max: 30, step: 1, unit: 'runs', label: 'Last game margin', aliases: ['won by', 'lost by', 'blowout'], rpcNote: 'last_margin_min/max — signed runs.' },
  winLossStreak: { group: 'Last game', kind: 'numRange', min: -25, max: 25, step: 1, label: 'Current W/L streak (signed)', aliases: ['winning streak', 'losing streak', 'streak'], rpcNote: 'streak_min/max — signed (+wins / −losses).' },

  // ── Opponent last game ──
  oppLastResult: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['opponent off a win', 'opponent off a loss'], rpcNote: "f.opp_last_result ('won'/'lost')." },
  oppLastMargin: { group: 'Opponent last game', kind: 'numRange', min: -30, max: 30, step: 1, unit: 'runs', label: 'Opponent last game margin', aliases: ['opponent won by', 'opponent lost by'], rpcNote: 'opp_last_margin_min/max — signed.' },

  // ── Season Record (as-of) ──
  winPct: { group: 'Season Record', kind: 'pctRange', label: 'Win %', aliases: ['win rate', 'record'], rpcNote: 'win_pct_min/max (0–1).' },
  winStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Win streak', rpcNote: 'win_streak_min/max.' },
  lossStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Loss streak', rpcNote: 'loss_streak_min/max.' },
  rpg: { group: 'Season Record', kind: 'numRange', min: 0, max: 10, step: 0.1, label: 'Runs per game', aliases: ['scoring', 'offense'], rpcNote: 'rpg_min/max.' },
  rapg: { group: 'Season Record', kind: 'numRange', min: 0, max: 10, step: 0.1, label: 'Runs allowed per game', aliases: ['run prevention'], rpcNote: 'rapg_min/max.' },
  runDiffPg: { group: 'Season Record', kind: 'numRange', min: -4, max: 4, step: 0.1, label: 'Run differential per game', aliases: ['run differential'], rpcNote: 'run_diff_pg_min/max.' },
  minGames: { group: 'Season Record', kind: 'scalarMin', min: 0, max: 40, step: 1, label: 'Min games this season', aliases: ['sample size'], rpcNote: 'f.min_games when > 0.' },

  // ── Run Line Profile ──
  rlCoverPct: { group: 'Run Line Profile', kind: 'pctRange', label: 'Run-line cover %', aliases: ['run line record', 'rl cover'], rpcNote: 'rl_cover_pct_min/max (0–1).' },
  rlStreak: { group: 'Run Line Profile', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Run-line cover streak', rpcNote: 'rl_streak_min/max.' },

  // ── Total Profile ──
  overPct: { group: 'Total Profile', kind: 'pctRange', label: 'Over %', aliases: ['over rate'], rpcNote: 'over_pct_min/max (0–1).' },
  overStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Over streak', rpcNote: 'over_streak_min/max.' },
  underStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Under streak', rpcNote: 'under_streak_min/max.' },

  // ── Prior Year ──
  prevWins: { group: 'Prior Year', kind: 'numRange', min: 0, max: 120, step: 1, label: 'Last season wins', rpcNote: 'prev_wins_min/max.' },
  prevWinPct: { group: 'Prior Year', kind: 'pctRange', label: 'Last season win %', rpcNote: 'prev_win_pct_min/max (0–1).' },

  // ── Head-to-Head ──
  h2hLastWin: { group: 'Head-to-Head', kind: 'enum', label: 'Won last meeting', options: [['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']], aliases: ['won last meeting', 'h2h'], rpcNote: 'f.h2h_last_win = yes?1:0.' },
  h2hLastOver: { group: 'Head-to-Head', kind: 'enum', label: 'Last meeting total', options: [['any', 'Any'], ['yes', 'Over'], ['no', 'Under']], rpcNote: 'f.h2h_last_over = yes?1:0.' },
  h2hLastMargin: { group: 'Head-to-Head', kind: 'numRange', min: -30, max: 30, step: 1, unit: 'runs', label: 'Last meeting margin', rpcNote: 'h2h_last_margin_min/max — signed.' },
  h2hSameSeason: { group: 'Head-to-Head', kind: 'tristate', label: 'Same season as last meeting', rpcNote: 'f.h2h_same_season.' },

  // ── Opponent Record ──
  oppWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent win %', rpcNote: 'opp_win_pct_min/max (0–1).' },
  oppOverPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent over %', rpcNote: 'opp_over_pct_min/max (0–1).' },
  oppRlCoverPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent run-line cover %', rpcNote: 'opp_rl_cover_pct_min/max (0–1).' },
  oppWinStreak: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Opponent win streak', rpcNote: 'opp_win_streak_min/max.' },
  oppLossStreak: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 25, step: 1, label: 'Opponent loss streak', rpcNote: 'opp_loss_streak_min/max.' },
  oppRpg: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 10, step: 0.1, label: 'Opponent runs per game', rpcNote: 'opp_rpg_min/max.' },
  oppRapg: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 10, step: 0.1, label: 'Opponent runs allowed per game', rpcNote: 'opp_rapg_min/max.' },
  oppPrevWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent last-season win %', rpcNote: 'opp_prev_win_pct_min/max (0–1).' },
};

export const MLB_DIMENSION_KEYS = Object.keys(MLB_FILTER_DIMENSIONS) as Array<Exclude<keyof MlbFilterSnapshot, 'betType'>>;

// ── Side-market symmetry (ml/rl/f5 sides share the NFL tautology) ──
export const MLB_SIDE_MARKETS: readonly MlbBetType[] = ['ml', 'rl', 'f5_ml', 'f5_rl'];
export const MLB_SIDE_SYMMETRIC_DIMS = [
  'seasons', 'months', 'division', 'interleague', 'lineRange', 'timeMin', 'timeMax', 'daysOfWeek',
  'doubleheader', 'seriesGame', 'tempRange', 'windRange', 'windDir', 'dome', 'pfRuns', 'minGames',
] as const;
export const MLB_SIDE_BREAKING_DIMS = MLB_DIMENSION_KEYS.filter(
  (k) => !(MLB_SIDE_SYMMETRIC_DIMS as readonly string[]).includes(k),
);
export function isSideSymmetricMlb(s: MlbFilterSnapshot): boolean {
  if (!MLB_SIDE_MARKETS.includes(s.betType as MlbBetType)) return false;
  return MLB_SIDE_BREAKING_DIMS.every(
    (k) => JSON.stringify(s[k]) === JSON.stringify(DEFAULT_MLB_SNAPSHOT[k]),
  );
}

function mlbNumRangeBounds(dim: EngineDimension & { kind: 'numRange' }, betType: string): [number, number] {
  return dim.boundsByBetType?.[betType]
    ? [dim.boundsByBetType[betType]![0], dim.boundsByBetType[betType]![1]]
    : [dim.min, dim.max];
}

function mlbBetTypeSideEffects(next: MlbFilterSnapshot): void {
  next.lineRange = mlbNumRangeBounds(MLB_FILTER_DIMENSIONS.lineRange as EngineDimension & { kind: 'numRange' }, next.betType);
}

export const MLB_SPORT_CONFIG: SportFilterConfig<MlbFilterSnapshot> = {
  sport: 'mlb',
  betTypes: MLB_BET_TYPES,
  defaultSnapshot: DEFAULT_MLB_SNAPSHOT,
  dimensions: MLB_FILTER_DIMENSIONS as unknown as Record<string, EngineDimension>,
  optionLists: {
    mlbTeams: { values: MLB_TEAM_ABBRS, aliases: MLB_TEAM_ALIASES },
    mlbPitchers: { values: [] },  // dynamic — supply via ctx.optionOverrides.mlbPitchers
    daysOfWeek: { values: NFL_DAYS, aliases: NFL_DAY_ALIASES },
  },
  applyBetTypeSideEffects: mlbBetTypeSideEffects,
  numRangeBounds: mlbNumRangeBounds,
};

/** Runtime parity check — dimensions must exactly cover the non-betType snapshot keys. */
export function assertMlbDimensionParity(): void {
  const snapKeys = Object.keys(DEFAULT_MLB_SNAPSHOT).filter((k) => k !== 'betType').sort();
  const dimKeys = [...MLB_DIMENSION_KEYS].sort();
  const missing = snapKeys.filter((k) => !dimKeys.includes(k as never));
  const extra = dimKeys.filter((k) => !snapKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`filterSchemaMlb drift — missing: [${missing.join(', ')}]; extra: [${extra.join(', ')}]`);
  }
}
