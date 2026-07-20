/**
 * Saved Historical Analysis filters are shared between web and iOS.
 * Web stores tuple fields (`seasons`, `spreadSize`, …); iOS stores flat
 * fields (`seasonMin`, `spreadMin`, …). Normalize either shape before restore.
 */

type NumPair = [number, number];

interface CfbBaseFilterSnapshot {
  betType: string;
  seasons: NumPair;
  weeks: NumPair;
  side: string;
  favDog: string;
  gameType: string;
  rankedMatchup: string;
  /** Full-game spread (subject team) — available on every result market. */
  spreadSide: string;
  spreadSize: NumPair;
  /** Full-game total line — available on every result market. */
  lineRange: NumPair;
  h1SpreadSide: string;
  h1SpreadSize: NumPair;
  h1TotalRange: NumPair;
  ttLineRange: NumPair;
  mlMin: string;
  mlMax: string;
  h1MlMin: string;
  h1MlMax: string;
  oppSpreadSide: string;
  oppSpreadSize: NumPair;
  oppMlMin: string;
  oppMlMax: string;
  oppTtLineRange: NumPair;
  primetime: boolean | null;
  conferenceGame: boolean | null;
  neutralSite: boolean | null;
  selectedConferences: string[];
  tempRange: NumPair;
  /** Wind speed mph [min, max]; default [0, 60] = unconstrained. */
  windRange: NumPair;
  weather: string;
  dome: string;
  lastResult: string;
  lastAts: string;
  lastTotal: string;
  lastRole: string;
  lastOt: boolean | null;
  restBye: string;
  teams: string[];
  opponents: string[];
  daysOfWeek: string[];
  lastMargin: NumPair;
  oppLastResult: string;
  oppLastAts: string;
  oppLastTotal: string;
  oppLastRole: string;
  oppLastOt: boolean | null;
  oppLastMargin: NumPair;
}
export interface CfbWebFilterSnapshot extends CfbBaseFilterSnapshot, NflAsOfFilterSnapshot {}

/** Season-to-date / as-of Systems filters (UI percents are 0–100; RPC gets 0–1). */
export interface NflAsOfFilterSnapshot {
  winPct: NumPair;
  winStreak: NumPair;
  lossStreak: NumPair;
  above500: boolean | null;
  winPctGtOpp: boolean | null;
  ppg: NumPair;
  paPg: NumPair;
  pointDiffPg: NumPair;
  minGames: number;
  atsWinPct: NumPair;
  atsWinStreak: NumPair;
  avgCoverMargin: NumPair;
  overPct: NumPair;
  overStreak: NumPair;
  underStreak: NumPair;
  prevWins: NumPair;
  prevWinPct: NumPair;
  madePlayoffsPrev: boolean | null;
  moreWinsThanOppPrev: boolean | null;
  h2hLastWin: string;
  h2hLastAts: string;
  h2hLastOver: string;
  h2hLastHome: boolean | null;
  h2hLastFav: boolean | null;
  h2hSameSeason: boolean | null;
  h2hSpreadCmp: string;
  oppWinPct: NumPair;
  oppOverPct: NumPair;
  oppWinStreak: NumPair;
  oppLossStreak: NumPair;
  oppPpg: NumPair;
  oppPaPg: NumPair;
  oppPrevWinPct: NumPair;
}

export const NFL_ASOF_DEFAULTS: NflAsOfFilterSnapshot = {
  winPct: [0, 100],
  winStreak: [0, 16],
  lossStreak: [0, 16],
  above500: null,
  winPctGtOpp: null,
  ppg: [0, 40],
  paPg: [0, 40],
  pointDiffPg: [-20, 20],
  minGames: 0,
  atsWinPct: [0, 100],
  atsWinStreak: [0, 16],
  avgCoverMargin: [-15, 15],
  overPct: [0, 100],
  overStreak: [0, 16],
  underStreak: [0, 16],
  prevWins: [0, 16],
  prevWinPct: [0, 100],
  madePlayoffsPrev: null,
  moreWinsThanOppPrev: null,
  h2hLastWin: 'any',
  h2hLastAts: 'any',
  h2hLastOver: 'any',
  h2hLastHome: null,
  h2hLastFav: null,
  h2hSameSeason: null,
  h2hSpreadCmp: 'any',
  oppWinPct: [0, 100],
  oppOverPct: [0, 100],
  oppWinStreak: [0, 16],
  oppLossStreak: [0, 16],
  oppPpg: [0, 40],
  oppPaPg: [0, 40],
  oppPrevWinPct: [0, 100],
};

/** CFB as-of defaults — CFB scoring/season lengths differ from NFL. */
export const CFB_ASOF_DEFAULTS: NflAsOfFilterSnapshot = {
  ...NFL_ASOF_DEFAULTS,
  ppg: [0, 60], paPg: [0, 60], pointDiffPg: [-40, 40], avgCoverMargin: [-30, 30], prevWins: [0, 15],
  oppPpg: [0, 60], oppPaPg: [0, 60],
};

export interface NflWebFilterSnapshot extends NflAsOfFilterSnapshot {
  betType: string;
  seasons: NumPair;
  weeks: NumPair;
  side: string;
  seasonType: string;
  playoffRound: string;
  favDog: string;
  /** Full-game spread (subject team) — available on every result market. */
  spreadSide: string;
  spreadSize: NumPair;
  /** Full-game total line — available on every result market. */
  lineRange: NumPair;
  h1SpreadSide: string;
  h1SpreadSize: NumPair;
  h1TotalRange: NumPair;
  ttLineRange: NumPair;
  mlMin: string;
  mlMax: string;
  h1MlMin: string;
  h1MlMax: string;
  oppSpreadSide: string;
  oppSpreadSize: NumPair;
  oppMlMin: string;
  oppMlMax: string;
  oppTtLineRange: NumPair;
  primetime: boolean | null;
  division: boolean | null;
  dome: string;
  tempRange: NumPair;
  /** Wind speed mph [min, max]; default [0, 60] = unconstrained. */
  windRange: NumPair;
  precip: string;
  restBye: string;
  coach: string;
  referee: string;
  lastResult: string;
  lastAts: string;
  lastTotal: string;
  lastRole: string;
  lastOt: boolean | null;
  lastMargin: NumPair;
  oppLastResult: string;
  oppLastAts: string;
  oppLastTotal: string;
  oppLastRole: string;
  oppLastOt: boolean | null;
  oppLastMargin: NumPair;
  teams: string[];
  opponents: string[];
  daysOfWeek: string[];
  teamDivisions: string[];
}

/** Legacy windMax (upper-only) → windRange; also accepts windMin + windMax (iOS). */
export function normalizeWindRange(r: Record<string, unknown>, maxDefault = 60): NumPair {
  if (Array.isArray(r.windRange) && r.windRange.length >= 2) {
    return [Number(r.windRange[0]) || 0, Number(r.windRange[1]) || maxDefault];
  }
  const max = typeof r.windMax === 'number' ? r.windMax : maxDefault;
  const min = typeof r.windMin === 'number' ? r.windMin : 0;
  return [min, max];
}

function isNativeSnapshot(raw: Record<string, unknown>): boolean {
  return typeof raw.seasonMin === 'number' || typeof raw.seasonMax === 'number';
}

function asPair(value: unknown, fallback: NumPair): NumPair {
  if (Array.isArray(value) && value.length >= 2) {
    const a = Number(value[0]);
    const b = Number(value[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return [a, b];
  }
  return fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalBool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

const NFL_MARGIN_BOUNDS: NumPair = [-60, 60];
/** Back-compat: convert an old blowout string ('win'/'loss') to a margin range; else the full range. */
function blowoutFallback(v: unknown): NumPair {
  if (v === 'win') return [21, 60];
  if (v === 'loss') return [-60, -21];
  return NFL_MARGIN_BOUNDS;
}

/** "Last game" filters — shared shape across web + iOS, both sports. Flat string/bool keys. */
function lastGameFields(r: Record<string, unknown>) {
  return {
    lastResult: str(r.lastResult, 'any'),
    lastAts: str(r.lastAts, 'any'),
    lastTotal: str(r.lastTotal, 'any'),
    lastRole: str(r.lastRole, 'any'),
    lastOt: optionalBool(r.lastOt),
  };
}

const CFB_MARGIN_BOUNDS: NumPair = [-80, 80];
/** Back-compat: CFB's retired blowout enum ('win'/'loss') → the equivalent margin range. */
function cfbBlowoutFallback(v: unknown): NumPair {
  if (v === 'win') return [21, 80];
  if (v === 'loss') return [-80, -21];
  return CFB_MARGIN_BOUNDS;
}

/** NFL subject "Last game" — like lastGameFields but a signed margin range instead of the blowout enum. */
function nflLastGameFields(r: Record<string, unknown>) {
  return {
    lastResult: str(r.lastResult, 'any'),
    lastAts: str(r.lastAts, 'any'),
    lastTotal: str(r.lastTotal, 'any'),
    lastRole: str(r.lastRole, 'any'),
    lastOt: optionalBool(r.lastOt),
    lastMargin: asPair(r.lastMargin, blowoutFallback(r.lastBlowout)),
  };
}

/** "Opponent last game" filters — the OPPONENT's previous game (opp_last_* columns). NFL only. */
function oppLastGameFields(r: Record<string, unknown>) {
  return {
    oppLastResult: str(r.oppLastResult, 'any'),
    oppLastAts: str(r.oppLastAts, 'any'),
    oppLastTotal: str(r.oppLastTotal, 'any'),
    oppLastRole: str(r.oppLastRole, 'any'),
    oppLastOt: optionalBool(r.oppLastOt),
    oppLastMargin: asPair(r.oppLastMargin, blowoutFallback(r.oppLastBlowout)),
  };
}

function asofFields(r: Record<string, unknown>, d: NflAsOfFilterSnapshot = NFL_ASOF_DEFAULTS): NflAsOfFilterSnapshot {
  return {
    winPct: asPair(r.winPct, d.winPct),
    winStreak: asPair(r.winStreak, d.winStreak),
    lossStreak: asPair(r.lossStreak, d.lossStreak),
    above500: optionalBool(r.above500),
    winPctGtOpp: optionalBool(r.winPctGtOpp),
    ppg: asPair(r.ppg, d.ppg),
    paPg: asPair(r.paPg, d.paPg),
    pointDiffPg: asPair(r.pointDiffPg, d.pointDiffPg),
    minGames: typeof r.minGames === 'number' ? r.minGames : d.minGames,
    atsWinPct: asPair(r.atsWinPct, d.atsWinPct),
    atsWinStreak: asPair(r.atsWinStreak, d.atsWinStreak),
    avgCoverMargin: asPair(r.avgCoverMargin, d.avgCoverMargin),
    overPct: asPair(r.overPct, d.overPct),
    overStreak: asPair(r.overStreak, d.overStreak),
    underStreak: asPair(r.underStreak, d.underStreak),
    prevWins: asPair(r.prevWins, d.prevWins),
    prevWinPct: asPair(r.prevWinPct, d.prevWinPct),
    madePlayoffsPrev: optionalBool(r.madePlayoffsPrev),
    moreWinsThanOppPrev: optionalBool(r.moreWinsThanOppPrev),
    h2hLastWin: str(r.h2hLastWin, 'any'),
    h2hLastAts: str(r.h2hLastAts, 'any'),
    h2hLastOver: str(r.h2hLastOver, 'any'),
    h2hLastHome: optionalBool(r.h2hLastHome),
    h2hLastFav: optionalBool(r.h2hLastFav),
    h2hSameSeason: optionalBool(r.h2hSameSeason),
    h2hSpreadCmp: str(r.h2hSpreadCmp, 'any'),
    oppWinPct: asPair(r.oppWinPct, d.oppWinPct),
    oppOverPct: asPair(r.oppOverPct, d.oppOverPct),
    oppWinStreak: asPair(r.oppWinStreak, d.oppWinStreak),
    oppLossStreak: asPair(r.oppLossStreak, d.oppLossStreak),
    oppPpg: asPair(r.oppPpg, d.oppPpg),
    oppPaPg: asPair(r.oppPaPg, d.oppPaPg),
    oppPrevWinPct: asPair(r.oppPrevWinPct, d.oppPrevWinPct),
  };
}

/** CFB Systems extras (as-of + opp-last + margin + rest + days) — shared by both CFB normalize branches. */
function cfbSystemsFields(r: Record<string, unknown>) {
  return {
    daysOfWeek: stringList(r.daysOfWeek),
    restBye: str(r.restBye, 'any'),
    lastMargin: asPair(r.lastMargin, cfbBlowoutFallback(r.lastBlowout)),
    oppLastResult: str(r.oppLastResult, 'any'),
    oppLastAts: str(r.oppLastAts, 'any'),
    oppLastTotal: str(r.oppLastTotal, 'any'),
    oppLastRole: str(r.oppLastRole, 'any'),
    oppLastOt: optionalBool(r.oppLastOt),
    oppLastMargin: asPair(r.oppLastMargin, cfbBlowoutFallback(r.oppLastBlowout)),
    ...asofFields(r, CFB_ASOF_DEFAULTS),
  };
}

/** Resolve multi-conference selection from web or iOS saved snapshots. */
function resolveSelectedConferences(raw: Record<string, unknown>): string[] {
  const selected = raw.selectedConferences;
  if (Array.isArray(selected) && selected.length > 0) {
    return selected.filter((c): c is string => typeof c === 'string' && c.length > 0);
  }
  const legacy = raw.conference;
  if (typeof legacy === 'string' && legacy !== 'any') return [legacy];
  return [];
}

/** Cross-market line fields shared by NFL/CFB (web + iOS native shapes). */
function footballCrossMarketLines(
  r: Record<string, unknown>,
  betType: string,
  native: boolean,
  bounds: {
    fgSpreadMax: number;
    h1SpreadMax: number;
    fgTotal: NumPair;
    h1Total: NumPair;
    tt: NumPair;
  },
): {
  spreadSide: string;
  spreadSize: NumPair;
  lineRange: NumPair;
  h1SpreadSide: string;
  h1SpreadSize: NumPair;
  h1TotalRange: NumPair;
  ttLineRange: NumPair;
  mlMin: string;
  mlMax: string;
  h1MlMin: string;
  h1MlMax: string;
  oppSpreadSide: string;
  oppSpreadSize: NumPair;
  oppMlMin: string;
  oppMlMax: string;
  oppTtLineRange: NumPair;
} {
  const spreadSide = str(r.spreadSide, 'any');
  const spreadSize = native
    ? [Number(r.spreadMin ?? 0), Number(r.spreadMax ?? bounds.fgSpreadMax)] as NumPair
    : asPair(r.spreadSize, [0, bounds.fgSpreadMax]);
  let lineRange = native
    ? [Number(r.lineMin ?? bounds.fgTotal[0]), Number(r.lineMax ?? bounds.fgTotal[1])] as NumPair
    : asPair(r.lineRange, bounds.fgTotal);
  let h1SpreadSide = str(r.h1SpreadSide, 'any');
  let h1SpreadSize = native
    ? ([Number(r.h1SpreadMin ?? 0), Number(r.h1SpreadMax ?? bounds.h1SpreadMax)] as NumPair)
    : asPair(r.h1SpreadSize, [0, bounds.h1SpreadMax]);
  let h1TotalRange = native
    ? ([Number(r.h1TotalMin ?? bounds.h1Total[0]), Number(r.h1TotalMax ?? bounds.h1Total[1])] as NumPair)
    : asPair(r.h1TotalRange, bounds.h1Total);
  let ttLineRange = native
    ? ([Number(r.ttLineMin ?? bounds.tt[0]), Number(r.ttLineMax ?? bounds.tt[1])] as NumPair)
    : asPair(r.ttLineRange, bounds.tt);

  // Legacy: single lineRange / spreadSize were bet-type-gated. Promote into the matching slot.
  const hasSplitTotals = native
    ? (r.h1TotalMin != null || r.ttLineMin != null)
    : (r.h1TotalRange != null || r.ttLineRange != null);
  const hasSplitSpreads = native
    ? (r.h1SpreadMin != null || r.h1SpreadSide != null)
    : (r.h1SpreadSize != null || r.h1SpreadSide != null);
  if (!hasSplitTotals) {
    if (betType === 'team_total') {
      ttLineRange = lineRange;
      lineRange = [...bounds.fgTotal];
    } else if (betType === 'h1_total') {
      h1TotalRange = lineRange;
      lineRange = [...bounds.fgTotal];
    }
  }
  if (!hasSplitSpreads && betType === 'h1_spread') {
    h1SpreadSide = spreadSide;
    h1SpreadSize = [
      Math.min(spreadSize[0], bounds.h1SpreadMax),
      Math.min(spreadSize[1], bounds.h1SpreadMax),
    ];
  }

  return {
    spreadSide,
    spreadSize,
    lineRange,
    h1SpreadSide,
    h1SpreadSize,
    h1TotalRange,
    ttLineRange,
    mlMin: str(r.mlMin, ''),
    mlMax: str(r.mlMax, ''),
    h1MlMin: str(r.h1MlMin, ''),
    h1MlMax: str(r.h1MlMax, ''),
    oppSpreadSide: str(r.oppSpreadSide, 'any'),
    oppSpreadSize: native
      ? ([Number(r.oppSpreadMin ?? 0), Number(r.oppSpreadMax ?? bounds.fgSpreadMax)] as NumPair)
      : asPair(r.oppSpreadSize, [0, bounds.fgSpreadMax]),
    oppMlMin: str(r.oppMlMin, ''),
    oppMlMax: str(r.oppMlMax, ''),
    oppTtLineRange: native
      ? ([Number(r.oppTtLineMin ?? bounds.tt[0]), Number(r.oppTtLineMax ?? bounds.tt[1])] as NumPair)
      : asPair(r.oppTtLineRange, bounds.tt),
  };
}

export function normalizeCfbSavedFilterSnapshot(
  raw: Record<string, unknown> | null | undefined,
  rowBetType?: string,
): CfbWebFilterSnapshot {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || 'fg_spread');
  const native = isNativeSnapshot(r);
  const lines = footballCrossMarketLines(r, betType, native, {
    fgSpreadMax: 50,
    h1SpreadMax: 28,
    fgTotal: [30, 80],
    h1Total: [15, 45],
    tt: [10, 55],
  });

  if (!native) {
    return {
      betType,
      seasons: asPair(r.seasons, [2016, 2025]),
      weeks: asPair(r.weeks, [1, 16]),
      side: str(r.side, 'any'),
      favDog: str(r.favDog, 'any'),
      gameType: str(r.gameType, 'any'),
      rankedMatchup: str(r.rankedMatchup, 'any'),
      ...lines,
      primetime: optionalBool(r.primetime),
      conferenceGame: optionalBool(r.conferenceGame),
      neutralSite: optionalBool(r.neutralSite),
      selectedConferences: resolveSelectedConferences(r),
      tempRange: asPair(r.tempRange, [-10, 110]),
      windRange: normalizeWindRange(r, 60),
      weather: str(r.weather, 'any'),
      dome: str(r.dome, 'any'),
      teams: stringList(r.teams),
      opponents: stringList(r.opponents),
      ...lastGameFields(r),
      ...cfbSystemsFields(r),
    };
  }

  return {
    betType,
    seasons: [Number(r.seasonMin ?? 2016), Number(r.seasonMax ?? 2025)],
    weeks: [Number(r.weekMin ?? 1), Number(r.weekMax ?? 16)],
    side: str(r.side, 'any'),
    favDog: str(r.favDog, 'any'),
    gameType: str(r.gameType, 'any'),
    rankedMatchup: str(r.rankedMatchup, 'any'),
    ...lines,
    primetime: optionalBool(r.primetime),
    conferenceGame: optionalBool(r.conferenceGame),
    neutralSite: optionalBool(r.neutralSite),
    selectedConferences: resolveSelectedConferences(r),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 110)],
    windRange: normalizeWindRange(r, 60),
    weather: str(r.weather, 'any'),
    dome: str(r.dome, 'any'),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    ...lastGameFields(r),
    ...cfbSystemsFields(r),
  };
}

export function normalizeNflSavedFilterSnapshot(
  raw: Record<string, unknown> | null | undefined,
  rowBetType?: string,
): NflWebFilterSnapshot {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || 'fg_spread');
  const native = isNativeSnapshot(r);
  const lines = footballCrossMarketLines(r, betType, native, {
    fgSpreadMax: 20,
    h1SpreadMax: 14,
    fgTotal: [30, 60],
    h1Total: [15, 35],
    tt: [10, 40],
  });

  if (!native) {
    return {
      betType,
      seasons: asPair(r.seasons, [2018, 2025]),
      weeks: asPair(r.weeks, [1, 18]),
      side: str(r.side, 'any'),
      seasonType: str(r.seasonType, 'any'),
      playoffRound: str(r.playoffRound, 'any'),
      favDog: str(r.favDog, 'any'),
      ...lines,
      primetime: optionalBool(r.primetime),
      division: optionalBool(r.division),
      dome: str(r.dome, 'any'),
      tempRange: asPair(r.tempRange, [-10, 100]),
      windRange: normalizeWindRange(r, 60),
      precip: str(r.precip, 'any'),
      restBye: str(r.restBye, 'any'),
      coach: str(r.coach, 'any'),
      referee: str(r.referee, 'any'),
      teams: stringList(r.teams),
      opponents: stringList(r.opponents),
      daysOfWeek: stringList(r.daysOfWeek),
      teamDivisions: stringList(r.teamDivisions),
      ...nflLastGameFields(r),
      ...oppLastGameFields(r),
      ...asofFields(r),
    };
  }

  return {
    betType,
    seasons: [Number(r.seasonMin ?? 2018), Number(r.seasonMax ?? 2025)],
    weeks: [Number(r.weekMin ?? 1), Number(r.weekMax ?? 18)],
    side: str(r.side, 'any'),
    seasonType: str(r.seasonType, 'any'),
    playoffRound: str(r.playoffRound, 'any'),
    favDog: str(r.favDog, 'any'),
    ...lines,
    primetime: optionalBool(r.primetime),
    division: optionalBool(r.division),
    dome: str(r.dome, 'any'),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 100)],
    windRange: normalizeWindRange(r, 60),
    precip: str(r.precip, 'any'),
    restBye: str(r.restBye, 'any'),
    coach: str(r.coach, 'any'),
    referee: str(r.referee, 'any'),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    daysOfWeek: stringList(r.daysOfWeek),
    teamDivisions: stringList(r.teamDivisions),
    ...nflLastGameFields(r),
    ...oppLastGameFields(r),
    ...asofFields(r),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// MLB — canonical Systems snapshot. The live MLBAnalytics page still uses a looser inline shape
// (single dayOfWeek, min/max strings, OptRange|null, pitcher {id,name} objects); this normalizer
// reads BOTH that legacy shape and the canonical one, so saved filters and chat patches converge
// on one contract. The page gets aligned to the canonical shape by the Cursor UI pass.
// ═══════════════════════════════════════════════════════════════════════════════════════════

export interface MlbFilterSnapshot {
  betType: string;
  seasons: NumPair; months: NumPair;
  teams: string[]; opponents: string[];
  side: string; favDog: string; mlMin: string; mlMax: string;
  lineRange: NumPair; f5TotalRange: NumPair; timeMin: string; timeMax: string;
  daysOfWeek: string[]; doubleheader: boolean | null;
  seriesGame: NumPair; trip: NumPair; switchGame: boolean | null; restRange: NumPair;
  division: boolean | null; interleague: boolean | null;
  tempRange: NumPair; windRange: NumPair; windDir: string; dome: boolean | null; pfRuns: NumPair;
  spNames: string[]; oppSpNames: string[]; spHand: string; oppSpHand: string;
  spXfip: NumPair; oppSpXfip: NumPair; bpIp: NumPair; bpXfip: NumPair;
  lastResult: string; lastAts: string; lastTotal: string; lastRole: string;
  lastMargin: NumPair; winLossStreak: NumPair;
  oppLastResult: string; oppLastAts: string; oppLastTotal: string; oppLastRole: string;
  oppLastMargin: NumPair;
  winPct: NumPair; winStreak: NumPair; lossStreak: NumPair;
  rlCoverPct: NumPair; rlStreak: NumPair;
  overPct: NumPair; overStreak: NumPair; underStreak: NumPair;
  rpg: NumPair; rapg: NumPair; runDiffPg: NumPair;
  prevWins: NumPair; prevWinPct: NumPair; minGames: number;
  h2hLastWin: string; h2hLastAts: string; h2hLastOver: string; h2hLastMargin: NumPair;
  h2hLastHome: boolean | null; h2hLastFav: boolean | null; h2hSameSeason: boolean | null;
  oppWinPct: NumPair; oppOverPct: NumPair; oppRlCoverPct: NumPair;
  oppWinStreak: NumPair; oppLossStreak: NumPair; oppRpg: NumPair; oppRapg: NumPair;
  oppPrevWinPct: NumPair;
}

export const MLB_SNAPSHOT_DEFAULTS: MlbFilterSnapshot = {
  betType: 'ml',
  seasons: [2025, 2026], months: [3, 11], teams: [], opponents: [],
  side: 'any', favDog: 'any', mlMin: '', mlMax: '',
  lineRange: [5, 14], f5TotalRange: [2, 8], timeMin: '', timeMax: '',
  daysOfWeek: [], doubleheader: null,
  seriesGame: [1, 6], trip: [1, 5], switchGame: null, restRange: [0, 10],
  division: null, interleague: null,
  tempRange: [30, 110], windRange: [0, 40], windDir: 'any', dome: null, pfRuns: [85, 115],
  spNames: [], oppSpNames: [], spHand: 'any', oppSpHand: 'any',
  spXfip: [2, 7], oppSpXfip: [2, 7], bpIp: [0, 20], bpXfip: [2, 7],
  lastResult: 'any', lastAts: 'any', lastTotal: 'any', lastRole: 'any',
  lastMargin: [-30, 30], winLossStreak: [-25, 25],
  oppLastResult: 'any', oppLastAts: 'any', oppLastTotal: 'any', oppLastRole: 'any',
  oppLastMargin: [-30, 30],
  winPct: [0, 100], winStreak: [0, 25], lossStreak: [0, 25],
  rlCoverPct: [0, 100], rlStreak: [0, 25],
  overPct: [0, 100], overStreak: [0, 25], underStreak: [0, 25],
  rpg: [0, 10], rapg: [0, 10], runDiffPg: [-4, 4],
  prevWins: [0, 120], prevWinPct: [0, 100], minGames: 0,
  h2hLastWin: 'any', h2hLastAts: 'any', h2hLastOver: 'any', h2hLastMargin: [-30, 30],
  h2hLastHome: null, h2hLastFav: null, h2hSameSeason: null,
  oppWinPct: [0, 100], oppOverPct: [0, 100], oppRlCoverPct: [0, 100],
  oppWinStreak: [0, 25], oppLossStreak: [0, 25], oppRpg: [0, 10], oppRapg: [0, 10],
  oppPrevWinPct: [0, 100],
};

/** legacy page helpers: min/max strings and OptRange|null → canonical pairs. */
function pairFromStrings(minS: unknown, maxS: unknown, def: NumPair): NumPair {
  const lo = typeof minS === 'string' && minS.trim() !== '' ? Number(minS) : NaN;
  const hi = typeof maxS === 'string' && maxS.trim() !== '' ? Number(maxS) : NaN;
  return [Number.isFinite(lo) ? lo : def[0], Number.isFinite(hi) ? hi : def[1]];
}
function pairFromOpt(opt: unknown, def: NumPair): NumPair {
  // Canonical NL / engine snapshots use [min,max] arrays — arrays are objects in JS, so we must
  // handle them before reading .min/.max (otherwise [4.5,7] silently becomes the default).
  if (Array.isArray(opt)) return asPair(opt, def);
  if (!opt || typeof opt !== 'object') return def;
  const o = opt as { min?: unknown; max?: unknown };
  const lo = Number(o.min); const hi = Number(o.max);
  return [Number.isFinite(lo) ? lo : def[0], Number.isFinite(hi) ? hi : def[1]];
}
function pitcherNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => (typeof p === 'string' ? p : (p && typeof p === 'object' && typeof (p as { name?: unknown }).name === 'string') ? (p as { name: string }).name : ''))
    .filter((n) => n.length > 0);
}

/** mlb_analysis_base uses AZ/ATH; saved filters may still store ARI/OAK. */
function mlbGameLogTeamList(v: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stringList(v)) {
    const u = raw.trim().toUpperCase();
    const abbr = u === 'ARI' ? 'AZ' : (u === 'OAK' || u === 'LVA' || u === 'SAC') ? 'ATH' : u;
    if (!abbr || seen.has(abbr)) continue;
    seen.add(abbr);
    out.push(abbr);
  }
  return out;
}

export function normalizeMlbSavedFilterSnapshot(
  raw: Record<string, unknown> | null | undefined,
  rowBetType?: string,
): MlbFilterSnapshot {
  const r = raw ?? {};
  const d = MLB_SNAPSHOT_DEFAULTS;
  const legacyDay = typeof r.dayOfWeek === 'string' && r.dayOfWeek !== 'any' ? [r.dayOfWeek] : [];
  return {
    betType: str(r.betType, rowBetType || 'ml'),
    seasons: asPair(r.seasons, d.seasons), months: asPair(r.months, d.months),
    teams: mlbGameLogTeamList(r.teams), opponents: mlbGameLogTeamList(r.opponents),
    side: str(r.side, 'any'), favDog: str(r.favDog, 'any'),
    mlMin: str(r.mlMin, ''), mlMax: str(r.mlMax, ''),
    lineRange: r.totalBounds ? pairFromOpt(r.totalBounds, d.lineRange) : asPair(r.lineRange, d.lineRange),
    f5TotalRange: asPair(r.f5TotalRange, d.f5TotalRange),
    timeMin: str(r.timeMin, ''), timeMax: str(r.timeMax, ''),
    daysOfWeek: stringList(r.daysOfWeek).length ? stringList(r.daysOfWeek) : legacyDay,
    doubleheader: optionalBool(r.doubleheader),
    seriesGame: r.seriesGame == null ? d.seriesGame : asPair(r.seriesGame, d.seriesGame),
    trip: r.trip == null ? d.trip : asPair(r.trip, d.trip),
    switchGame: optionalBool(r.switchGame), restRange: asPair(r.restRange, d.restRange),
    division: optionalBool(r.division), interleague: optionalBool(r.interleague),
    tempRange: asPair(r.tempRange, d.tempRange), windRange: asPair(r.windRange, d.windRange),
    windDir: str(r.windDir, 'any'), dome: optionalBool(r.dome),
    pfRuns: r.pfRuns == null ? d.pfRuns : pairFromOpt(r.pfRuns, d.pfRuns),
    spNames: stringList(r.spNames).length ? stringList(r.spNames) : pitcherNames(r.sp),
    oppSpNames: stringList(r.oppSpNames).length ? stringList(r.oppSpNames) : pitcherNames(r.oppSp),
    spHand: str(r.spHand, 'any'), oppSpHand: str(r.oppSpHand, 'any'),
    spXfip: r.spXfip == null ? d.spXfip : pairFromOpt(r.spXfip, d.spXfip),
    oppSpXfip: r.oppSpXfip == null ? d.oppSpXfip : pairFromOpt(r.oppSpXfip, d.oppSpXfip),
    bpIp: r.bpIp == null ? d.bpIp : pairFromOpt(r.bpIp, d.bpIp),
    bpXfip: r.bpXfip == null ? d.bpXfip : pairFromOpt(r.bpXfip, d.bpXfip),
    lastResult: str(r.lastResult, 'any'),
    lastAts: str(r.lastAts, 'any'), lastTotal: str(r.lastTotal, 'any'), lastRole: str(r.lastRole, 'any'),
    lastMargin: Array.isArray(r.lastMargin) ? asPair(r.lastMargin, d.lastMargin) : pairFromStrings(r.lastMarginMin, r.lastMarginMax, d.lastMargin),
    winLossStreak: Array.isArray(r.winLossStreak) ? asPair(r.winLossStreak, d.winLossStreak) : pairFromStrings(r.streakMin, r.streakMax, d.winLossStreak),
    oppLastResult: str(r.oppLastResult, 'any'),
    oppLastAts: str(r.oppLastAts, 'any'), oppLastTotal: str(r.oppLastTotal, 'any'), oppLastRole: str(r.oppLastRole, 'any'),
    oppLastMargin: asPair(r.oppLastMargin, d.oppLastMargin),
    winPct: asPair(r.winPct, d.winPct), winStreak: asPair(r.winStreak, d.winStreak),
    lossStreak: asPair(r.lossStreak, d.lossStreak),
    rlCoverPct: asPair(r.rlCoverPct, d.rlCoverPct), rlStreak: asPair(r.rlStreak, d.rlStreak),
    overPct: asPair(r.overPct, d.overPct), overStreak: asPair(r.overStreak, d.overStreak),
    underStreak: asPair(r.underStreak, d.underStreak),
    rpg: asPair(r.rpg, d.rpg), rapg: asPair(r.rapg, d.rapg), runDiffPg: asPair(r.runDiffPg, d.runDiffPg),
    prevWins: asPair(r.prevWins, d.prevWins), prevWinPct: asPair(r.prevWinPct, d.prevWinPct),
    minGames: typeof r.minGames === 'number' ? r.minGames : 0,
    h2hLastWin: str(r.h2hLastWin, 'any'), h2hLastAts: str(r.h2hLastAts, 'any'), h2hLastOver: str(r.h2hLastOver, 'any'),
    h2hLastMargin: asPair(r.h2hLastMargin, d.h2hLastMargin),
    h2hLastHome: optionalBool(r.h2hLastHome), h2hLastFav: optionalBool(r.h2hLastFav),
    h2hSameSeason: optionalBool(r.h2hSameSeason),
    oppWinPct: asPair(r.oppWinPct, d.oppWinPct), oppOverPct: asPair(r.oppOverPct, d.oppOverPct),
    oppRlCoverPct: asPair(r.oppRlCoverPct, d.oppRlCoverPct),
    oppWinStreak: asPair(r.oppWinStreak, d.oppWinStreak), oppLossStreak: asPair(r.oppLossStreak, d.oppLossStreak),
    oppRpg: asPair(r.oppRpg, d.oppRpg), oppRapg: asPair(r.oppRapg, d.oppRapg),
    oppPrevWinPct: asPair(r.oppPrevWinPct, d.oppPrevWinPct),
  };
}
