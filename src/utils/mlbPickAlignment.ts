/**
 * Compute alignment between a suggested pick and the model's day-of-week +
 * team breakdown stats. When a pick is on a strong DOW + a strong team for
 * its bet type, that's an extra "the model is hot here" signal we surface
 * to the user.
 *
 * NOTE: mlb_game_log uses AZ for Arizona and ATH for Athletics, while the
 * mlb_team_mapping uses ARI/OAK. We translate at lookup time so this util
 * works whether the upstream caller passed the canonical or game-log abbr.
 */

import { MLB_FALLBACK_BY_NAME } from '@/utils/mlbTeamLogos';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';

export interface AlignmentResult {
  level: 'strong' | 'aligned' | 'mixed' | 'concern' | 'neutral';
  /** DOW row used (null if no DOW data). */
  dow: ModelBreakdownRow | null;
  /** Team row used (null if no team identifiable from pick). */
  team: ModelBreakdownRow | null;
  /** Three-letter weekday label used (e.g., 'Tue'). */
  dowLabel: string | null;
  /** Team abbr used (in game-log format). */
  teamAbbr: string | null;
  /** Plain-English explanation of the alignment, suitable for tooltips/inline rendering. */
  rationale: string;
}

/** Day-of-week label from a date or ISO timestamp. */
export function dowLabelFor(d: string | null | undefined): string | null {
  if (!d) return null;
  // Use ET-ish parse — "T12:00:00" trick avoids UTC drift on bare YYYY-MM-DD strings.
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  if (isNaN(date.getTime())) return null;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

/** Map a full team name (e.g. "New York Yankees") to game-log abbr (NYY, AZ, ATH...). */
export function teamNameToGameLogAbbr(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/\./g, '').trim();
  const fb = MLB_FALLBACK_BY_NAME[key];
  if (!fb) return null;
  // game_log convention: ARI→AZ, OAK→ATH. Athletics uses ATH (LV) since 2025.
  if (fb.team === 'ARI') return 'AZ';
  if (fb.team === 'OAK') return 'ATH';
  return fb.team;
}

/** Best-effort: figure out which team a pick text refers to. */
function pickSubjectTeamAbbr(
  pick: string,
  homeTeamName: string | null,
  awayTeamName: string | null,
): string | null {
  const lower = pick.toLowerCase();
  const homeKey = homeTeamName?.toLowerCase().split(/\s+/).pop() ?? null;
  const awayKey = awayTeamName?.toLowerCase().split(/\s+/).pop() ?? null;
  // Match by last word (mascot) — works for "Yankees", "Astros", "Padres" etc.
  if (awayKey && lower.includes(awayKey)) return teamNameToGameLogAbbr(awayTeamName);
  if (homeKey && lower.includes(homeKey)) return teamNameToGameLogAbbr(homeTeamName);
  // Fallback: full name
  if (awayTeamName && lower.includes(awayTeamName.toLowerCase())) return teamNameToGameLogAbbr(awayTeamName);
  if (homeTeamName && lower.includes(homeTeamName.toLowerCase())) return teamNameToGameLogAbbr(homeTeamName);
  return null;
}

interface ComputeAlignmentInput {
  bet_type: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou';
  pick: string;
  home_team: string | null;
  away_team: string | null;
  game_time_et: string | null;
  rows: ModelBreakdownRow[];
}

/**
 * Score a pick against the breakdown rows. Returns a level + the rows used.
 *
 * Thresholds (arbitrary but reasonable):
 *   strong  — both DOW and team rows show win% ≥ 55 AND ROI > 0
 *   aligned — at least one of DOW/team passes; nothing concerning
 *   concern — both DOW and team show win% < 45
 *   mixed   — one is favorable, the other is concerning
 *   neutral — not enough data, or signals balance out
 */
export function computeAlignment(input: ComputeAlignmentInput): AlignmentResult {
  const { bet_type, pick, home_team, away_team, game_time_et, rows } = input;
  const dowLabel = dowLabelFor(game_time_et);
  const dow = dowLabel
    ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'dow' && r.breakdown_value === dowLabel) ?? null
    : null;

  let team: ModelBreakdownRow | null = null;
  let teamAbbr: string | null = null;

  const homeAbbr = teamNameToGameLogAbbr(home_team);
  const awayAbbr = teamNameToGameLogAbbr(away_team);

  if (bet_type === 'full_ou' || bet_type === 'f5_ou') {
    // Both teams are credited for O/U; surface whichever one is more notable.
    const homeRow = homeAbbr ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === homeAbbr) : null;
    const awayRow = awayAbbr ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === awayAbbr) : null;
    // Prefer the row that aligns with the pick direction (higher ROI = better fit).
    if (homeRow && awayRow) {
      team = homeRow.roi_pct >= awayRow.roi_pct ? homeRow : awayRow;
    } else {
      team = homeRow || awayRow;
    }
    teamAbbr = team?.breakdown_value ?? null;
  } else {
    // ML/spread: parse the pick text for the subject team.
    teamAbbr = pickSubjectTeamAbbr(pick, home_team, away_team);
    if (teamAbbr) {
      team = rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === teamAbbr) ?? null;
    }
  }

  const dowOk = !!dow && dow.win_pct >= 55 && dow.roi_pct > 0;
  const teamOk = !!team && team.win_pct >= 55 && team.roi_pct > 0;
  const dowBad = !!dow && dow.win_pct < 45;
  const teamBad = !!team && team.win_pct < 45;

  let level: AlignmentResult['level'] = 'neutral';
  if (dowOk && teamOk) level = 'strong';
  else if ((dowOk && !teamBad) || (teamOk && !dowBad)) level = 'aligned';
  else if (dowBad && teamBad) level = 'concern';
  else if (dowBad || teamBad) level = 'mixed';

  // Build a one-line rationale.
  const parts: string[] = [];
  if (dow) parts.push(`${dow.breakdown_value} ${dow.win_pct}% (${dow.roi_pct >= 0 ? '+' : ''}${dow.roi_pct}%)`);
  if (team) parts.push(`${team.breakdown_value} ${team.win_pct}% (${team.roi_pct >= 0 ? '+' : ''}${team.roi_pct}%)`);
  const rationale = parts.length > 0 ? parts.join(' · ') : 'Insufficient breakdown data';

  return { level, dow, team, dowLabel, teamAbbr, rationale };
}

/** Display config for each alignment level. */
export const ALIGNMENT_DISPLAY: Record<AlignmentResult['level'], { label: string; emoji: string; color: string }> = {
  strong:  { label: 'Strong alignment',  emoji: '★',  color: '#22c55e' },
  aligned: { label: 'Aligned',           emoji: '✓',  color: '#86efac' },
  neutral: { label: 'Neutral',           emoji: '·',  color: '#94a3b8' },
  mixed:   { label: 'Mixed signals',     emoji: '~',  color: '#facc15' },
  concern: { label: 'Concerning trends', emoji: '⚠', color: '#ef4444' },
};
