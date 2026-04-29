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
  /**
   * Team rows relevant to this pick.
   *  * ML/spread: 1 entry — the team named in the pick text (or empty if not found).
   *  * O/U: up to 2 entries — both home and away, since both are credited.
   */
  teams: ModelBreakdownRow[];
  /** Three-letter weekday label used (e.g., 'Tue'). */
  dowLabel: string | null;
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
 *   strong  — DOW passes AND every team row passes (win% ≥ 55 AND ROI > 0)
 *   aligned — DOW passes AND no team row is concerning (win% ≥ 45)
 *   concern — DOW fails AND every team row has win% < 45
 *   mixed   — anything in between (one good, one bad, etc.)
 *   neutral — not enough data
 *
 * For O/U bets we evaluate BOTH teams in the game (since the breakdown credits
 * both home and away). For ML/spread we evaluate just the team named in the
 * pick text. The team component of the score uses the WEAKER team for O/U so
 * a single weak side can drag the alignment down.
 */
export function computeAlignment(input: ComputeAlignmentInput): AlignmentResult {
  const { bet_type, pick, home_team, away_team, game_time_et, rows } = input;
  const dowLabel = dowLabelFor(game_time_et);
  const dow = dowLabel
    ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'dow' && r.breakdown_value === dowLabel) ?? null
    : null;

  const homeAbbr = teamNameToGameLogAbbr(home_team);
  const awayAbbr = teamNameToGameLogAbbr(away_team);
  const findTeam = (abbr: string | null) =>
    abbr ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === abbr) ?? null : null;

  const teams: ModelBreakdownRow[] = [];
  if (bet_type === 'full_ou' || bet_type === 'f5_ou') {
    // O/U credits both teams; surface both so the user sees the full picture.
    // Order: away first (matches "Away @ Home" reading order in pick cards).
    const awayRow = findTeam(awayAbbr);
    const homeRow = findTeam(homeAbbr);
    if (awayRow) teams.push(awayRow);
    if (homeRow) teams.push(homeRow);
  } else {
    // ML/spread: only the team named in the pick text.
    const subjectAbbr = pickSubjectTeamAbbr(pick, home_team, away_team);
    const subj = findTeam(subjectAbbr);
    if (subj) teams.push(subj);
  }

  // For scoring: every team must clear the threshold to count as "ok".
  // A single weak team flips the assessment to mixed/concern.
  // "Bad" includes meaningful negative ROI even if win_pct is in the
  // 45-55% zone — a team batting 46% with -12% ROI on a bet type is
  // actively losing money, not neutral.
  const isOk  = (w: number, r: number) => w >= 55 && r > 0;
  const isBad = (w: number, r: number) => w < 45 || r <= -5;
  const dowOk = !!dow && isOk(dow.win_pct, dow.roi_pct);
  const dowBad = !!dow && isBad(dow.win_pct, dow.roi_pct);
  const teamsAllOk = teams.length > 0 && teams.every(t => isOk(t.win_pct, t.roi_pct));
  const teamsAllBad = teams.length > 0 && teams.every(t => isBad(t.win_pct, t.roi_pct));
  const teamsAnyBad = teams.length > 0 && teams.some(t => isBad(t.win_pct, t.roi_pct));

  let level: AlignmentResult['level'] = 'neutral';
  if (dowOk && teamsAllOk) level = 'strong';
  else if ((dowOk && !teamsAnyBad) || (teamsAllOk && !dowBad)) level = 'aligned';
  else if (dowBad && teamsAllBad) level = 'concern';
  else if (dowBad || teamsAnyBad) level = 'mixed';

  // Build a one-line rationale that lists DOW + each team row.
  const parts: string[] = [];
  if (dow) parts.push(`${dow.breakdown_value} ${dow.win_pct}% (${dow.roi_pct >= 0 ? '+' : ''}${dow.roi_pct}%)`);
  for (const t of teams) {
    parts.push(`${t.breakdown_value} ${t.win_pct}% (${t.roi_pct >= 0 ? '+' : ''}${t.roi_pct}%)`);
  }
  const rationale = parts.length > 0 ? parts.join(' · ') : 'Insufficient breakdown data';

  return { level, dow, teams, dowLabel, rationale };
}

/** Display config for each alignment level. */
export const ALIGNMENT_DISPLAY: Record<AlignmentResult['level'], { label: string; emoji: string; color: string }> = {
  strong:  { label: 'Strong alignment',  emoji: '★',  color: '#22c55e' },
  aligned: { label: 'Aligned',           emoji: '✓',  color: '#86efac' },
  neutral: { label: 'Neutral',           emoji: '·',  color: '#94a3b8' },
  mixed:   { label: 'Mixed signals',     emoji: '~',  color: '#facc15' },
  concern: { label: 'Concerning trends', emoji: '⚠', color: '#ef4444' },
};
