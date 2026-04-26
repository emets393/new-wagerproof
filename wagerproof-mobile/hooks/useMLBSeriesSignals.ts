import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

/**
 * Mobile-side hook for the MLB series-position signals (G2/G3 carryover).
 * Mirrors src/hooks/useMLBSeriesSignals.ts on web — same shape, same query.
 */
export interface MLBSeriesSignal {
  game_pk: number;
  matchup: string;
  team_name: string;
  team_side: 'home' | 'away';
  severity: 'positive' | 'negative';
  message: string;
}

interface RawGameSignals {
  game_pk: number;
  home_team_name: string;
  away_team_name: string;
  home_signals: string[] | null;
  away_signals: string[] | null;
}

export function useMLBSeriesSignals() {
  return useQuery<MLBSeriesSignal[]>({
    queryKey: ['mlb-series-signals'],
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mlb_game_signals')
        .select('game_pk, home_team_name, away_team_name, home_signals, away_signals');

      if (error) throw error;
      const rows = (data || []) as RawGameSignals[];

      const out: MLBSeriesSignal[] = [];
      for (const row of rows) {
        const matchup = `${row.away_team_name} @ ${row.home_team_name}`;
        const collect = (arr: string[] | null, side: 'home' | 'away', team: string) => {
          for (const raw of arr ?? []) {
            try {
              const sig = JSON.parse(raw);
              if (sig?.category === 'series' && sig?.message) {
                out.push({
                  game_pk: row.game_pk,
                  matchup,
                  team_name: team,
                  team_side: side,
                  severity: sig.severity === 'positive' ? 'positive' : 'negative',
                  message: sig.message as string,
                });
              }
            } catch { /* skip malformed */ }
          }
        };
        collect(row.home_signals, 'home', row.home_team_name);
        collect(row.away_signals, 'away', row.away_team_name);
      }
      return out;
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
