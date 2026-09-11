import type {
  BattingRegression,
  BullpenFatigue,
  LRSplitEntry,
  PitcherRegression,
  SuggestedPick,
  WeatherParkFlag,
} from '@/hooks/useMLBRegressionReport';
import type { MLBSeriesSignal } from '@/hooks/useMLBSeriesSignals';
import type { PerfectStormTier } from '@/hooks/useMLBPerfectStormRecords';

/**
 * Normalized model for the /mlb/daily-regression-report split view.
 *
 * The report payload is organized by *signal type* (a list of pitchers, a list
 * of batting lines, a list of picks...). The split view is organized by *game*,
 * so `buildFeed.ts` inverts it: one `RegressionGame` carries everything the
 * report says about one matchup.
 */

export interface RegressionTeam {
  /** Full name exactly as the report spells it (used for joins). */
  name: string;
  abbrev: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
}

/** A starter flagged for regression, tagged with which way it should break. */
export interface RegressionPitcher extends PitcherRegression {
  /** `negative` = ERA has been luckier than the peripherals, so it should rise. */
  direction: 'negative' | 'positive';
}

/** A lineup flagged for regression, tagged with which way it should break. */
export interface RegressionBatting extends BattingRegression {
  /** `heat` = under-performing its contact quality, so runs should come. */
  direction: 'heat' | 'cool';
}

export interface RegressionGame {
  /** URL id — MLB `game_pk`, which is already unique per game of a doubleheader. */
  id: string;
  gamePk: number;
  away: RegressionTeam;
  home: RegressionTeam;
  /** ISO timestamp when the report carried one. */
  gameTimeEt: string | null;
  /** "7:05 PM ET", or "Time TBD" when the report has no first pitch. */
  gameTimeLabel: string;
  /** Sortable within-day key; games with no time sort last. */
  timeSortKey: string;
  isDoubleheader: boolean;
  gameNumber: number;
  venue: string | null;

  picks: SuggestedPick[];
  /** Strongest tier among this game's picks; drives the feed badge and sort. */
  topTier: PerfectStormTier | null;

  pitchers: RegressionPitcher[];
  batting: RegressionBatting[];
  bullpens: BullpenFatigue[];
  signals: MLBSeriesSignal[];
  weather: WeatherParkFlag | null;
  lrSplits: LRSplitEntry[];

  /** Everything except picks — "how much else is the report saying about this game". */
  signalCount: number;
}

export type RegressionFilter = 'all' | 'picks';

export const REGRESSION_FILTER_LABELS: Record<RegressionFilter, string> = {
  all: 'All games',
  picks: 'With picks',
};

export type RegressionSortKey = 'time' | 'tier' | 'signals';

export const REGRESSION_SORT_LABELS: Record<RegressionSortKey, string> = {
  time: 'First pitch',
  tier: 'Pick conviction',
  signals: 'Most signals',
};

/** Conviction order — higher wins when a game carries several picks. */
export const TIER_RANK: Record<PerfectStormTier, number> = {
  hammer: 4,
  ps: 3,
  lean: 2,
  watch: 1,
};

export const TIER_META: Record<
  PerfectStormTier,
  { short: string; long: string; blurb: string; accent: string }
> = {
  hammer: {
    short: 'Hammer',
    long: 'Perfect Storm Hammer',
    blurb: 'Highest conviction — every regression angle and the model agree.',
    accent: '#a78bfa',
  },
  ps: {
    short: 'Perfect Storm',
    long: 'Perfect Storm',
    blurb: 'Regression and the model line up on the same side.',
    accent: '#22c55e',
  },
  lean: {
    short: 'Strong lean',
    long: 'Strong Lean',
    blurb: 'A real edge, but one supporting angle is missing.',
    accent: '#3b82f6',
  },
  watch: {
    short: 'Watch',
    long: 'Watch',
    blurb: 'Worth tracking — the weakest tier we publish.',
    accent: '#f59e0b',
  },
};

export const BET_TYPE_LABEL: Record<SuggestedPick['bet_type'], string> = {
  full_ml: 'Full game · Moneyline',
  full_ou: 'Full game · Total',
  full_rl: 'Full game · Run line',
  f5_ml: 'First 5 · Moneyline',
  f5_ou: 'First 5 · Total',
  f5_rl: 'First 5 · Run line',
};

/** The four markets the accuracy tables are keyed on. */
export type AccuracyBetType = 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou';

export const ACCURACY_BET_TYPES: AccuracyBetType[] = ['full_ml', 'full_ou', 'f5_ml', 'f5_ou'];

export const ACCURACY_BET_TYPE_LABEL: Record<AccuracyBetType, string> = {
  full_ml: 'Full ML',
  full_ou: 'Full O/U',
  f5_ml: 'F5 ML',
  f5_ou: 'F5 O/U',
};
