import type { F5SplitRow, PitchHand } from '@/types/mlbF5Splits';
import { SAMPLE_THRESHOLDS } from '@/types/mlbF5Splits';

export function toF5SplitTeamAbbr(abbr: string | null | undefined): string {
  const a = (abbr ?? '').trim().toUpperCase();
  if (a === 'ARI') return 'AZ';
  if (a === 'OAK' || a === 'LVA' || a === 'SAC') return 'ATH';
  return a;
}

export function normalizePitchHand(raw: string | null | undefined): PitchHand {
  if (!raw) return null;
  const h = raw.trim().toUpperCase();
  if (h === 'R' || h.startsWith('R')) return 'R';
  if (h === 'L' || h.startsWith('L')) return 'L';
  return null;
}

export function splitLookupKey(
  teamAbbr: string,
  homeAway: 'home' | 'away',
  oppSpHand: PitchHand,
): string | null {
  if (oppSpHand !== 'R' && oppSpHand !== 'L') return null;
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
  return key ? lookup.get(key) ?? null : null;
}

export function splitIsShowable(games: number | null | undefined): boolean {
  return (games ?? 0) >= SAMPLE_THRESHOLDS.HIDE;
}

export function pitchHandLabel(hand: PitchHand): string {
  if (hand === 'R') return 'RHP';
  if (hand === 'L') return 'LHP';
  return 'unknown hand';
}

export function formatMoneyline(ml: number | null | undefined): string {
  if (ml == null || !Number.isFinite(Number(ml))) return '-';
  return ml > 0 ? `+${ml}` : String(ml);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(1).replace(/\.0$/, '')}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return Number(value).toFixed(digits);
}

export function formatDiff(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
}

export function recordWithPct(row: F5SplitRow | null): string {
  if (!row) return '-';
  return `${row.f5_record} (${formatPct(row.f5_win_pct)})`;
}

export function formatGameDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Date TBD';
  const date = new Date(`${dateString.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatGameTime(timeString: string | null | undefined): string {
  if (!timeString) return 'Time TBD';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  return `${date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })} ET`;
}
