import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

/** Line-history row from nfl_betting_lines (only the columns the charts read). */
export interface NflLinePoint {
  as_of_ts: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  home_team: string;
  away_team: string;
}

/**
 * Full line history for one game, ported verbatim from GameDetailsModal's NFL
 * line-movement effect (same table, columns, filter, and error strings).
 */
export function useNflLineMovement(trainingKey: string | undefined) {
  const [lineData, setLineData] = useState<NflLinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trainingKey) return;
    let cancelled = false;

    const fetchLineData = async () => {
      setLoading(true);
      setError(null);
      // Clear the previous game's series so a selection change never charts stale data.
      setLineData([]);

      try {
        const { data, error: fetchError } = await collegeFootballSupabase
          .from('nfl_betting_lines')
          .select('as_of_ts, home_spread, away_spread, over_line, home_team, away_team')
          .eq('training_key', trainingKey)
          .order('as_of_ts', { ascending: true });

        if (cancelled) return;

        if (fetchError) {
          debug.error('Error fetching line movement data:', fetchError);
          setError('Failed to fetch line movement data');
          return;
        }

        if (!data || data.length === 0) {
          setError('No line movement data available');
          return;
        }

        setLineData(data as NflLinePoint[]);
      } catch (err) {
        debug.error('Error fetching line data:', err);
        if (!cancelled) setError('An unexpected error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLineData();
    return () => {
      cancelled = true;
    };
  }, [trainingKey]);

  return { lineData, loading, error };
}
