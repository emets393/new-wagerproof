import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type { F5Game, F5SplitRow } from '@/types/mlbF5Splits';
import {
  buildSplitLookup,
  normalizePitchHand,
  toF5SplitTeamAbbr,
} from '@/utils/mlbF5Splits';
import {
  fallbackAbbrevFromTeamName,
  normalizeTeamNameKey,
} from '@/types/mlb';
import type { MLBTeamMapping } from '@/types/mlb';
import { getMLBFallbackTeamInfo } from '@/constants/mlbTeams';

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function addDaysYmd(baseYmd: string, days: number): string {
  const date = new Date(`${baseYmd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

function resolveTeam(
  teamName: string,
  teamId: number | null,
  byName: Map<string, MLBTeamMapping>,
  byId: Map<number, MLBTeamMapping>,
): string {
  const nameKey = normalizeTeamNameKey(teamName);
  const direct = byName.get(nameKey);
  if (direct?.team) return direct.team;
  if (teamId) {
    const byTeamId = byId.get(teamId);
    if (byTeamId?.team) return byTeamId.team;
  }
  for (const [key, mapping] of byName) {
    if (key.includes(nameKey) || nameKey.includes(key)) return mapping.team;
  }
  return getMLBFallbackTeamInfo(teamName)?.team ?? fallbackAbbrevFromTeamName(teamName);
}

async function fetchF5Games(): Promise<F5Game[]> {
  const today = getTodayET();
  const end = addDaysYmd(today, 2);
  const { data: rows, error } = await collegeFootballSupabase
    .from('mlb_games_today')
    .select('*')
    .gte('official_date', today)
    .lte('official_date', end)
    .order('official_date', { ascending: true })
    .order('game_time_et', { ascending: true });

  if (error) throw error;

  const { data: mappingRows } = await collegeFootballSupabase
    .from('mlb_team_mapping')
    .select('*');
  const byName = new Map<string, MLBTeamMapping>();
  const byId = new Map<number, MLBTeamMapping>();
  for (const raw of mappingRows ?? []) {
    const mapping: MLBTeamMapping = {
      mlb_api_id: Number(raw.mlb_api_id ?? raw.team_id ?? raw.id),
      team: String(raw.team ?? raw.abbreviation ?? raw.team_abbrev ?? ''),
      team_name: String(raw.team_name ?? raw.name ?? raw.full_name ?? ''),
      logo_url: raw.logo_url ?? raw.logo ?? null,
    };
    if (mapping.team_name) byName.set(normalizeTeamNameKey(mapping.team_name), mapping);
    if (mapping.mlb_api_id) byId.set(mapping.mlb_api_id, mapping);
  }

  return (rows ?? [])
    .filter((row: any) => !row.is_postponed)
    .map((row: any) => {
      const awayName = row.away_team_name || row.away_team || row.away_team_full_name || 'Away';
      const homeName = row.home_team_name || row.home_team || row.home_team_full_name || 'Home';
      const awayId = Number(row.away_team_id ?? row.away_mlb_team_id ?? row.away_id ?? 0) || null;
      const homeId = Number(row.home_team_id ?? row.home_mlb_team_id ?? row.home_id ?? 0) || null;

      return {
        game_pk: Number(row.game_pk),
        official_date: row.official_date,
        game_time_et: row.game_time_et,
        away_team_name: awayName,
        home_team_name: homeName,
        venue_name: row.venue_name ?? row.venue ?? null,
        away_abbr: toF5SplitTeamAbbr(resolveTeam(awayName, awayId, byName, byId)),
        home_abbr: toF5SplitTeamAbbr(resolveTeam(homeName, homeId, byName, byId)),
        away_sp_name: row.away_sp_name ?? null,
        home_sp_name: row.home_sp_name ?? null,
        away_sp_hand: normalizePitchHand(row.away_sp_hand),
        home_sp_hand: normalizePitchHand(row.home_sp_hand),
        total_line: row.total_line ?? row.game_total_line ?? null,
        f5_away_ml: row.f5_away_ml ?? null,
        f5_home_ml: row.f5_home_ml ?? null,
        f5_total_line: row.f5_total_line ?? null,
      };
    });
}

export function useMLBF5Splits() {
  const gamesQuery = useQuery({
    queryKey: ['mlb-f5-games', getTodayET()],
    queryFn: fetchF5Games,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const teamAbbrs = useMemo(
    () => [...new Set((gamesQuery.data ?? []).flatMap(g => [g.away_abbr, g.home_abbr]))].sort(),
    [gamesQuery.data],
  );

  const splitsQuery = useQuery({
    queryKey: ['mlb-f5-splits-mobile', teamAbbrs],
    enabled: teamAbbrs.length > 0,
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('mv_mlb_f5_team_splits')
        .select('*')
        .in('team_abbr', teamAbbrs);
      if (error) throw error;
      const rows = (data ?? []) as F5SplitRow[];
      return {
        rows,
        lookup: buildSplitLookup(rows),
        lastRefreshedAt: rows.find(r => r.last_refreshed_at)?.last_refreshed_at ?? null,
      };
    },
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  return {
    games: gamesQuery.data ?? [],
    splitLookup: splitsQuery.data?.lookup ?? new Map<string, F5SplitRow>(),
    lastRefreshedAt: splitsQuery.data?.lastRefreshedAt ?? null,
    isLoading: gamesQuery.isLoading || splitsQuery.isLoading,
    error: gamesQuery.error ?? splitsQuery.error,
    refetch: () => {
      gamesQuery.refetch();
      splitsQuery.refetch();
    },
  };
}
