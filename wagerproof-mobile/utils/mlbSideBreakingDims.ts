// Side-market symmetry for MLB "Save this System" (see .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md).
//
// A side market (ml / rl / f5_ml / f5_rl) is "symmetric" when the current filters
// describe the GAME but never pick a specific side — so ~50% of matching bets land
// on each team and the hit rate is a tautology. In that case the Save dialog forces
// a Home/Away/Favorite/Underdog choice (which literally sets a filter) before asking
// ON vs AGAINST. Totals markets are never symmetric (over/under is always meaningful).
//
// These two arrays are the canonical web dim lists (verbatim from
// src/features/analysis/filterSchemaMlb.ts) kept here for parity/reference. The mobile
// filter state only implements a subset of these dims; `isMlbSideSymmetric` checks the
// mobile-present breaking dims against their defaults.

import {
  defaultMlbFilters,
  type MlbAnalysisBetType,
  type MlbAnalysisFilterState,
} from '@/types/mlbHistoricalAnalysis';

/** Dims that DON'T pick a side — present on both teams equally (web key names). */
export const MLB_SIDE_SYMMETRIC_DIMS = [
  'seasons', 'months', 'division', 'interleague', 'lineRange', 'f5TotalRange', 'timeMin', 'timeMax',
  'daysOfWeek', 'doubleheader', 'seriesGame', 'tempRange', 'windRange', 'windDir', 'dome', 'pfRuns', 'minGames',
] as const;

/** Dims that DEFINE a side — if any differs from default the market isn't symmetric (web key names). */
export const MLB_SIDE_BREAKING_DIMS = [
  'teams', 'opponents', 'side', 'favDog', 'mlMin', 'mlMax', 'trip', 'switchGame', 'restRange',
  'spNames', 'oppSpNames', 'spHand', 'oppSpHand', 'spXfip', 'oppSpXfip', 'bpIp', 'bpXfip',
  'lastResult', 'lastAts', 'lastTotal', 'lastRole', 'lastMargin', 'winLossStreak',
  'oppLastResult', 'oppLastAts', 'oppLastTotal', 'oppLastRole', 'oppLastMargin',
  'winPct', 'winStreak', 'lossStreak', 'rpg', 'rapg', 'runDiffPg', 'rlCoverPct', 'rlStreak',
  'overPct', 'overStreak', 'underStreak', 'prevWins', 'prevWinPct',
  'h2hLastWin', 'h2hLastAts', 'h2hLastOver', 'h2hLastMargin', 'h2hLastHome', 'h2hLastFav', 'h2hSameSeason',
  'oppWinPct', 'oppOverPct', 'oppRlCoverPct', 'oppWinStreak', 'oppLossStreak', 'oppRpg', 'oppRapg', 'oppPrevWinPct',
] as const;

export const MLB_SIDE_MARKETS: readonly MlbAnalysisBetType[] = ['ml', 'rl', 'f5_ml', 'f5_rl'];
export const MLB_TOTAL_MARKETS: readonly MlbAnalysisBetType[] = ['total', 'f5_total'];

export function isMlbSideMarket(betType: MlbAnalysisBetType): boolean {
  return MLB_SIDE_MARKETS.includes(betType);
}

export function isMlbTotalMarket(betType: MlbAnalysisBetType): boolean {
  return MLB_TOTAL_MARKETS.includes(betType);
}

/**
 * True when a SIDE market's filters are symmetric — i.e. no mobile-present breaking
 * dim differs from its default. Only the breaking dims that exist on the mobile filter
 * state are checked (see MLB_SIDE_BREAKING_DIMS for the full web list).
 */
export function isMlbSideSymmetric(
  f: MlbAnalysisFilterState,
  betType: MlbAnalysisBetType,
): boolean {
  if (!isMlbSideMarket(betType)) return false;
  const d = defaultMlbFilters();
  const anyBreaking =
    f.teams.length > 0 ||
    f.opponents.length > 0 ||
    f.side !== d.side ||
    f.favDog !== d.favDog ||
    f.mlMin.trim() !== '' ||
    f.mlMax.trim() !== '' ||
    f.tripMin != null ||
    f.tripMax != null ||
    f.switchGame !== d.switchGame ||
    f.restMin != null ||
    f.restMax != null ||
    f.streakMin.trim() !== '' ||
    f.streakMax.trim() !== '' ||
    f.lastResult !== d.lastResult ||
    f.lastMarginMin.trim() !== '' ||
    f.lastMarginMax.trim() !== '' ||
    f.sp.length > 0 ||
    f.oppSp.length > 0 ||
    f.spHand !== d.spHand ||
    f.oppSpHand !== d.oppSpHand ||
    f.spXfipMin != null ||
    f.spXfipMax != null ||
    f.oppSpXfipMin != null ||
    f.oppSpXfipMax != null ||
    f.bpIpMin != null ||
    f.bpIpMax != null ||
    f.bpXfipMin != null ||
    f.bpXfipMax != null;
  return !anyBreaking;
}
