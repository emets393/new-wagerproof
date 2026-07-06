import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

/** Historical matchup row from nfl_training_data (only the fields the H2H UI reads). */
export interface NflH2HGame {
  id: string | number;
  game_date: string;
  week: number | string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_away_spread_cover: number | null;
  ou_result: number | null;
  [key: string]: unknown;
}

/**
 * Last 5 head-to-head meetings between the two teams, ported verbatim from
 * GameDetailsModal's NFL H2H effect (same table, filter, order, and limit).
 */
export function useNflH2H(homeTeam: string | undefined, awayTeam: string | undefined) {
  const [games, setGames] = useState<NflH2HGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!homeTeam || !awayTeam) return;
    let cancelled = false;

    const fetchH2HData = async () => {
      setLoading(true);
      setError(null);

      try {
        debug.log('Fetching H2H data for:', homeTeam, 'vs', awayTeam);

        const { data, error: fetchError } = await collegeFootballSupabase
          .from('nfl_training_data')
          .select('*')
          .or(
            `and(home_team.eq."${homeTeam}",away_team.eq."${awayTeam}"),and(home_team.eq."${awayTeam}",away_team.eq."${homeTeam}")`
          )
          .order('game_date', { ascending: false })
          .limit(5);

        if (fetchError) {
          debug.error('Supabase error:', fetchError);
          throw fetchError;
        }

        if (!cancelled) setGames((data as NflH2HGame[]) || []);
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
  }, [homeTeam, awayTeam]);

  return { games, loading, error };
}
