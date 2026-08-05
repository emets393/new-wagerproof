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
      return out;
    },
  });
}
