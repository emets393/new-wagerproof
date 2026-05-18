import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { MatchupGame, PitchHand } from '@/types/mlb-matchups';
import { normalizeHand } from '@/utils/mlbPitcherMatchups';
import {
  buildMlbTeamMappingMaps,
  mlbStatsApiTeamBrand,
  type MlbTeamMappingRow,
  resolveMlbTeamDisplay,
} from '@/utils/mlbTeamLogos';
import { toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

interface StarterRow {
  game_pk: number;
  home_away: 'home' | 'away';
  pitcher_id: number | string | null;
  pitcher_name: string | null;
  pitch_hand: string | null;
  computed_at?: string | null;
}

function pickStarter(rows: StarterRow[], gamePk: number, side: 'home' | 'away'): StarterRow | null {
  const matches = rows
    .filter(r => Number(r.game_pk) === gamePk && r.home_away === side)
    .sort((a, b) => String(b.computed_at ?? '').localeCompare(String(a.computed_at ?? '')));
  return matches[0] ?? null;
}

export function useTodaysMatchupGames() {
  return useQuery<MatchupGame[]>({
    queryKey: ['mlb-pitcher-matchups-games'],
    queryFn: async () => {
      const { data: games, error: gamesError } = await collegeFootballSupabase
        .from('mlb_games_today')
        .select(
          'game_pk, official_date, game_time_et, venue_name, away_team_name, home_team_name, away_team_id, home_team_id, total_line, away_ml, home_ml, wind_speed_mph, wind_direction, temperature_f, away_sp_name, home_sp_name, is_postponed',
        )
        .order('official_date', { ascending: true })
        .order('game_time_et', { ascending: true });

      if (gamesError) throw gamesError;

      const { data: teams, error: teamsError } = await collegeFootballSupabase
        .from('mlb_team_mapping')
        .select('*');
      if (teamsError) throw teamsError;

      const { byMlbApiId, byTeamName, list } = buildMlbTeamMappingMaps(
        (teams ?? []) as Record<string, unknown>[],
      );

      const active = (games ?? []).filter(g => g.is_postponed !== true);
      const gamePks = active.map(g => Number(g.game_pk)).filter(n => !Number.isNaN(n));

      let starters: StarterRow[] = [];
      if (gamePks.length > 0) {
        const { data: starterRows, error: starterError } = await collegeFootballSupabase
          .from('mlb_starter_pregame')
          .select('game_pk, home_away, pitcher_id, pitcher_name, pitch_hand, computed_at')
          .in('game_pk', gamePks);
        if (starterError) throw starterError;
        starters = (starterRows ?? []) as StarterRow[];
      }

      const missingWeatherPks = active
        .filter(
          g =>
            (g.wind_speed_mph == null || g.wind_direction == null) &&
            gamePks.includes(Number(g.game_pk)),
        )
        .map(g => Number(g.game_pk));

      const weatherByPk = new Map<
        number,
        { wind_speed_mph: number | null; wind_direction: string | null; temperature_f: number | null }
      >();

      if (missingWeatherPks.length > 0) {
        const { data: wxRows } = await collegeFootballSupabase
          .from('mlb_game_log')
          .select('game_pk, wind_speed_mph, wind_direction, temperature_f')
          .in('game_pk', missingWeatherPks);
        for (const row of wxRows ?? []) {
          const pk = Number(row.game_pk);
          if (!Number.isNaN(pk)) {
            weatherByPk.set(pk, {
              wind_speed_mph: row.wind_speed_mph != null ? Number(row.wind_speed_mph) : null,
              wind_direction: row.wind_direction ?? null,
              temperature_f: row.temperature_f != null ? Number(row.temperature_f) : null,
            });
          }
        }
      }

      return active
        .map(g => {
          const gamePk = Number(g.game_pk);
          const awayStarter = pickStarter(starters, gamePk, 'away');
          const homeStarter = pickStarter(starters, gamePk, 'home');
          const awayHand =
            normalizeHand(awayStarter?.pitch_hand) ??
            normalizeHand((g as { away_sp_hand?: string }).away_sp_hand) ??
            'R';
          const homeHand =
            normalizeHand(homeStarter?.pitch_hand) ??
            normalizeHand((g as { home_sp_hand?: string }).home_sp_hand) ??
            'R';

          const awaySpId = Number(awayStarter?.pitcher_id);
          const homeSpId = Number(homeStarter?.pitcher_id);
          if (!Number.isFinite(awaySpId) || !Number.isFinite(homeSpId)) return null;

          const wx = weatherByPk.get(gamePk);

          const awayName = g.away_team_name ?? 'Away';
          const homeName = g.home_team_name ?? 'Home';
          const awayTeamId = Number(g.away_team_id) || 0;
          const homeTeamId = Number(g.home_team_id) || 0;

          const awayResolved = resolveMlbTeamDisplay(
            awayTeamId,
            awayName,
            byMlbApiId as Map<number, MlbTeamMappingRow>,
            byTeamName as Map<string, MlbTeamMappingRow>,
            list as MlbTeamMappingRow[],
          );
          const homeResolved = resolveMlbTeamDisplay(
            homeTeamId,
            homeName,
            byMlbApiId as Map<number, MlbTeamMappingRow>,
            byTeamName as Map<string, MlbTeamMappingRow>,
            list as MlbTeamMappingRow[],
          );

          const awayAbbr =
            awayResolved?.abbrev ??
            mlbStatsApiTeamBrand(awayTeamId)?.abbrev ??
            awayName.slice(0, 3).toUpperCase();
          const homeAbbr =
            homeResolved?.abbrev ??
            mlbStatsApiTeamBrand(homeTeamId)?.abbrev ??
            homeName.slice(0, 3).toUpperCase();

          return {
            game_pk: gamePk,
            official_date: g.official_date,
            game_time: g.game_time_et ?? null,
            venue_name: g.venue_name ?? null,
            away_team_name: awayName,
            home_team_name: homeName,
            away_abbr: toF5SplitTeamAbbr(awayAbbr),
            home_abbr: toF5SplitTeamAbbr(homeAbbr),
            away_team_id: awayTeamId,
            home_team_id: homeTeamId,
            total_line: g.total_line != null ? Number(g.total_line) : null,
            away_ml: g.away_ml != null ? Number(g.away_ml) : null,
            home_ml: g.home_ml != null ? Number(g.home_ml) : null,
            wind_speed_mph:
              g.wind_speed_mph != null
                ? Number(g.wind_speed_mph)
                : (wx?.wind_speed_mph ?? null),
            wind_direction: g.wind_direction ?? wx?.wind_direction ?? null,
            temperature_f:
              g.temperature_f != null ? Number(g.temperature_f) : (wx?.temperature_f ?? null),
            away_sp_name: awayStarter?.pitcher_name ?? g.away_sp_name ?? 'TBD',
            away_sp_id: awaySpId,
            away_sp_hand: awayHand as PitchHand,
            home_sp_name: homeStarter?.pitcher_name ?? g.home_sp_name ?? 'TBD',
            home_sp_id: homeSpId,
            home_sp_hand: homeHand as PitchHand,
          } satisfies MatchupGame;
        })
        .filter((g): g is MatchupGame => g != null);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
