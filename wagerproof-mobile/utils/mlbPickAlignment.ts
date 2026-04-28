/**
 * Mobile-side mirror of src/utils/mlbPickAlignment.ts. Self-contained name→abbr
 * table since wagerproof-mobile doesn't share src/utils.
 */

import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';

export interface AlignmentResult {
  level: 'strong' | 'aligned' | 'mixed' | 'concern' | 'neutral';
  dow: ModelBreakdownRow | null;
  team: ModelBreakdownRow | null;
  dowLabel: string | null;
  teamAbbr: string | null;
  rationale: string;
}

// Full team name → game_log abbr (mlb_game_log uses AZ/ATH for ARI/OAK).
const NAME_TO_ABBR: Record<string, string> = {
  'arizona diamondbacks': 'AZ',
  'atlanta braves': 'ATL',
  'baltimore orioles': 'BAL',
  'boston red sox': 'BOS',
  'chicago cubs': 'CHC',
  'chicago white sox': 'CWS',
  'cincinnati reds': 'CIN',
  'cleveland guardians': 'CLE',
  'colorado rockies': 'COL',
  'detroit tigers': 'DET',
  'houston astros': 'HOU',
  'kansas city royals': 'KC',
  'los angeles angels': 'LAA',
  'los angeles dodgers': 'LAD',
  'miami marlins': 'MIA',
  'milwaukee brewers': 'MIL',
  'minnesota twins': 'MIN',
  'new york mets': 'NYM',
  'new york yankees': 'NYY',
  'oakland athletics': 'ATH',
  'las vegas athletics': 'ATH',
  'athletics': 'ATH',
  'philadelphia phillies': 'PHI',
  'pittsburgh pirates': 'PIT',
  'san diego padres': 'SD',
  'san francisco giants': 'SF',
  'seattle mariners': 'SEA',
  'st. louis cardinals': 'STL',
  'st louis cardinals': 'STL',
  'tampa bay rays': 'TB',
  'texas rangers': 'TEX',
  'toronto blue jays': 'TOR',
  'washington nationals': 'WSH',
};

export function dowLabelFor(d: string | null | undefined): string | null {
  if (!d) return null;
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  if (isNaN(date.getTime())) return null;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

export function teamNameToGameLogAbbr(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/\./g, '').trim();
  return NAME_TO_ABBR[key] ?? null;
}

function pickSubjectTeamAbbr(
  pick: string,
  homeTeamName: string | null,
  awayTeamName: string | null,
): string | null {
  const lower = pick.toLowerCase();
  const homeKey = homeTeamName?.toLowerCase().split(/\s+/).pop() ?? null;
  const awayKey = awayTeamName?.toLowerCase().split(/\s+/).pop() ?? null;
  if (awayKey && lower.includes(awayKey)) return teamNameToGameLogAbbr(awayTeamName);
  if (homeKey && lower.includes(homeKey)) return teamNameToGameLogAbbr(homeTeamName);
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
    const homeRow = homeAbbr ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === homeAbbr) : null;
    const awayRow = awayAbbr ? rows.find(r => r.bet_type === bet_type && r.breakdown_type === 'team' && r.breakdown_value === awayAbbr) : null;
    if (homeRow && awayRow) {
      team = homeRow.roi_pct >= awayRow.roi_pct ? homeRow : awayRow;
    } else {
      team = homeRow || awayRow;
    }
    teamAbbr = team?.breakdown_value ?? null;
  } else {
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

  const parts: string[] = [];
  if (dow) parts.push(`${dow.breakdown_value} ${dow.win_pct}% (${dow.roi_pct >= 0 ? '+' : ''}${dow.roi_pct}%)`);
  if (team) parts.push(`${team.breakdown_value} ${team.win_pct}% (${team.roi_pct >= 0 ? '+' : ''}${team.roi_pct}%)`);
  const rationale = parts.length > 0 ? parts.join(' · ') : 'Insufficient breakdown data';

  return { level, dow, team, dowLabel, teamAbbr, rationale };
}

export const ALIGNMENT_DISPLAY: Record<AlignmentResult['level'], { label: string; emoji: string; color: string }> = {
  strong:  { label: 'Strong alignment',  emoji: '★',  color: '#22c55e' },
  aligned: { label: 'Aligned',           emoji: '✓',  color: '#86efac' },
  neutral: { label: 'Neutral',           emoji: '·',  color: '#94a3b8' },
  mixed:   { label: 'Mixed signals',     emoji: '~',  color: '#facc15' },
  concern: { label: 'Concerning trends', emoji: '⚠', color: '#ef4444' },
};
