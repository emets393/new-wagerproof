import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

/**
 * One actionable series-position signal extracted from mlb_game_signals.
 * Series signals fire when today is G2 or G3 of a series and the previous
 * game's margin/ML hits a documented carryover or regression pattern.
 *
 * Severity: 'positive' = back this team, 'negative' = fade this team.
 */
export interface MLBSeriesSignal {
  game_pk: number;
  matchup: string;            // "{away_team} @ {home_team}"
  team_name: string;          // The team this signal is about
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

/**
 * Pulls today's MLB series-position signals (G2 carryover, G3 regression, etc.)
 * from the mlb_game_signals view. Used by the Daily Regression Report page to
 * surface picks the external Python ETL doesn't yet narrate.
 */
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
        // Each signal is a JSON-encoded text. Parse, filter to category='series', collect.
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
            } catch { /* malformed JSON — skip */ }
          }
        };
        collect(row.home_signals, 'home', row.home_team_name);
        collect(row.away_signals, 'away', row.away_team_name);
      }
      return out;
    },
    refetchInterval: 10 * 60 * 1000,   // 10 min
    staleTime: 5 * 60 * 1000,
  });
}
