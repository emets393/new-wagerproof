import React, { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, Clock, ArrowLeftRight, Search } from 'lucide-react';
import { getNCAABTeamInitials } from '@/utils/teamColors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** NCAAB halftime row: no rest metrics. Uses todays_first_half_line / todays_second_half_line. */
interface NCAABHalftimeTrendRow {
  game_id: number;
  team_name: string;
  team_side: 'away' | 'home';
  todays_lost_both_halves_last_game: boolean;
  todays_first_half_line: number | null;
  todays_first_half_fav_dog: string | null;
  todays_second_half_line: number | null;
  todays_second_half_fav_dog: string | null;
  first_half_side_games: number | null;
  first_half_side_wins: number | null;
  first_half_side_win_pct: number | null;
  second_half_side_games: number | null;
  second_half_side_wins: number | null;
  second_half_side_win_pct: number | null;
  side_flip_games: number | null;
  side_flip_count: number | null;
  side_flip_pct: number | null;
  lost_both_1h_side_games: number | null;
  lost_both_1h_side_wins: number | null;
  lost_both_1h_side_win_pct: number | null;
  first_half_favdog_side_games: number | null;
  first_half_favdog_side_wins: number | null;
  first_half_favdog_side_win_pct: number | null;
  second_half_favdog_side_games: number | null;
  second_half_favdog_side_wins: number | null;
  second_half_favdog_side_win_pct: number | null;
  // O/U fields (from ncaab_halftime_trends_today)
  todays_first_half_ou_line: number | null;
  todays_second_half_ou_line: number | null;
  first_half_ou_side_games: number | null;
  first_half_ou_side_overs: number | null;
  first_half_ou_side_over_pct: number | null;
  second_half_ou_side_games: number | null;
  second_half_ou_side_overs: number | null;
  second_half_ou_side_over_pct: number | null;
  ou_flip_games: number | null;
  ou_flip_count: number | null;
  ou_flip_pct: number | null;
  first_half_ou_favdog_side_games: number | null;
  first_half_ou_favdog_side_overs: number | null;
  first_half_ou_favdog_side_over_pct: number | null;
  second_half_ou_favdog_side_games: number | null;
  second_half_ou_favdog_side_overs: number | null;
  second_half_ou_favdog_side_over_pct: number | null;
}

interface NCAABGameHalftimeTrends {
  game_id: number;
  game_date: string | null;
  tipoff_time_et: string | null;
  away_team: NCAABHalftimeTrendRow;
  home_team: NCAABHalftimeTrendRow;
}

export type NCAABTeamMappingByName = Map<string, { teamAbbrev: string | null; logoUrl: string }>;

function parseNum(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

const getPercentageColor = (pct: number | null): string => {
  if (pct === null) return 'text-gray-500';
  if (pct > 55) return 'text-green-600 dark:text-green-400';
  if (pct < 45) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400';
};

const getHalftimePercentageStyle = (pct: number | null | undefined): React.CSSProperties => {
  if (pct == null) return { color: '#6b7280' };
  const n = Number(pct);
  if (Number.isNaN(n)) return { color: '#6b7280' };
  const pct100 = n > 1 ? n : n * 100;
  if (pct100 <= 53) return { color: '#ef4444' };
  if (pct100 <= 57) return { color: '#eab308' };
  return { color: '#22c55e' };
};

/** Build Map keyed by teamranking_team_name (trimmed) for abbrev and logo. Logo from espn_team_id or espn_team_url. */
async function fetchNCAABTeamMappingByName(): Promise<NCAABTeamMappingByName> {
  const { data, error } = await collegeFootballSupabase
    .from('ncaab_team_mapping')
    .select('teamranking_team_name, team_abbrev, espn_team_id, espn_team_url');

  if (error || !data) return new Map();

  const map: NCAABTeamMappingByName = new Map();
  for (const row of data as any[]) {
    const name = row.teamranking_team_name != null ? String(row.teamranking_team_name).trim() : '';
    if (!name) continue;
    let logoUrl = '/placeholder.svg';
    if (row.espn_team_id != null && row.espn_team_id !== '') {
      const id = typeof row.espn_team_id === 'string' ? parseInt(row.espn_team_id, 10) : row.espn_team_id;
      if (!Number.isNaN(id)) logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
    }
    if (logoUrl === '/placeholder.svg' && row.espn_team_url && String(row.espn_team_url).trim() !== '')
      logoUrl = row.espn_team_url;
    const teamAbbrev = row.team_abbrev != null && String(row.team_abbrev).trim() !== '' ? row.team_abbrev : null;
    map.set(name, { teamAbbrev, logoUrl });
    map.set(name.toLowerCase(), { teamAbbrev, logoUrl });
  }
  return map;
}

function getNCAABLogoUrl(teamName: string, mapping: NCAABTeamMappingByName): string {
  if (!teamName) return '/placeholder.svg';
  const trimmed = teamName.trim();
  const m = mapping.get(trimmed) ?? mapping.get(trimmed.toLowerCase());
  if (m?.logoUrl && m.logoUrl !== '/placeholder.svg') return m.logoUrl;
  return '/placeholder.svg';
}

function getNCAABAbbr(teamName: string, mapping: NCAABTeamMappingByName): string {
  const trimmed = teamName.trim();
  const m = mapping.get(trimmed) ?? mapping.get(trimmed.toLowerCase());
  if (m?.teamAbbrev) return m.teamAbbrev;
  return getNCAABTeamInitials(teamName);
}

const formatTipoffTime = (tipoffTimeUtc: string | null, gameDate?: string | null): string => {
  if (!tipoffTimeUtc) return '';
  try {
    let utcDate: Date;
    if (tipoffTimeUtc.includes('T') || (tipoffTimeUtc.length > 10 && tipoffTimeUtc.includes(' '))) {
      utcDate = new Date(tipoffTimeUtc);
    } else if (gameDate) {
      const timePart = tipoffTimeUtc.includes(':') && tipoffTimeUtc.split(':').length >= 2
        ? tipoffTimeUtc.length === 5 ? `${tipoffTimeUtc}:00` : tipoffTimeUtc
        : tipoffTimeUtc;
      utcDate = new Date(`${gameDate}T${timePart}`);
    } else {
      utcDate = new Date(tipoffTimeUtc);
    }
    if (isNaN(utcDate.getTime())) return '';
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const dateStr = utcDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const dayMatch = dateStr.match(/(\d+)/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 0;
    const suffix = day > 3 && day < 21 ? 'th' : (day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th');
    const formattedDate = dateStr.replace(/\d+/, `${day}${suffix}`);
    return `${timeStr} ET ${formattedDate}`;
  } catch {
    return '';
  }
};

type ColorBucket = 'red' | 'yellow' | 'green';

function pctToBucket(pct: number | null | undefined): ColorBucket | null {
  if (pct == null) return null;
  const n = Number(pct);
  if (Number.isNaN(n)) return null;
  const pct100 = n > 1 ? n : n * 100;
  if (pct100 <= 53) return 'red';
  if (pct100 <= 57) return 'yellow';
  return 'green';
}

function getLeanLabel(
  metricLabel: string,
  awayVal: number | null,
  homeVal: number | null,
  awayAbbr: string,
  homeAbbr: string,
  isFlipRow: boolean
): string {
  const a = pctToBucket(awayVal);
  const b = pctToBucket(homeVal);
  if (a == null || b == null) return '-';

  if (isFlipRow) {
    const an = Number(awayVal);
    const bn = Number(homeVal);
    const away100 = !Number.isNaN(an) ? (an > 1 ? an : an * 100) : 100;
    const home100 = !Number.isNaN(bn) ? (bn > 1 ? bn : bn * 100) : 100;

    if (a === 'green' && b === 'green') return 'Heavy Lean Flip';
    if ((a === 'green' && b === 'yellow') || (a === 'yellow' && b === 'green')) return 'Slight Lean Flip';
    if (a === 'yellow' && b === 'yellow') return 'Slight Lean Flip';
    if (a === 'yellow' && b === 'red') return 'No Play';
    if (a === 'red' && b === 'yellow') return 'No Play';
    if (a === 'green' && b === 'red' && home100 > 45) return 'Slight Lean Flip';
    if (a === 'red' && b === 'green' && away100 > 45) return 'Slight Lean Flip';
    if (a === 'red' && b === 'red') {
      if (away100 <= 40 && home100 <= 40) return 'Heavy Lean Same';
      return 'No Play';
    }
    return '-';
  }

  const order: ColorBucket[] = ['red', 'yellow', 'green'];
  const aIdx = order.indexOf(a);
  const bIdx = order.indexOf(b);
  if (aIdx === bIdx) return 'No Play';
  const better = aIdx > bIdx ? 'away' : 'home';
  const betterAbbr = better === 'away' ? awayAbbr : homeAbbr;
  const half = metricLabel.startsWith('1H') ? '1H' : metricLabel.startsWith('2H') ? '2H' : '';
  const halfSuffix = half ? ` ${half}` : '';
  const isHeavy = (a === 'green' && b === 'red') || (a === 'red' && b === 'green');
  if (isHeavy) return `Heavy Lean ${betterAbbr}${halfSuffix}`;
  return `Slight Lean ${betterAbbr}${halfSuffix}`;
}

/** O/U lean from game average and per-team averages. Best leans when BOTH teams trend same direction (both >50% = over, both <50% = under). No Play when teams disagree. */
function getOULeanFromAverage(
  gameAvg: number | null | undefined,
  awayAvg: number | null | undefined,
  homeAvg: number | null | undefined
): string {
  if (gameAvg == null) return '-';
  const g = pctTo100(gameAvg);
  const a = awayAvg != null ? pctTo100(awayAvg) : null;
  const h = homeAvg != null ? pctTo100(homeAvg) : null;
  const bothOver = a != null && h != null && a > 50 && h > 50;
  const bothUnder = a != null && h != null && a < 50 && h < 50;
  if (a != null && h != null && !bothOver && !bothUnder) return 'No Play';
  if (bothOver) {
    if (g > 57) return 'Heavy Lean Over';
    if (g > 53) return 'Slight Lean Over';
    return 'No Play';
  }
  if (bothUnder) {
    if (g < 43) return 'Heavy Lean Under';
    if (g < 47) return 'Slight Lean Under';
    return 'No Play';
  }
  if (g > 57) return 'Heavy Lean Over';
  if (g > 53) return 'Slight Lean Over';
  if (g >= 47) return 'No Play';
  if (g >= 43) return 'Slight Lean Under';
  return 'Heavy Lean Under';
}

/** O/U lean for flip row only. 1H/2H use getOULeanFromAverage. */
function getOULeanLabel(
  awayOverPct: number | null,
  homeOverPct: number | null,
  isFlipRow: boolean
): string {
  if (!isFlipRow) return '-';
  const a = pctToBucket(awayOverPct);
  const b = pctToBucket(homeOverPct);
  if (a == null || b == null) return '-';
  const flipLabel = getLeanLabel('Flip % (1H↔2H)', awayOverPct, homeOverPct, 'A', 'H', true);
  if (flipLabel === 'No Play' || flipLabel === '-') return 'No Play';
  if (flipLabel.startsWith('Heavy')) return 'Heavy Lean Flip';
  if (flipLabel.startsWith('Slight')) return 'Slight Lean Flip';
  if (flipLabel === 'Heavy Lean Same') return 'Heavy Lean Same';
  return 'No Play';
}

/** Average of all 1H O/U over_pct values for the game (both teams: 1H by side, 1H Fav/Dog). */
function getGame1HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const away = game.away_team;
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.first_half_ou_side_over_pct);
  push(away.first_half_ou_favdog_side_over_pct);
  push(home.first_half_ou_side_over_pct);
  push(home.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

function getAway1HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const away = game.away_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.first_half_ou_side_over_pct);
  push(away.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

function getHome1HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(home.first_half_ou_side_over_pct);
  push(home.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

function getAway2HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const away = game.away_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.second_half_ou_side_over_pct);
  push(away.second_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

function getHome2HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(home.second_half_ou_side_over_pct);
  push(home.second_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Average of all 2H O/U over_pct values for the game (both teams). */
function getGame2HOUAverage(game: NCAABGameHalftimeTrends): number | null {
  const awayAvg = getAway2HOUAverage(game);
  const homeAvg = getHome2HOUAverage(game);
  if (awayAvg == null && homeAvg == null) return null;
  if (awayAvg == null) return homeAvg;
  if (homeAvg == null) return awayAvg;
  return (awayAvg + homeAvg) / 2;
}

function getLeanCellClassName(leanLabel: string | undefined): string {
  if (!leanLabel || leanLabel === '-') return 'text-foreground';
  if (leanLabel === 'No Play') return 'text-foreground';
  if (leanLabel === 'Heavy Lean Under') return 'text-red-500';
  if (leanLabel.startsWith('Slight')) return 'text-yellow-500';
  if (leanLabel.startsWith('Heavy')) return 'text-green-500';
  return 'text-foreground';
}

function parseSideLeanLabel(label: string): { strength: 'slight' | 'heavy'; teamAbbr: string } | null {
  if (!label || label === 'No Play' || label === '-') return null;
  const heavyMatch = label.match(/^Heavy Lean (.+?) 1H$/);
  if (heavyMatch) return { strength: 'heavy', teamAbbr: heavyMatch[1].trim() };
  const slightMatch = label.match(/^Slight Lean (.+?) 1H$/);
  if (slightMatch) return { strength: 'slight', teamAbbr: slightMatch[1].trim() };
  const heavy2 = label.match(/^Heavy Lean (.+?) 2H$/);
  if (heavy2) return { strength: 'heavy', teamAbbr: heavy2[1].trim() };
  const slight2 = label.match(/^Slight Lean (.+?) 2H$/);
  if (slight2) return { strength: 'slight', teamAbbr: slight2[1].trim() };
  return null;
}

type Consensus1H2H = { type: 'no_play' } | { type: 'slight' | 'heavy'; teamAbbr: string };
type ConsensusFlip = 'no_play' | 'slight' | 'heavy';

type OUConsensus1H2H = { type: 'no_play' } | { type: 'slight' | 'heavy'; direction: 'over' | 'under' };

/** O/U consensus for NCAAB: 1H/2H from average of all over_pct metrics for that half (both teams); Flip from ou_flip_pct. */
function getOUConsensus(
  game: NCAABGameHalftimeTrends
): { oneH: OUConsensus1H2H; twoH: OUConsensus1H2H; flip: ConsensusFlip } {
  const away = game.away_team;
  const home = game.home_team;

  const oneHAvg = getGame1HOUAverage(game);
  const oneHAwayAvg = getAway1HOUAverage(game);
  const oneHHomeAvg = getHome1HOUAverage(game);
  const oneHLabel = getOULeanFromAverage(oneHAvg, oneHAwayAvg, oneHHomeAvg);
  let oneH: OUConsensus1H2H = { type: 'no_play' };
  if (oneHLabel && oneHLabel !== 'No Play' && oneHLabel !== '-') {
    oneH = { type: oneHLabel.startsWith('Heavy') ? 'heavy' : 'slight', direction: oneHLabel.includes('Over') ? 'over' : 'under' };
  }

  const twoHAvg = getGame2HOUAverage(game);
  const twoHAwayAvg = getAway2HOUAverage(game);
  const twoHHomeAvg = getHome2HOUAverage(game);
  const twoHLabel = getOULeanFromAverage(twoHAvg, twoHAwayAvg, twoHHomeAvg);
  let twoH: OUConsensus1H2H = { type: 'no_play' };
  if (twoHLabel && twoHLabel !== 'No Play' && twoHLabel !== '-') {
    twoH = { type: twoHLabel.startsWith('Heavy') ? 'heavy' : 'slight', direction: twoHLabel.includes('Over') ? 'over' : 'under' };
  }

  const flipLabel = getOULeanLabel(away.ou_flip_pct ?? null, home.ou_flip_pct ?? null, true);
  let flip: ConsensusFlip = 'no_play';
  if (flipLabel.startsWith('Heavy')) flip = 'heavy';
  else if (flipLabel.startsWith('Slight') || flipLabel === 'Heavy Lean Same') flip = 'slight';

  return { oneH, twoH, flip };
}

/** Consensus from two metrics: only show a pick when one team leads in BOTH metrics; strength from average of the two. */
function consensusFromTwoMetrics(
  m1A: number | null,
  m1B: number | null,
  m2A: number | null,
  m2B: number | null,
  awayAbbr: string,
  homeAbbr: string,
  halfLabel: '1H' | '2H'
): Consensus1H2H {
  if (m1A == null || m1B == null || m2A == null || m2B == null) return { type: 'no_play' };
  const a1 = pctTo100(m1A), b1 = pctTo100(m1B);
  const a2 = pctTo100(m2A), b2 = pctTo100(m2B);
  const awayWinsBoth = a1 > b1 && a2 > b2;
  const homeWinsBoth = b1 > a1 && b2 > a2;
  if (!awayWinsBoth && !homeWinsBoth) return { type: 'no_play' };
  const avgA = (a1 + a2) / 2, avgB = (b1 + b2) / 2;
  const lean = getLeanLabel(halfLabel, avgA, avgB, awayAbbr, homeAbbr, false);
  const parsed = parseSideLeanLabel(lean);
  return parsed ? { type: parsed.strength, teamAbbr: parsed.teamAbbr } : { type: 'no_play' };
}

/** NCAAB: 1H = average of 1H by side + 1H Fav/Dog; pick only when one team leads in both. 2H = same for 2H. Flip unchanged. */
function getConsensus(
  game: NCAABGameHalftimeTrends,
  awayAbbr: string,
  homeAbbr: string
): { oneH: Consensus1H2H; twoH: Consensus1H2H; flip: ConsensusFlip } {
  const away = game.away_team;
  const home = game.home_team;

  const oneH = consensusFromTwoMetrics(
    away.first_half_side_win_pct,
    home.first_half_side_win_pct,
    away.first_half_favdog_side_win_pct,
    home.first_half_favdog_side_win_pct,
    awayAbbr,
    homeAbbr,
    '1H'
  );

  const twoH = consensusFromTwoMetrics(
    away.second_half_side_win_pct,
    home.second_half_side_win_pct,
    away.second_half_favdog_side_win_pct,
    home.second_half_favdog_side_win_pct,
    awayAbbr,
    homeAbbr,
    '2H'
  );

  const flipLabel = getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true);
  let flip: ConsensusFlip = 'no_play';
  if (flipLabel !== 'No Play' && flipLabel !== '-') {
    flip = flipLabel.startsWith('Heavy') ? 'heavy' : 'slight';
  }

  return { oneH, twoH, flip };
}

export type NCAABHalftimeSortMode = 'time' | '1h' | '2h' | 'flip';

function pctTo100(pct: number | null | undefined): number {
  if (pct == null) return 0;
  const n = Number(pct);
  return Number.isNaN(n) ? 0 : n > 1 ? n : n * 100;
}

/** Side lean (1H/2H): No Play=0, Slight=1, Heavy=2 */
function ncaabSideLeanStrength(leanLabel: string): number {
  if (!leanLabel || leanLabel === 'No Play' || leanLabel === '-') return 0;
  return leanLabel.startsWith('Heavy') ? 2 : leanLabel.startsWith('Slight') ? 1 : 0;
}

/** Flip row: No Play=0, Heavy Lean Same=1, Slight Lean Flip=2, Heavy Lean Flip=3 */
function ncaabFlipLeanStrength(leanLabel: string): number {
  if (!leanLabel || leanLabel === '-') return 0;
  if (leanLabel === 'Heavy Lean Flip') return 3;
  if (leanLabel === 'Slight Lean Flip') return 2;
  if (leanLabel === 'Heavy Lean Same') return 1;
  return 0;
}

/** Cumulative 1H score: sum across 1H by side, 1H Fav/Dog (max 4) */
function getNCAAB1HCumulativeScore(
  away: NCAABHalftimeTrendRow,
  home: NCAABHalftimeTrendRow,
  awayAbbr: string,
  homeAbbr: string
): { score: number; avgEdge: number } {
  const s1 = getLeanLabel('1H by side', away.first_half_side_win_pct, home.first_half_side_win_pct, awayAbbr, homeAbbr, false);
  const s2 = getLeanLabel('1H Fav/Dog', away.first_half_favdog_side_win_pct, home.first_half_favdog_side_win_pct, awayAbbr, homeAbbr, false);
  const score = ncaabSideLeanStrength(s1) + ncaabSideLeanStrength(s2);
  const e1 = Math.abs(pctTo100(away.first_half_side_win_pct) - pctTo100(home.first_half_side_win_pct));
  const e2 = Math.abs(pctTo100(away.first_half_favdog_side_win_pct) - pctTo100(home.first_half_favdog_side_win_pct));
  const avgEdge = (e1 + e2) / 2;
  return { score, avgEdge };
}

/** Cumulative 2H score: sum across 2H by side, 2H Fav/Dog (max 4) */
function getNCAAB2HCumulativeScore(
  away: NCAABHalftimeTrendRow,
  home: NCAABHalftimeTrendRow,
  awayAbbr: string,
  homeAbbr: string
): { score: number; avgEdge: number } {
  const s1 = getLeanLabel('2H by side', away.second_half_side_win_pct, home.second_half_side_win_pct, awayAbbr, homeAbbr, false);
  const s2 = getLeanLabel('2H Fav/Dog', away.second_half_favdog_side_win_pct, home.second_half_favdog_side_win_pct, awayAbbr, homeAbbr, false);
  const score = ncaabSideLeanStrength(s1) + ncaabSideLeanStrength(s2);
  const e1 = Math.abs(pctTo100(away.second_half_side_win_pct) - pctTo100(home.second_half_side_win_pct));
  const e2 = Math.abs(pctTo100(away.second_half_favdog_side_win_pct) - pctTo100(home.second_half_favdog_side_win_pct));
  const avgEdge = (e1 + e2) / 2;
  return { score, avgEdge };
}

/** Flip score: single metric (max 3) */
function getNCAABFlipCumulativeScore(
  away: NCAABHalftimeTrendRow,
  home: NCAABHalftimeTrendRow,
  awayAbbr: string,
  homeAbbr: string
): { score: number; avgEdge: number } {
  const f1 = getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true);
  const score = ncaabFlipLeanStrength(f1);
  const avgEdge = Math.abs(pctTo100(away.side_flip_pct) - pctTo100(home.side_flip_pct));
  return { score, avgEdge };
}

/** Sortable timestamp: combine game_date + tipoff_time_et so time-only strings like "20:30" parse correctly. */
function getTipoffTimestamp(g: NCAABGameHalftimeTrends): number {
  const dateStr = g.game_date ?? '';
  const timeStr = g.tipoff_time_et ?? '';
  if (dateStr && timeStr) {
    const timePart = timeStr.length === 5 && timeStr.includes(':') ? `${timeStr}:00` : timeStr;
    const combined = `${dateStr}T${timePart}`;
    const ts = new Date(combined).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  if (dateStr) {
    const ts = new Date(dateStr).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  if (timeStr) {
    const ts = new Date(`1970-01-01T${timeStr}`).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
}

/** O/U 1H sort score: higher when both teams trend same direction. */
function getOU1HScore(game: NCAABGameHalftimeTrends): number {
  const gameAvg = getGame1HOUAverage(game);
  const awayAvg = getAway1HOUAverage(game);
  const homeAvg = getHome1HOUAverage(game);
  if (gameAvg == null || awayAvg == null || homeAvg == null) return 0;
  const a = pctTo100(awayAvg);
  const h = pctTo100(homeAvg);
  const bothOver = a > 50 && h > 50;
  const bothUnder = a < 50 && h < 50;
  if (!bothOver && !bothUnder) return 0;
  return Math.abs(pctTo100(gameAvg) - 50);
}

/** O/U 2H sort score. */
function getOU2HScore(game: NCAABGameHalftimeTrends): number {
  const gameAvg = getGame2HOUAverage(game);
  const awayAvg = getAway2HOUAverage(game);
  const homeAvg = getHome2HOUAverage(game);
  if (gameAvg == null || awayAvg == null || homeAvg == null) return 0;
  const a = pctTo100(awayAvg);
  const h = pctTo100(homeAvg);
  const bothOver = a > 50 && h > 50;
  const bothUnder = a < 50 && h < 50;
  if (!bothOver && !bothUnder) return 0;
  return Math.abs(pctTo100(gameAvg) - 50);
}

function ouLeanStrength(label: string): number {
  if (!label || label === 'No Play' || label === '-') return 0;
  return label.startsWith('Heavy') ? 2 : label.startsWith('Slight') ? 1 : 0;
}

function sortNCAABGamesByMode(
  games: NCAABGameHalftimeTrends[],
  mode: NCAABHalftimeSortMode,
  teamMapping: NCAABTeamMappingByName,
  viewMode: 'ats' | 'ou' = 'ats'
): NCAABGameHalftimeTrends[] {
  const tipoffTs = getTipoffTimestamp;

  if (mode === 'time') {
    return [...games].sort((a, b) => {
      const ta = tipoffTs(a);
      const tb = tipoffTs(b);
      if (ta !== tb) return ta - tb;
      return (a.game_id ?? 0) - (b.game_id ?? 0);
    });
  }

  if (viewMode === 'ou') {
    return [...games].sort((a, b) => {
      if (mode === '1h') {
        const scoreA = getOU1HScore(a);
        const scoreB = getOU1HScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const labelA = getOULeanFromAverage(getGame1HOUAverage(a), getAway1HOUAverage(a), getHome1HOUAverage(a));
        const labelB = getOULeanFromAverage(getGame1HOUAverage(b), getAway1HOUAverage(b), getHome1HOUAverage(b));
        if (ouLeanStrength(labelB) !== ouLeanStrength(labelA)) return ouLeanStrength(labelB) - ouLeanStrength(labelA);
        return tipoffTs(a) - tipoffTs(b);
      }
      if (mode === '2h') {
        const scoreA = getOU2HScore(a);
        const scoreB = getOU2HScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const labelA = getOULeanFromAverage(getGame2HOUAverage(a), getAway2HOUAverage(a), getHome2HOUAverage(a));
        const labelB = getOULeanFromAverage(getGame2HOUAverage(b), getAway2HOUAverage(b), getHome2HOUAverage(b));
        if (ouLeanStrength(labelB) !== ouLeanStrength(labelA)) return ouLeanStrength(labelB) - ouLeanStrength(labelA);
        return tipoffTs(a) - tipoffTs(b);
      }
      if (mode === 'flip') {
        const labelA = getOULeanLabel(a.away_team.ou_flip_pct ?? null, a.home_team.ou_flip_pct ?? null, true);
        const labelB = getOULeanLabel(b.away_team.ou_flip_pct ?? null, b.home_team.ou_flip_pct ?? null, true);
        if (ouLeanStrength(labelB) !== ouLeanStrength(labelA)) return ouLeanStrength(labelB) - ouLeanStrength(labelA);
        return tipoffTs(a) - tipoffTs(b);
      }
      return tipoffTs(a) - tipoffTs(b);
    });
  }

  return [...games].sort((a, b) => {
    const awayA = a.away_team;
    const homeA = a.home_team;
    const awayB = b.away_team;
    const homeB = b.home_team;
    const abbrA = getNCAABAbbr(awayA.team_name, teamMapping);
    const homeAbbrA = getNCAABAbbr(homeA.team_name, teamMapping);
    const abbrB = getNCAABAbbr(awayB.team_name, teamMapping);
    const homeAbbrB = getNCAABAbbr(homeB.team_name, teamMapping);

    if (mode === '1h') {
      const { score: scoreA, avgEdge: edgeA } = getNCAAB1HCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNCAAB1HCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    if (mode === '2h') {
      const { score: scoreA, avgEdge: edgeA } = getNCAAB2HCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNCAAB2HCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    if (mode === 'flip') {
      const { score: scoreA, avgEdge: edgeA } = getNCAABFlipCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNCAABFlipCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    return tipoffTs(a) - tipoffTs(b);
  });
}

export default function NCAABTodayHalftimeTrends() {
  const [games, setGames] = useState<NCAABGameHalftimeTrends[]>([]);
  const [lostBothHalvesTeams, setLostBothHalvesTeams] = useState<NCAABHalftimeTrendRow[]>([]);
  const [teamMapping, setTeamMapping] = useState<NCAABTeamMappingByName>(new Map());
  const [sortMode, setSortMode] = useState<NCAABHalftimeSortMode>('time');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'ats' | 'ou'>('ats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const mappingRes = await fetchNCAABTeamMappingByName();
      setTeamMapping(mappingRes);

      // Get today's game_ids from a lightweight query (avoids heavy view timeout)
      const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data: todayGames, error: gamesError } = await collegeFootballSupabase
        .from('v_cbb_input_values')
        .select('game_id')
        .eq('game_date_et', todayEt);
      if (gamesError || !todayGames?.length) {
        setGames([]);
        setLostBothHalvesTeams([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }
      const gameIds = (todayGames as { game_id: number }[]).map((g) => g.game_id);

      // Fetch halftime trends by small game_id batches so each query stays under timeout
      const GAME_BATCH = 15;
      let allRows: any[] = [];
      for (let i = 0; i < gameIds.length; i += GAME_BATCH) {
        const chunk = gameIds.slice(i, i + GAME_BATCH);
        const { data: batch, error: fetchError } = await collegeFootballSupabase
          .from('ncaab_halftime_trends_today')
          .select('*')
          .in('game_id', chunk)
          .order('game_id', { ascending: true });
        if (fetchError) {
          setError(`Failed to load data: ${fetchError.message}`);
          setLoading(false);
          return;
        }
        const list = (batch || []) as any[];
        allRows = allRows.concat(list);
      }

      const data = allRows;
      if (data.length === 0) {
        setGames([]);
        setLostBothHalvesTeams([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      const gamesMap = new Map<number, NCAABGameHalftimeTrends>();
      for (const row of data as any[]) {
        const side = row.team_side === 'away' || row.team_side === 'home' ? row.team_side : null;
        if (!side) continue;
        const r: NCAABHalftimeTrendRow = {
          game_id: row.game_id,
          team_name: row.team_name ?? '',
          team_side: side,
          todays_lost_both_halves_last_game: row.todays_lost_both_halves_last_game === true,
          todays_first_half_line: row.todays_first_half_line != null ? Number(row.todays_first_half_line) : null,
          todays_first_half_fav_dog: row.todays_first_half_fav_dog ?? null,
          todays_second_half_line: row.todays_second_half_line != null ? Number(row.todays_second_half_line) : null,
          todays_second_half_fav_dog: row.todays_second_half_fav_dog ?? null,
          first_half_side_games: row.first_half_side_games ?? null,
          first_half_side_wins: row.first_half_side_wins ?? null,
          first_half_side_win_pct: row.first_half_side_win_pct ?? null,
          second_half_side_games: row.second_half_side_games ?? null,
          second_half_side_wins: row.second_half_side_wins ?? null,
          second_half_side_win_pct: row.second_half_side_win_pct ?? null,
          side_flip_games: row.side_flip_games ?? null,
          side_flip_count: row.side_flip_count ?? null,
          side_flip_pct: row.side_flip_pct ?? null,
          lost_both_1h_side_games: row.lost_both_1h_side_games ?? null,
          lost_both_1h_side_wins: row.lost_both_1h_side_wins ?? null,
          lost_both_1h_side_win_pct: row.lost_both_1h_side_win_pct ?? null,
          first_half_favdog_side_games: row.first_half_favdog_side_games ?? null,
          first_half_favdog_side_wins: row.first_half_favdog_side_wins ?? null,
          first_half_favdog_side_win_pct: row.first_half_favdog_side_win_pct ?? null,
          second_half_favdog_side_games: row.second_half_favdog_side_games ?? null,
          second_half_favdog_side_wins: row.second_half_favdog_side_wins ?? null,
          second_half_favdog_side_win_pct: row.second_half_favdog_side_win_pct ?? null,
          todays_first_half_ou_line: parseNum(row.todays_first_half_ou_line ?? row.todays_first_half_ou),
          todays_second_half_ou_line: parseNum(row.todays_second_half_ou_line ?? row.todays_second_half_ou),
          first_half_ou_side_games: row.first_half_ou_side_games ?? null,
          first_half_ou_side_overs: row.first_half_ou_side_overs ?? null,
          first_half_ou_side_over_pct: parseNum(row.first_half_ou_side_over_pct) ?? null,
          second_half_ou_side_games: row.second_half_ou_side_games ?? null,
          second_half_ou_side_overs: row.second_half_ou_side_overs ?? null,
          second_half_ou_side_over_pct: parseNum(row.second_half_ou_side_over_pct) ?? null,
          ou_flip_games: row.ou_flip_games ?? null,
          ou_flip_count: row.ou_flip_count ?? null,
          ou_flip_pct: parseNum(row.ou_flip_pct) ?? null,
          first_half_ou_favdog_side_games: row.first_half_ou_favdog_side_games ?? null,
          first_half_ou_favdog_side_overs: row.first_half_ou_favdog_side_overs ?? null,
          first_half_ou_favdog_side_over_pct: parseNum(row.first_half_ou_favdog_side_over_pct) ?? null,
          second_half_ou_favdog_side_games: row.second_half_ou_favdog_side_games ?? null,
          second_half_ou_favdog_side_overs: row.second_half_ou_favdog_side_overs ?? null,
          second_half_ou_favdog_side_over_pct: parseNum(row.second_half_ou_favdog_side_over_pct) ?? null,
        };
        if (!gamesMap.has(row.game_id)) {
          gamesMap.set(row.game_id, {
            game_id: row.game_id,
            game_date: row.game_date ?? null,
            tipoff_time_et: null,
            away_team: side === 'away' ? r : ({} as NCAABHalftimeTrendRow),
            home_team: side === 'home' ? r : ({} as NCAABHalftimeTrendRow),
          });
        } else {
          const g = gamesMap.get(row.game_id)!;
          if (side === 'away') g.away_team = r;
          else g.home_team = r;
        }
      }

      const gamesArray = Array.from(gamesMap.values()).filter(
        g => g.away_team.team_name && g.home_team.team_name
      );

      const tipoffGameIds = gamesArray.map(g => g.game_id);
      if (tipoffGameIds.length > 0) {
        const TIMES_BATCH = 50;
        const timesData: any[] = [];
        for (let i = 0; i < tipoffGameIds.length; i += TIMES_BATCH) {
          const chunk = tipoffGameIds.slice(i, i + TIMES_BATCH);
          const { data: batch } = await collegeFootballSupabase
            .from('v_cbb_input_values')
            .select('game_id, tipoff_time_et, game_date_et')
            .in('game_id', chunk);
          if (batch?.length) timesData.push(...batch);
        }
        if (timesData.length > 0) {
          const byGame = new Map<number, { tipoff_time_et: string | null; game_date: string | null }>();
          for (const t of timesData as any[]) {
            byGame.set(t.game_id, {
              tipoff_time_et: t.tipoff_time_et ?? null,
              game_date: t.game_date_et ?? t.game_date ?? null,
            });
          }
          gamesArray.forEach(g => {
            const info = byGame.get(g.game_id);
            if (info) {
              g.tipoff_time_et = info.tipoff_time_et;
              if (info.game_date) g.game_date = info.game_date;
            }
          });
        }
      }

      gamesArray.sort((a, b) => {
        if (a.tipoff_time_et && b.tipoff_time_et) {
          return new Date(a.tipoff_time_et).getTime() - new Date(b.tipoff_time_et).getTime();
        }
        if (a.tipoff_time_et && !b.tipoff_time_et) return -1;
        if (!a.tipoff_time_et && b.tipoff_time_et) return 1;
        if (a.game_date && b.game_date) return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        return 0;
      });

      const lostBoth: NCAABHalftimeTrendRow[] = (data as any[])
        .filter((row: any) => row.todays_lost_both_halves_last_game === true)
        .map((row: any) => ({
          game_id: row.game_id,
          team_name: row.team_name ?? '',
          team_side: row.team_side === 'away' || row.team_side === 'home' ? row.team_side : 'away',
          todays_lost_both_halves_last_game: true,
          todays_first_half_line: row.todays_first_half_line != null ? Number(row.todays_first_half_line) : null,
          todays_first_half_fav_dog: row.todays_first_half_fav_dog ?? null,
          todays_second_half_line: row.todays_second_half_line != null ? Number(row.todays_second_half_line) : null,
          todays_second_half_fav_dog: row.todays_second_half_fav_dog ?? null,
          first_half_side_games: row.first_half_side_games ?? null,
          first_half_side_wins: row.first_half_side_wins ?? null,
          first_half_side_win_pct: row.first_half_side_win_pct ?? null,
          second_half_side_games: row.second_half_side_games ?? null,
          second_half_side_wins: row.second_half_side_wins ?? null,
          second_half_side_win_pct: row.second_half_side_win_pct ?? null,
          side_flip_games: row.side_flip_games ?? null,
          side_flip_count: row.side_flip_count ?? null,
          side_flip_pct: row.side_flip_pct ?? null,
          lost_both_1h_side_games: row.lost_both_1h_side_games ?? null,
          lost_both_1h_side_wins: row.lost_both_1h_side_wins ?? null,
          lost_both_1h_side_win_pct: row.lost_both_1h_side_win_pct ?? null,
          first_half_favdog_side_games: row.first_half_favdog_side_games ?? null,
          first_half_favdog_side_wins: row.first_half_favdog_side_wins ?? null,
          first_half_favdog_side_win_pct: row.first_half_favdog_side_win_pct ?? null,
          second_half_favdog_side_games: row.second_half_favdog_side_games ?? null,
          second_half_favdog_side_wins: row.second_half_favdog_side_wins ?? null,
          second_half_favdog_side_win_pct: row.second_half_favdog_side_win_pct ?? null,
          todays_first_half_ou_line: null,
          todays_second_half_ou_line: null,
          first_half_ou_side_games: null,
          first_half_ou_side_overs: null,
          first_half_ou_side_over_pct: null,
          second_half_ou_side_games: null,
          second_half_ou_side_overs: null,
          second_half_ou_side_over_pct: null,
          ou_flip_games: null,
          ou_flip_count: null,
          ou_flip_pct: null,
          first_half_ou_favdog_side_games: null,
          first_half_ou_favdog_side_overs: null,
          first_half_ou_favdog_side_over_pct: null,
          second_half_ou_favdog_side_games: null,
          second_half_ou_favdog_side_overs: null,
          second_half_ou_favdog_side_over_pct: null,
        }));

      setGames(gamesArray);
      setLostBothHalvesTeams(lostBoth);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderMetricRow = (
    label: string,
    awayVal: number | null,
    homeVal: number | null,
    awayGames?: number | null,
    homeGames?: number | null,
    leanLabel?: string,
    useHalftimeColors?: boolean,
    rowKeyPrefix?: number | string,
    awaySuffix?: string,
    homeSuffix?: string
  ) => {
    const rowKey = rowKeyPrefix != null ? `${rowKeyPrefix}-${label}` : label;
    const awayNum = awayVal != null ? Number(awayVal) : null;
    const homeNum = homeVal != null ? Number(homeVal) : null;
    const displayAway = awayNum != null && !Number.isNaN(awayNum) ? (awayNum > 1 ? awayNum : awayNum * 100).toFixed(1) : null;
    const displayHome = homeNum != null && !Number.isNaN(homeNum) ? (homeNum > 1 ? homeNum : homeNum * 100).toFixed(1) : null;
    const awayStyle = useHalftimeColors ? getHalftimePercentageStyle(awayVal) : undefined;
    const homeStyle = useHalftimeColors ? getHalftimePercentageStyle(homeVal) : undefined;
    const awayPct100 = displayAway != null ? Number(displayAway) : null;
    const homePct100 = displayHome != null ? Number(displayHome) : null;
    const awayClass = !useHalftimeColors && awayPct100 != null ? getPercentageColor(awayPct100) : undefined;
    const homeClass = !useHalftimeColors && homePct100 != null ? getPercentageColor(homePct100) : undefined;
    const awaySub = awaySuffix ?? (awayGames != null && awayGames > 0 ? String(awayGames) : null);
    const homeSub = homeSuffix ?? (homeGames != null && homeGames > 0 ? String(homeGames) : null);
    return (
      <div key={rowKey} className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,5.5rem)] sm:grid-cols-[140px_1fr_1fr_160px] gap-2 text-sm items-center border-b border-gray-200 dark:border-gray-700 py-1 min-w-0">
        <div className="font-medium text-xs text-gray-700 dark:text-gray-300 min-w-0 break-words">{label}</div>
        <div className="text-left min-w-0 overflow-hidden">
          {displayAway != null ? (
            <span style={awayStyle} className={awayClass}>
              {displayAway}%
              {awaySub != null && <span className="text-gray-500 text-xs ml-1">({awaySub})</span>}
            </span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </div>
        <div className="text-left min-w-0 overflow-hidden">
          {displayHome != null ? (
            <span style={homeStyle} className={homeClass}>
              {displayHome}%
              {homeSub != null && <span className="text-gray-500 text-xs ml-1">({homeSub})</span>}
            </span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </div>
        <div className={`text-xs font-medium min-w-0 break-words ${getLeanCellClassName(leanLabel)}`}>
          {leanLabel ?? '-'}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="h-8 w-8" />
          Halftime Trends
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Halftime Trends</h1>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex flex-wrap items-center gap-2 min-w-0">
            <Clock className="h-8 w-8 shrink-0" />
            Halftime Trends
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 min-w-0 break-words">
            First-half and second-half ATS and O/U trends for today&apos;s College Basketball games
            {lastUpdated && (
              <span className="ml-2">• Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('ats')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'ats' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              ATS
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ou')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'ou' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              O/U
            </button>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="shrink-0">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {games.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by team name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as NCAABHalftimeSortMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="1h">Best 1H Lean</SelectItem>
                <SelectItem value="2h">Best 2H Lean</SelectItem>
                <SelectItem value="flip">Best Flip / Same Lean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No games today.
          </CardContent>
        </Card>
      ) : (() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
          ? sortNCAABGamesByMode(games, sortMode, teamMapping, viewMode).filter(
              (g) =>
                g.away_team.team_name.toLowerCase().includes(q) ||
                g.home_team.team_name.toLowerCase().includes(q)
            )
          : sortNCAABGamesByMode(games, sortMode, teamMapping, viewMode);
        if (filtered.length === 0) {
          return (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No games match your search. Try a different team name.
              </CardContent>
            </Card>
          );
        }
        return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {filtered.map(game => {
            const away = game.away_team;
            const home = game.home_team;
            const awayAbbr = getNCAABAbbr(away.team_name, teamMapping);
            const homeAbbr = getNCAABAbbr(home.team_name, teamMapping);
            const format1HLine = (val: number | null) =>
              val == null ? '' : `(1H: ${val > 0 ? `+${val}` : `${val}`})`;
            return (
              <Card key={game.game_id} className="min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                      {game.tipoff_time_et
                        ? formatTipoffTime(game.tipoff_time_et, game.game_date)
                        : game.game_date || 'Time TBD'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 min-w-0">
                    <img
                      src={getNCAABLogoUrl(away.team_name, teamMapping)}
                      alt={away.team_name}
                      className="w-8 h-8 object-contain shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="font-semibold text-white min-w-0 truncate">
                      <span className="md:hidden">{awayAbbr}</span>
                      <span className="hidden md:inline">{away.team_name}</span>
                      {viewMode === 'ats' && (away.todays_first_half_line != null || home.todays_first_half_line != null) &&
                        away.todays_first_half_line != null && (
                          <span className="text-gray-500 font-normal ml-1">
                            (1H: {away.todays_first_half_line >= 0 ? '+' : ''}{away.todays_first_half_line})
                          </span>
                        )}
                    </span>
                    <span className="text-gray-500">@</span>
                    <img
                      src={getNCAABLogoUrl(home.team_name, teamMapping)}
                      alt={home.team_name}
                      className="w-8 h-8 object-contain shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="font-semibold text-white min-w-0 truncate">
                      <span className="md:hidden">{homeAbbr}</span>
                      <span className="hidden md:inline">{home.team_name}</span>
                      {viewMode === 'ats' && (away.todays_first_half_line != null || home.todays_first_half_line != null) &&
                        home.todays_first_half_line != null && (
                          <span className="text-gray-500 font-normal ml-1">
                            (1H: {home.todays_first_half_line >= 0 ? '+' : ''}{home.todays_first_half_line})
                          </span>
                        )}
                      {viewMode === 'ou' && (away.todays_first_half_ou_line != null || home.todays_first_half_ou_line != null) &&
                        home.todays_first_half_ou_line != null && (
                          <span className="text-gray-500 font-normal ml-1">
                            (1H O/U: {home.todays_first_half_ou_line})
                          </span>
                        )}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 min-w-0 overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,5.5rem)] sm:grid-cols-[140px_1fr_1fr_160px] gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 items-center min-w-0">
                    <div className="min-w-0 break-words">Metric</div>
                    <div className="flex justify-start min-w-0">
                      <img
                        src={getNCAABLogoUrl(away.team_name, teamMapping)}
                        alt={away.team_name}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex justify-start min-w-0">
                      <img
                        src={getNCAABLogoUrl(home.team_name, teamMapping)}
                        alt={home.team_name}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="min-w-0 break-words">Lean</div>
                  </div>
                  {viewMode === 'ats' && (
                    <>
                  {renderMetricRow(
                    '1H by side',
                    away.first_half_side_win_pct,
                    home.first_half_side_win_pct,
                    away.first_half_side_games,
                    home.first_half_side_games,
                    getLeanLabel('1H by side', away.first_half_side_win_pct, home.first_half_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '1H Fav/Dog',
                    away.first_half_favdog_side_win_pct,
                    home.first_half_favdog_side_win_pct,
                    away.first_half_favdog_side_games,
                    home.first_half_favdog_side_games,
                    getLeanLabel('1H Fav/Dog', away.first_half_favdog_side_win_pct, home.first_half_favdog_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    game.game_id,
                    away.todays_first_half_fav_dog
                      ? away.todays_first_half_fav_dog.charAt(0).toUpperCase() + away.todays_first_half_fav_dog.slice(1).toLowerCase()
                      : undefined,
                    home.todays_first_half_fav_dog
                      ? home.todays_first_half_fav_dog.charAt(0).toUpperCase() + home.todays_first_half_fav_dog.slice(1).toLowerCase()
                      : undefined
                  )}
                  {renderMetricRow(
                    '2H by side',
                    away.second_half_side_win_pct,
                    home.second_half_side_win_pct,
                    away.second_half_side_games,
                    home.second_half_side_games,
                    getLeanLabel('2H by side', away.second_half_side_win_pct, home.second_half_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '2H Fav/Dog',
                    away.second_half_favdog_side_win_pct,
                    home.second_half_favdog_side_win_pct,
                    away.second_half_favdog_side_games,
                    home.second_half_favdog_side_games,
                    getLeanLabel('2H Fav/Dog', away.second_half_favdog_side_win_pct, home.second_half_favdog_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    game.game_id,
                    away.todays_second_half_fav_dog
                      ? away.todays_second_half_fav_dog.charAt(0).toUpperCase() + away.todays_second_half_fav_dog.slice(1).toLowerCase()
                      : undefined,
                    home.todays_second_half_fav_dog
                      ? home.todays_second_half_fav_dog.charAt(0).toUpperCase() + home.todays_second_half_fav_dog.slice(1).toLowerCase()
                      : undefined
                  )}
                  {renderMetricRow(
                    'Flip % (1H↔2H)',
                    away.side_flip_pct,
                    home.side_flip_pct,
                    undefined,
                    undefined,
                    getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true),
                    true,
                    game.game_id
                  )}
                    </>
                  )}
                  {viewMode === 'ou' && (
                    <>
                  {renderMetricRow(
                    '1H O/U by side',
                    away.first_half_ou_side_over_pct,
                    home.first_half_ou_side_over_pct,
                    away.first_half_ou_side_games,
                    home.first_half_ou_side_games,
                    getOULeanFromAverage(getGame1HOUAverage(game), getAway1HOUAverage(game), getHome1HOUAverage(game)),
                    true,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '1H O/U Fav/Dog',
                    away.first_half_ou_favdog_side_over_pct,
                    home.first_half_ou_favdog_side_over_pct,
                    away.first_half_ou_favdog_side_games,
                    home.first_half_ou_favdog_side_games,
                    getOULeanFromAverage(getGame1HOUAverage(game), getAway1HOUAverage(game), getHome1HOUAverage(game)),
                    true,
                    game.game_id,
                    away.todays_first_half_fav_dog
                      ? away.todays_first_half_fav_dog.charAt(0).toUpperCase() + away.todays_first_half_fav_dog.slice(1).toLowerCase()
                      : undefined,
                    home.todays_first_half_fav_dog
                      ? home.todays_first_half_fav_dog.charAt(0).toUpperCase() + home.todays_first_half_fav_dog.slice(1).toLowerCase()
                      : undefined
                  )}
                  {renderMetricRow(
                    '2H O/U by side',
                    away.second_half_ou_side_over_pct,
                    home.second_half_ou_side_over_pct,
                    away.second_half_ou_side_games,
                    home.second_half_ou_side_games,
                    getOULeanFromAverage(getGame2HOUAverage(game), getAway2HOUAverage(game), getHome2HOUAverage(game)),
                    true,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '2H O/U Fav/Dog',
                    away.second_half_ou_favdog_side_over_pct,
                    home.second_half_ou_favdog_side_over_pct,
                    away.second_half_ou_favdog_side_games,
                    home.second_half_ou_favdog_side_games,
                    getOULeanFromAverage(getGame2HOUAverage(game), getAway2HOUAverage(game), getHome2HOUAverage(game)),
                    true,
                    game.game_id,
                    away.todays_second_half_fav_dog
                      ? away.todays_second_half_fav_dog.charAt(0).toUpperCase() + away.todays_second_half_fav_dog.slice(1).toLowerCase()
                      : undefined,
                    home.todays_second_half_fav_dog
                      ? home.todays_second_half_fav_dog.charAt(0).toUpperCase() + home.todays_second_half_fav_dog.slice(1).toLowerCase()
                      : undefined
                  )}
                  {renderMetricRow(
                    'O/U Flip % (1H↔2H)',
                    away.ou_flip_pct,
                    home.ou_flip_pct,
                    undefined,
                    undefined,
                    getOULeanLabel(away.ou_flip_pct ?? null, home.ou_flip_pct ?? null, true),
                    true,
                    game.game_id
                  )}
                    </>
                  )}
                  {/* Consensus */}
                  {(() => {
                    const teamForAbbr = (abbr: string) => (abbr === awayAbbr ? away : home);
                    const format1HLine = (val: number | null) =>
                      val == null ? '' : `(1H: ${val > 0 ? `+${val}` : `${val}`})`;
                    if (viewMode === 'ou') {
                      const consensus = getOUConsensus(game);
                      return (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">Consensus</div>
                          <div className="flex flex-wrap gap-3 text-sm min-w-0">
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                  <span className="text-muted-foreground shrink-0">1st Half Play:</span>
                                  {consensus.oneH.type === 'no_play' ? (
                                    <span className="text-foreground">No Play</span>
                                  ) : (
                                    <span className={getLeanCellClassName(consensus.oneH.type === 'heavy' ? `Heavy Lean ${consensus.oneH.direction === 'over' ? 'Over' : 'Under'}` : `Slight Lean ${consensus.oneH.direction === 'over' ? 'Over' : 'Under'}`)}>
                                      {consensus.oneH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean {consensus.oneH.direction === 'over' ? 'Over' : 'Under'}
                                      {away.todays_first_half_ou_line != null && ` (O/U ${away.todays_first_half_ou_line})`}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                {consensus.oneH.type === 'no_play' ? 'No Play' : `1st Half O/U — ${consensus.oneH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean ${consensus.oneH.direction === 'over' ? 'Over' : 'Under'}`}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                  <span className="text-muted-foreground shrink-0">2nd Half Play:</span>
                                  {consensus.twoH.type === 'no_play' ? (
                                    <span className="text-foreground">No Play</span>
                                  ) : (
                                    <span className={getLeanCellClassName(consensus.twoH.type === 'heavy' ? `Heavy Lean ${consensus.twoH.direction === 'over' ? 'Over' : 'Under'}` : `Slight Lean ${consensus.twoH.direction === 'over' ? 'Over' : 'Under'}`)}>
                                      {consensus.twoH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean {consensus.twoH.direction === 'over' ? 'Over' : 'Under'}
                                      {away.todays_second_half_ou_line != null && ` (O/U ${away.todays_second_half_ou_line})`}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                {consensus.twoH.type === 'no_play' ? 'No Play' : `2nd Half O/U — ${consensus.twoH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean ${consensus.twoH.direction === 'over' ? 'Over' : 'Under'}`}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                  <span className="text-muted-foreground shrink-0">Flip Play:</span>
                                  {consensus.flip === 'no_play' ? (
                                    <span className="text-foreground">No Play</span>
                                  ) : (
                                    <>
                                      <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
                                      <span className={getLeanCellClassName(consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip')}>
                                        {consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                {consensus.flip === 'no_play' ? 'No Play' : (consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip')}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    }
                    const consensus = getConsensus(game, awayAbbr, homeAbbr);
                    return (
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Consensus</div>
                        <div className="flex flex-wrap gap-3 text-sm min-w-0">
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                <span className="text-muted-foreground shrink-0">1st Half Play:</span>
                                {consensus.oneH.type === 'no_play' ? (
                                  <span className="text-foreground">No Play</span>
                                ) : (
                                  <>
                                    <img
                                      src={getNCAABLogoUrl(teamForAbbr(consensus.oneH.teamAbbr).team_name, teamMapping)}
                                      alt={consensus.oneH.teamAbbr}
                                      className="w-6 h-6 object-contain"
                                    />
                                    <span className={getLeanCellClassName(consensus.oneH.type === 'heavy' ? 'Heavy' : 'Slight')}>
                                      {consensus.oneH.type === 'heavy' ? 'Heavy Lean' : 'Slight Lean'}{' '}
                                      {format1HLine(teamForAbbr(consensus.oneH.teamAbbr).todays_first_half_line)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {consensus.oneH.type === 'no_play'
                                ? 'No Play'
                                : `${teamForAbbr(consensus.oneH.teamAbbr).team_name} — ${consensus.oneH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean 1st Half`}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                <span className="text-muted-foreground shrink-0">2nd Half Play:</span>
                                {consensus.twoH.type === 'no_play' ? (
                                  <span className="text-foreground">No Play</span>
                                ) : (
                                  <>
                                    <img
                                      src={getNCAABLogoUrl(teamForAbbr(consensus.twoH.teamAbbr).team_name, teamMapping)}
                                      alt={consensus.twoH.teamAbbr}
                                      className="w-6 h-6 object-contain"
                                    />
                                    <span className={getLeanCellClassName(consensus.twoH.type === 'heavy' ? 'Heavy' : 'Slight')}>
                                      {consensus.twoH.type === 'heavy' ? 'Heavy Lean' : 'Slight Lean'} 2H Spread
                                    </span>
                                  </>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {consensus.twoH.type === 'no_play'
                                ? 'No Play'
                                : `${teamForAbbr(consensus.twoH.teamAbbr).team_name} — ${consensus.twoH.type === 'heavy' ? 'Heavy' : 'Slight'} Lean 2H Spread`}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-muted/60 dark:bg-muted/40 border border-border px-3 py-1.5 min-w-0 max-w-full cursor-help" tabIndex={0} role="button">
                                <span className="text-muted-foreground shrink-0">Flip Play:</span>
                                {consensus.flip === 'no_play' ? (
                                  <span className="text-foreground">No Play</span>
                                ) : (
                                  <>
                                    <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
                                    <span className={getLeanCellClassName(consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip')}>
                                      {consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {consensus.flip === 'no_play' ? 'No Play' : (consensus.flip === 'heavy' ? 'Heavy Lean Flip' : 'Slight Lean Flip')}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
        );
      })()}

      {viewMode === 'ats' && (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Lost Both Halves Last Game</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Teams that lost both halves in their previous game and their 1st Half Spread win percentage in the next game.
          </p>
        </CardHeader>
        <CardContent>
          {lostBothHalvesTeams.length === 0 ? (
            <p className="text-sm text-gray-500">No Teams in Today&apos;s Games Lost Both Halves Last Game</p>
          ) : (
            <ul className="space-y-3">
              {lostBothHalvesTeams.map((row, i) => {
                const pctStr =
                  row.lost_both_1h_side_win_pct != null
                    ? `${(row.lost_both_1h_side_win_pct * 100).toFixed(1)}%`
                    : 'N/A';
                const teamDisplayName = row.team_name.split(' ')[0];
                return (
                  <li key={`${row.game_id}-${row.team_name}-${i}`} className="flex flex-col gap-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 text-sm min-w-0">
                      <img
                        src={getNCAABLogoUrl(row.team_name, teamMapping)}
                        alt={row.team_name}
                        className="w-6 h-6 object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="font-medium text-white">{row.team_name}</span>
                      <span style={getHalftimePercentageStyle(row.lost_both_1h_side_win_pct)}>{pctStr}</span>
                      {row.lost_both_1h_side_games != null && row.lost_both_1h_side_games > 0 && (
                        <span className="text-gray-500 text-xs">({row.lost_both_1h_side_games} games)</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground pl-9">
                      {teamDisplayName} has covered the 1st half spread {pctStr} of games after they lost both halves of
                      their previous game.
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
