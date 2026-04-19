import { supabase } from '@/integrations/supabase/client';
import { ZodError } from 'zod';
import {
  AgentProfile,
  AgentWithPerformance,
  AgentPerformance,
  PresetArchetype,
  CreateAgentInput,
  UpdateAgentInput,
  CreateAgentSchema,
  UpdateAgentSchema,
  DEFAULT_CUSTOM_INSIGHTS,
  DEFAULT_PERSONALITY_PARAMS,
} from '@/types/agent';

function formatValidationError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`).join('; ');
}

function normalizeUpdateAgentInput(data: UpdateAgentInput): UpdateAgentInput {
  return {
    ...data,
    personality_params: data.personality_params
      ? {
          ...DEFAULT_PERSONALITY_PARAMS,
          ...data.personality_params,
        }
      : data.personality_params,
    custom_insights: data.custom_insights
      ? {
          ...DEFAULT_CUSTOM_INSIGHTS,
          ...data.custom_insights,
        }
      : data.custom_insights,
  };
}

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

  // Insert immediately with is_public=false; check entitlement in the background.
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
    auto_generate_time: validated.auto_generate_time,
    auto_generate_timezone: validated.auto_generate_timezone,
    is_widget_favorite: validated.is_widget_favorite,
    is_public: false,
    is_active: validated.auto_generate,
  };

  const { data: agent, error } = await (supabase as any)
    .from('avatar_profiles')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (
      error.code === '23505' ||
      error.message?.toLowerCase().includes('unique_avatar_name_per_user') ||
      error.message?.toLowerCase().includes('duplicate key')
    ) {
      throw new Error(`You already have an agent named "${validated.name}". Please choose a different name.`);
    }
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('row-level security') ||
      error.message?.toLowerCase().includes('permission denied')
    ) {
      throw new Error('Agent limit reached. Free: 1 active. Pro: 10 active, 30 total.');
    }
    throw error;
  }

  // Await public status check so the agent is immediately visible on detail pages
  try {
    const { data: canAccess } = await (supabase as any).rpc('can_access_agent_picks', { p_user_id: userId });
    if (canAccess) {
      await (supabase as any).from('avatar_profiles').update({ is_public: true }).eq('id', agent.id);
      agent.is_public = true;
    }
  } catch {
    // Non-critical — agent still works, just won't be public yet
  }

  return agent as AgentProfile;
}

export async function updateAgent(agentId: string, data: UpdateAgentInput): Promise<AgentProfile> {
  let validated;

  try {
    validated = UpdateAgentSchema.parse(normalizeUpdateAgentInput(data));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(formatValidationError(error));
    }
    throw error;
  }

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
