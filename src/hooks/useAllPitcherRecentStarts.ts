// One bulk query for every starting pitcher's last 3 completed starts.
// Used by the daily report so the pitcher-side scoring algorithm can factor
// recent form (L3 K%, xwOBA-A, depth) without firing N separate queries.
import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { MatchupGame } from '@/types/mlb-matchups';
import type { PitcherStartLog } from '@/hooks/usePitcherRecentStarts';

export function useAllPitcherRecentStarts(
  games: MatchupGame[],
  season: number,
  enabled: boolean,
) {
  return useQuery<Map<number, PitcherStartLog[]>>({
    queryKey: [
      'mlb-pitcher-recent-starts-bulk',
      season,
      // Stable cache key — sort pitcher ids so the same slate hits the same cache.
      [...new Set(games.flatMap(g => [g.away_sp_id, g.home_sp_id]))].sort((a, b) => a - b).join(','),
    ],
    enabled: enabled && games.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const pitcherIds = [...new Set(games.flatMap(g => [g.away_sp_id, g.home_sp_id]))].filter(
        n => Number.isFinite(n) && n > 0,
      );
      if (pitcherIds.length === 0) return new Map();

      // Pull every completed start this season for these pitchers — typically
      // 30 pitchers × ~10 starts = ~300 rows, comfortably one round-trip.
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await collegeFootballSupabase
        .from('mlb_pitcher_logs')
        .select(
          'pitcher_id, game_pk, official_date, opponent_team_name, ip_official, batters_faced, strikeouts, walks, hits_allowed, home_runs_allowed, xfip, xera_est, xwoba_allowed, k_pct, bb_pct, games_started',
        )
        .in('pitcher_id', pitcherIds)
        .eq('season', season)
        .gt('games_started', 0)
        .lt('official_date', today)
        .order('official_date', { ascending: false });

      if (error) {
        console.warn('[useAllPitcherRecentStarts]', error.message);
        return new Map();
      }

      const byPitcher = new Map<number, PitcherStartLog[]>();
      for (const raw of (data ?? []) as Record<string, unknown>[]) {
        const pid = Number(raw.pitcher_id);
        if (!Number.isFinite(pid)) continue;
        const log: PitcherStartLog = {
          game_pk: Number(raw.game_pk),
          official_date: String(raw.official_date),
          opponent_team_name: (raw.opponent_team_name as string) ?? null,
          ip_official: raw.ip_official != null ? Number(raw.ip_official) : null,
          batters_faced: raw.batters_faced != null ? Number(raw.batters_faced) : null,
          strikeouts: raw.strikeouts != null ? Number(raw.strikeouts) : null,
          walks: raw.walks != null ? Number(raw.walks) : null,
          hits_allowed: raw.hits_allowed != null ? Number(raw.hits_allowed) : null,
          home_runs_allowed: raw.home_runs_allowed != null ? Number(raw.home_runs_allowed) : null,
          xfip: raw.xfip != null ? Number(raw.xfip) : null,
          xera_est: raw.xera_est != null ? Number(raw.xera_est) : null,
          xwoba_allowed: raw.xwoba_allowed != null ? Number(raw.xwoba_allowed) : null,
          k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
          bb_pct: raw.bb_pct != null ? Number(raw.bb_pct) : null,
        };
        const list = byPitcher.get(pid) ?? [];
        // Already sorted DESC by date — take the first 3 per pitcher.
        if (list.length < 3) {
          list.push(log);
          byPitcher.set(pid, list);
        }
      }
      return byPitcher;
    },
  });
}
