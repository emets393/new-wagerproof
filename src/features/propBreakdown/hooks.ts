import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { NflPropPlayerPage, NflPropPlayerTrends, PropSlateAnchor } from './types';

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

export function useNflPropSlate() {
  return useQuery({
    queryKey: ['nflPropPage', 'slate'],
    queryFn: resolveLatestSlate,
    staleTime: STALE,
  });
}

export function useNflPropPlayerPage(playerId: string | undefined) {
  const slate = useNflPropSlate();
  return useQuery({
    queryKey: ['nflPropPage', playerId, slate.data?.season, slate.data?.week],
    enabled: Boolean(playerId) && Boolean(slate.data),
    staleTime: STALE,
    queryFn: async (): Promise<NflPropPlayerPage> => {
      const { season, week } = slate.data!;
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select('*')
        .eq('season', season)
        .eq('week', week)
        .eq('player_id', playerId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Player prop page not found for this slate');
      const row = data as NflPropPlayerPage;
      // Defensive: markets must be an array (generator bug once wrote a dict here).
      if (!Array.isArray(row.markets)) {
        row.markets = [];
      }
      if (!Array.isArray(row.highlights) && row.highlights != null) {
        row.highlights = [];
      }
      return row;
    },
  });
}

export function useNflPropPlayerTrends(playerId: string | undefined) {
  return useQuery({
    queryKey: ['nflPropTrends', playerId],
    enabled: Boolean(playerId),
    staleTime: STALE,
    queryFn: async (): Promise<NflPropPlayerTrends | null> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_player_prop_trends')
        .select('player_id,recent_game_log,matchups,splits')
        .eq('player_id', playerId!)
        .maybeSingle();
      if (error) throw error;
      const trends = (data as NflPropPlayerTrends | null) ?? null;
      if (!trends?.recent_game_log?.length) return trends;

      const seasons = [...new Set(trends.recent_game_log.map((game) => game.season))];
      const weeks = [...new Set(trends.recent_game_log.map((game) => game.week))];
      const { data: gameStats, error: statsError } = await collegeFootballSupabase
        .from('nfl_player_game_logs')
        .select('player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions')
        .eq('player_id', playerId!)
        .in('season', seasons)
        .in('week', weeks);
      if (statsError) throw statsError;

      const statsByGame = new Map(
        (gameStats ?? []).map((row) => [`${row.season}-${row.week}`, row] as const),
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

      trends.recent_game_log = trends.recent_game_log.map((game) => {
        const stats = statsByGame.get(`${game.season}-${game.week}`);
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
      return trends;
    },
  });
}

/** Light index for browse / search (optional entry points). */
export function useNflPropPlayerIndex() {
  const slate = useNflPropSlate();
  return useQuery({
    queryKey: ['nflPropPage', 'index', slate.data?.season, slate.data?.week],
    enabled: Boolean(slate.data),
    staleTime: STALE,
    queryFn: async () => {
      const { season, week } = slate.data!;
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select('player_id,player_name,position,team,opponent,headshot_url')
        .eq('season', season)
        .eq('week', week)
        .order('player_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
