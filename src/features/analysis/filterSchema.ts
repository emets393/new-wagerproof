/**
 * Declarative filter schema for the NFL Historical Analysis / Systems page.
 *
 * SINGLE SOURCE OF TRUTH for the *shape* of every filter dimension: its kind, bounds, enum
 * values, defaults, and how it maps to the `nfl_analysis` RPC. It exists so that four consumers
 * cannot drift apart:
 *   1. the manual filter UI (`NFLAnalytics.tsx`)
 *   2. the natural-language patch layer (model tool schema + validator)
 *   3. active-filter chips / plain-English echo
 *   4. saved-filter validation
 *
 * IMPORTANT — this file describes the *snapshot* shape (the UI-ergonomic `NflWebFilterSnapshot`),
 * NOT the raw `p_filters` RPC shape. The snapshot→RPC translation lives in exactly one place:
 * `buildFilters()` in `NFLAnalytics.tsx`. A patch must be produced in snapshot space and then flow
 * through `buildFilters()` — never target `p_filters` directly, because that shape carries lossy,
 * sign-encoded quirks (see the `rpcNote` fields below). Every bound / enum / step / default here was
 * transcribed verbatim from `NFLAnalytics.tsx` (the controls + `buildFilters`) — keep them in lockstep.
 *
 * Drift protection: `NFL_FILTER_DIMENSIONS` is typed `Record<Exclude<keyof NflWebFilterSnapshot,
 * 'betType'>, FilterDimension>`, so adding a snapshot field without a matching dimension (or a typo)
 * is a COMPILE error. `assertNflDimensionParity()` re-checks at runtime as belt-and-suspenders.
 */
import { NFL_ASOF_DEFAULTS, type NflWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

// ── Bet-type spine ────────────────────────────────────────────────────────────────────────
export const NFL_BET_TYPES = [
  'fg_spread', 'fg_ml', 'fg_total', 'team_total', 'h1_spread', 'h1_ml', 'h1_total',
] as const;
export type NflBetType = (typeof NFL_BET_TYPES)[number];

/** Canonical NFL team abbreviations as stored in a snapshot (RPC form: LAR not LA, WAS not WSH).
 *  Mirrors NFL_TEAMS in NFLAnalytics.tsx. Used to validate team/opponent multiselect values. */
export const NFL_TEAM_ABBRS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
  'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
] as const;
/** Edge aliases → canonical abbr (matches toRpcTeam in NFLAnalytics.tsx). */
export const NFL_TEAM_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX', OAK: 'LV', SD: 'LAC', STL: 'LAR' };

/** NFL day-of-week values (match nfl_analysis_base.day_of_week) + NL aliases for the extraction model. */
export const NFL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const NFL_DAY_ALIASES: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
  sun: 'Sun', mon: 'Mon', tue: 'Tue', tues: 'Tue', wed: 'Wed', thu: 'Thu', thur: 'Thu', thurs: 'Thu', fri: 'Fri', sat: 'Sat',
};
/** NFL divisions (match nfl_analysis_base.team_division). */
export const NFL_DIVISIONS = ['AFC East', 'AFC North', 'AFC South', 'AFC West', 'NFC East', 'NFC North', 'NFC South', 'NFC West'] as const;

/** Markets whose data only exists 2023+ (season floor clamps to 2023). Mirrors LIMITED_MARKETS. */
export const NFL_LIMITED_BET_TYPES: readonly NflBetType[] = ['h1_spread', 'h1_ml', 'h1_total', 'team_total'];
/** Bet types that expose the spread size+side control (spread markets + ML, which is the spread priced up). */
const SPREAD_CONTROL_BET_TYPES: readonly NflBetType[] = ['fg_spread', 'h1_spread', 'fg_ml', 'h1_ml'];
/** Bet types that expose the total-line range control. */
const TOTAL_CONTROL_BET_TYPES: readonly NflBetType[] = ['fg_total', 'h1_total', 'team_total'];

export const NFL_FILTER_GROUPS = [
  'Situation', 'Matchup', 'Weather', 'Context', 'Last game', 'Opponent last game',
  'Season Record', 'Cover Profile', 'Total Profile', 'Prior Year', 'Head-to-Head', 'Opponent Record',
] as const;
export type NflFilterGroup = (typeof NFL_FILTER_GROUPS)[number];

// ── Dimension descriptor union ────────────────────────────────────────────────────────────
type EnumOption = readonly [value: string, label: string];

/** When a dimension is only active under certain conditions (bet type, or another field's value). */
interface Availability {
  /** Only active for these bet types (omit = all). */
  betTypes?: readonly NflBetType[];
  /** Only active when another snapshot field equals this value (e.g. weeks requires seasonType='regular'). */
  requires?: { key: keyof NflWebFilterSnapshot; equals: string };
}

interface Base {
  group: NflFilterGroup;
  label: string;
  /** NL synonyms to help the extraction model map phrasing → this dimension. Not exhaustive. */
  aliases?: readonly string[];
  availability?: Availability;
  /** How `buildFilters()` translates this to `p_filters`. Documentation + prompt/validator reference. */
  rpcNote?: string;
}

export type FilterDimension =
  // dual-thumb numeric range held as [lo, hi]. Sent to RPC as `<key>_min`/`<key>_max` only when the
  // thumb differs from the bound (see applyNumRange). `boundsByBetType` overrides [min,max] per market.
  | (Base & {
      kind: 'numRange';
      min: number; max: number; step: number;
      unit?: string;
      boundsByBetType?: Partial<Record<NflBetType, readonly [number, number]>>;
      /** When betType ∈ NFL_LIMITED_BET_TYPES, the effective min is raised to this (seasons only). */
      limitedFloor?: number;
    })
  // percent range shown 0–100 in the UI but sent to the RPC divided by 100 (see applyPctRange).
  | (Base & { kind: 'pctRange' })
  // single-thumb "at most" slider (windMax): value is an upper bound; default (= max) means no constraint.
  | (Base & { kind: 'scalarMax'; min: number; max: number; step: number; unit?: string })
  // single-thumb "at least" slider (minGames): value is a lower bound; 0 means no constraint.
  | (Base & { kind: 'scalarMin'; min: number; max: number; step: number })
  // fixed-choice dropdown; default is always the first option ('any'). `dynamic` = options loaded at runtime.
  | (Base & { kind: 'enum'; options: readonly EnumOption[]; dynamic?: boolean })
  // three-state toggle: true | false | null(default, no constraint).
  | (Base & { kind: 'tristate' })
  // multi-select of team abbreviations (NFL_TEAMS / loaded nfl_teams list).
  | (Base & { kind: 'multiselect'; optionSource: 'nflTeams' | 'daysOfWeek' | 'nflDivisions' })
  // one side of the American-odds moneyline pair (mlMin / mlMax); stored as a string, '' = unset.
  | (Base & { kind: 'mlOdds'; bound: 'min' | 'max' });

// ── The default snapshot (compile-time verified to match the type exactly) ──────────────────
/** Canonical "no filters" snapshot — mirrors resetAll() for the default (fg_spread) market. */
export const DEFAULT_NFL_SNAPSHOT = {
  betType: 'fg_spread',
  seasons: [2018, 2025], weeks: [1, 18], side: 'any', seasonType: 'any', playoffRound: 'any',
  favDog: 'any', spreadSide: 'any', spreadSize: [0, 20], lineRange: [30, 60], mlMin: '', mlMax: '',
  primetime: null, division: null, dome: 'any', tempRange: [-10, 100], windMax: 60, precip: 'any',
  restBye: 'any', coach: 'any', referee: 'any',
  lastResult: 'any', lastAts: 'any', lastTotal: 'any', lastRole: 'any', lastOt: null, lastMargin: [-60, 60],
  oppLastResult: 'any', oppLastAts: 'any', oppLastTotal: 'any', oppLastRole: 'any', oppLastOt: null, oppLastMargin: [-60, 60],
  teams: [], opponents: [], daysOfWeek: [], teamDivisions: [],
  ...NFL_ASOF_DEFAULTS,
} satisfies NflWebFilterSnapshot;

// ── The dimensions. Record over the snapshot keys ⇒ compile error on any missing/extra/typo key. ──
export const NFL_FILTER_DIMENSIONS: Record<Exclude<keyof NflWebFilterSnapshot, 'betType'>, FilterDimension> = {
  // ── Situation ──
  seasons: {
    group: 'Situation', kind: 'numRange', min: 2018, max: 2025, step: 1, limitedFloor: 2023,
    label: 'Seasons', aliases: ['year', 'years', 'season range', 'since'],
    rpcNote: 'season_min only if > floor; season_max only if < 2025. Floor = 2023 for limited markets, else 2018.',
  },
  seasonType: {
    group: 'Situation', kind: 'enum', label: 'Season type',
    options: [['any', 'Regular + Playoffs'], ['regular', 'Regular season'], ['postseason', 'Playoffs only']],
    aliases: ['playoffs', 'postseason', 'regular season'],
    rpcNote: "regular → season_type='regular' (+ weeks); postseason → season_type='postseason' (+ playoff_round).",
  },
  weeks: {
    group: 'Situation', kind: 'numRange', min: 1, max: 18, step: 1, label: 'Weeks',
    availability: { requires: { key: 'seasonType', equals: 'regular' } },
    aliases: ['week', 'early season', 'late season'],
    rpcNote: 'week_min/week_max — only sent when seasonType = regular.',
  },
  playoffRound: {
    group: 'Situation', kind: 'enum', label: 'Playoff round',
    options: [['any', 'All rounds'], ['Wild Card', 'Wild Card'], ['Divisional', 'Divisional'], ['Conference', 'Conference'], ['Super Bowl', 'Super Bowl']],
    availability: { requires: { key: 'seasonType', equals: 'postseason' } },
    rpcNote: 'playoff_round — only sent when seasonType = postseason. Values are Title Case.',
  },
  side: {
    group: 'Situation', kind: 'enum', label: 'Side',
    options: [['any', 'Either'], ['home', 'Home'], ['away', 'Away']],
    aliases: ['home', 'away', 'road', 'at home', 'on the road'],
    rpcNote: "f.side = 'home' | 'away'.",
  },
  teams: {
    group: 'Situation', kind: 'multiselect', optionSource: 'nflTeams', label: 'Team',
    aliases: ['team', 'teams'],
    rpcNote: 'f.team = array of team abbreviations (LA→LAR alias applied).',
  },
  opponents: {
    group: 'Situation', kind: 'multiselect', optionSource: 'nflTeams', label: 'Opponent',
    aliases: ['opponent', 'against', 'vs', 'versus', 'facing'],
    rpcNote: 'f.opponent = array of team abbreviations.',
  },
  daysOfWeek: { group: 'Situation', kind: 'multiselect', optionSource: 'daysOfWeek', label: 'Days of week', aliases: ['day', 'day of week', 'weekday', 'monday', 'thursday', 'sunday', 'saturday', 'which days'], rpcNote: 'f.day_of_week = array of day names (Sun/Mon/Tue/Wed/Thu/Fri/Sat).' },
  spreadSide: {
    group: 'Situation', kind: 'enum', label: 'Spread side',
    options: [['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']],
    availability: { betTypes: SPREAD_CONTROL_BET_TYPES },
    aliases: ['favorite', 'underdog', 'favored', 'getting', 'laying', 'dog'],
    rpcNote: 'Combines with spreadSize; drives the spread sign — see spreadSize.rpcNote.',
  },
  spreadSize: {
    group: 'Situation', kind: 'numRange', min: 0, max: 20, step: 0.5, unit: 'pts',
    boundsByBetType: { fg_spread: [0, 20], h1_spread: [0, 14], fg_ml: [0, 20], h1_ml: [0, 20] },
    availability: { betTypes: SPREAD_CONTROL_BET_TYPES },
    label: 'Spread size', aliases: ['spread', 'points', 'laying', 'getting', 'by'],
    rpcNote: "favorite → spread_min=-hi, spread_max=-max(lo,0.5); underdog → spread_min=max(lo,0.5), spread_max=hi; " +
      'either side with a narrowed range → abs_spread_min/max. h1_spread uses h1_spread_*/h1_abs_spread_*; ' +
      'fg_ml/h1_ml filter by the FULL-GAME spread (spread_*/abs_spread_*).',
  },
  mlMin: {
    group: 'Situation', kind: 'mlOdds', bound: 'min', label: 'Moneyline odds (min)',
    aliases: ['moneyline', 'odds', 'american odds', 'ml'],
    rpcNote: 'f.ml_min = numeric American odds. Negative = favorite, positive = underdog. If both set and reversed, sorted.',
  },
  mlMax: {
    group: 'Situation', kind: 'mlOdds', bound: 'max', label: 'Moneyline odds (max)',
    aliases: ['moneyline', 'odds', 'american odds', 'ml'],
    rpcNote: 'f.ml_max = numeric American odds. Same value in mlMin & mlMax = an exact line.',
  },
  favDog: {
    group: 'Situation', kind: 'enum', label: 'Favorite / Underdog',
    options: [['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']],
    availability: { betTypes: ['team_total'] },
    aliases: ['favorite', 'underdog'],
    rpcNote: "f.fav_dog — ONLY applied for the team_total market (spread markets use spreadSide instead).",
  },
  lineRange: {
    group: 'Situation', kind: 'numRange', min: 30, max: 60, step: 0.5,
    boundsByBetType: { fg_total: [30, 60], h1_total: [15, 35], team_total: [10, 40] },
    availability: { betTypes: TOTAL_CONTROL_BET_TYPES },
    label: 'Total line', aliases: ['total', 'over under', 'o/u', 'total line', 'team total line'],
    rpcNote: 'total_min/total_max (fg_total), h1_total_min/max (h1_total), tt_min/tt_max (team_total).',
  },

  // ── Matchup ──
  primetime: { group: 'Matchup', kind: 'tristate', label: 'Primetime', aliases: ['primetime', 'night game', 'sunday night', 'monday night'], rpcNote: 'f.primetime = boolean.' },
  division: { group: 'Matchup', kind: 'tristate', label: 'Divisional', aliases: ['divisional', 'division game', 'in division'], rpcNote: 'f.division = boolean.' },
  teamDivisions: { group: 'Matchup', kind: 'multiselect', optionSource: 'nflDivisions', label: 'Team division', aliases: ['division', 'afc east', 'nfc west', 'afc north', 'nfc south', 'which division'], rpcNote: 'f.team_division = array of division names (AFC East … NFC West).' },
  restBye: {
    group: 'Matchup', kind: 'enum', label: 'Rest / Bye',
    options: [['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short rest (Thu)']],
    aliases: ['bye', 'rest', 'off a bye', 'short week', 'thursday'],
    rpcNote: "off_bye → rest_min=13; short → rest_max=4; pre_bye → pre_bye=true.",
  },

  // ── Weather ──
  dome: {
    group: 'Weather', kind: 'enum', label: 'Venue',
    options: [['any', 'Any'], ['dome', 'Dome'], ['outdoor', 'Outdoor']],
    aliases: ['dome', 'indoor', 'outdoor', 'retractable'],
    rpcNote: "f.dome = (dome === 'dome').",
  },
  precip: {
    group: 'Weather', kind: 'enum', label: 'Precipitation',
    options: [['any', 'Any'], ['none', 'None'], ['rain', 'Rain'], ['snow', 'Snow']],
    aliases: ['rain', 'snow', 'precipitation', 'wet', 'dry'],
    rpcNote: "f.precip = 'none' | 'rain' | 'snow'.",
  },
  tempRange: {
    group: 'Weather', kind: 'numRange', min: -10, max: 100, step: 1, unit: '°F', label: 'Temperature',
    aliases: ['temperature', 'cold', 'hot', 'freezing', 'degrees'],
    rpcNote: 'temp_min/temp_max.',
  },
  windMax: {
    group: 'Weather', kind: 'scalarMax', min: 0, max: 60, step: 1, unit: 'mph', label: 'Max wind',
    aliases: ['wind', 'windy', 'gusts'],
    rpcNote: 'f.wind_max — only sent when < 60.',
  },

  // ── Context ──
  coach: { group: 'Context', kind: 'enum', dynamic: true, options: [['any', 'Any coach']], label: 'Coach', aliases: ['coach', 'head coach'], rpcNote: 'f.coach = exact coach name. Options loaded from the RPC by_coach list.' },
  referee: { group: 'Context', kind: 'enum', dynamic: true, options: [['any', 'Any referee']], label: 'Referee', aliases: ['referee', 'ref', 'official'], rpcNote: 'f.referee = exact referee name. Options loaded from the RPC by_referee list.' },

  // ── Last game ──
  lastResult: { group: 'Last game', kind: 'enum', label: 'Last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['off a win', 'off a loss', 'last game'], rpcNote: "f.last_won = won?1:0." },
  lastAts: { group: 'Last game', kind: 'enum', label: 'Last game ATS', options: [['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]], aliases: ['covered last', 'failed to cover'], rpcNote: "f.last_covered = covered?1:0 (else 'not')." },
  lastTotal: { group: 'Last game', kind: 'enum', label: 'Last game total', options: [['any', 'Any'], ['over', 'Over'], ['under', 'Under']], aliases: ['over last game', 'under last game', 'coming off an under', 'coming off an over', 'off an under', 'off an over', 'last game went under', 'last game went over'], rpcNote: "f.last_over = over?1:0." },
  lastRole: { group: 'Last game', kind: 'enum', label: 'Last game role', options: [['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']], aliases: ['favorite last game', 'underdog last game'], rpcNote: "f.last_favorite = (lastRole === 'favorite')." },
  lastMargin: { group: 'Last game', kind: 'numRange', min: -60, max: 60, step: 1, unit: 'pts', label: 'Last game margin', aliases: ['margin', 'margin of victory', 'margin of loss', 'won by', 'lost by', 'blowout'], rpcNote: 'last_margin_min/max — signed: positive = won by, negative = lost by (e.g. won by 10+ = [10, 60], lost by 7+ = [-60, -7], within a TD = [-7, 7]).' },
  lastOt: { group: 'Last game', kind: 'tristate', label: 'Last game overtime', aliases: ['overtime', 'ot'], rpcNote: 'f.last_overtime = boolean.' },

  // ── Opponent last game (the opponent's previous game; opp_last_* columns) ──
  oppLastResult: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['opponent off a win', 'opponent off a loss', 'opponent won last', 'opponent lost last'], rpcNote: "f.opp_last_won = won?1:0." },
  oppLastAts: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game ATS', options: [['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]], aliases: ['opponent covered last', 'opponent failed to cover last'], rpcNote: "f.opp_last_covered = covered?1:0 (else 'not')." },
  oppLastTotal: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game total', options: [['any', 'Any'], ['over', 'Over'], ['under', 'Under']], aliases: ['opponent over last game', 'opponent under last game'], rpcNote: "f.opp_last_over = over?1:0." },
  oppLastRole: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game role', options: [['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']], aliases: ['opponent favorite last game', 'opponent underdog last game'], rpcNote: "f.opp_last_favorite = (oppLastRole === 'favorite')." },
  oppLastMargin: { group: 'Opponent last game', kind: 'numRange', min: -60, max: 60, step: 1, unit: 'pts', label: 'Opponent last game margin', aliases: ['opponent margin', 'opponent won by', 'opponent lost by', 'opponent blowout'], rpcNote: 'opp_last_margin_min/max — signed: positive = opponent won by, negative = opponent lost by.' },
  oppLastOt: { group: 'Opponent last game', kind: 'tristate', label: 'Opponent last game overtime', aliases: ['opponent overtime', 'opponent ot'], rpcNote: 'f.opp_last_overtime = boolean.' },

  // ── Season Record (as-of, at time of game) ──
  winPct: { group: 'Season Record', kind: 'pctRange', label: 'Win %', aliases: ['win rate', 'record', 'winning percentage'], rpcNote: 'win_pct_min/max — UI 0–100 sent as 0–1.' },
  winStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Win streak', aliases: ['winning streak', 'wins in a row'], rpcNote: 'win_streak_min/max.' },
  lossStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Loss streak', aliases: ['losing streak', 'losses in a row'], rpcNote: 'loss_streak_min/max.' },
  above500: { group: 'Season Record', kind: 'tristate', label: 'Winning record (>.500)', aliases: ['winning record', 'above .500', 'below .500', 'losing record'], rpcNote: 'f.above_500 = boolean.' },
  winPctGtOpp: { group: 'Season Record', kind: 'tristate', label: 'Win% better than opponent', aliases: ['better record than opponent', 'worse record'], rpcNote: 'f.win_pct_gt_opp = boolean.' },
  ppg: { group: 'Season Record', kind: 'numRange', min: 0, max: 40, step: 0.5, label: 'Points per game', aliases: ['ppg', 'scoring', 'points scored'], rpcNote: 'ppg_min/max.' },
  paPg: { group: 'Season Record', kind: 'numRange', min: 0, max: 40, step: 0.5, label: 'Points allowed per game', aliases: ['points allowed', 'defense', 'pa/g'], rpcNote: 'pa_pg_min/max.' },
  pointDiffPg: { group: 'Season Record', kind: 'numRange', min: -20, max: 20, step: 0.5, label: 'Point differential per game', aliases: ['point differential', 'margin', 'net points'], rpcNote: 'point_diff_pg_min/max.' },
  minGames: { group: 'Season Record', kind: 'scalarMin', min: 0, max: 10, step: 1, label: 'Min games this season', aliases: ['minimum games', 'sample size', 'at least N games'], rpcNote: 'f.min_games — only sent when > 0. Guards thin early-season samples.' },

  // ── Cover Profile ──
  atsWinPct: { group: 'Cover Profile', kind: 'pctRange', label: 'ATS win %', aliases: ['ats win percentage', 'ats percentage', 'ats win rate', 'cover rate', 'covering X percent', 'covered more than half', 'covered less than half'], rpcNote: 'ats_win_pct_min/max — 0–100 sent as 0–1.' },
  atsWinStreak: { group: 'Cover Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'ATS win streak', aliases: ['cover streak', 'ats streak', 'covered in a row', 'has not covered', "hasn't covered", 'failed to cover straight'], rpcNote: 'ats_win_streak_min/max.' },
  avgCoverMargin: { group: 'Cover Profile', kind: 'numRange', min: -15, max: 15, step: 0.5, label: 'Avg cover margin', aliases: ['cover margin', 'average ats margin'], rpcNote: 'avg_cover_margin_min/max.' },

  // ── Total Profile ──
  overPct: { group: 'Total Profile', kind: 'pctRange', label: 'Over %', aliases: ['over rate', 'overs percentage', 'gone over', 'gone under', 'hit the over', 'hit the under', 'overs more than half', 'unders more than half', 'total went over', 'games totals'], rpcNote: 'over_pct_min/max — 0–100 sent as 0–1. "Gone under more than half" → overPct max ≤ 50 (under-heavy).' },
  overStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Over streak', aliases: ['overs in a row'], rpcNote: 'over_streak_min/max.' },
  underStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Under streak', aliases: ['unders in a row'], rpcNote: 'under_streak_min/max.' },

  // ── Prior Year ──
  prevWins: { group: 'Prior Year', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Last season wins', aliases: ['prior year wins', 'wins last year'], rpcNote: 'prev_wins_min/max.' },
  prevWinPct: { group: 'Prior Year', kind: 'pctRange', label: 'Last season win %', aliases: ['prior year record', 'win rate last year'], rpcNote: 'prev_win_pct_min/max — 0–100 sent as 0–1.' },
  madePlayoffsPrev: { group: 'Prior Year', kind: 'tristate', label: 'Made playoffs last year', aliases: ['made the playoffs', 'missed the playoffs'], rpcNote: 'f.made_playoffs_prev = boolean.' },
  moreWinsThanOppPrev: { group: 'Prior Year', kind: 'tristate', label: 'More wins than opponent last year', aliases: ['more wins than opponent last season'], rpcNote: 'f.more_wins_than_opp_prev = boolean.' },

  // ── Head-to-Head (last meeting vs this opponent) ──
  h2hLastWin: { group: 'Head-to-Head', kind: 'enum', label: 'Won last meeting', options: [['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']], aliases: ['won last meeting', 'lost last meeting', 'h2h'], rpcNote: "f.h2h_last_win = yes?1:0." },
  h2hLastAts: { group: 'Head-to-Head', kind: 'enum', label: 'Covered last meeting', options: [['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]], aliases: ['covered last meeting'], rpcNote: "f.h2h_last_ats_win = yes?1:0." },
  h2hLastOver: { group: 'Head-to-Head', kind: 'enum', label: 'Last meeting total', options: [['any', 'Any'], ['yes', 'Over'], ['no', 'Under']], aliases: ['over last meeting', 'under last meeting'], rpcNote: "f.h2h_last_over = yes?1:0." },
  h2hLastHome: { group: 'Head-to-Head', kind: 'tristate', label: 'Was home last meeting', rpcNote: 'f.h2h_last_home = boolean.' },
  h2hLastFav: { group: 'Head-to-Head', kind: 'tristate', label: 'Was favorite last meeting', rpcNote: 'f.h2h_last_fav = boolean.' },
  h2hSameSeason: { group: 'Head-to-Head', kind: 'tristate', label: 'Same season as last meeting', rpcNote: 'f.h2h_same_season = boolean.' },
  h2hSpreadCmp: {
    group: 'Head-to-Head', kind: 'enum', label: 'Spread vs last meeting',
    options: [['any', 'Any'], ['lower', 'Lower (more favored / less pts)'], ['higher', 'Higher (less favored / more pts)']],
    rpcNote: "lower → h2h_spread_lower=true; higher → h2h_spread_higher=true.",
  },

  // ── Opponent Record ──
  oppWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent win %', aliases: ['opponent record', 'opponent win rate', 'opponent winning percentage'], rpcNote: 'opp_win_pct_min/max — 0–100 sent as 0–1. Wins/losses only — NEVER use for over/under language.' },
  oppOverPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent over %', aliases: ['opponent over rate', 'opponent overs', 'opponent gone under', 'opponent under rate', 'both teams overs', 'opponent hit the under'], rpcNote: 'opp_over_pct_min/max — 0–100 sent as 0–1. Season O/U tendency for the opponent.' },
  oppWinStreak: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Opponent win streak', rpcNote: 'opp_win_streak_min/max.' },
  oppPrevWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent last-season win %', rpcNote: 'opp_prev_win_pct_min/max — 0–100 sent as 0–1.' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────
/** All snapshot keys that are filter dimensions (everything except the betType spine). */
export const NFL_DIMENSION_KEYS = Object.keys(NFL_FILTER_DIMENSIONS) as Array<Exclude<keyof NflWebFilterSnapshot, 'betType'>>;

/** Whether a dimension is active for a given bet type (respects the `availability.betTypes` gate). */
export function isDimensionAvailable(
  dim: FilterDimension,
  betType: NflBetType,
  snapshot?: Partial<NflWebFilterSnapshot>,
): boolean {
  if (dim.availability?.betTypes && !dim.availability.betTypes.includes(betType)) return false;
  if (dim.availability?.requires && snapshot) {
    const { key, equals } = dim.availability.requires;
    if (snapshot[key] !== equals) return false;
  }
  return true;
}

/** Effective [min, max] for a numRange, resolving bet-type overrides + the limited-market season floor. */
export function numRangeBounds(dim: FilterDimension, betType: NflBetType): [number, number] {
  if (dim.kind !== 'numRange') throw new Error('numRangeBounds called on non-numRange dimension');
  const base: [number, number] = dim.boundsByBetType?.[betType]
    ? [dim.boundsByBetType[betType]![0], dim.boundsByBetType[betType]![1]]
    : [dim.min, dim.max];
  if (dim.limitedFloor != null && NFL_LIMITED_BET_TYPES.includes(betType)) {
    base[0] = Math.max(base[0], dim.limitedFloor);
  }
  return base;
}

// ── Side-market symmetry ────────────────────────────────────────────────────────────────────
/**
 * The four two-sided markets. The base table is team-per-game exploded, so on these markets every
 * game contributes two mirror rows (one covered/won, one didn't). If the active filters cannot
 * distinguish the two sides of a game, the overall hit rate is FORCED to ~50% — a bookkeeping
 * identity, not a finding. The hero must never present that tautology as insight.
 */
export const NFL_SIDE_MARKETS: readonly NflBetType[] = ['fg_spread', 'fg_ml', 'h1_spread', 'h1_ml'];

/**
 * Dimensions that are GAME-level attributes: filtering by them keeps both mirror rows of a game, so
 * the side-market overall stays a forced ~50%. Special cases:
 * - spreadSize: with spreadSide='any' it filters the ABS spread (game-level ⇒ symmetric); when a
 *   direction is chosen, spreadSide itself already breaks symmetry, so spreadSize needs no check.
 * - minGames: subject-team games-played; mirror rows differ only around byes, leaving the overall
 *   within noise of 50% — treating it as breaking would resurrect the junk 50% hero.
 */
export const NFL_SIDE_SYMMETRIC_DIMS = [
  'seasons', 'weeks', 'seasonType', 'playoffRound', 'lineRange', 'spreadSize', 'primetime',
  'division', 'dome', 'tempRange', 'windMax', 'precip', 'referee', 'daysOfWeek', 'minGames',
] as const;

/** Dimensions that pick a side / describe one team: activating any of them breaks the mirror. */
export const NFL_SIDE_BREAKING_DIMS = NFL_DIMENSION_KEYS.filter(
  (k) => !(NFL_SIDE_SYMMETRIC_DIMS as readonly string[]).includes(k),
);

/**
 * True when the current snapshot is on a two-sided market with only game-level filters active —
 * i.e. the overall hit rate is a forced ~50% and the hero must show the real side splits instead.
 */
export function isSideSymmetric(s: NflWebFilterSnapshot): boolean {
  if (!NFL_SIDE_MARKETS.includes(s.betType as NflBetType)) return false;
  return NFL_SIDE_BREAKING_DIMS.every(
    (k) => JSON.stringify(s[k]) === JSON.stringify(DEFAULT_NFL_SNAPSHOT[k]),
  );
}

/**
 * Runtime parity check (belt-and-suspenders to the compile-time Record guarantee). Confirms the
 * dimension keys are exactly the non-betType snapshot keys. Call in a dev boot path or a unit test.
 */
export function assertNflDimensionParity(): void {
  const snapKeys = Object.keys(DEFAULT_NFL_SNAPSHOT).filter((k) => k !== 'betType').sort();
  const dimKeys = [...NFL_DIMENSION_KEYS].sort();
  const missing = snapKeys.filter((k) => !dimKeys.includes(k as never));
  const extra = dimKeys.filter((k) => !snapKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(
      `filterSchema drift — missing dimensions: [${missing.join(', ')}]; extra dimensions: [${extra.join(', ')}]`,
    );
  }
}
