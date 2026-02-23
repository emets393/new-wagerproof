import React, { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, Clock, ArrowLeftRight, Search } from 'lucide-react';
import { getNBATeamInitials } from '@/utils/teamColors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HalftimeTrendRow {
  game_id: number;
  team_name: string;
  team_side: 'away' | 'home';
  rest_bucket: string | null;
  todays_lost_both_halves_last_game: boolean;
  todays_first_half_ats: number | null;
  todays_first_half_fav_dog: string | null;
  todays_second_half_ats: number | null;
  first_half_side_games: number | null;
  first_half_side_wins: number | null;
  first_half_side_win_pct: number | null;
  second_half_side_games: number | null;
  second_half_side_wins: number | null;
  second_half_side_win_pct: number | null;
  side_flip_games: number | null;
  side_flip_count: number | null;
  side_flip_pct: number | null;
  first_half_side_rest_games: number | null;
  first_half_side_rest_wins: number | null;
  first_half_side_rest_win_pct: number | null;
  second_half_side_rest_games: number | null;
  second_half_side_rest_wins: number | null;
  second_half_side_rest_win_pct: number | null;
  side_rest_flip_games: number | null;
  side_rest_flip_count: number | null;
  side_rest_flip_pct: number | null;
  lost_both_1h_side_games: number | null;
  lost_both_1h_side_wins: number | null;
  lost_both_1h_side_win_pct: number | null;
  first_half_favdog_side_games: number | null;
  first_half_favdog_side_wins: number | null;
  first_half_favdog_side_win_pct: number | null;
  // O/U fields (from nba_halftime_trends_today)
  todays_first_half_ou: number | null;
  todays_second_half_ou: number | null;
  first_half_ou_side_games: number | null;
  first_half_ou_side_overs: number | null;
  first_half_ou_side_over_pct: number | null;
  second_half_ou_side_games: number | null;
  second_half_ou_side_overs: number | null;
  second_half_ou_side_over_pct: number | null;
  ou_side_flip_games: number | null;
  ou_side_flip_count: number | null;
  ou_side_flip_pct: number | null;
  first_half_ou_side_rest_games: number | null;
  first_half_ou_side_rest_overs: number | null;
  first_half_ou_side_rest_over_pct: number | null;
  second_half_ou_side_rest_games: number | null;
  second_half_ou_side_rest_overs: number | null;
  second_half_ou_side_rest_over_pct: number | null;
  ou_side_rest_flip_games: number | null;
  ou_side_rest_flip_count: number | null;
  ou_side_rest_flip_pct: number | null;
  first_half_ou_favdog_side_games: number | null;
  first_half_ou_favdog_side_overs: number | null;
  first_half_ou_favdog_side_over_pct: number | null;
  second_half_ou_favdog_side_games: number | null;
  second_half_ou_favdog_side_overs: number | null;
  second_half_ou_favdog_side_over_pct: number | null;
}

interface GameHalftimeTrends {
  game_id: number;
  game_date: string | null;
  tipoff_time_et: string | null;
  away_team: HalftimeTrendRow;
  home_team: HalftimeTrendRow;
}

const MIN_GAMES_RECOMMEND = 5;

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

/** 1H/2H metrics: red ≤53%, yellow 53.1–57%, green >57%. Returns inline style so color cannot be overridden. */
const getHalftimePercentageStyle = (pct: number | null | undefined): React.CSSProperties => {
  if (pct == null) return { color: '#6b7280' };
  const n = Number(pct);
  if (Number.isNaN(n)) return { color: '#6b7280' };
  const pct100 = n > 1 ? n : n * 100;
  if (pct100 <= 53) return { color: '#ef4444' };   // red
  if (pct100 <= 57) return { color: '#eab308' };   // yellow
  return { color: '#22c55e' };                      // green
};

const getNBATeamLogoUrl = (teamName: string): string => {
  if (!teamName) return '/placeholder.svg';
  const espnLogoMap: { [key: string]: string } = {
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Okla City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };
  if (espnLogoMap[teamName]) return espnLogoMap[teamName];
  const lower = teamName.toLowerCase();
  const key = Object.keys(espnLogoMap).find(k => k.toLowerCase() === lower);
  if (key) return espnLogoMap[key];
  for (const [k, url] of Object.entries(espnLogoMap)) {
    if (teamName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(teamName.toLowerCase()))
      return url;
  }
  return '/placeholder.svg';
};

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

/**
 * 1H/2H rows: No Play (both red or both green), Slight Lean (yellow vs red or green vs yellow), Heavy Lean (green vs red).
 * Flip rows: Heavy Lean Flip (both green), Slight Lean Flip (green+yellow or both yellow), No Play (yellow+red);
 *   both red and both ≤40% = Heavy Lean Same (1H coverer likely covers 2H).
 */
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

/** Lean column color: No Play = white/black (theme), Slight = yellow, Heavy = green; for O/U Heavy Lean Under = red. */
function getLeanCellClassName(leanLabel: string | undefined): string {
  if (!leanLabel || leanLabel === '-') return 'text-foreground';
  if (leanLabel === 'No Play') return 'text-foreground';
  if (leanLabel === 'Heavy Lean Under') return 'text-red-500';
  if (leanLabel.startsWith('Slight')) return 'text-yellow-500';
  if (leanLabel.startsWith('Heavy')) return 'text-green-500';
  return 'text-foreground';
}

/** Parsed 1H/2H lean: strength and team abbr (e.g. "Heavy Lean OKC 1H" -> { strength: 'heavy', teamAbbr: 'OKC' }). */
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

export type Consensus1H2H = { type: 'no_play' } | { type: 'slight' | 'heavy'; teamAbbr: string };
export type ConsensusFlip = 'no_play' | 'slight' | 'heavy';

export type OUConsensus1H2H = { type: 'no_play' } | { type: 'slight' | 'heavy'; direction: 'over' | 'under' };

/** O/U consensus: 1H/2H from average of all over_pct metrics for that half (both teams); Flip from O/U flip % comparison. */
function getOUConsensus(game: GameHalftimeTrends): { oneH: OUConsensus1H2H; twoH: OUConsensus1H2H; flip: ConsensusFlip } {
  const away = game.away_team;
  const home = game.home_team;

  const oneHAvg = getGame1HOUAverage(game);
  const oneHAwayAvg = getAway1HOUAverage(game);
  const oneHHomeAvg = getHome1HOUAverage(game);
  const oneHLabel = getOULeanFromAverage(oneHAvg, oneHAwayAvg, oneHHomeAvg);
  let oneH: OUConsensus1H2H = { type: 'no_play' };
  if (oneHLabel && oneHLabel !== 'No Play' && oneHLabel !== '-') {
    oneH = {
      type: oneHLabel.startsWith('Heavy') ? 'heavy' : 'slight',
      direction: oneHLabel.includes('Over') ? 'over' : 'under',
    };
  }

  const twoHAvg = getGame2HOUAverage(game);
  const twoHAwayAvg = getAway2HOUAverage(game);
  const twoHHomeAvg = getHome2HOUAverage(game);
  const twoHLabel = getOULeanFromAverage(twoHAvg, twoHAwayAvg, twoHHomeAvg);
  let twoH: OUConsensus1H2H = { type: 'no_play' };
  if (twoHLabel && twoHLabel !== 'No Play' && twoHLabel !== '-') {
    twoH = {
      type: twoHLabel.startsWith('Heavy') ? 'heavy' : 'slight',
      direction: twoHLabel.includes('Over') ? 'over' : 'under',
    };
  }

  const flipLabel = getOULeanLabel(away.ou_side_flip_pct ?? null, home.ou_side_flip_pct ?? null, true);
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

/** 1H = average of 1H by side + 1H Fav/Dog; pick only when one team leads in both. 2H = average of 2H by side + 2H by side+rest; same. Flip unchanged. */
function getConsensus(game: GameHalftimeTrends): { oneH: Consensus1H2H; twoH: Consensus1H2H; flip: ConsensusFlip } {
  const away = game.away_team;
  const home = game.home_team;
  const awayAbbr = getNBATeamInitials(away.team_name);
  const homeAbbr = getNBATeamInitials(home.team_name);

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
    away.second_half_side_rest_win_pct,
    home.second_half_side_rest_win_pct,
    awayAbbr,
    homeAbbr,
    '2H'
  );

  const flip1 = getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true);
  const flip2 = getLeanLabel('Rest flip %', away.side_rest_flip_pct, home.side_rest_flip_pct, awayAbbr, homeAbbr, true);
  let flip: ConsensusFlip = 'no_play';
  if (flip1 !== 'No Play' && flip1 !== '-' && flip2 !== 'No Play' && flip2 !== '-') {
    const isHeavy1 = flip1.startsWith('Heavy');
    const isHeavy2 = flip2.startsWith('Heavy');
    flip = isHeavy1 || isHeavy2 ? 'heavy' : 'slight';
  }

  return { oneH, twoH, flip };
}

function formatRestBucket(rest: string | null): string {
  if (!rest) return '-';
  const map: Record<string, string> = {
    no_rest: 'No rest',
    one_day_off: '1 day off',
    two_three_days_off: '2-3 days off',
    four_plus_days_off: '4+ days off',
  };
  return map[rest] || rest.replace(/_/g, ' ');
}

export type HalftimeSortMode = 'time' | '1h' | '2h' | 'flip';

function pctTo100(pct: number | null | undefined): number {
  if (pct == null) return 0;
  const n = Number(pct);
  return Number.isNaN(n) ? 0 : n > 1 ? n : n * 100;
}

/** Side lean (1H/2H): No Play=0, Slight=1, Heavy=2 */
function sideLeanStrength(leanLabel: string): number {
  if (!leanLabel || leanLabel === 'No Play' || leanLabel === '-') return 0;
  return leanLabel.startsWith('Heavy') ? 2 : leanLabel.startsWith('Slight') ? 1 : 0;
}

/** O/U lean from game average and per-team averages. Best leans when BOTH teams trend same direction (both >50% = over, both <50% = under). Same thresholds; No Play when teams disagree. */
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
  if (a != null && h != null && !bothOver && !bothUnder) return 'No Play'; // mixed direction
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
  // fallback when we don't have per-team averages (e.g. flip): use game avg only
  if (g > 57) return 'Heavy Lean Over';
  if (g > 53) return 'Slight Lean Over';
  if (g >= 47) return 'No Play';
  if (g >= 43) return 'Slight Lean Under';
  return 'Heavy Lean Under';
}

/** O/U lean for flip row only (compares two teams). 1H/2H use getOULeanFromAverage with game-half average. */
function getOULeanLabel(
  awayOverPct: number | null,
  homeOverPct: number | null,
  isFlipRow: boolean
): string {
  if (!isFlipRow) return '-'; // 1H/2H rows use getOULeanFromAverage instead
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

/** Average of all 1H O/U over_pct values for the game (both teams, all 1H metrics). Used for O/U Lean. */
function getGame1HOUAverage(game: GameHalftimeTrends): number | null {
  const away = game.away_team;
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.first_half_ou_side_over_pct);
  push(away.first_half_ou_side_rest_over_pct);
  push(away.first_half_ou_favdog_side_over_pct);
  push(home.first_half_ou_side_over_pct);
  push(home.first_half_ou_side_rest_over_pct);
  push(home.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Away team's 1H O/U over_pct average (1H by side, by side+rest, Fav/Dog). */
function getAway1HOUAverage(game: GameHalftimeTrends): number | null {
  const away = game.away_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.first_half_ou_side_over_pct);
  push(away.first_half_ou_side_rest_over_pct);
  push(away.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Home team's 1H O/U over_pct average. */
function getHome1HOUAverage(game: GameHalftimeTrends): number | null {
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(home.first_half_ou_side_over_pct);
  push(home.first_half_ou_side_rest_over_pct);
  push(home.first_half_ou_favdog_side_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Away team's 2H O/U over_pct average. */
function getAway2HOUAverage(game: GameHalftimeTrends): number | null {
  const away = game.away_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(away.second_half_ou_side_over_pct);
  push(away.second_half_ou_side_rest_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Home team's 2H O/U over_pct average. */
function getHome2HOUAverage(game: GameHalftimeTrends): number | null {
  const home = game.home_team;
  const vals: number[] = [];
  const push = (pct: number | null) => {
    if (pct != null) vals.push(pctTo100(pct));
  };
  push(home.second_half_ou_side_over_pct);
  push(home.second_half_ou_side_rest_over_pct);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
}

/** Average of all 2H O/U over_pct values for the game (both teams, all 2H metrics). */
function getGame2HOUAverage(game: GameHalftimeTrends): number | null {
  const awayAvg = getAway2HOUAverage(game);
  const homeAvg = getHome2HOUAverage(game);
  if (awayAvg == null && homeAvg == null) return null;
  if (awayAvg == null) return homeAvg;
  if (homeAvg == null) return awayAvg;
  return (awayAvg + homeAvg) / 2;
}

/** O/U 1H sort score: higher when both teams trend same direction (both over or both under). Score = distance from 50% when both agree, else 0. */
function getOU1HScore(game: GameHalftimeTrends): number {
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

/** O/U 2H sort score: same logic as 1H. */
function getOU2HScore(game: GameHalftimeTrends): number {
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

/** O/U lean strength for sorting (Heavy=2, Slight=1, No Play=0). */
function ouLeanStrength(label: string): number {
  if (!label || label === 'No Play' || label === '-') return 0;
  return label.startsWith('Heavy') ? 2 : label.startsWith('Slight') ? 1 : 0;
}

/** Flip row: No Play=0, Heavy Lean Same=1, Slight Lean Flip=2, Heavy Lean Flip=3 */
function flipLeanStrength(leanLabel: string): number {
  if (!leanLabel || leanLabel === '-') return 0;
  if (leanLabel === 'Heavy Lean Flip') return 3;
  if (leanLabel === 'Slight Lean Flip') return 2;
  if (leanLabel === 'Heavy Lean Same') return 1;
  return 0;
}

/** Cumulative 1H score: sum of strength across 1H by side, 1H by side+rest, 1H Fav/Dog (max 6) */
function getNBA1HCumulativeScore(away: HalftimeTrendRow, home: HalftimeTrendRow, awayAbbr: string, homeAbbr: string): { score: number; avgEdge: number } {
  const s1 = getLeanLabel('1H by side', away.first_half_side_win_pct, home.first_half_side_win_pct, awayAbbr, homeAbbr, false);
  const s2 = getLeanLabel('1H by side + rest', away.first_half_side_rest_win_pct, home.first_half_side_rest_win_pct, awayAbbr, homeAbbr, false);
  const s3 = getLeanLabel('1H Fav/Dog', away.first_half_favdog_side_win_pct, home.first_half_favdog_side_win_pct, awayAbbr, homeAbbr, false);
  const score = sideLeanStrength(s1) + sideLeanStrength(s2) + sideLeanStrength(s3);
  const e1 = Math.abs(pctTo100(away.first_half_side_win_pct) - pctTo100(home.first_half_side_win_pct));
  const e2 = Math.abs(pctTo100(away.first_half_side_rest_win_pct) - pctTo100(home.first_half_side_rest_win_pct));
  const e3 = Math.abs(pctTo100(away.first_half_favdog_side_win_pct) - pctTo100(home.first_half_favdog_side_win_pct));
  const avgEdge = (e1 + e2 + e3) / 3;
  return { score, avgEdge };
}

/** Cumulative 2H score: sum across 2H by side, 2H by side+rest (max 4) */
function getNBA2HCumulativeScore(away: HalftimeTrendRow, home: HalftimeTrendRow, awayAbbr: string, homeAbbr: string): { score: number; avgEdge: number } {
  const s1 = getLeanLabel('2H by side', away.second_half_side_win_pct, home.second_half_side_win_pct, awayAbbr, homeAbbr, false);
  const s2 = getLeanLabel('2H by side + rest', away.second_half_side_rest_win_pct, home.second_half_side_rest_win_pct, awayAbbr, homeAbbr, false);
  const score = sideLeanStrength(s1) + sideLeanStrength(s2);
  const e1 = Math.abs(pctTo100(away.second_half_side_win_pct) - pctTo100(home.second_half_side_win_pct));
  const e2 = Math.abs(pctTo100(away.second_half_side_rest_win_pct) - pctTo100(home.second_half_side_rest_win_pct));
  const avgEdge = (e1 + e2) / 2;
  return { score, avgEdge };
}

/** Cumulative Flip score: sum across Flip % and Rest flip % (max 6) */
function getNBAFlipCumulativeScore(away: HalftimeTrendRow, home: HalftimeTrendRow, awayAbbr: string, homeAbbr: string): { score: number; avgEdge: number } {
  const f1 = getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true);
  const f2 = getLeanLabel('Rest flip %', away.side_rest_flip_pct, home.side_rest_flip_pct, awayAbbr, homeAbbr, true);
  const score = flipLeanStrength(f1) + flipLeanStrength(f2);
  const e1 = Math.abs(pctTo100(away.side_flip_pct) - pctTo100(home.side_flip_pct));
  const e2 = Math.abs(pctTo100(away.side_rest_flip_pct) - pctTo100(home.side_rest_flip_pct));
  const avgEdge = (e1 + e2) / 2;
  return { score, avgEdge };
}

/** Sortable timestamp: combine game_date + tipoff_time_et so time-only strings like "20:30" parse correctly. */
function getTipoffTimestamp(g: GameHalftimeTrends): number {
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

function sortGamesByMode(games: GameHalftimeTrends[], mode: HalftimeSortMode, viewMode: 'ats' | 'ou' = 'ats'): GameHalftimeTrends[] {
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
        const labelA = getOULeanLabel(a.away_team.ou_side_flip_pct ?? null, a.home_team.ou_side_flip_pct ?? null, true);
        const labelB = getOULeanLabel(b.away_team.ou_side_flip_pct ?? null, b.home_team.ou_side_flip_pct ?? null, true);
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
    const abbrA = getNBATeamInitials(awayA.team_name);
    const homeAbbrA = getNBATeamInitials(homeA.team_name);
    const abbrB = getNBATeamInitials(awayB.team_name);
    const homeAbbrB = getNBATeamInitials(homeB.team_name);

    if (mode === '1h') {
      const { score: scoreA, avgEdge: edgeA } = getNBA1HCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNBA1HCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    if (mode === '2h') {
      const { score: scoreA, avgEdge: edgeA } = getNBA2HCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNBA2HCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    if (mode === 'flip') {
      const { score: scoreA, avgEdge: edgeA } = getNBAFlipCumulativeScore(awayA, homeA, abbrA, homeAbbrA);
      const { score: scoreB, avgEdge: edgeB } = getNBAFlipCumulativeScore(awayB, homeB, abbrB, homeAbbrB);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (edgeB !== edgeA) return edgeB - edgeA;
      return tipoffTs(a) - tipoffTs(b);
    }
    return tipoffTs(a) - tipoffTs(b);
  });
}

export default function NBATodayHalftimeTrends() {
  const [games, setGames] = useState<GameHalftimeTrends[]>([]);
  const [lostBothHalvesTeams, setLostBothHalvesTeams] = useState<HalftimeTrendRow[]>([]);
  const [sortMode, setSortMode] = useState<HalftimeSortMode>('time');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'ats' | 'ou'>('ats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nba_halftime_trends_today')
        .select('*')
        .order('game_id', { ascending: true });

      if (fetchError) {
        setError(`Failed to load data: ${fetchError.message}`);
        setLoading(false);
        return;
      }
      if (!data || data.length === 0) {
        setGames([]);
        setLostBothHalvesTeams([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      const gamesMap = new Map<number, GameHalftimeTrends>();
      for (const row of data as any[]) {
        const side = row.team_side === 'away' || row.team_side === 'home' ? row.team_side : null;
        if (!side) continue;
        const r: HalftimeTrendRow = {
          game_id: row.game_id,
          team_name: row.team_name ?? '',
          team_side: side,
          rest_bucket: row.rest_bucket ?? null,
          todays_lost_both_halves_last_game: row.todays_lost_both_halves_last_game === true,
          todays_first_half_ats: row.todays_first_half_ats ?? null,
          todays_first_half_fav_dog: row.todays_first_half_fav_dog ?? null,
          todays_second_half_ats: row.todays_second_half_ats ?? null,
          first_half_side_games: row.first_half_side_games ?? null,
          first_half_side_wins: row.first_half_side_wins ?? null,
          first_half_side_win_pct: row.first_half_side_win_pct ?? null,
          second_half_side_games: row.second_half_side_games ?? null,
          second_half_side_wins: row.second_half_side_wins ?? null,
          second_half_side_win_pct: row.second_half_side_win_pct ?? null,
          side_flip_games: row.side_flip_games ?? null,
          side_flip_count: row.side_flip_count ?? null,
          side_flip_pct: row.side_flip_pct ?? null,
          first_half_side_rest_games: row.first_half_side_rest_games ?? null,
          first_half_side_rest_wins: row.first_half_side_rest_wins ?? null,
          first_half_side_rest_win_pct: row.first_half_side_rest_win_pct ?? null,
          second_half_side_rest_games: row.second_half_side_rest_games ?? null,
          second_half_side_rest_wins: row.second_half_side_rest_wins ?? null,
          second_half_side_rest_win_pct: row.second_half_side_rest_win_pct ?? null,
          side_rest_flip_games: row.side_rest_flip_games ?? null,
          side_rest_flip_count: row.side_rest_flip_count ?? null,
          side_rest_flip_pct: row.side_rest_flip_pct ?? null,
          lost_both_1h_side_games: row.lost_both_1h_side_games ?? null,
          lost_both_1h_side_wins: row.lost_both_1h_side_wins ?? null,
          lost_both_1h_side_win_pct: row.lost_both_1h_side_win_pct ?? null,
          first_half_favdog_side_games: row.first_half_favdog_side_games ?? null,
          first_half_favdog_side_wins: row.first_half_favdog_side_wins ?? null,
          first_half_favdog_side_win_pct: row.first_half_favdog_side_win_pct ?? null,
          todays_first_half_ou: parseNum(row.todays_first_half_ou ?? row.todays_first_half_ou_line),
          todays_second_half_ou: parseNum(row.todays_second_half_ou ?? row.todays_second_half_ou_line),
          first_half_ou_side_games: row.first_half_ou_side_games ?? null,
          first_half_ou_side_overs: row.first_half_ou_side_overs ?? null,
          first_half_ou_side_over_pct: parseNum(row.first_half_ou_side_over_pct) ?? null,
          second_half_ou_side_games: row.second_half_ou_side_games ?? null,
          second_half_ou_side_overs: row.second_half_ou_side_overs ?? null,
          second_half_ou_side_over_pct: parseNum(row.second_half_ou_side_over_pct) ?? null,
          ou_side_flip_games: row.ou_side_flip_games ?? null,
          ou_side_flip_count: row.ou_side_flip_count ?? null,
          ou_side_flip_pct: parseNum(row.ou_side_flip_pct) ?? null,
          first_half_ou_side_rest_games: row.first_half_ou_side_rest_games ?? null,
          first_half_ou_side_rest_overs: row.first_half_ou_side_rest_overs ?? null,
          first_half_ou_side_rest_over_pct: parseNum(row.first_half_ou_side_rest_over_pct) ?? null,
          second_half_ou_side_rest_games: row.second_half_ou_side_rest_games ?? null,
          second_half_ou_side_rest_overs: row.second_half_ou_side_rest_overs ?? null,
          second_half_ou_side_rest_over_pct: parseNum(row.second_half_ou_side_rest_over_pct) ?? null,
          ou_side_rest_flip_games: row.ou_side_rest_flip_games ?? null,
          ou_side_rest_flip_count: row.ou_side_rest_flip_count ?? null,
          ou_side_rest_flip_pct: parseNum(row.ou_side_rest_flip_pct) ?? null,
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
            away_team: side === 'away' ? r : ({} as HalftimeTrendRow),
            home_team: side === 'home' ? r : ({} as HalftimeTrendRow),
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

      const gameIds = gamesArray.map(g => g.game_id);
      if (gameIds.length > 0) {
        const { data: timesData } = await collegeFootballSupabase
          .from('nba_input_values_view')
          .select('game_id, tipoff_time_et, game_date')
          .in('game_id', gameIds);
        if (timesData) {
          const byGame = new Map<number, { tipoff_time_et: string | null; game_date: string | null }>();
          for (const t of timesData as any[]) {
            byGame.set(t.game_id, {
              tipoff_time_et: t.tipoff_time_et ?? null,
              game_date: t.game_date ?? null,
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
          const ta = new Date(a.tipoff_time_et).getTime();
          const tb = new Date(b.tipoff_time_et).getTime();
          return ta - tb;
        }
        if (a.tipoff_time_et && !b.tipoff_time_et) return -1;
        if (!a.tipoff_time_et && b.tipoff_time_et) return 1;
        if (a.game_date && b.game_date) return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        return 0;
      });

      const lostBoth: HalftimeTrendRow[] = (data as any[])
        .filter((row: any) => row.todays_lost_both_halves_last_game === true)
        .map((row: any) => ({
          game_id: row.game_id,
          team_name: row.team_name ?? '',
          team_side: row.team_side === 'away' || row.team_side === 'home' ? row.team_side : 'away',
          rest_bucket: row.rest_bucket ?? null,
          todays_lost_both_halves_last_game: true,
          todays_first_half_ats: row.todays_first_half_ats ?? null,
          todays_first_half_fav_dog: row.todays_first_half_fav_dog ?? null,
          todays_second_half_ats: row.todays_second_half_ats ?? null,
          first_half_side_games: row.first_half_side_games ?? null,
          first_half_side_wins: row.first_half_side_wins ?? null,
          first_half_side_win_pct: row.first_half_side_win_pct ?? null,
          second_half_side_games: row.second_half_side_games ?? null,
          second_half_side_wins: row.second_half_side_wins ?? null,
          second_half_side_win_pct: row.second_half_side_win_pct ?? null,
          side_flip_games: row.side_flip_games ?? null,
          side_flip_count: row.side_flip_count ?? null,
          side_flip_pct: row.side_flip_pct ?? null,
          first_half_side_rest_games: row.first_half_side_rest_games ?? null,
          first_half_side_rest_wins: row.first_half_side_rest_wins ?? null,
          first_half_side_rest_win_pct: row.first_half_side_rest_win_pct ?? null,
          second_half_side_rest_games: row.second_half_side_rest_games ?? null,
          second_half_side_rest_wins: row.second_half_side_rest_wins ?? null,
          second_half_side_rest_win_pct: row.second_half_side_rest_win_pct ?? null,
          side_rest_flip_games: row.side_rest_flip_games ?? null,
          side_rest_flip_count: row.side_rest_flip_count ?? null,
          side_rest_flip_pct: row.side_rest_flip_pct ?? null,
          lost_both_1h_side_games: row.lost_both_1h_side_games ?? null,
          lost_both_1h_side_wins: row.lost_both_1h_side_wins ?? null,
          lost_both_1h_side_win_pct: row.lost_both_1h_side_win_pct ?? null,
          first_half_favdog_side_games: row.first_half_favdog_side_games ?? null,
          first_half_favdog_side_wins: row.first_half_favdog_side_wins ?? null,
          first_half_favdog_side_win_pct: row.first_half_favdog_side_win_pct ?? null,
          todays_first_half_ou: null,
          todays_second_half_ou: null,
          first_half_ou_side_games: null,
          first_half_ou_side_overs: null,
          first_half_ou_side_over_pct: null,
          second_half_ou_side_games: null,
          second_half_ou_side_overs: null,
          second_half_ou_side_over_pct: null,
          ou_side_flip_games: null,
          ou_side_flip_count: null,
          ou_side_flip_pct: null,
          first_half_ou_side_rest_games: null,
          first_half_ou_side_rest_overs: null,
          first_half_ou_side_rest_over_pct: null,
          second_half_ou_side_rest_games: null,
          second_half_ou_side_rest_overs: null,
          second_half_ou_side_rest_over_pct: null,
          ou_side_rest_flip_games: null,
          ou_side_rest_flip_count: null,
          ou_side_rest_flip_pct: null,
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
    isFlipRow?: boolean,
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
              {awaySub != null && (
                <span className="text-gray-500 text-xs ml-1">({awaySub})</span>
              )}
            </span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </div>
        <div className="text-left min-w-0 overflow-hidden">
          {displayHome != null ? (
            <span style={homeStyle} className={homeClass}>
              {displayHome}%
              {homeSub != null && (
                <span className="text-gray-500 text-xs ml-1">({homeSub})</span>
              )}
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
            First-half and second-half ATS and O/U trends for today&apos;s NBA games
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
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as HalftimeSortMode)}>
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
          ? sortGamesByMode(games, sortMode, viewMode).filter(
              (g) =>
                g.away_team.team_name.toLowerCase().includes(q) ||
                g.home_team.team_name.toLowerCase().includes(q)
            )
          : sortGamesByMode(games, sortMode, viewMode);
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
            const awayAbbr = getNBATeamInitials(away.team_name);
            const homeAbbr = getNBATeamInitials(home.team_name);
            return (
              <Card key={game.game_id} className="min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                      {game.tipoff_time_et ? (
                        formatTipoffTime(game.tipoff_time_et, game.game_date)
                      ) : (
                        game.game_date || 'Time TBD'
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 min-w-0">
                    <img
                      src={getNBATeamLogoUrl(away.team_name)}
                      alt={away.team_name}
                      className="w-8 h-8 object-contain shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="font-semibold text-white min-w-0 truncate">
                      <span className="md:hidden">{awayAbbr}</span>
                      <span className="hidden md:inline">{away.team_name}</span>
                      {viewMode === 'ats' && (away.todays_first_half_ats != null || home.todays_first_half_ats != null) && away.todays_first_half_ats != null && (
                        <span className="text-gray-500 font-normal ml-1">(1H: {away.todays_first_half_ats >= 0 ? '+' : ''}{away.todays_first_half_ats})</span>
                      )}
                    </span>
                    <span className="text-gray-500">@</span>
                    <img
                      src={getNBATeamLogoUrl(home.team_name)}
                      alt={home.team_name}
                      className="w-8 h-8 object-contain shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="font-semibold text-white min-w-0 truncate">
                      <span className="md:hidden">{homeAbbr}</span>
                      <span className="hidden md:inline">{home.team_name}</span>
                      {viewMode === 'ats' && (away.todays_first_half_ats != null || home.todays_first_half_ats != null) && home.todays_first_half_ats != null && (
                        <span className="text-gray-500 font-normal ml-1">(1H: {home.todays_first_half_ats >= 0 ? '+' : ''}{home.todays_first_half_ats})</span>
                      )}
                      {viewMode === 'ou' && (away.todays_first_half_ou != null || home.todays_first_half_ou != null) && home.todays_first_half_ou != null && (
                        <span className="text-gray-500 font-normal ml-1">(1H O/U: {home.todays_first_half_ou})</span>
                      )}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 min-w-0 overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,5.5rem)] sm:grid-cols-[140px_1fr_1fr_160px] gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 items-center min-w-0">
                    <div className="min-w-0 break-words">Metric</div>
                    <div className="flex justify-start min-w-0">
                      <img
                        src={getNBATeamLogoUrl(away.team_name)}
                        alt={away.team_name}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex justify-start min-w-0">
                      <img
                        src={getNBATeamLogoUrl(home.team_name)}
                        alt={home.team_name}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="min-w-0 break-words">Lean</div>
                  </div>
                  {/* ATS metrics */}
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
                    false,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '1H by side + rest',
                    away.first_half_side_rest_win_pct,
                    home.first_half_side_rest_win_pct,
                    away.first_half_side_rest_games,
                    home.first_half_side_rest_games,
                    getLeanLabel('1H by side + rest', away.first_half_side_rest_win_pct, home.first_half_side_rest_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    false,
                    game.game_id,
                    `Away - ${formatRestBucket(away.rest_bucket)}`,
                    `Home - ${formatRestBucket(home.rest_bucket)}`
                  )}
                  {renderMetricRow(
                    '1H Fav/Dog',
                    away.first_half_favdog_side_win_pct,
                    home.first_half_favdog_side_win_pct,
                    away.first_half_favdog_side_games,
                    home.first_half_favdog_side_games,
                    getLeanLabel('1H Fav/Dog', away.first_half_favdog_side_win_pct, home.first_half_favdog_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    false,
                    game.game_id,
                    away.todays_first_half_fav_dog ? away.todays_first_half_fav_dog.charAt(0).toUpperCase() + away.todays_first_half_fav_dog.slice(1).toLowerCase() : undefined,
                    home.todays_first_half_fav_dog ? home.todays_first_half_fav_dog.charAt(0).toUpperCase() + home.todays_first_half_fav_dog.slice(1).toLowerCase() : undefined
                  )}
                  {/* 2H metrics */}
                  {renderMetricRow(
                    '2H by side',
                    away.second_half_side_win_pct,
                    home.second_half_side_win_pct,
                    away.second_half_side_games,
                    home.second_half_side_games,
                    getLeanLabel('2H by side', away.second_half_side_win_pct, home.second_half_side_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    false,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '2H by side + rest',
                    away.second_half_side_rest_win_pct,
                    home.second_half_side_rest_win_pct,
                    away.second_half_side_rest_games,
                    home.second_half_side_rest_games,
                    getLeanLabel('2H by side + rest', away.second_half_side_rest_win_pct, home.second_half_side_rest_win_pct, awayAbbr, homeAbbr, false),
                    true,
                    false,
                    game.game_id,
                    `Away - ${formatRestBucket(away.rest_bucket)}`,
                    `Home - ${formatRestBucket(home.rest_bucket)}`
                  )}
                  {/* Flip % metrics */}
                  {renderMetricRow(
                    'Flip % (1H↔2H)',
                    away.side_flip_pct,
                    home.side_flip_pct,
                    undefined,
                    undefined,
                    getLeanLabel('Flip % (1H↔2H)', away.side_flip_pct, home.side_flip_pct, awayAbbr, homeAbbr, true),
                    true,
                    true,
                    game.game_id
                  )}
                  {renderMetricRow(
                    'Rest flip %',
                    away.side_rest_flip_pct,
                    home.side_rest_flip_pct,
                    undefined,
                    undefined,
                    getLeanLabel('Rest flip %', away.side_rest_flip_pct, home.side_rest_flip_pct, awayAbbr, homeAbbr, true),
                    true,
                    true,
                    game.game_id
                  )}
                    </>
                  )}
                  {/* O/U metrics */}
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
                    false,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '1H O/U by side + rest',
                    away.first_half_ou_side_rest_over_pct,
                    home.first_half_ou_side_rest_over_pct,
                    away.first_half_ou_side_rest_games,
                    home.first_half_ou_side_rest_games,
                    getOULeanFromAverage(getGame1HOUAverage(game), getAway1HOUAverage(game), getHome1HOUAverage(game)),
                    true,
                    false,
                    game.game_id,
                    `Away - ${formatRestBucket(away.rest_bucket)}`,
                    `Home - ${formatRestBucket(home.rest_bucket)}`
                  )}
                  {renderMetricRow(
                    '1H O/U Fav/Dog',
                    away.first_half_ou_favdog_side_over_pct,
                    home.first_half_ou_favdog_side_over_pct,
                    away.first_half_ou_favdog_side_games,
                    home.first_half_ou_favdog_side_games,
                    getOULeanFromAverage(getGame1HOUAverage(game), getAway1HOUAverage(game), getHome1HOUAverage(game)),
                    true,
                    false,
                    game.game_id,
                    away.todays_first_half_fav_dog ? away.todays_first_half_fav_dog.charAt(0).toUpperCase() + away.todays_first_half_fav_dog.slice(1).toLowerCase() : undefined,
                    home.todays_first_half_fav_dog ? home.todays_first_half_fav_dog.charAt(0).toUpperCase() + home.todays_first_half_fav_dog.slice(1).toLowerCase() : undefined
                  )}
                  {renderMetricRow(
                    '2H O/U by side',
                    away.second_half_ou_side_over_pct,
                    home.second_half_ou_side_over_pct,
                    away.second_half_ou_side_games,
                    home.second_half_ou_side_games,
                    getOULeanFromAverage(getGame2HOUAverage(game), getAway2HOUAverage(game), getHome2HOUAverage(game)),
                    true,
                    false,
                    game.game_id,
                    'Away',
                    'Home'
                  )}
                  {renderMetricRow(
                    '2H O/U by side + rest',
                    away.second_half_ou_side_rest_over_pct,
                    home.second_half_ou_side_rest_over_pct,
                    away.second_half_ou_side_rest_games,
                    home.second_half_ou_side_rest_games,
                    getOULeanFromAverage(getGame2HOUAverage(game), getAway2HOUAverage(game), getHome2HOUAverage(game)),
                    true,
                    false,
                    game.game_id,
                    `Away - ${formatRestBucket(away.rest_bucket)}`,
                    `Home - ${formatRestBucket(home.rest_bucket)}`
                  )}
                  {renderMetricRow(
                    'O/U Flip % (1H↔2H)',
                    away.ou_side_flip_pct,
                    home.ou_side_flip_pct,
                    undefined,
                    undefined,
                    getOULeanLabel(away.ou_side_flip_pct ?? null, home.ou_side_flip_pct ?? null, true),
                    true,
                    true,
                    game.game_id
                  )}
                  {renderMetricRow(
                    'O/U Rest Flip %',
                    away.ou_side_rest_flip_pct,
                    home.ou_side_rest_flip_pct,
                    undefined,
                    undefined,
                    getOULeanLabel(away.ou_side_rest_flip_pct ?? null, home.ou_side_rest_flip_pct ?? null, true),
                    true,
                    true,
                    game.game_id
                  )}
                    </>
                  )}
                  {/* Consensus */}
                  {(() => {
                    const teamForAbbr = (abbr: string) => (abbr === awayAbbr ? away : home);
                    const format1HLine = (val: number | null) => val == null ? '' : `(1H: ${val > 0 ? `+${val}` : `${val}`})`;
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
                                      {away.todays_first_half_ou != null && ` (O/U ${away.todays_first_half_ou})`}
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
                                      {away.todays_second_half_ou != null && ` (O/U ${away.todays_second_half_ou})`}
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
                    const consensus = getConsensus(game);
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
                                                      src={getNBATeamLogoUrl(teamForAbbr(consensus.oneH.teamAbbr).team_name)}
                                                      alt={consensus.oneH.teamAbbr}
                                                      className="w-6 h-6 object-contain"
                                                    />
                                                    <span className={getLeanCellClassName(consensus.oneH.type === 'heavy' ? 'Heavy' : 'Slight')}>
                                                      {consensus.oneH.type === 'heavy' ? 'Heavy Lean' : 'Slight Lean'} {format1HLine(teamForAbbr(consensus.oneH.teamAbbr).todays_first_half_ats)}
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
                                                      src={getNBATeamLogoUrl(teamForAbbr(consensus.twoH.teamAbbr).team_name)}
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
                const pctStr = row.lost_both_1h_side_win_pct != null
                  ? `${(row.lost_both_1h_side_win_pct * 100).toFixed(1)}%`
                  : 'N/A';
                const teamDisplayName = row.team_name.split(' ')[0];
                return (
                  <li key={`${row.game_id}-${row.team_name}-${i}`} className="flex flex-col gap-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 text-sm min-w-0">
                      <img
                        src={getNBATeamLogoUrl(row.team_name)}
                        alt={row.team_name}
                        className="w-6 h-6 object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="font-medium text-white">{row.team_name}</span>
                      <span style={getHalftimePercentageStyle(row.lost_both_1h_side_win_pct)}>
                        {pctStr}
                      </span>
                      {row.lost_both_1h_side_games != null && row.lost_both_1h_side_games > 0 && (
                        <span className="text-gray-500 text-xs">({row.lost_both_1h_side_games} games)</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground pl-9">
                      {teamDisplayName} has covered the 1st half spread {pctStr} of games after they lost both halves of their previous game.
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
