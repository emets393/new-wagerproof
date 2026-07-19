/**
 * Saved Historical Analysis filters are shared between web and iOS.
 * Web stores tuple fields (`seasons`, `spreadSize`, …); iOS stores flat
 * fields (`seasonMin`, `spreadMin`, …). Normalize either shape before restore.
 */

type NumPair = [number, number];

export interface CfbWebFilterSnapshot {
  betType: string;
  seasons: NumPair;
  weeks: NumPair;
  side: string;
  favDog: string;
  gameType: string;
  rankedMatchup: string;
  spreadSide: string;
  spreadSize: NumPair;
  lineRange: NumPair;
  mlMin: string;
  mlMax: string;
  primetime: boolean | null;
  conferenceGame: boolean | null;
  neutralSite: boolean | null;
  selectedConferences: string[];
  tempRange: NumPair;
  windMax: number;
  weather: string;
  dome: string;
  lastResult: string;
  lastAts: string;
  lastTotal: string;
  lastRole: string;
  lastOt: boolean | null;
  lastBlowout: string;
  teams: string[];
  opponents: string[];
}

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
  oppPrevWinPct: [0, 100],
};

export interface NflWebFilterSnapshot extends NflAsOfFilterSnapshot {
  betType: string;
  seasons: NumPair;
  weeks: NumPair;
  side: string;
  seasonType: string;
  playoffRound: string;
  favDog: string;
  spreadSide: string;
  spreadSize: NumPair;
  lineRange: NumPair;
  mlMin: string;
  mlMax: string;
  primetime: boolean | null;
  division: boolean | null;
  dome: string;
  tempRange: NumPair;
  windMax: number;
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
    lastBlowout: str(r.lastBlowout, 'any'),
  };
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

function asofFields(r: Record<string, unknown>): NflAsOfFilterSnapshot {
  const d = NFL_ASOF_DEFAULTS;
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
    oppPrevWinPct: asPair(r.oppPrevWinPct, d.oppPrevWinPct),
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

export function normalizeCfbSavedFilterSnapshot(
  raw: Record<string, unknown> | null | undefined,
  rowBetType?: string,
): CfbWebFilterSnapshot {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || 'fg_spread');

  if (!isNativeSnapshot(r)) {
    return {
      betType,
      seasons: asPair(r.seasons, [2016, 2025]),
      weeks: asPair(r.weeks, [1, 16]),
      side: str(r.side, 'any'),
      favDog: str(r.favDog, 'any'),
      gameType: str(r.gameType, 'any'),
      rankedMatchup: str(r.rankedMatchup, 'any'),
      spreadSide: str(r.spreadSide, 'any'),
      spreadSize: asPair(r.spreadSize, [0, 28]),
      lineRange: asPair(r.lineRange, [30, 80]),
      mlMin: str(r.mlMin, ''),
      mlMax: str(r.mlMax, ''),
      primetime: optionalBool(r.primetime),
      conferenceGame: optionalBool(r.conferenceGame),
      neutralSite: optionalBool(r.neutralSite),
      selectedConferences: resolveSelectedConferences(r),
      tempRange: asPair(r.tempRange, [-10, 110]),
      windMax: typeof r.windMax === 'number' ? r.windMax : 60,
      weather: str(r.weather, 'any'),
      dome: str(r.dome, 'any'),
      teams: stringList(r.teams),
      opponents: stringList(r.opponents),
      ...lastGameFields(r),
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
    spreadSide: str(r.spreadSide, 'any'),
    spreadSize: [Number(r.spreadMin ?? 0), Number(r.spreadMax ?? 28)],
    lineRange: [Number(r.lineMin ?? 30), Number(r.lineMax ?? 80)],
    mlMin: str(r.mlMin, ''),
    mlMax: str(r.mlMax, ''),
    primetime: optionalBool(r.primetime),
    conferenceGame: optionalBool(r.conferenceGame),
    neutralSite: optionalBool(r.neutralSite),
    selectedConferences: resolveSelectedConferences(r),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 110)],
    windMax: typeof r.windMax === 'number' ? r.windMax : 60,
    weather: str(r.weather, 'any'),
    dome: str(r.dome, 'any'),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    ...lastGameFields(r),
  };
}

export function normalizeNflSavedFilterSnapshot(
  raw: Record<string, unknown> | null | undefined,
  rowBetType?: string,
): NflWebFilterSnapshot {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || 'fg_spread');

  if (!isNativeSnapshot(r)) {
    return {
      betType,
      seasons: asPair(r.seasons, [2018, 2025]),
      weeks: asPair(r.weeks, [1, 18]),
      side: str(r.side, 'any'),
      seasonType: str(r.seasonType, 'any'),
      playoffRound: str(r.playoffRound, 'any'),
      favDog: str(r.favDog, 'any'),
      spreadSide: str(r.spreadSide, 'any'),
      spreadSize: asPair(r.spreadSize, [0, 20]),
      lineRange: asPair(r.lineRange, [30, 60]),
      mlMin: str(r.mlMin, ''),
      mlMax: str(r.mlMax, ''),
      primetime: optionalBool(r.primetime),
      division: optionalBool(r.division),
      dome: str(r.dome, 'any'),
      tempRange: asPair(r.tempRange, [-10, 100]),
      windMax: typeof r.windMax === 'number' ? r.windMax : 60,
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
    spreadSide: str(r.spreadSide, 'any'),
    spreadSize: [Number(r.spreadMin ?? 0), Number(r.spreadMax ?? 20)],
    lineRange: [Number(r.lineMin ?? 30), Number(r.lineMax ?? 60)],
    mlMin: str(r.mlMin, ''),
    mlMax: str(r.mlMax, ''),
    primetime: optionalBool(r.primetime),
    division: optionalBool(r.division),
    dome: str(r.dome, 'any'),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 100)],
    windMax: typeof r.windMax === 'number' ? r.windMax : 60,
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
