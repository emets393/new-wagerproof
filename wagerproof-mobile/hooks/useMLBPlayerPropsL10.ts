import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import { parseGames, parseLines } from '@/utils/mlbPlayerProps';

function normalizeRow(raw: Record<string, unknown>): MlbPlayerPropRow {
  const opp = raw.opp_archetype_today;
  return {
    player_id: Number(raw.player_id),
    player_name: String(raw.player_name ?? ''),
    is_pitcher: Boolean(raw.is_pitcher),
    market: String(raw.market ?? ''),
    game_is_day: Boolean(raw.game_is_day),
    opp_archetype_today:
      opp != null && opp !== '' && opp !== 'Insufficient' ? String(opp) : null,
    lines: parseLines(raw.lines),
    games: parseGames(raw.games),
  };
}

async function fetchProps(gamePk: number): Promise<MlbPlayerPropRow[]> {
  try {
    const { data, error } = await collegeFootballSupabase.rpc('get_mlb_player_props_l10', {
      p_game_pk: gamePk,
    });
    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
  } catch {
    return [];
  }
}

export function useMLBPlayerPropsL10(gamePk: number, enabled = true) {
  return useQuery<MlbPlayerPropRow[]>({
    queryKey: ['mlb-player-props-l10', gamePk],
    enabled: enabled && gamePk > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchProps(gamePk),
  });
}

export async function fetchMLBPlayerPropsL10(gamePk: number): Promise<MlbPlayerPropRow[]> {
  return fetchProps(gamePk);
}
