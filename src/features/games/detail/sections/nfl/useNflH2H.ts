import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNflLinesCity, getNflTeamAbbr } from '@/utils/nflTeamAssets';
import debug from '@/utils/debug';

/**
 * Normalized H2H meeting for the NFL detail widget.
 *
 * `nfl_training_data` is the live results table (includes full 2025).
 * `nfl_matchup_history` is a Week-12-2025 slate snapshot for only 14
 * matchups — cut off before that week's kickoffs — so preferring it alone
 * hides later 2025 meetings (e.g. BUF@HOU Wk12). We merge both and keep the
 * newest 5.
 */
export interface NflH2HGame {
  id: string;
  game_date: string;
  week: number | string | null;
  season: number | null;
  /** Always abbreviations for display / verification. */
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  total_points: number | null;
  neutral_site: boolean | null;
  /** 1 = home covered, 0 = away covered, null = push / unknown. */
  home_away_spread_cover: number | null;
  /** 1 = over, 0 = under, null = push / unknown. */
  ou_result: number | null;
  winner_team: string | null;
  cover_team: string | null;
  ats_result: string | null;
  ou_result_label: string | null;
  closing_spread_home: number | null;
  closing_total: number | null;
  closing_ml_home: number | null;
  closing_ml_away: number | null;
  source: 'matchup_history' | 'training_data';
}

type MatchupHistoryRow = {
  game_id?: string | null;
  matchup_key?: string | null;
  season?: number | null;
  week?: number | null;
  date?: string | null;
  away_team: string;
  home_team: string;
  neutral_site?: boolean | null;
  away_score?: number | null;
  home_score?: number | null;
  total_points?: number | null;
  closing_spread_home?: number | null;
  closing_total?: number | null;
  closing_ml_home?: number | null;
  closing_ml_away?: number | null;
  winner_team?: string | null;
  cover_team?: string | null;
  ats_result?: string | null;
  ou_result?: string | null;
};

type TrainingDataRow = {
  unique_id?: string | null;
  game_date?: string | null;
  week?: number | null;
  season?: number | null;
  home_team: string;
  away_team: string;
  home_score?: number | null;
  away_score?: number | null;
  total_points?: number | null;
  home_away_spread_cover?: number | null;
  ou_result?: number | null;
  home_spread?: number | null;
  ou_vegas_line?: number | null;
};

const FETCH_LIMIT = 15;
const DISPLAY_LIMIT = 5;

function matchupKey(a: string, b: string): string {
  return [a, b].map((x) => x.toUpperCase()).sort().join('|');
}

function meetingDedupeKey(row: NflH2HGame): string {
  const teams = matchupKey(row.home_team, row.away_team);
  if (row.season != null && row.week != null) {
    return `${row.season}-${row.week}-${teams}`;
  }
  return `${row.game_date.slice(0, 10)}-${teams}`;
}

function mapHistoryRow(row: MatchupHistoryRow): NflH2HGame {
  const home = String(row.home_team || '').toUpperCase();
  const away = String(row.away_team || '').toUpperCase();
  const ou = (row.ou_result || '').toUpperCase();
  let ouNum: number | null = null;
  if (ou === 'OVER') ouNum = 1;
  else if (ou === 'UNDER') ouNum = 0;

  let coverNum: number | null = null;
  const cover = (row.cover_team || '').toUpperCase();
  if (cover && cover === home) coverNum = 1;
  else if (cover && cover === away) coverNum = 0;
  else if ((row.ats_result || '').toUpperCase() === 'PUSH') coverNum = null;

  return {
    id: String(row.game_id || `${away}@${home}-${row.date || ''}`),
    game_date: row.date || '',
    week: row.week ?? null,
    season: row.season ?? null,
    home_team: home,
    away_team: away,
    home_score: row.home_score ?? null,
    away_score: row.away_score ?? null,
    total_points:
      row.total_points ??
      (row.home_score != null && row.away_score != null
        ? Number(row.home_score) + Number(row.away_score)
        : null),
    neutral_site: row.neutral_site ?? null,
    home_away_spread_cover: coverNum,
    ou_result: ouNum,
    winner_team: row.winner_team ? String(row.winner_team).toUpperCase() : null,
    cover_team: row.cover_team ? String(row.cover_team).toUpperCase() : null,
    ats_result: row.ats_result ?? null,
    ou_result_label: row.ou_result ?? null,
    closing_spread_home: row.closing_spread_home ?? null,
    closing_total: row.closing_total ?? null,
    closing_ml_home: row.closing_ml_home ?? null,
    closing_ml_away: row.closing_ml_away ?? null,
    source: 'matchup_history',
  };
}

function mapTrainingRow(
  row: TrainingDataRow,
  homeAbbr: string,
  awayAbbr: string,
  homeCity: string,
  awayCity: string,
): NflH2HGame {
  // training_data cities → today's abbrs (site can flip vs current home/away).
  const rowHomeAbbr =
    row.home_team === homeCity
      ? homeAbbr
      : row.home_team === awayCity
        ? awayAbbr
        : getNflTeamAbbr(row.home_team) || row.home_team;
  const rowAwayAbbr =
    row.away_team === awayCity
      ? awayAbbr
      : row.away_team === homeCity
        ? homeAbbr
        : getNflTeamAbbr(row.away_team) || row.away_team;

  const homeScore = row.home_score ?? null;
  const awayScore = row.away_score ?? null;
  let winner: string | null = null;
  if (homeScore != null && awayScore != null) {
    if (homeScore > awayScore) winner = String(rowHomeAbbr).toUpperCase();
    else if (awayScore > homeScore) winner = String(rowAwayAbbr).toUpperCase();
  }

  const coverFlag = row.home_away_spread_cover;
  let coverTeam: string | null = null;
  if (coverFlag === 1) coverTeam = String(rowHomeAbbr).toUpperCase();
  else if (coverFlag === 0) coverTeam = String(rowAwayAbbr).toUpperCase();

  const ouFlag = row.ou_result;
  let ouLabel: string | null = null;
  if (ouFlag === 1) ouLabel = 'OVER';
  else if (ouFlag === 0) ouLabel = 'UNDER';

  return {
    id: String(row.unique_id || `${row.away_team}@${row.home_team}-${row.game_date || ''}`),
    game_date: row.game_date || '',
    week: row.week ?? null,
    season: row.season ?? null,
    home_team: String(rowHomeAbbr).toUpperCase(),
    away_team: String(rowAwayAbbr).toUpperCase(),
    home_score: homeScore,
    away_score: awayScore,
    total_points:
      row.total_points ??
      (homeScore != null && awayScore != null ? homeScore + awayScore : null),
    neutral_site: null,
    home_away_spread_cover: coverFlag ?? null,
    ou_result: ouFlag ?? null,
    winner_team: winner,
    cover_team: coverTeam,
    ats_result: coverFlag === 1 ? 'HOME' : coverFlag === 0 ? 'AWAY' : null,
    ou_result_label: ouLabel,
    closing_spread_home: row.home_spread ?? null,
    closing_total: row.ou_vegas_line ?? null,
    closing_ml_home: null,
    closing_ml_away: null,
    source: 'training_data',
  };
}

/**
 * Merge history + training. Training wins on the same meeting (has 2025+),
 * but we keep history-only fields (ML, neutral site) when training is sparse.
 */
function mergeH2HMeetings(training: NflH2HGame[], history: NflH2HGame[]): NflH2HGame[] {
  const byKey = new Map<string, NflH2HGame>();

  for (const row of history) {
    byKey.set(meetingDedupeKey(row), row);
  }

  for (const row of training) {
    const key = meetingDedupeKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...row,
      neutral_site: row.neutral_site ?? prev.neutral_site,
      closing_ml_home: row.closing_ml_home ?? prev.closing_ml_home,
      closing_ml_away: row.closing_ml_away ?? prev.closing_ml_away,
      closing_spread_home: row.closing_spread_home ?? prev.closing_spread_home,
      closing_total: row.closing_total ?? prev.closing_total,
      cover_team: row.cover_team ?? prev.cover_team,
      ats_result: row.ats_result ?? prev.ats_result,
      ou_result_label: row.ou_result_label ?? prev.ou_result_label,
      source: 'training_data',
    });
  }

  return [...byKey.values()].sort((a, b) =>
    String(b.game_date || '').localeCompare(String(a.game_date || '')),
  );
}

async function fetchMatchupHistory(homeAbbr: string, awayAbbr: string): Promise<NflH2HGame[]> {
  const key = matchupKey(awayAbbr, homeAbbr);
  const { data, error } = await collegeFootballSupabase
    .from('nfl_matchup_history')
    .select(
      'matchup_key,game_id,season,week,date,away_team,home_team,neutral_site,away_score,home_score,total_points,closing_spread_home,closing_total,closing_ml_home,closing_ml_away,winner_team,cover_team,ats_result,ou_result',
    )
    .eq('matchup_key', key)
    .order('date', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) throw error;
  return ((data as MatchupHistoryRow[]) || []).map(mapHistoryRow);
}

async function fetchTrainingHistory(
  homeAbbr: string,
  awayAbbr: string,
): Promise<NflH2HGame[]> {
  const homeCity = getNflLinesCity(homeAbbr);
  const awayCity = getNflLinesCity(awayAbbr);
  if (!homeCity || !awayCity) return [];

  const { data, error } = await collegeFootballSupabase
    .from('nfl_training_data')
    .select(
      'unique_id,game_date,week,season,home_team,away_team,home_score,away_score,total_points,home_away_spread_cover,ou_result,home_spread,ou_vegas_line',
    )
    .or(
      `and(home_team.eq."${homeCity}",away_team.eq."${awayCity}"),and(home_team.eq."${awayCity}",away_team.eq."${homeCity}")`,
    )
    .order('game_date', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) throw error;
  return ((data as TrainingDataRow[]) || []).map((row) =>
    mapTrainingRow(row, homeAbbr, awayAbbr, homeCity, awayCity),
  );
}

/**
 * Last 5 head-to-head meetings. Merges `nfl_training_data` (city keys, full
 * 2025) with `nfl_matchup_history` (abbr keys, slate snapshot) so stale
 * history rows cannot hide newer training meetings.
 */
export function useNflH2H(homeAbbr: string | undefined, awayAbbr: string | undefined) {
  const [games, setGames] = useState<NflH2HGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const home = String(homeAbbr || '')
      .trim()
      .toUpperCase();
    const away = String(awayAbbr || '')
      .trim()
      .toUpperCase();
    if (!home || !away) {
      setGames([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchH2HData = async () => {
      setLoading(true);
      setError(null);
      setGames([]);

      try {
        debug.log('Fetching NFL H2H for:', away, '@', home);

        const [history, training] = await Promise.all([
          fetchMatchupHistory(home, away),
          fetchTrainingHistory(home, away),
        ]);
        const rows = mergeH2HMeetings(training, history).slice(0, DISPLAY_LIMIT);

        if (!cancelled) setGames(rows);
      } catch (err) {
        debug.error('Error fetching H2H data:', err);
        if (!cancelled) setError('Failed to load historical data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchH2HData();
    return () => {
      cancelled = true;
    };
  }, [homeAbbr, awayAbbr]);

  return { games, loading, error };
}
