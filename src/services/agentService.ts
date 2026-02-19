import { supabase } from '@/integrations/supabase/client';
import {
  AgentProfile,
  AgentWithPerformance,
  AgentPerformance,
  PresetArchetype,
  CreateAgentInput,
  UpdateAgentInput,
  CreateAgentSchema,
  UpdateAgentSchema,
} from '@/types/agent';

export async function fetchUserAgents(userId: string): Promise<AgentWithPerformance[]> {
  const { data: agents, error: agentsError } = await (supabase as any)
    .from('avatar_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (agentsError) throw agentsError;
  if (!agents || agents.length === 0) return [];

  const agentIds = agents.map((a: any) => a.id);
  const { data: performances } = await (supabase as any)
    .from('avatar_performance_cache')
    .select('*')
    .in('avatar_id', agentIds);

  const perfMap = new Map<string, AgentPerformance>();
  (performances || []).forEach((p: any) => perfMap.set(p.avatar_id, p as AgentPerformance));

  return agents.map((agent: any) => ({
    ...(agent as AgentProfile),
    performance: perfMap.get(agent.id) || null,
  }));
}

export async function fetchAgentById(agentId: string): Promise<AgentWithPerformance | null> {
  const { data: agent, error: agentError } = await (supabase as any)
    .from('avatar_profiles')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError) {
    if (agentError.code === 'PGRST116') return null;
    throw agentError;
  }

  const { data: performance } = await (supabase as any)
    .from('avatar_performance_cache')
    .select('*')
    .eq('avatar_id', agentId)
    .maybeSingle();

  return {
    ...(agent as AgentProfile),
    performance: (performance as AgentPerformance) || null,
  };
}

export async function createAgent(userId: string, data: CreateAgentInput): Promise<AgentProfile> {
  const validated = CreateAgentSchema.parse(data);

  let canCreatePublicAgent = false;
  const { data: canAccessPicks } = await (supabase as any).rpc('can_access_agent_picks', {
    p_user_id: userId,
  });
  canCreatePublicAgent = Boolean(canAccessPicks);

  const insertData = {
    user_id: userId,
    name: validated.name,
    avatar_emoji: validated.avatar_emoji,
    avatar_color: validated.avatar_color,
    preferred_sports: validated.preferred_sports,
    archetype: validated.archetype,
    personality_params: validated.personality_params,
    custom_insights: validated.custom_insights,
    auto_generate: validated.auto_generate,
    is_widget_favorite: validated.is_widget_favorite,
    is_public: canCreatePublicAgent,
    is_active: true,
  };

  const { data: agent, error } = await (supabase as any)
    .from('avatar_profiles')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('row-level security') ||
      error.message?.toLowerCase().includes('permission denied')
    ) {
      throw new Error('Agent limit reached. Free: 1 active. Pro: 10 active, 30 total.');
    }
    throw error;
  }

  return agent as AgentProfile;
}

export async function updateAgent(agentId: string, data: UpdateAgentInput): Promise<AgentProfile> {
  const validated = UpdateAgentSchema.parse(data);
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  Object.entries(validated).forEach(([key, value]) => {
    if (value !== undefined) updateData[key] = value;
  });

  const { data: agent, error } = await (supabase as any)
    .from('avatar_profiles')
    .update(updateData)
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw error;
  return agent as AgentProfile;
}

export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await (supabase as any).from('avatar_profiles').delete().eq('id', agentId);
  if (error) throw error;
}

export async function fetchPresetArchetypes(): Promise<PresetArchetype[]> {
  const { data, error } = await (supabase as any)
    .from('preset_archetypes')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data || []) as PresetArchetype[];
}
