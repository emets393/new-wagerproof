import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

/** Prior completed meeting from `cfb_games` (cross-season; no current-week filter). */
export interface CfbH2HGame {
  id: string;
  game_date: string;
  season: number | null;
  week: number | string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  total_points: number | null;
  neutral_site: boolean | null;
  winner_team: string | null;
  closing_spread_home: number | null;
  closing_total: number | null;
}

type CfbGamesRow = {
  api_id?: number | string | null;
  season?: number | null;
  week?: number | null;
  start_date?: string | null;
  home_team: string;
  away_team: string;
  home_points?: number | null;
  away_points?: number | null;
  neutral_site?: boolean | null;
  completed?: boolean | null;
  spread_line?: number | null;
  over_under?: number | null;
};

function mapRow(row: CfbGamesRow): CfbH2HGame {
  const homeScore = row.home_points ?? null;
  const awayScore = row.away_points ?? null;
  let winner: string | null = null;
  if (homeScore != null && awayScore != null) {
    if (homeScore > awayScore) winner = row.home_team;
    else if (awayScore > homeScore) winner = row.away_team;
  }

  return {
    id: String(row.api_id || `${row.away_team}@${row.home_team}-${row.start_date || ''}`),
    game_date: row.start_date ? String(row.start_date).slice(0, 10) : '',
    season: row.season ?? null,
    week: row.week ?? null,
    home_team: row.home_team,
    away_team: row.away_team,
    home_score: homeScore,
    away_score: awayScore,
    total_points:
      homeScore != null && awayScore != null ? homeScore + awayScore : null,
    neutral_site: row.neutral_site ?? null,
    winner_team: winner,
    closing_spread_home: row.spread_line ?? null,
    closing_total: row.over_under ?? null,
  };
}

/**
 * Last 5 completed head-to-head meetings from `cfb_games`.
 * No season filter — Week 1 still surfaces prior-season series.
 * CFB has no `cfb_matchup_history` table (NFL-only).
 */
export function useCfbH2H(homeTeam: string | undefined, awayTeam: string | undefined) {
  const [games, setGames] = useState<CfbH2HGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const home = String(homeTeam || '').trim();
    const away = String(awayTeam || '').trim();
    if (!home || !away) {
      setGames([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchH2H = async () => {
      setLoading(true);
      setError(null);
      setGames([]);

      try {
        debug.log('Fetching CFB H2H for:', away, '@', home);

        const { data, error: fetchError } = await collegeFootballSupabase
          .from('cfb_games')
          .select(
            'api_id,season,week,start_date,home_team,away_team,home_points,away_points,neutral_site,completed,spread_line,over_under',
          )
          .eq('completed', true)
          .or(
            `and(home_team.eq."${home}",away_team.eq."${away}"),and(home_team.eq."${away}",away_team.eq."${home}")`,
          )
          .order('start_date', { ascending: false })
          .limit(5);

        if (fetchError) throw fetchError;
        if (!cancelled) setGames(((data as CfbGamesRow[]) || []).map(mapRow));
      } catch (err) {
        debug.error('Error fetching CFB H2H:', err);
        if (!cancelled) setError('Failed to load historical data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchH2H();
    return () => {
      cancelled = true;
    };
  }, [homeTeam, awayTeam]);

  return { games, loading, error };
}
