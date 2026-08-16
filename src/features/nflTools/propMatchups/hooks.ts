import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { NflPropPlayerPage, NflPropPlayerTrends, PropSlateAnchor } from '@/features/propBreakdown/types';

const STALE = 5 * 60 * 1000;

async function resolveLatestSlate(): Promise<PropSlateAnchor> {
  const { data, error } = await collegeFootballSupabase
    .from('nfl_prop_player_pages')
    .select('season,week')
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('No NFL prop player pages slate found');
  return { season: Number(row.season), week: Number(row.week) };
}

export function useNflPropMatchupsSlate() {
  return useQuery({
    queryKey: ['nflPropMatchups', 'slate'],
    queryFn: resolveLatestSlate,
    staleTime: STALE,
  });
}

/** Full week of player pages — grouped into games client-side. */
export function useNflPropMatchupsPages() {
  const slate = useNflPropMatchupsSlate();
  return useQuery({
    queryKey: ['nflPropMatchups', 'pages', slate.data?.season, slate.data?.week],
    enabled: Boolean(slate.data),
    staleTime: STALE,
    queryFn: async (): Promise<NflPropPlayerPage[]> => {
      const { season, week } = slate.data!;
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select(
          'player_id,season,week,player_name,position,team,opponent,is_home,game_label,kickoff,headshot_url,markets,baseline,ngs,scheme,highlights'
        )
        .eq('season', season)
        .eq('week', week);
      if (error) throw error;
      return ((data ?? []) as NflPropPlayerPage[]).map((row) => ({
        ...row,
        markets: Array.isArray(row.markets) ? row.markets : [],
        highlights: Array.isArray(row.highlights) ? row.highlights : [],
      }));
    },
  });
}

/** Career trends for the players in the open game (vs-team records). */
export function useNflPropTrendsBatch(playerIds: string[]) {
  const key = [...playerIds].sort().join(',');
  return useQuery({
    queryKey: ['nflPropMatchups', 'trends', key],
    enabled: playerIds.length > 0,
    staleTime: STALE,
    queryFn: async (): Promise<Record<string, NflPropPlayerTrends>> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_player_prop_trends')
        .select('player_id,recent_game_log,matchups,splits')
        .in('player_id', playerIds);
      if (error) throw error;
      const out: Record<string, NflPropPlayerTrends> = {};
      for (const row of data ?? []) {
        out[row.player_id] = row as NflPropPlayerTrends;
      }

      const gameLogs = Object.values(out).flatMap((trend) => trend.recent_game_log ?? []);
      const seasons = [...new Set(gameLogs.map((game) => game.season))];
      const weeks = [...new Set(gameLogs.map((game) => game.week))];
      if (seasons.length > 0 && weeks.length > 0) {
        const { data: statRows, error: statError } = await collegeFootballSupabase
          .from('nfl_player_game_logs')
          .select('player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions')
          .in('player_id', playerIds)
          .in('season', seasons)
          .in('week', weeks);
        if (statError) throw statError;
        const statsByGame = new Map(
          (statRows ?? []).map((row) => [`${row.player_id}-${row.season}-${row.week}`, row] as const),
        );
        const statByMarket = {
          player_pass_yds: 'pass_yds',
          player_pass_tds: 'pass_tds',
          player_receptions: 'receptions',
          player_reception_yds: 'rec_yds',
          player_rush_yds: 'rush_yds',
          player_pass_attempts: 'pass_attempts',
          player_rush_attempts: 'carries',
          player_pass_completions: 'completions',
        } as const;
        for (const [playerId, trend] of Object.entries(out)) {
          trend.recent_game_log = (trend.recent_game_log ?? []).map((game) => {
            const stats = statsByGame.get(`${playerId}-${game.season}-${game.week}`);
            if (!stats) return game;
            const actuals: Record<string, number> = { ...(game.actuals ?? {}) };
            for (const [market, stat] of Object.entries(statByMarket)) {
              const value = stats[stat as keyof typeof stats];
              if (typeof value === 'number' && Number.isFinite(value)) actuals[market] = value;
            }
            const rushTds = typeof stats.rush_tds === 'number' ? stats.rush_tds : 0;
            const receivingTds = typeof stats.rec_tds === 'number' ? stats.rec_tds : 0;
            actuals.player_anytime_td = rushTds + receivingTds;
            return { ...game, actuals };
          });
        }
      }
      return out;
    },
  });
}
