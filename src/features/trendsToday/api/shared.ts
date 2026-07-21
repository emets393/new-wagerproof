/**
 * Consensus + formatting logic shared by the three trend adapters. Every rule
 * here is ported from the legacy pages (MLB/NBA/NCAABTodayBettingTrends.tsx);
 * the thresholds are load-bearing and must not drift, because the sort scores
 * they feed are what ordered those pages.
 */

import type {
  TrendAngle,
  TrendSideStat,
  TrendsSport,
  TrendsVerdict,
} from '../types';

/** Rate above which a situation is a real lean (the legacy "green" band). */
const GREEN_PCT = 55;
/** 45-55 is "yellow": weak enough to follow a partner, not to lead. */
const YELLOW_LOW_PCT = 45;

export function toTrendPct(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n =
    typeof value === 'string' ? parseFloat(String(value).replace(/%/g, '').trim()) : Number(value);
  if (!Number.isFinite(n)) return null;
  // PostgREST hands numeric columns back as either 0-1 fractions or 0-100
  // percents depending on the view; normalize to percent.
  if (n > 0 && n < 1) return n * 100;
  return n;
}

export interface ParsedRecord {
  wins: number;
  losses: number;
  pushes: number;
  total: number;
}

/** Parses "15-3-0". For O/U records wins = overs and losses = unders. */
export function parseRecord(record: string | null | undefined): ParsedRecord {
  if (!record) return { wins: 0, losses: 0, pushes: 0, total: 0 };
  const parts = String(record).split('-').map(Number);
  const wins = parts[0] || 0;
  const losses = parts[1] || 0;
  const pushes = parts[2] || 0;
  return { wins, losses, pushes, total: wins + losses + pushes };
}

/** Union of the MLB and hoops situation vocabularies. */
const SITUATION_LABELS: Record<string, string> = {
  is_after_loss: 'After loss',
  is_after_win: 'After win',
  is_fav: 'Favorite',
  is_dog: 'Underdog',
  is_home: 'Home',
  is_away: 'Away',
  is_home_fav: 'Home favorite',
  is_away_fav: 'Away favorite',
  is_home_dog: 'Home underdog',
  is_away_dog: 'Away underdog',
  one_day_off: '1 day off',
  two_three_days_off: '2-3 days off',
  four_plus_days_off: '4+ days off',
  no_rest: 'No rest',
  rest_advantage: 'Rest advantage',
  rest_disadvantage: 'Rest disadvantage',
  rest_equal: 'Equal rest',
  equal_rest: 'Equal rest',
  non_league: 'Non-league',
  non_division: 'Non-division',
  league: 'League',
  division: 'Division',
};

export function formatSituation(situation: string | null | undefined): string {
  if (!situation) return '—';
  return (
    SITUATION_LABELS[situation] ??
    situation.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

export function isGreen(pct: number | null): boolean {
  return pct !== null && pct > GREEN_PCT;
}

export function isYellow(pct: number | null): boolean {
  return pct !== null && pct >= YELLOW_LOW_PCT && pct <= GREEN_PCT;
}

function isLow(pct: number | null): boolean {
  return pct !== null && pct < YELLOW_LOW_PCT;
}

/**
 * Side consensus for one angle: whoever's rate is higher. Deliberately has no
 * threshold — the legacy pages showed a winner for any non-tie, and the
 * magnitude is carried separately by the dominance score.
 */
export function sideLeanFor(
  awayPct: number | null,
  homePct: number | null,
): 'away' | 'home' | null {
  if (awayPct === null || homePct === null) return null;
  if (awayPct > homePct) return 'away';
  if (homePct > awayPct) return 'home';
  return null;
}

/**
 * MLB total consensus (port of `getOuConsensusMlb`). MLB rows carry only an
 * over rate, so "under" is inferred from a low over rate rather than read from
 * its own column.
 */
export function mlbOuLean(
  awayOver: number | null,
  homeOver: number | null,
): 'over' | 'under' | null {
  const aG = isGreen(awayOver);
  const aY = isYellow(awayOver);
  const aLow = isLow(awayOver);
  const hG = isGreen(homeOver);
  const hY = isYellow(homeOver);
  const hLow = isLow(homeOver);

  if (aG && hG) return 'over';
  if (aLow && hLow) return 'under';
  if (aG && hY) return 'over';
  if (hG && aY) return 'over';
  if (aLow && hY) return 'under';
  if (hLow && aY) return 'under';
  return null;
}

/**
 * NBA/NCAAB total consensus (port of `getOUConsensus`). These rows carry
 * explicit over AND under rates, so both sides are tested directly. One team
 * green over while the other is green under is an explicit no-consensus.
 */
export function hoopsOuLean(
  awayOver: number | null,
  awayUnder: number | null,
  homeOver: number | null,
  homeUnder: number | null,
): 'over' | 'under' | null {
  const aOG = isGreen(awayOver);
  const aOY = isYellow(awayOver);
  const aUG = isGreen(awayUnder);
  const aUY = isYellow(awayUnder);
  const hOG = isGreen(homeOver);
  const hOY = isYellow(homeOver);
  const hUG = isGreen(homeUnder);
  const hUY = isYellow(homeUnder);

  if (aOG && hOG) return 'over';
  if (aUG && hUG) return 'under';
  // Teams pulling opposite directions cancel out before the softer rules run.
  if ((aOG && hUG) || (aUG && hOG)) return null;
  if (aOG && hOY) return 'over';
  if (hOG && aOY) return 'over';
  if (aUG && hUY) return 'under';
  if (hUG && aUY) return 'under';
  return null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Rolls every angle up into the game-level read shown on the feed card and at
 * the top of the detail pane. The winner is whichever side more angles favor;
 * an exact split reports no lean rather than picking arbitrarily.
 */
export function buildVerdict(angles: TrendAngle[]): TrendsVerdict {
  const sideAngles = angles.filter((a) => a.sideLean !== null);
  const awayWins = sideAngles.filter((a) => a.sideLean === 'away').length;
  const homeWins = sideAngles.filter((a) => a.sideLean === 'home').length;
  const side = awayWins > homeWins ? 'away' : homeWins > awayWins ? 'home' : null;

  const overAngles = angles.filter((a) => a.ouLean === 'over').length;
  const underAngles = angles.filter((a) => a.ouLean === 'under').length;
  const total = overAngles > underAngles ? 'over' : underAngles > overAngles ? 'under' : null;

  const awayAvgSidePct = average(
    angles.map((a) => a.away.sidePct).filter((v): v is number => v !== null),
  );
  const homeAvgSidePct = average(
    angles.map((a) => a.home.sidePct).filter((v): v is number => v !== null),
  );
  const awayAvgOverPct = average(
    angles.map((a) => a.away.overPct).filter((v): v is number => v !== null),
  );
  const homeAvgOverPct = average(
    angles.map((a) => a.home.overPct).filter((v): v is number => v !== null),
  );

  const combinedOver =
    awayAvgOverPct !== null && homeAvgOverPct !== null
      ? (awayAvgOverPct + homeAvgOverPct) / 2
      : (awayAvgOverPct ?? homeAvgOverPct);

  return {
    side,
    sideAgree: side === 'away' ? awayWins : side === 'home' ? homeWins : 0,
    sideTotal: sideAngles.length,
    awayAvgSidePct,
    homeAvgSidePct,
    sideMarginPts:
      awayAvgSidePct !== null && homeAvgSidePct !== null
        ? Math.abs(awayAvgSidePct - homeAvgSidePct)
        : null,
    total,
    totalAgree: total === 'over' ? overAngles : total === 'under' ? underAngles : 0,
    totalTotal: overAngles + underAngles,
    awayAvgOverPct,
    homeAvgOverPct,
    totalMarginPts: combinedOver !== null ? Math.abs(combinedOver - 50) : null,
  };
}

// ---------------------------------------------------------------------------
// Sort scores (ported verbatim — these order the feed)
// ---------------------------------------------------------------------------

/** Hoops require a real sample before an angle counts toward a score. */
const MIN_GAMES = 5;
/** Side rates closer than this are noise, not dominance. */
const MIN_SIDE_DIFF_PTS = 10;

function sideGamesOf(stat: TrendSideStat): number {
  return stat.sideGames ?? 0;
}

/**
 * MLB scoring (ports `calculateMlDominance` / `calculateOuConsensusStrength`).
 * MLB rows carry no record strings, so there's no sample-size gate — only the
 * 10-point separation filter.
 */
function scoreMlb(angles: TrendAngle[]): { ouConsensus: number; sideDominance: number } {
  let sideDominance = 0;
  let ouConsensus = 0;

  for (const angle of angles) {
    const a = angle.away.sidePct;
    const h = angle.home.sidePct;
    if (a !== null && h !== null && Math.abs(a - h) >= MIN_SIDE_DIFF_PTS) {
      sideDominance += Math.abs(a - h);
    }

    const ao = angle.away.overPct;
    const ho = angle.home.overPct;
    if (ao !== null && ho !== null) {
      if (ao > GREEN_PCT && ho > GREEN_PCT) ouConsensus += ao + ho;
      if (ao < YELLOW_LOW_PCT && ho < YELLOW_LOW_PCT) ouConsensus += 200 - ao - ho;
    }
  }

  return { ouConsensus, sideDominance };
}

/**
 * NBA/NCAAB scoring (ports `calculateATSDominance` /
 * `calculateOUConsensusStrength`). Both weight by the smaller sample so a
 * 100%-in-3-games angle can't outrank a 60%-in-40-games one.
 */
function scoreHoops(angles: TrendAngle[]): { ouConsensus: number; sideDominance: number } {
  let sideDominance = 0;
  let ouConsensus = 0;

  for (const angle of angles) {
    const a = angle.away.sidePct;
    const h = angle.home.sidePct;
    if (a !== null && h !== null) {
      const minGames = Math.min(sideGamesOf(angle.away), sideGamesOf(angle.home));
      const diff = Math.abs(a - h);
      if (minGames >= MIN_GAMES && diff > MIN_SIDE_DIFF_PTS) {
        sideDominance += diff * minGames;
      }
    }

    const awayGames = angle.away.ouGames ?? 0;
    const homeGames = angle.home.ouGames ?? 0;
    if (awayGames < MIN_GAMES || homeGames < MIN_GAMES) continue;
    const totalGames = awayGames + homeGames;
    if (totalGames === 0) continue;

    const bothOver =
      angle.away.overPct !== null &&
      angle.away.overPct > GREEN_PCT &&
      angle.home.overPct !== null &&
      angle.home.overPct > GREEN_PCT;
    const bothUnder =
      angle.away.underPct !== null &&
      angle.away.underPct > GREEN_PCT &&
      angle.home.underPct !== null &&
      angle.home.underPct > GREEN_PCT;

    if (bothOver) {
      const avg =
        ((angle.away.overPct as number) * awayGames + (angle.home.overPct as number) * homeGames) /
        totalGames;
      ouConsensus += avg * Math.min(awayGames, homeGames);
    }
    if (bothUnder) {
      const avg =
        ((angle.away.underPct as number) * awayGames +
          (angle.home.underPct as number) * homeGames) /
        totalGames;
      ouConsensus += avg * Math.min(awayGames, homeGames);
    }
  }

  return { ouConsensus, sideDominance };
}

export function scoreAngles(
  sport: TrendsSport,
  angles: TrendAngle[],
): { ouConsensus: number; sideDominance: number } {
  return sport === 'mlb' ? scoreMlb(angles) : scoreHoops(angles);
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/** Matches a bare "18:00" / "18:00:00" — NCAAB stores tipoffs this way. */
const TIME_ONLY_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * Formats a tipoff/first-pitch value as an ET clock time. Handles both full
 * timestamps and NCAAB's time-only strings (which are already ET, so they get
 * reformatted rather than timezone-converted).
 */
export function formatEtTime(value: string | null | undefined): string {
  if (!value) return 'TBD';
  const raw = String(value).trim();

  if (TIME_ONLY_RE.test(raw)) {
    const [hoursStr, minutesStr] = raw.split(':');
    const hours = parseInt(hoursStr, 10);
    if (!Number.isFinite(hours)) return 'TBD';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutesStr.padStart(2, '0')} ${suffix} ET`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return `${date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} ET`;
}

/**
 * Sortable key for a game. Full timestamps sort by their instant; time-only
 * strings sort lexically after the date, which is correct for a single slate.
 */
export function timeSortKeyFor(gameDate: string, time: string | null | undefined): string {
  if (!time) return `${gameDate}T99:99`;
  const raw = String(time).trim();
  if (TIME_ONLY_RE.test(raw)) return `${gameDate}T${raw.padStart(5, '0')}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return `${gameDate}T99:99`;
  return date.toISOString();
}

/**
 * Groups the two situational rows per game into away/home pairs. Rows whose
 * `team_side` isn't exactly away/home are dropped — the legacy NBA page
 * guarded this and the NCAAB page didn't, which let a malformed row silently
 * land in the wrong slot.
 */
export function pairRowsByGame<T extends { team_side?: string }>(
  rows: T[],
  gameIdOf: (row: T) => number | null,
): Map<number, { away: T; home: T }> {
  const partial = new Map<number, { away?: T; home?: T }>();

  for (const row of rows) {
    const id = gameIdOf(row);
    if (id === null) continue;
    if (row.team_side !== 'away' && row.team_side !== 'home') continue;
    const entry = partial.get(id) ?? {};
    entry[row.team_side] = row;
    partial.set(id, entry);
  }

  const complete = new Map<number, { away: T; home: T }>();
  for (const [id, entry] of partial) {
    if (entry.away && entry.home) complete.set(id, { away: entry.away, home: entry.home });
  }
  return complete;
}

/** Today's date in ET — the same notion of "game day" the slates use. */
export function todayInEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** True when a PostgREST error means "relation does not exist". */
export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || Boolean(error.message?.includes('does not exist'));
}
