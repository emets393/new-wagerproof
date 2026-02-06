import { supabase } from './supabase';
import { z } from 'zod';
import {
  AgentProfile,
  AgentWithPerformance,
  AgentPerformance,
  PresetArchetype,
  CreateAgentSchema,
  UpdateAgentSchema,
  PersonalityParams,
  CustomInsights,
  Sport,
  ArchetypeId,
} from '@/types/agent';

// ============================================================================
// INPUT TYPES
// ============================================================================

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

// ============================================================================
// AGENT CRUD OPERATIONS
// ============================================================================

/**
 * Fetch all agents for a user with their performance data
 */
export async function fetchUserAgents(userId: string): Promise<AgentWithPerformance[]> {
  try {
    // Fetch agents
    const { data: agents, error: agentsError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      return [];
    }

    // Fetch performance data for all agents
    const agentIds = agents.map((a) => a.id);
    const { data: performances, error: perfError } = await supabase
      .from('avatar_performance_cache')
      .select('*')
      .in('avatar_id', agentIds);

    if (perfError) {
      console.error('Error fetching performance:', perfError);
      // Don't throw - return agents without performance
    }

    // Create performance lookup map
    const perfMap = new Map<string, AgentPerformance>();
    if (performances) {
      performances.forEach((p) => {
        perfMap.set(p.avatar_id, p as AgentPerformance);
      });
    }

    // Combine agents with performance
    const agentsWithPerformance: AgentWithPerformance[] = agents.map((agent) => ({
      ...(agent as AgentProfile),
      performance: perfMap.get(agent.id) || null,
    }));

    console.log(`Loaded ${agentsWithPerformance.length} agents for user`);
    return agentsWithPerformance;
  } catch (error) {
    console.error('Error in fetchUserAgents:', error);
    throw error;
  }
}

/**
 * Fetch a single agent by ID with performance data
 */
export async function fetchAgentById(agentId: string): Promise<AgentWithPerformance | null> {
  try {
    // Fetch agent
    const { data: agent, error: agentError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Error fetching agent:', agentError);
      throw agentError;
    }

    if (!agent) {
      return null;
    }

    // Fetch performance data
    const { data: performance, error: perfError } = await supabase
      .from('avatar_performance_cache')
      .select('*')
      .eq('avatar_id', agentId)
      .maybeSingle();

    if (perfError) {
      console.error('Error fetching performance:', perfError);
      // Don't throw - return agent without performance
    }

    const agentWithPerformance: AgentWithPerformance = {
      ...(agent as AgentProfile),
      performance: (performance as AgentPerformance) || null,
    };

    console.log(`Loaded agent: ${agent.name}`);
    return agentWithPerformance;
  } catch (error) {
    console.error('Error in fetchAgentById:', error);
    throw error;
  }
}

/**
 * Create a new agent
 */
export async function createAgent(
  userId: string,
  data: CreateAgentInput
): Promise<AgentProfile> {
  try {
    // Validate input
    const validated = CreateAgentSchema.parse(data);

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
      is_public: true,
      is_active: true,
    };

    const { data: agent, error } = await supabase
      .from('avatar_profiles')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      throw error;
    }

    console.log(`Created agent: ${agent.name} (${agent.id})`);
    return agent as AgentProfile;
  } catch (error) {
    console.error('Error in createAgent:', error);
    throw error;
  }
}

/**
 * Update an existing agent
 */
export async function updateAgent(
  agentId: string,
  data: UpdateAgentInput
): Promise<AgentProfile> {
  try {
    // Validate input
    const validated = UpdateAgentSchema.parse(data);

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.avatar_emoji !== undefined) updateData.avatar_emoji = validated.avatar_emoji;
    if (validated.avatar_color !== undefined) updateData.avatar_color = validated.avatar_color;
    if (validated.preferred_sports !== undefined) updateData.preferred_sports = validated.preferred_sports;
    if (validated.archetype !== undefined) updateData.archetype = validated.archetype;
    if (validated.personality_params !== undefined) updateData.personality_params = validated.personality_params;
    if (validated.custom_insights !== undefined) updateData.custom_insights = validated.custom_insights;
    if (validated.auto_generate !== undefined) updateData.auto_generate = validated.auto_generate;
    if (validated.is_public !== undefined) updateData.is_public = validated.is_public;
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

    const { data: agent, error } = await supabase
      .from('avatar_profiles')
      .update(updateData)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating agent:', error);
      throw error;
    }

    console.log(`Updated agent: ${agent.name} (${agent.id})`);
    return agent as AgentProfile;
  } catch (error) {
    console.error('Error in updateAgent:', error);
    throw error;
  }
}

/**
 * Delete an agent permanently. Related picks, performance cache,
 * and follows are removed via ON DELETE CASCADE.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('avatar_profiles')
      .delete()
      .eq('id', agentId);

    if (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }

    console.log(`Deleted agent: ${agentId}`);
  } catch (error) {
    console.error('Error in deleteAgent:', error);
    throw error;
  }
}

/**
 * Fetch all preset archetype templates
 */
export async function fetchPresetArchetypes(): Promise<PresetArchetype[]> {
  try {
    const { data, error } = await supabase
      .from('preset_archetypes')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching preset archetypes:', error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} preset archetypes`);
    return (data as PresetArchetype[]) || [];
  } catch (error) {
    console.error('Error in fetchPresetArchetypes:', error);
    throw error;
  }
}
