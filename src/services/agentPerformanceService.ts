import { supabase } from '@/integrations/supabase/client';
import { AgentPerformance, Sport } from '@/types/agent';

export interface LeaderboardEntry {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  user_id: string;
  preferred_sports: Sport[];
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number | null;
  net_units: number;
  current_streak: number;
  best_streak: number;
}

export type LeaderboardSortMode = 'overall' | 'recent_run' | 'longest_streak' | 'bottom_100';

export async function fetchAgentPerformance(agentId: string): Promise<AgentPerformance | null> {
  const { data, error } = await (supabase as any)
    .from('avatar_performance_cache')
    .select('*')
    .eq('avatar_id', agentId)
    .maybeSingle();

  if (error) throw error;
  return (data as AgentPerformance) || null;
}

export async function fetchLeaderboard(
  limit = 100,
  sport?: Sport,
  sortMode: LeaderboardSortMode = 'overall',
  excludeUnder10Picks = false
): Promise<LeaderboardEntry[]> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  let agentsQuery = (supabase as any)
    .from('avatar_profiles')
    .select('id, name, avatar_emoji, avatar_color, user_id, preferred_sports')
    .eq('is_public', true);

  if (sport) {
    agentsQuery = agentsQuery.contains('preferred_sports', [sport]);
  }

  const { data: agents, error: agentsError } = await agentsQuery;
  if (agentsError || !agents?.length) return [];

  const agentIds = agents.map((a: any) => a.id);
  const { data: performances, error: perfError } = await (supabase as any)
    .from('avatar_performance_cache')
    .select('*')
    .in('avatar_id', agentIds);

  if (perfError) return [];

  const perfMap = new Map<string, AgentPerformance>();
  (performances || []).forEach((p: any) => perfMap.set(p.avatar_id, p as AgentPerformance));

  return agents
    .map((agent: any) => {
      const perf = perfMap.get(agent.id);
      return {
        avatar_id: agent.id,
        name: agent.name,
        avatar_emoji: agent.avatar_emoji,
        avatar_color: agent.avatar_color,
        user_id: agent.user_id,
        preferred_sports: agent.preferred_sports,
        total_picks: perf?.total_picks || 0,
        wins: perf?.wins || 0,
        losses: perf?.losses || 0,
        pushes: perf?.pushes || 0,
        win_rate: perf?.win_rate || null,
        net_units: perf?.net_units || 0,
        current_streak: perf?.current_streak || 0,
        best_streak: perf?.best_streak || 0,
      } satisfies LeaderboardEntry;
    })
    .filter((entry) => (entry.wins + entry.losses) > 0)
    .filter((entry) => (excludeUnder10Picks ? entry.total_picks >= 10 : true))
    .sort((a, b) => {
      if (sortMode === 'recent_run') {
        if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak;
        if (b.net_units !== a.net_units) return b.net_units - a.net_units;
        return (b.win_rate || 0) - (a.win_rate || 0);
      }
      if (sortMode === 'longest_streak') {
        if (b.best_streak !== a.best_streak) return b.best_streak - a.best_streak;
        if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak;
        if (b.net_units !== a.net_units) return b.net_units - a.net_units;
        return (b.win_rate || 0) - (a.win_rate || 0);
      }
      if (sortMode === 'bottom_100') {
        if (a.net_units !== b.net_units) return a.net_units - b.net_units;
        if ((a.win_rate || 0) !== (b.win_rate || 0)) return (a.win_rate || 0) - (b.win_rate || 0);
        return a.current_streak - b.current_streak;
      }

      if (b.net_units !== a.net_units) return b.net_units - a.net_units;
      if ((b.win_rate || 0) !== (a.win_rate || 0)) return (b.win_rate || 0) - (a.win_rate || 0);
      return b.current_streak - a.current_streak;
    })
    .slice(0, effectiveLimit);
}
