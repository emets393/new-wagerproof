import { supabase } from '@/services/supabase';
import { AgentPick, AgentWithPerformance } from '@/types/agent';
import { TopAgentWidgetData, AgentPickForWidget } from '@/modules/widget-data-bridge';

const MAX_WIDGET_AGENTS = 3;
const PICKS_PER_AGENT = 2;

function sortByPerformance(a: AgentWithPerformance, b: AgentWithPerformance): number {
  const aNetUnits = a.performance?.net_units ?? 0;
  const bNetUnits = b.performance?.net_units ?? 0;
  if (bNetUnits !== aNetUnits) return bNetUnits - aNetUnits;

  const aWinRate = a.performance?.win_rate ?? 0;
  const bWinRate = b.performance?.win_rate ?? 0;
  if (bWinRate !== aWinRate) return bWinRate - aWinRate;

  const aStreak = a.performance?.current_streak ?? 0;
  const bStreak = b.performance?.current_streak ?? 0;
  return bStreak - aStreak;
}

function formatRecord(agent: AgentWithPerformance): string {
  const wins = agent.performance?.wins ?? 0;
  const losses = agent.performance?.losses ?? 0;
  const pushes = agent.performance?.pushes ?? 0;
  return pushes > 0 ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`;
}

function formatPickForWidget(pick: AgentPick): AgentPickForWidget {
  return {
    id: pick.id,
    sport: pick.sport,
    matchup: pick.matchup,
    pickSelection: pick.pick_selection,
    odds: pick.odds || undefined,
    result: pick.result || undefined,
    gameDate: pick.game_date || undefined,
  };
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function selectPicksForAgent(allPicks: AgentPick[]): AgentPickForWidget[] {
  const todayStr = getTodayDateString();

  const todaysPicks = allPicks
    .filter((pick) => pick.game_date === todayStr)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const historicalPicks = allPicks
    .filter((pick) => pick.game_date !== todayStr)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const selected: AgentPick[] = [];
  const selectedIds = new Set<string>();

  for (const pick of todaysPicks) {
    if (selected.length >= PICKS_PER_AGENT) break;
    selected.push(pick);
    selectedIds.add(pick.id);
  }

  for (const pick of historicalPicks) {
    if (selected.length >= PICKS_PER_AGENT) break;
    if (selectedIds.has(pick.id)) continue;
    selected.push(pick);
    selectedIds.add(pick.id);
  }

  return selected.map(formatPickForWidget);
}

export async function fetchTopAgentsForWidget(userId: string): Promise<TopAgentWidgetData[]> {
  if (!userId) return [];

  const { data: agents, error: agentsError } = await supabase
    .from('avatar_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (agentsError) {
    console.error('Error fetching agents for widget:', agentsError);
    return [];
  }

  const agentProfiles = ((agents as any[]) || []) as Array<Omit<AgentWithPerformance, 'performance'>>;
  const agentIds = agentProfiles.map((agent) => agent.id);
  if (agentIds.length === 0) return [];

  const { data: performances, error: perfError } = await supabase
    .from('avatar_performance_cache')
    .select('*')
    .in('avatar_id', agentIds);

  if (perfError) {
    console.error('Error fetching agent performance for widget:', perfError);
  }

  const performanceByAgent = new Map<string, AgentWithPerformance['performance']>();
  (performances || []).forEach((perf: any) => {
    performanceByAgent.set(perf.avatar_id, perf);
  });

  const typedAgents: AgentWithPerformance[] = agentProfiles.map((agent) => ({
    ...agent,
    performance: performanceByAgent.get(agent.id) || null,
  }));
  if (typedAgents.length === 0) return [];

  const favorites = typedAgents
    .filter((agent) => agent.is_widget_favorite)
    .sort(sortByPerformance);
  const nonFavorites = typedAgents
    .filter((agent) => !agent.is_widget_favorite)
    .sort(sortByPerformance);

  const selectedAgents: AgentWithPerformance[] = favorites.slice(0, MAX_WIDGET_AGENTS);
  if (selectedAgents.length < MAX_WIDGET_AGENTS) {
    const remaining = MAX_WIDGET_AGENTS - selectedAgents.length;
    selectedAgents.push(...nonFavorites.slice(0, remaining));
  }

  if (selectedAgents.length === 0) return [];

  const selectedIds = selectedAgents.map((agent) => agent.id);
  const { data: picks, error: picksError } = await supabase
    .from('avatar_picks')
    .select('*')
    .in('avatar_id', selectedIds)
    .order('created_at', { ascending: false });

  if (picksError) {
    console.error('Error fetching agent picks for widget:', picksError);
    return selectedAgents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      agentEmoji: agent.avatar_emoji,
      agentColor: agent.avatar_color,
      isFavorite: agent.is_widget_favorite,
      netUnits: agent.performance?.net_units ?? 0,
      winRate: agent.performance?.win_rate ?? undefined,
      currentStreak: agent.performance?.current_streak ?? 0,
      record: formatRecord(agent),
      picks: [],
    }));
  }

  const picksByAgent = new Map<string, AgentPick[]>();
  selectedIds.forEach((agentId) => picksByAgent.set(agentId, []));

  for (const rawPick of (picks || []) as AgentPick[]) {
    const agentPicks = picksByAgent.get(rawPick.avatar_id) || [];
    agentPicks.push(rawPick);
    picksByAgent.set(rawPick.avatar_id, agentPicks);
  }

  return selectedAgents.map((agent) => ({
    agentId: agent.id,
    agentName: agent.name,
    agentEmoji: agent.avatar_emoji,
    agentColor: agent.avatar_color,
    isFavorite: agent.is_widget_favorite,
    netUnits: agent.performance?.net_units ?? 0,
    winRate: agent.performance?.win_rate ?? undefined,
    currentStreak: agent.performance?.current_streak ?? 0,
    record: formatRecord(agent),
    picks: selectPicksForAgent(picksByAgent.get(agent.id) || []),
  }));
}
