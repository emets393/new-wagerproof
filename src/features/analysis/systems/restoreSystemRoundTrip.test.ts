import { describe, expect, it } from 'vitest';
import { normalizeNflSavedFilterSnapshot } from '../normalizeSavedFilterSnapshot';
import { isSideSymmetric } from '../filterSchema';
import { TREND_ADAPTERS } from '../sportAdapters';

/**
 * "Andy Reid Playoffs" — real MAIN row shape (filters + rpc_filters).
 * Restoring via normalize → toRpcFilters must round-trip the saved RPC payload
 * so My Systems tap-to-load shows the same 21-game / 66.7% analysis.
 */
const ANDY_REID_PLAYOFFS_FILTERS: Record<string, unknown> = {
  above500: null,
  atsWinPct: [0, 100],
  atsWinStreak: [0, 16],
  avgCoverMargin: [-15, 15],
  betType: 'fg_spread',
  coach: 'Andy Reid',
  daysOfWeek: [],
  division: null,
  dome: 'any',
  favDog: 'any',
  h1MlMax: '',
  h1MlMin: '',
  h1SpreadSide: 'any',
  h1SpreadSize: [0, 14],
  h1TotalRange: [15, 35],
  h2hLastAts: 'any',
  h2hLastFav: null,
  h2hLastHome: null,
  h2hLastOver: 'any',
  h2hLastWin: 'any',
  h2hSameSeason: null,
  h2hSpreadCmp: 'any',
  lastAts: 'any',
  lastMargin: [-60, 60],
  lastOt: null,
  lastResult: 'any',
  lastRole: 'any',
  lastTotal: 'any',
  lineRange: [30, 60],
  lossStreak: [0, 16],
  madePlayoffsPrev: null,
  minGames: 0,
  mlMax: '',
  mlMin: '',
  moreWinsThanOppPrev: null,
  oppLastAts: 'any',
  oppLastMargin: [-60, 60],
  oppLastOt: null,
  oppLastResult: 'any',
  oppLastRole: 'any',
  oppLastTotal: 'any',
  oppLossStreak: [0, 16],
  oppMlMax: '',
  oppMlMin: '',
  oppOverPct: [0, 100],
  oppPaPg: [0, 40],
  oppPpg: [0, 40],
  oppPrevWinPct: [0, 100],
  oppSpreadSide: 'any',
  oppSpreadSize: [0, 20],
  oppTtLineRange: [10, 40],
  oppWinPct: [0, 100],
  oppWinStreak: [0, 16],
  opponents: [],
  overPct: [0, 100],
  overStreak: [0, 16],
  paPg: [0, 40],
  playoffRound: 'any',
  pointDiffPg: [-20, 20],
  ppg: [0, 40],
  precip: 'any',
  prevWinPct: [0, 100],
  prevWins: [0, 16],
  primetime: null,
  referee: 'any',
  restBye: 'any',
  seasonType: 'postseason',
  seasons: [2018, 2025],
  side: 'any',
  spreadSide: 'any',
  spreadSize: [0, 20],
  teamDivisions: [],
  teams: [],
  tempRange: [-10, 100],
  ttLineRange: [10, 40],
  underStreak: [0, 16],
  weeks: [1, 18],
  winPct: [0, 100],
  winPctGtOpp: null,
  winStreak: [0, 16],
  windRange: [0, 60],
};

const ANDY_REID_RPC = {
  coach: 'Andy Reid',
  season_min: 2018,
  season_type: 'postseason',
};

describe('My Systems restore round-trip (Andy Reid Playoffs)', () => {
  it('preserves coach + postseason through normalize', () => {
    const snap = normalizeNflSavedFilterSnapshot(ANDY_REID_PLAYOFFS_FILTERS, 'fg_spread');
    expect(snap.coach).toBe('Andy Reid');
    expect(snap.seasonType).toBe('postseason');
    expect(snap.betType).toBe('fg_spread');
    expect(isSideSymmetric(snap)).toBe(false);
  });

  it('re-derives the exact saved rpc_filters', () => {
    const snap = TREND_ADAPTERS.nfl.normalize(ANDY_REID_PLAYOFFS_FILTERS, 'fg_spread');
    const rpc = TREND_ADAPTERS.nfl.toRpcFilters(snap);
    expect(rpc).toEqual(ANDY_REID_RPC);
  });

  it('still works when bet_type is only on the row (not inside filters)', () => {
    const { betType: _drop, ...withoutBet } = ANDY_REID_PLAYOFFS_FILTERS;
    const snap = TREND_ADAPTERS.nfl.normalize(withoutBet, 'fg_spread');
    expect(snap.betType).toBe('fg_spread');
    expect(TREND_ADAPTERS.nfl.toRpcFilters(snap)).toEqual(ANDY_REID_RPC);
  });
});
