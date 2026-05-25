import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export interface PitcherStartLog {
  game_pk: number;
  official_date: string;
  opponent_team_name: string | null;
  ip_official: number | null;
  batters_faced: number | null;
  strikeouts: number | null;
  walks: number | null;
  hits_allowed: number | null;
  home_runs_allowed: number | null;
  xfip: number | null;
  xera_est: number | null;
  xwoba_allowed: number | null;
  k_pct: number | null;
  bb_pct: number | null;
}

/** Most recent N starts for a pitcher, newest first. We default to 3 because
 *  pitchers start ~every 5 days — comparing 3 starts to season averages is the
 *  proper "recent form" window. Excludes the current matchup's game date so a
 *  start logged mid-game doesn't pollute the "last 3 completed starts" panel. */
export function usePitcherRecentStarts(
  pitcherId: number | null | undefined,
  season: number,
  options: { limit?: number; beforeDate?: string | null; enabled?: boolean } = {},
) {
  const { limit = 3, beforeDate = null, enabled = true } = options;
  return useQuery<PitcherStartLog[]>({
    queryKey: ['mlb-pitcher-recent-starts', pitcherId, season, limit, beforeDate],
    enabled: enabled && Number.isFinite(Number(pitcherId)) && Number(pitcherId) > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      let q = collegeFootballSupabase
        .from('mlb_pitcher_logs')
        .select(
          'game_pk, official_date, opponent_team_name, ip_official, batters_faced, strikeouts, walks, hits_allowed, home_runs_allowed, xfip, xera_est, xwoba_allowed, k_pct, bb_pct, games_started',
        )
        .eq('pitcher_id', pitcherId as number)
        .eq('season', season)
        .gt('games_started', 0);
      // Exclude the current matchup's date so today's in-progress / just-completed
      // start (which the ingestion pipeline may have already written) doesn't
      // displace the actual third-most-recent prior start.
      if (beforeDate) q = q.lt('official_date', beforeDate);
      const { data, error } = await q
        .order('official_date', { ascending: false })
        .limit(limit);
      if (error) return [];
      return ((data ?? []) as PitcherStartLog[]).map(r => ({
        game_pk: Number(r.game_pk),
        official_date: String(r.official_date),
        opponent_team_name: r.opponent_team_name ?? null,
        ip_official: r.ip_official != null ? Number(r.ip_official) : null,
        batters_faced: r.batters_faced != null ? Number(r.batters_faced) : null,
        strikeouts: r.strikeouts != null ? Number(r.strikeouts) : null,
        walks: r.walks != null ? Number(r.walks) : null,
        hits_allowed: r.hits_allowed != null ? Number(r.hits_allowed) : null,
        home_runs_allowed: r.home_runs_allowed != null ? Number(r.home_runs_allowed) : null,
        xfip: r.xfip != null ? Number(r.xfip) : null,
        xera_est: r.xera_est != null ? Number(r.xera_est) : null,
        xwoba_allowed: r.xwoba_allowed != null ? Number(r.xwoba_allowed) : null,
        k_pct: r.k_pct != null ? Number(r.k_pct) : null,
        bb_pct: r.bb_pct != null ? Number(r.bb_pct) : null,
      }));
    },
  });
}
