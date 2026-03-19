import { supabase } from './supabase';
import { z, ZodError } from 'zod';
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
  DEFAULT_CUSTOM_INSIGHTS,
  DEFAULT_PERSONALITY_PARAMS,
} from '@/types/agent';

// ============================================================================
// INPUT TYPES
// ============================================================================

export type CreateAgentInput = z.input<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.input<typeof UpdateAgentSchema>;

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

    // Insert the agent immediately with is_public=false (safe default).
    // Check entitlement in parallel and update is_public afterwards if needed.
    // This avoids blocking the UI with a sequential RPC call.
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
      // Manual-mode agents are created inactive so they do not count as live autopilot agents.
      is_active: validated.auto_generate,
    };

    const { data: agent, error } = await supabase
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

    // Fire-and-forget: check entitlement and flip is_public if the user qualifies.
    // This doesn't block the UI — the agent is already created and usable.
    Promise.resolve(supabase.rpc('can_access_agent_picks', { p_user_id: userId }))
      .then(({ data: canAccess }) => {
        if (canAccess) {
          supabase.from('avatar_profiles').update({ is_public: true }).eq('id', agent.id);
        }
      })
      .catch(() => {});

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
    const validated = UpdateAgentSchema.parse(normalizeUpdateAgentInput(data));

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
    if (validated.auto_generate_time !== undefined) updateData.auto_generate_time = validated.auto_generate_time;
    if (validated.auto_generate_timezone !== undefined) updateData.auto_generate_timezone = validated.auto_generate_timezone;
    if (validated.is_widget_favorite !== undefined) updateData.is_widget_favorite = validated.is_widget_favorite;
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
    if (error instanceof ZodError) {
      console.error('Agent update validation error:', error.flatten());
      throw new Error(formatValidationError(error));
    }
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
