/**
 * Declarative filter schema for the CFB Historical Analysis / Systems page.
 * Mirrors filterSchema.ts (NFL) — see its header for the architecture. Same guarantees:
 * dimensions are a Record over the snapshot keys (compile-time drift protection), engine-driven
 * validation via CFB_SPORT_CONFIG, and side-market symmetry classification for the 50% tautology.
 * Bounds/enums transcribed from CFBAnalytics.tsx (+ the new Systems dims backed by cfb_analysis).
 */
import { CFB_ASOF_DEFAULTS, type CfbWebFilterSnapshot } from './normalizeSavedFilterSnapshot';
import { NFL_DAYS, NFL_DAY_ALIASES } from './filterSchema';
import type { SportFilterConfig, EngineDimension } from './sportFilterEngine';

export const CFB_BET_TYPES = [
  'fg_spread', 'fg_ml', 'fg_total', 'team_total', 'h1_spread', 'h1_ml', 'h1_total',
] as const;
export type CfbBetType = (typeof CFB_BET_TYPES)[number];
export const CFB_LIMITED_BET_TYPES: readonly CfbBetType[] = ['h1_spread', 'h1_ml', 'h1_total', 'team_total'];

/** Full school names as stored in cfb_analysis_base (137 FBS programs, 2016–2025). */
export const CFB_TEAMS = [
  'Air Force', 'Akron', 'Alabama', 'App State', 'Arizona', 'Arizona State', 'Arkansas',
  'Arkansas State', 'Army', 'Auburn', 'BYU', 'Ball State', 'Baylor', 'Boise State',
  'Boston College', 'Bowling Green', 'Buffalo', 'California', 'Central Michigan', 'Charlotte',
  'Cincinnati', 'Clemson', 'Coastal Carolina', 'Colorado', 'Colorado State', 'Delaware', 'Duke',
  'East Carolina', 'Eastern Michigan', 'Florida', 'Florida Atlantic', 'Florida International',
  'Florida State', 'Fresno State', 'Georgia', 'Georgia Southern', 'Georgia State', 'Georgia Tech',
  'Hawai\'i', 'Houston', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Iowa State',
  'Jacksonville State', 'James Madison', 'Kansas', 'Kansas State', 'Kennesaw State', 'Kent State',
  'Kentucky', 'LSU', 'Liberty', 'Louisiana', 'Louisiana Tech', 'Louisville', 'Marshall',
  'Maryland', 'Massachusetts', 'Memphis', 'Miami', 'Miami (OH)', 'Michigan', 'Michigan State',
  'Middle Tennessee', 'Minnesota', 'Mississippi State', 'Missouri', 'Missouri State', 'NC State',
  'Navy', 'Nebraska', 'Nevada', 'New Mexico', 'New Mexico State', 'North Carolina', 'North Texas',
  'Northern Illinois', 'Northwestern', 'Notre Dame', 'Ohio', 'Ohio State', 'Oklahoma',
  'Oklahoma State', 'Old Dominion', 'Ole Miss', 'Oregon', 'Oregon State', 'Penn State',
  'Pittsburgh', 'Purdue', 'Rice', 'Rutgers', 'SMU', 'Sam Houston', 'San Diego State',
  'San José State', 'South Alabama', 'South Carolina', 'South Florida', 'Southern Miss',
  'Stanford', 'Syracuse', 'TCU', 'Temple', 'Tennessee', 'Texas', 'Texas A&M', 'Texas State',
  'Texas Tech', 'Toledo', 'Troy', 'Tulane', 'Tulsa', 'UAB', 'UCF', 'UCLA', 'UConn', 'UL Monroe',
  'UNLV', 'USC', 'UTEP', 'UTSA', 'Utah', 'Utah State', 'Vanderbilt', 'Virginia', 'Virginia Tech',
  'Wake Forest', 'Washington', 'Washington State', 'West Virginia', 'Western Kentucky',
  'Western Michigan', 'Wisconsin', 'Wyoming'
] as const;
export const CFB_CONFERENCES = [
  'ACC', 'American Athletic', 'Big 12', 'Big Ten', 'Conference USA', 'FBS Independents',
  'Mid-American', 'Mountain West', 'Pac-12', 'SEC', 'Sun Belt'
] as const;

type Dim = EngineDimension;
const ML_BT: readonly CfbBetType[] = ['fg_ml', 'h1_ml'];

export const DEFAULT_CFB_SNAPSHOT = {
  betType: 'fg_spread',
  seasons: [2016, 2025], weeks: [1, 16], side: 'any', favDog: 'any', gameType: 'any',
  rankedMatchup: 'any',
  spreadSide: 'any', spreadSize: [0, 50], lineRange: [30, 80],
  h1SpreadSide: 'any', h1SpreadSize: [0, 28], h1TotalRange: [15, 45], ttLineRange: [10, 55],
  mlMin: '', mlMax: '', h1MlMin: '', h1MlMax: '',
  oppSpreadSide: 'any', oppSpreadSize: [0, 50], oppMlMin: '', oppMlMax: '', oppTtLineRange: [10, 55],
  primetime: null, conferenceGame: null, neutralSite: null,
  selectedConferences: [], tempRange: [-10, 110], windRange: [0, 60], weather: 'any', dome: 'any',
  restBye: 'any',
  lastResult: 'any', lastAts: 'any', lastTotal: 'any', lastRole: 'any', lastOt: null,
  teams: [], opponents: [], daysOfWeek: [], lastMargin: [-80, 80],
  oppLastResult: 'any', oppLastAts: 'any', oppLastTotal: 'any', oppLastRole: 'any', oppLastOt: null,
  oppLastMargin: [-80, 80],
  ...CFB_ASOF_DEFAULTS,
} satisfies CfbWebFilterSnapshot;

const YES_NO_ENUM = (label: string, yes: string, no: string, group: string, rpc: string, aliases?: readonly string[]): Dim =>
  ({ group, kind: 'enum', label, options: [['any', 'Any'], ['yes', yes], ['no', no]], aliases, rpcNote: rpc });

export const CFB_FILTER_DIMENSIONS: Record<Exclude<keyof CfbWebFilterSnapshot, 'betType'>, Dim> = {
  // ── Situation ──
  seasons: { group: 'Situation', kind: 'numRange', min: 2016, max: 2025, step: 1, limitedFloor: 2023, label: 'Seasons', aliases: ['year', 'years', 'since'], rpcNote: 'season_min/max; floor 2023 for 1H/TT markets.' },
  gameType: { group: 'Situation', kind: 'enum', label: 'Game type', options: [['any', 'All games'], ['regular', 'Regular season'], ['bowl', 'Bowl games'], ['playoff', 'Playoff'], ['postseason', 'All postseason']], aliases: ['bowl', 'playoff', 'postseason', 'regular season'], rpcNote: "f.game_type; 'postseason' = bowl+playoff." },
  weeks: { group: 'Situation', kind: 'numRange', min: 1, max: 16, step: 1, label: 'Weeks', aliases: ['week', 'early season', 'late season'], rpcNote: 'week_min/max — only applied for regular-season/any game types.' },
  rankedMatchup: { group: 'Situation', kind: 'enum', label: 'Ranked matchup', options: [['any', 'Any'], ['both', 'Both ranked'], ['neither', 'Neither ranked'], ['home_ranked', 'Home ranked only'], ['away_ranked', 'Away ranked only'], ['either', 'Either ranked']], aliases: ['ranked', 'top 25', 'unranked'], rpcNote: 'f.ranked_matchup (AP Top 25; full 2016+).' },
  side: { group: 'Situation', kind: 'enum', label: 'Side', options: [['any', 'Either'], ['home', 'Home'], ['away', 'Away']], aliases: ['home', 'away', 'road'], rpcNote: 'f.side.' },
  teams: { group: 'Situation', kind: 'multiselect', optionSource: 'cfbTeams', label: 'Team', aliases: ['team', 'school'], rpcNote: 'f.team = array of full school names.' },
  opponents: { group: 'Situation', kind: 'multiselect', optionSource: 'cfbTeams', label: 'Opponent', aliases: ['opponent', 'against', 'vs'], rpcNote: 'f.opponent = array of full school names.' },
  daysOfWeek: { group: 'Situation', kind: 'multiselect', optionSource: 'daysOfWeek', label: 'Days of week', aliases: ['day', 'saturday', 'friday', 'thursday', 'weeknight', 'maction'], rpcNote: 'f.day_of_week = array (CFB plays Tue–Sat; Sun/Mon rare).' },
  spreadSide: { group: 'Situation', kind: 'enum', label: 'FG spread side (team)', options: [['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']], aliases: ['favored', 'getting', 'laying', 'dog', 'spread'], rpcNote: 'Drives FG spread sign — available on every bet type.' },
  spreadSize: { group: 'Situation', kind: 'numRange', min: 0, max: 50, step: 0.5, unit: 'pts', label: 'FG spread size (team)', aliases: ['spread', 'points', 'laying'], rpcNote: 'favorite → spread_min=-hi; underdog → +; either → abs_spread_*. CFB spreads reach the 50s.' },
  h1SpreadSide: { group: 'Situation', kind: 'enum', label: '1H spread side (team)', options: [['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']], aliases: ['1h spread'], rpcNote: 'h1_spread_*/h1_abs_spread_*.' },
  h1SpreadSize: { group: 'Situation', kind: 'numRange', min: 0, max: 28, step: 0.5, unit: 'pts', label: '1H spread size (team)', aliases: ['1h spread'], rpcNote: 'Same sign rules on h1_spread.' },
  favDog: { group: 'Situation', kind: 'enum', label: 'Favorite / Underdog', options: [['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']], availability: { betTypes: [...ML_BT, 'team_total'] }, aliases: ['favorite', 'underdog'], rpcNote: 'f.fav_dog — ML markets + team totals.' },
  mlMin: { group: 'Situation', kind: 'mlOdds', bound: 'min', label: 'FG moneyline odds (team, min)', aliases: ['moneyline', 'odds'], rpcNote: 'f.ml_min (American; CFB ML data 2021+). Available on every bet type.' },
  mlMax: { group: 'Situation', kind: 'mlOdds', bound: 'max', label: 'FG moneyline odds (team, max)', aliases: ['moneyline', 'odds'], rpcNote: 'f.ml_max.' },
  h1MlMin: { group: 'Situation', kind: 'mlOdds', bound: 'min', label: '1H moneyline odds (team, min)', aliases: ['1h moneyline', '1h ml'], rpcNote: 'f.h1_ml_min — filters h1_ml_px (decimal; American |v|≥100 converted).' },
  h1MlMax: { group: 'Situation', kind: 'mlOdds', bound: 'max', label: '1H moneyline odds (team, max)', aliases: ['1h moneyline'], rpcNote: 'f.h1_ml_max.' },
  lineRange: { group: 'Situation', kind: 'numRange', min: 30, max: 80, step: 0.5, label: 'Game total line', aliases: ['total', 'over under', 'o/u', 'game total'], rpcNote: 'total_min/max on fg_total. Available on every bet type.' },
  h1TotalRange: { group: 'Situation', kind: 'numRange', min: 15, max: 45, step: 0.5, label: '1H total line', aliases: ['1h total'], rpcNote: 'h1_total_min/max.' },
  ttLineRange: { group: 'Situation', kind: 'numRange', min: 10, max: 55, step: 0.5, label: 'Team total line (team)', aliases: ['team total line', 'tt line', 'posted team total'], rpcNote: 'tt_min/max. NEVER use for "spread of N" — that is spreadSize.' },
  oppSpreadSide: { group: 'Situation', kind: 'enum', label: 'FG spread side (opponent)', options: [['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']], aliases: ['opponent spread'], rpcNote: 'Inverts onto subject fg_spread.' },
  oppSpreadSize: { group: 'Situation', kind: 'numRange', min: 0, max: 50, step: 0.5, unit: 'pts', label: 'FG spread size (opponent)', aliases: ['opponent spread'], rpcNote: 'Emitted as inverted subject spread.' },
  oppMlMin: { group: 'Situation', kind: 'mlOdds', bound: 'min', label: 'FG moneyline odds (opponent, min)', aliases: ['opponent moneyline', 'opp ml'], rpcNote: 'f.opp_ml_min (requires RPC support).' },
  oppMlMax: { group: 'Situation', kind: 'mlOdds', bound: 'max', label: 'FG moneyline odds (opponent, max)', aliases: ['opponent moneyline'], rpcNote: 'f.opp_ml_max.' },
  oppTtLineRange: { group: 'Situation', kind: 'numRange', min: 10, max: 55, step: 0.5, label: 'Team total line (opponent)', aliases: ['opponent team total'], rpcNote: 'f.opp_tt_min/max (requires RPC support).' },

  // ── Matchup ──
  primetime: { group: 'Matchup', kind: 'tristate', label: 'Primetime', aliases: ['primetime', 'night game'], rpcNote: 'f.primetime = boolean.' },
  conferenceGame: { group: 'Matchup', kind: 'tristate', label: 'Conference game', aliases: ['conference game', 'non-conference'], rpcNote: 'f.conference_game = boolean.' },
  neutralSite: { group: 'Matchup', kind: 'tristate', label: 'Neutral site', aliases: ['neutral site', 'bowl site'], rpcNote: 'f.neutral_site = boolean.' },
  selectedConferences: { group: 'Matchup', kind: 'multiselect', optionSource: 'cfbConferences', label: 'Conference', aliases: ['conference', 'sec', 'big ten', 'acc', 'big 12'], rpcNote: "1 selected → f.conference; multiple → expanded client-side to that conference's team list." },
  restBye: {
    group: 'Matchup', kind: 'enum', label: 'Rest / Bye',
    options: [['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short week (<7 days)']],
    aliases: ['bye', 'rest', 'off a bye', 'short week', 'weeknight after saturday'],
    rpcNote: "off_bye → rest_min=13; short → rest_max=6 (CFB weekday game after a Saturday); pre_bye → pre_bye=true. Regular season only (postseason rows have no rest chain).",
  },

  // ── Weather ──
  weather: { group: 'Weather', kind: 'enum', label: 'Weather', options: [['any', 'Any'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']], aliases: ['rain', 'snow', 'wet', 'clear', 'cloudy'], rpcNote: "f.weather (condition text complete 2022+, partial before)." },
  dome: { group: 'Weather', kind: 'enum', label: 'Venue', options: [['any', 'Any'], ['dome', 'Dome'], ['outdoor', 'Outdoor']], aliases: ['dome', 'indoor', 'outdoor'], rpcNote: "f.dome = (dome === 'dome')." },
  tempRange: { group: 'Weather', kind: 'numRange', min: -10, max: 110, step: 1, unit: '°F', label: 'Temperature', aliases: ['temperature', 'cold', 'hot'], rpcNote: 'temp_min/max.' },
  windRange: { group: 'Weather', kind: 'numRange', min: 0, max: 60, step: 1, unit: 'mph', label: 'Wind speed', aliases: ['wind', 'windy'], rpcNote: 'wind_min when > 0; wind_max when < 60.' },

  // ── Last game ──
  lastResult: { group: 'Last game', kind: 'enum', label: 'Last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['off a win', 'off a loss'], rpcNote: 'f.last_won = won?1:0.' },
  lastAts: { group: 'Last game', kind: 'enum', label: 'Last game ATS', options: [['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]], aliases: ['covered last'], rpcNote: 'f.last_covered = covered?1:0.' },
  lastTotal: { group: 'Last game', kind: 'enum', label: 'Last game total', options: [['any', 'Any'], ['over', 'Over'], ['under', 'Under']], aliases: ['over last game', 'under last game'], rpcNote: 'f.last_over = over?1:0.' },
  lastRole: { group: 'Last game', kind: 'enum', label: 'Last game role', options: [['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']], rpcNote: "f.last_favorite = (lastRole === 'favorite')." },
  lastOt: { group: 'Last game', kind: 'tristate', label: 'Last game overtime', aliases: ['overtime', 'ot'], rpcNote: 'f.last_overtime = boolean.' },
  lastMargin: { group: 'Last game', kind: 'numRange', min: -80, max: 80, step: 1, unit: 'pts', label: 'Last game margin', aliases: ['margin', 'won by', 'lost by', 'blowout'], rpcNote: 'last_margin_min/max — signed: + won by, − lost by (blowout win = [21, 80]).' },

  // ── Opponent last game ──
  oppLastResult: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game result', options: [['any', 'Any'], ['won', 'Won'], ['lost', 'Lost']], aliases: ['opponent off a win', 'opponent off a loss'], rpcNote: 'f.opp_last_won = won?1:0.' },
  oppLastAts: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game ATS', options: [['any', 'Any'], ['covered', 'Covered'], ['not', "Didn't cover"]], rpcNote: 'f.opp_last_covered = covered?1:0.' },
  oppLastTotal: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game total', options: [['any', 'Any'], ['over', 'Over'], ['under', 'Under']], rpcNote: 'f.opp_last_over = over?1:0.' },
  oppLastRole: { group: 'Opponent last game', kind: 'enum', label: 'Opponent last game role', options: [['any', 'Any'], ['favorite', 'Favorite'], ['underdog', 'Underdog']], rpcNote: "f.opp_last_favorite = (oppLastRole === 'favorite')." },
  oppLastOt: { group: 'Opponent last game', kind: 'tristate', label: 'Opponent last game overtime', rpcNote: 'f.opp_last_overtime = boolean.' },
  oppLastMargin: { group: 'Opponent last game', kind: 'numRange', min: -80, max: 80, step: 1, unit: 'pts', label: 'Opponent last game margin', aliases: ['opponent won by', 'opponent lost by'], rpcNote: 'opp_last_margin_min/max — signed.' },

  // ── Season Record / Cover / Total / Prior Year / H2H / Opponent Record (as-of; keys match NFL) ──
  winPct: { group: 'Season Record', kind: 'pctRange', label: 'Win %', aliases: ['win rate', 'record'], rpcNote: 'win_pct_min/max (0–1).' },
  winStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Win streak', aliases: ['winning streak'], rpcNote: 'win_streak_min/max.' },
  lossStreak: { group: 'Season Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Loss streak', aliases: ['losing streak'], rpcNote: 'loss_streak_min/max.' },
  above500: { group: 'Season Record', kind: 'tristate', label: 'Winning record (>.500)', aliases: ['winning record', 'losing record'], rpcNote: 'f.above_500.' },
  winPctGtOpp: { group: 'Season Record', kind: 'tristate', label: 'Win% better than opponent', rpcNote: 'f.win_pct_gt_opp.' },
  ppg: { group: 'Season Record', kind: 'numRange', min: 0, max: 60, step: 0.5, label: 'Points per game', aliases: ['ppg', 'scoring'], rpcNote: 'ppg_min/max.' },
  paPg: { group: 'Season Record', kind: 'numRange', min: 0, max: 60, step: 0.5, label: 'Points allowed per game', aliases: ['points allowed', 'defense'], rpcNote: 'pa_pg_min/max.' },
  pointDiffPg: { group: 'Season Record', kind: 'numRange', min: -40, max: 40, step: 0.5, label: 'Point differential per game', aliases: ['point differential', 'margin'], rpcNote: 'point_diff_pg_min/max.' },
  minGames: { group: 'Season Record', kind: 'scalarMin', min: 0, max: 10, step: 1, label: 'Min games this season', aliases: ['minimum games', 'sample size'], rpcNote: 'f.min_games when > 0.' },
  atsWinPct: { group: 'Cover Profile', kind: 'pctRange', label: 'ATS win %', aliases: ['ats percentage', 'cover rate'], rpcNote: 'ats_win_pct_min/max (0–1).' },
  atsWinStreak: { group: 'Cover Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'ATS win streak', aliases: ['cover streak'], rpcNote: 'ats_win_streak_min/max.' },
  avgCoverMargin: { group: 'Cover Profile', kind: 'numRange', min: -30, max: 30, step: 0.5, label: 'Avg cover margin', rpcNote: 'avg_cover_margin_min/max.' },
  overPct: { group: 'Total Profile', kind: 'pctRange', label: 'Over %', aliases: ['over rate'], rpcNote: 'over_pct_min/max (0–1).' },
  overStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Over streak', rpcNote: 'over_streak_min/max.' },
  underStreak: { group: 'Total Profile', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Under streak', rpcNote: 'under_streak_min/max.' },
  prevWins: { group: 'Prior Year', kind: 'numRange', min: 0, max: 15, step: 1, label: 'Last season wins', rpcNote: 'prev_wins_min/max.' },
  prevWinPct: { group: 'Prior Year', kind: 'pctRange', label: 'Last season win %', rpcNote: 'prev_win_pct_min/max (0–1).' },
  madePlayoffsPrev: { group: 'Prior Year', kind: 'tristate', label: 'Made a bowl/playoff last year', aliases: ['made a bowl', 'bowl eligible last year'], rpcNote: 'f.made_playoffs_prev (bowl or playoff appearance).' },
  moreWinsThanOppPrev: { group: 'Prior Year', kind: 'tristate', label: 'More wins than opponent last year', rpcNote: 'f.more_wins_than_opp_prev.' },
  h2hLastWin: { group: 'Head-to-Head', kind: 'enum', label: 'Won last meeting', options: [['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']], aliases: ['won last meeting', 'h2h'], rpcNote: 'f.h2h_last_win = yes?1:0.' },
  h2hLastAts: { group: 'Head-to-Head', kind: 'enum', label: 'Covered last meeting', options: [['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]], rpcNote: 'f.h2h_last_ats_win = yes?1:0.' },
  h2hLastOver: { group: 'Head-to-Head', kind: 'enum', label: 'Last meeting total', options: [['any', 'Any'], ['yes', 'Over'], ['no', 'Under']], rpcNote: 'f.h2h_last_over = yes?1:0.' },
  h2hLastHome: { group: 'Head-to-Head', kind: 'tristate', label: 'Was home last meeting', rpcNote: 'f.h2h_last_home.' },
  h2hLastFav: { group: 'Head-to-Head', kind: 'tristate', label: 'Was favorite last meeting', rpcNote: 'f.h2h_last_fav.' },
  h2hSameSeason: { group: 'Head-to-Head', kind: 'tristate', label: 'Same season as last meeting', rpcNote: 'f.h2h_same_season.' },
  h2hSpreadCmp: { group: 'Head-to-Head', kind: 'enum', label: 'Spread vs last meeting', options: [['any', 'Any'], ['lower', 'Lower'], ['higher', 'Higher']], rpcNote: 'lower → h2h_spread_lower; higher → h2h_spread_higher.' },
  oppWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent win %', rpcNote: 'opp_win_pct_min/max (0–1).' },
  oppOverPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent over %', rpcNote: 'opp_over_pct_min/max (0–1).' },
  oppWinStreak: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Opponent win streak', rpcNote: 'opp_win_streak_min/max.' },
  oppLossStreak: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 16, step: 1, label: 'Opponent loss streak', aliases: ['opponent losing streak'], rpcNote: 'opp_loss_streak_min/max.' },
  oppPpg: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 60, step: 0.5, label: 'Opponent points per game', aliases: ['opponent ppg', 'opponent scoring'], rpcNote: 'opp_ppg_min/max.' },
  oppPaPg: { group: 'Opponent Record', kind: 'numRange', min: 0, max: 60, step: 0.5, label: 'Opponent points allowed per game', aliases: ['opponent points allowed', 'opponent defense'], rpcNote: 'opp_pa_pg_min/max.' },
  oppPrevWinPct: { group: 'Opponent Record', kind: 'pctRange', label: 'Opponent last-season win %', rpcNote: 'opp_prev_win_pct_min/max (0–1).' },
};

export const CFB_DIMENSION_KEYS = Object.keys(CFB_FILTER_DIMENSIONS) as Array<Exclude<keyof CfbWebFilterSnapshot, 'betType'>>;

// ── Side-market symmetry (same tautology as NFL; ranked_matchup is GAME-level — its RPC predicate
// evaluates identically for both rows of a game, so it keeps the mirror intact) ──
export const CFB_SIDE_MARKETS: readonly CfbBetType[] = ['fg_spread', 'fg_ml', 'h1_spread', 'h1_ml'];
export const CFB_SIDE_SYMMETRIC_DIMS = [
  'seasons', 'weeks', 'gameType', 'rankedMatchup', 'lineRange', 'h1TotalRange', 'ttLineRange',
  'spreadSize', 'h1SpreadSize', 'oppSpreadSize', 'oppTtLineRange',
  'primetime', 'conferenceGame', 'neutralSite', 'tempRange', 'windRange', 'weather', 'dome', 'daysOfWeek', 'minGames',
] as const;
export const CFB_SIDE_BREAKING_DIMS = CFB_DIMENSION_KEYS.filter(
  (k) => !(CFB_SIDE_SYMMETRIC_DIMS as readonly string[]).includes(k),
);
export function isSideSymmetricCfb(s: CfbWebFilterSnapshot): boolean {
  if (!CFB_SIDE_MARKETS.includes(s.betType as CfbBetType)) return false;
  return CFB_SIDE_BREAKING_DIMS.every(
    (k) => JSON.stringify(s[k]) === JSON.stringify(DEFAULT_CFB_SNAPSHOT[k]),
  );
}

function cfbNumRangeBounds(dim: EngineDimension & { kind: 'numRange' }, betType: string): [number, number] {
  const base: [number, number] = dim.boundsByBetType?.[betType]
    ? [dim.boundsByBetType[betType]![0], dim.boundsByBetType[betType]![1]]
    : [dim.min, dim.max];
  if (dim.limitedFloor != null && (CFB_LIMITED_BET_TYPES as readonly string[]).includes(betType)) {
    base[0] = Math.max(base[0], dim.limitedFloor);
  }
  return base;
}

function cfbBetTypeSideEffects(next: CfbWebFilterSnapshot): void {
  const bt = next.betType;
  const floor = cfbNumRangeBounds(CFB_FILTER_DIMENSIONS.seasons as EngineDimension & { kind: 'numRange' }, bt)[0];
  if (next.seasons[0] < floor) next.seasons = [floor, next.seasons[1]];
}

export const CFB_SPORT_CONFIG: SportFilterConfig<CfbWebFilterSnapshot> = {
  sport: 'cfb',
  betTypes: CFB_BET_TYPES,
  defaultSnapshot: DEFAULT_CFB_SNAPSHOT,
  dimensions: CFB_FILTER_DIMENSIONS as unknown as Record<string, EngineDimension>,
  optionLists: {
    cfbTeams: { values: CFB_TEAMS },
    cfbConferences: { values: CFB_CONFERENCES, aliases: { 'aac': 'American Athletic', 'american': 'American Athletic', 'cusa': 'Conference USA', 'c-usa': 'Conference USA', 'mac': 'Mid-American', 'independents': 'FBS Independents', 'independent': 'FBS Independents' } },
    daysOfWeek: { values: NFL_DAYS, aliases: NFL_DAY_ALIASES },
  },
  applyBetTypeSideEffects: cfbBetTypeSideEffects,
  numRangeBounds: cfbNumRangeBounds,
};

/** Runtime parity check — dimensions must exactly cover the non-betType snapshot keys. */
export function assertCfbDimensionParity(): void {
  const snapKeys = Object.keys(DEFAULT_CFB_SNAPSHOT).filter((k) => k !== 'betType').sort();
  const dimKeys = [...CFB_DIMENSION_KEYS].sort();
  const missing = snapKeys.filter((k) => !dimKeys.includes(k as never));
  const extra = dimKeys.filter((k) => !snapKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`filterSchemaCfb drift — missing: [${missing.join(', ')}]; extra: [${extra.join(', ')}]`);
  }
}
