import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { TodaysMlbGameForF5 } from '@/types/mlbF5Splits';
import {
  buildMlbTeamMappingMaps,
  type MlbTeamMappingRow,
  resolveMlbTeamDisplay,
} from '@/utils/mlbTeamLogos';
import { normalizePitchHand, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

interface StarterPregameRow {
  game_pk: number;
  home_away: 'home' | 'away';
  pitch_hand: string | null;
  pitcher_name?: string | null;
  computed_at?: string | null;
}

function pickLatestStarterHand(
  rows: StarterPregameRow[],
  gamePk: number,
  side: 'home' | 'away',
): string | null {
  const matches = rows
    .filter(r => Number(r.game_pk) === gamePk && r.home_away === side)
    .sort((a, b) => String(b.computed_at ?? '').localeCompare(String(a.computed_at ?? '')));
  return matches[0]?.pitch_hand ?? null;
}

export function useTodaysMlbGames() {
  return useQuery<TodaysMlbGameForF5[]>({
    queryKey: ['mlb-f5-splits-todays-games'],
    queryFn: async () => {
      const { data: games, error: gamesError } = await collegeFootballSupabase
        .from('mlb_games_today')
        .select(
          'game_pk, official_date, game_time_et, away_team_name, home_team_name, venue_name, away_sp_name, home_sp_name, total_line, f5_total_line, f5_away_ml, f5_home_ml, is_postponed',
        )
        .order('official_date', { ascending: true })
        .order('game_time_et', { ascending: true });

      if (gamesError) throw gamesError;

      const activeGames = (games ?? []).filter(g => g.is_postponed !== true);
      const gamePks = activeGames.map(g => Number(g.game_pk)).filter(n => !Number.isNaN(n));

      const { data: teams, error: teamsError } = await collegeFootballSupabase
        .from('mlb_team_mapping')
        .select('*');
      if (teamsError) throw teamsError;

      const { byMlbApiId, byTeamName, list } = buildMlbTeamMappingMaps(
        (teams ?? []) as Record<string, unknown>[],
      );

      let starterRows: StarterPregameRow[] = [];
      if (gamePks.length > 0) {
        const { data: starters, error: startersError } = await collegeFootballSupabase
          .from('mlb_starter_pregame')
          .select('game_pk, home_away, pitch_hand, pitcher_name, computed_at')
          .in('game_pk', gamePks);
        if (startersError) throw startersError;
        starterRows = (starters ?? []) as StarterPregameRow[];
      }

      return activeGames.map(g => {
        const gamePk = Number(g.game_pk);
        const awayName = g.away_team_name ?? 'Away';
        const homeName = g.home_team_name ?? 'Home';
        const awayResolved = resolveMlbTeamDisplay(
          null,
          awayName,
          byMlbApiId as Map<number, MlbTeamMappingRow>,
          byTeamName as Map<string, MlbTeamMappingRow>,
          list as MlbTeamMappingRow[],
        );
        const homeResolved = resolveMlbTeamDisplay(
          null,
          homeName,
          byMlbApiId as Map<number, MlbTeamMappingRow>,
          byTeamName as Map<string, MlbTeamMappingRow>,
          list as MlbTeamMappingRow[],
        );

        const awayAbbr = awayResolved?.abbrev ?? awayName.slice(0, 3).toUpperCase();
        const homeAbbr = homeResolved?.abbrev ?? homeName.slice(0, 3).toUpperCase();

        return {
          game_pk: gamePk,
          official_date: g.official_date,
          game_time_et: g.game_time_et,
          away_team_name: awayName,
          home_team_name: homeName,
          venue_name: g.venue_name ?? null,
          away_sp_name: g.away_sp_name ?? null,
          home_sp_name: g.home_sp_name ?? null,
          away_abbr: toF5SplitTeamAbbr(awayAbbr),
          home_abbr: toF5SplitTeamAbbr(homeAbbr),
          away_sp_hand: normalizePitchHand(pickLatestStarterHand(starterRows, gamePk, 'away')),
          home_sp_hand: normalizePitchHand(pickLatestStarterHand(starterRows, gamePk, 'home')),
          total_line: g.total_line != null ? Number(g.total_line) : null,
          f5_total_line: g.f5_total_line != null ? Number(g.f5_total_line) : null,
          f5_away_ml: g.f5_away_ml != null ? Number(g.f5_away_ml) : null,
          f5_home_ml: g.f5_home_ml != null ? Number(g.f5_home_ml) : null,
        } satisfies TodaysMlbGameForF5;
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
