import { useQueries } from '@tanstack/react-query';
import type { MatchupGame } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
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

export function useAllPlayerProps(games: MatchupGame[], enabled: boolean) {
  const queries = useQueries({
    queries: games.map(game => ({
      queryKey: ['mlb-player-props-l10', game.game_pk],
      queryFn: () => fetchProps(game.game_pk),
      enabled: enabled && game.game_pk > 0,
      staleTime: 10 * 60 * 1000,
    })),
  });

  const propsByGamePk = new Map<number, MlbPlayerPropRow[]>();
  for (let i = 0; i < games.length; i++) {
    if (queries[i].data) propsByGamePk.set(games[i].game_pk, queries[i].data);
  }

  const isLoading = queries.some(q => q.isLoading);
  return { propsByGamePk, isLoading };
}
