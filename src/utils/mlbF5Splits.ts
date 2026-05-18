import type { F5SplitRow, PitchHand } from '@/types/mlbF5Splits';
import { F5_SPLIT_MIN_GAMES } from '@/types/mlbF5Splits';

/** Materialized view uses game-log abbreviations (AZ, ATH). */
export function toF5SplitTeamAbbr(abbr: string): string {
  const a = abbr.trim().toUpperCase();
  if (a === 'ARI') return 'AZ';
  if (a === 'OAK' || a === 'LVA') return 'ATH';
  return a;
}

export function splitLookupKey(
  teamAbbr: string,
  homeAway: 'home' | 'away',
  oppSpHand: PitchHand,
): string | null {
  if (!oppSpHand || (oppSpHand !== 'R' && oppSpHand !== 'L')) return null;
  return `${toF5SplitTeamAbbr(teamAbbr)}|${homeAway}|${oppSpHand}`;
}

export function buildSplitLookup(rows: F5SplitRow[]): Map<string, F5SplitRow> {
  const map = new Map<string, F5SplitRow>();
  for (const row of rows) {
    const key = splitLookupKey(row.team_abbr, row.home_away, row.opp_sp_hand);
    if (key) map.set(key, row);
  }
  return map;
}

export function findSplitRow(
  lookup: Map<string, F5SplitRow>,
  teamAbbr: string,
  homeAway: 'home' | 'away',
  oppSpHand: PitchHand,
): F5SplitRow | null {
  const key = splitLookupKey(teamAbbr, homeAway, oppSpHand);
  if (!key) return null;
  return lookup.get(key) ?? null;
}

export function pitchHandLabel(hand: PitchHand): string {
  if (hand === 'R') return 'Right-handed';
  if (hand === 'L') return 'Left-handed';
  return 'Unknown';
}

export function normalizePitchHand(raw: string | null | undefined): PitchHand {
  if (!raw) return null;
  const h = raw.trim().toUpperCase();
  if (h === 'R' || h.startsWith('R')) return 'R';
  if (h === 'L' || h.startsWith('L')) return 'L';
  return null;
}

export function hasEnoughSplitGames(row: F5SplitRow | null): boolean {
  return !!row && row.games >= F5_SPLIT_MIN_GAMES;
}

export function formatMoneyline(ml: number | null): string {
  if (ml === null || ml === undefined || Number.isNaN(Number(ml))) return '—';
  return ml > 0 ? `+${ml}` : String(ml);
}

/** `official_date` as YYYY-MM-DD → e.g. "Mon, May 19". */
export function formatGameDateLabel(dateString: string | null | undefined): string {
  if (!dateString) return 'Date TBD';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatGameTimeEt(timeString: string | null): string {
  if (!timeString) return 'Time TBD';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${time} ET`;
}

export function offenseDiffClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

/** Lower runs allowed vs season is good (green). */
export function defenseDiffClass(value: number): string {
  if (value < 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value > 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

export type CompareBetter = 'higher' | 'lower';

const COMPARE_GOOD = 'text-emerald-600 dark:text-emerald-400 font-semibold';
const COMPARE_BAD = 'text-red-600 dark:text-red-400';

/** Green = better side, red = worse; empty when tied or either value missing. */
export function compareMetricColors(
  away: number | null | undefined,
  home: number | null | undefined,
  better: CompareBetter,
): { away: string; home: string } {
  if (
    away == null ||
    home == null ||
    !Number.isFinite(away) ||
    !Number.isFinite(home) ||
    away === home
  ) {
    return { away: '', home: '' };
  }
  const awayIsBetter = better === 'higher' ? away > home : away < home;
  const homeIsBetter = better === 'higher' ? home > away : home < away;
  return {
    away: awayIsBetter ? COMPARE_GOOD : COMPARE_BAD,
    home: homeIsBetter ? COMPARE_GOOD : COMPARE_BAD,
  };
}

export interface TeamDefenseSplitStats {
  avgRa: number;
  games: number;
  diffVsSeason: number;
  enough: boolean;
}

export function getTeamDefenseSplitStats(
  splitRow: F5SplitRow | null,
  ownHand: PitchHand,
): TeamDefenseSplitStats | null {
  if (!splitRow || !hasEnoughSplitGames(splitRow)) return null;
  if (ownHand !== 'R' && ownHand !== 'L') return null;

  const avgRa =
    ownHand === 'R' ? splitRow.avg_f5_ra_when_own_rhp : splitRow.avg_f5_ra_when_own_lhp;
  const games =
    ownHand === 'R' ? splitRow.games_with_own_rhp : splitRow.games_with_own_lhp;
  const diffVsSeason =
    ownHand === 'R'
      ? splitRow.ra_diff_vs_season_when_own_rhp
      : splitRow.ra_diff_vs_season_when_own_lhp;

  if (games == null || games < F5_SPLIT_MIN_GAMES || avgRa == null || diffVsSeason == null) {
    return null;
  }

  return { avgRa, games, diffVsSeason, enough: true };
}
