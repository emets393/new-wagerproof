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
}

export interface NflWebFilterSnapshot {
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
  };
}
