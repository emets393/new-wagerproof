import type { F5SplitRow, PitchHand } from '@/types/mlbF5Splits';
import {
  abbrevFromTeamNameOnly,
  MLB_FALLBACK_BY_NAME,
  normalizeTeamNameKey,
} from '@/utils/mlbTeamLogos';
import { findSplitRow, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

export type HomeAway = 'home' | 'away';

export function normalizeHomeAway(raw: string | null | undefined): HomeAway | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'home' || v.startsWith('home')) return 'home';
  if (v === 'away' || v.startsWith('away') || v === 'road') return 'away';
  return null;
}

export function normalizeOppSpHand(raw: string | null | undefined): 'R' | 'L' | null {
  if (!raw) return null;
  const h = raw.trim().toUpperCase();
  if (h === 'R' || h.startsWith('R')) return 'R';
  if (h === 'L' || h.startsWith('L')) return 'L';
  return null;
}

export function handHpLabel(hand: 'R' | 'L'): 'RHP' | 'LHP' {
  return hand === 'R' ? 'RHP' : 'LHP';
}

export function splitLocationLabel(homeAway: HomeAway): 'Home' | 'Away' {
  return homeAway === 'home' ? 'Home' : 'Away';
}

export function splitQualifierShort(homeAway: HomeAway, hand: 'R' | 'L'): string {
  return `${homeAway} vs ${handHpLabel(hand)}`;
}

export function splitQualifierTitle(homeAway: HomeAway, hand: 'R' | 'L'): string {
  return `${splitLocationLabel(homeAway)} vs ${handHpLabel(hand)}`;
}

export function splitQualifierLong(homeAway: HomeAway, hand: 'R' | 'L'): string {
  const loc = homeAway === 'home' ? 'at home' : 'on the road';
  const handWord = hand === 'R' ? 'right-handed' : 'left-handed';
  return `${loc} against ${handWord}`;
}

export function otherHomeAway(homeAway: HomeAway): HomeAway {
  return homeAway === 'home' ? 'away' : 'home';
}

export function teamAbbrFromLrSplitName(teamName: string): string {
  const key = normalizeTeamNameKey(teamName);
  const fb = MLB_FALLBACK_BY_NAME[key];
  if (fb?.team) return toF5SplitTeamAbbr(fb.team);
  return toF5SplitTeamAbbr(abbrevFromTeamNameOnly(teamName));
}

export interface AggregatedF5Split {
  games: number;
  f5_wins: number;
  f5_losses: number;
  f5_ties: number;
  f5_record: string;
  f5_win_pct: number | null;
}

export function computeF5WinPct(wins: number, losses: number): number | null {
  const decisions = wins + losses;
  if (decisions === 0) return null;
  return Math.round((wins / decisions) * 1000) / 10;
}

export function formatF5Record(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export function aggregateF5SplitRows(...rows: (F5SplitRow | null | undefined)[]): AggregatedF5Split | null {
  const valid = rows.filter((r): r is F5SplitRow => r != null);
  if (valid.length === 0) return null;

  let games = 0;
  let f5_wins = 0;
  let f5_losses = 0;
  let f5_ties = 0;

  for (const row of valid) {
    games += row.games;
    f5_wins += row.f5_wins;
    f5_losses += row.f5_losses;
    f5_ties += row.f5_ties;
  }

  return {
    games,
    f5_wins,
    f5_losses,
    f5_ties,
    f5_record: formatF5Record(f5_wins, f5_losses, f5_ties),
    f5_win_pct: computeF5WinPct(f5_wins, f5_losses),
  };
}

export function aggregateF5SplitByHand(
  lookup: Map<string, F5SplitRow>,
  teamAbbr: string,
  oppSpHand: 'R' | 'L',
): AggregatedF5Split | null {
  const home = findSplitRow(lookup, teamAbbr, 'home', oppSpHand);
  const away = findSplitRow(lookup, teamAbbr, 'away', oppSpHand);
  return aggregateF5SplitRows(home, away);
}

export function offenseSectionBadgeLabel(
  awayAbbr: string,
  homeAbbr: string,
  awayOppHand: PitchHand,
  homeOppHand: PitchHand,
): string {
  const awayPart =
    awayOppHand === 'R' || awayOppHand === 'L'
      ? `${awayAbbr} away vs ${handHpLabel(awayOppHand)}`
      : `${awayAbbr} away`;
  const homePart =
    homeOppHand === 'R' || homeOppHand === 'L'
      ? `${homeAbbr} home vs ${handHpLabel(homeOppHand)}`
      : `${homeAbbr} home`;
  return `${awayPart} · ${homePart}`;
}

export function offenseStatTitle(base: string, awayQual: string, homeQual: string): string {
  if (awayQual === homeQual) return `${base} (${awayQual})`;
  return `${base} (${awayQual} / ${homeQual})`;
}
