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
// COLUMN SELECTIONS — avoid SELECT * to reduce payload size
// ============================================================================

/** Columns needed for list views (excludes large JSONB: personality_params, custom_insights) */
const AGENT_LIST_COLUMNS = 'id, user_id, name, avatar_emoji, avatar_color, preferred_sports, archetype, is_public, is_active, created_at, updated_at, auto_generate, auto_generate_time, auto_generate_timezone, is_widget_favorite, last_generated_at, last_auto_generated_at, owner_last_active_at, daily_generation_count, last_generation_date';

/** All columns needed for detail/edit views (includes personality_params, custom_insights) */
const AGENT_DETAIL_COLUMNS = '*';

/** Columns needed for performance cache */
const PERF_COLUMNS = 'avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, current_streak, best_streak, worst_streak, last_calculated_at';

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
    // Fetch agents (list columns only — excludes large JSONB fields)
    const { data: agents, error: agentsError } = await supabase
      .from('avatar_profiles')
      .select(AGENT_LIST_COLUMNS)
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
      .select(PERF_COLUMNS)
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
    // Fetch agent and performance in parallel
    const [agentResult, perfResult] = await Promise.all([
      supabase
        .from('avatar_profiles')
        .select(AGENT_DETAIL_COLUMNS)
        .eq('id', agentId)
        .single(),
      supabase
        .from('avatar_performance_cache')
        .select(PERF_COLUMNS)
        .eq('avatar_id', agentId)
        .maybeSingle(),
    ]);

    const { data: agent, error: agentError } = agentResult;
    const { data: performance, error: perfError } = perfResult;

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching agent:', agentError);
      throw agentError;
    }

    if (!agent) {
      return null;
    }

    if (perfError) {
      console.error('Error fetching performance:', perfError);
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
 * Check if a Supabase error is an RLS / permission denial.
 */
function isRlsError(error: any): boolean {
  return (
    error.code === '42501' ||
    error.message?.toLowerCase().includes('row-level security') ||
    error.message?.toLowerCase().includes('permission denied')
  );
}

/**
 * Sync the user's RevenueCat subscription status to the profiles table so
 * server-side RLS policies see the correct Pro state.
 */
async function syncSubscriptionToSupabase(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_active: isActive })
    .eq('user_id', userId);
  if (error) {
    console.warn('Failed to sync subscription_active to Supabase:', error.message);
  }
}

/**
 * Create a new agent.
 *
 * If the insert is blocked by RLS but RevenueCat says the user is Pro,
 * we sync subscription_active to Supabase and retry once. This prevents
 * Pro users from being locked out when the DB hasn't seen their entitlement yet.
 */
export async function createAgent(
  userId: string,
  data: CreateAgentInput
): Promise<AgentProfile> {
  // Lazy-import to avoid circular dependency — revenuecat.ts is a service, not a context
  const { hasActiveEntitlement } = require('./revenuecat');

  try {
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
      auto_generate_time: validated.auto_generate_time,
      auto_generate_timezone: validated.auto_generate_timezone,
      is_widget_favorite: validated.is_widget_favorite,
      is_public: false,
      // Manual-mode agents are created inactive so they don't count as live autopilot agents.
      is_active: validated.auto_generate,
    };

    // ── First attempt ──
    const { data: agent, error } = await supabase
      .from('avatar_profiles')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Duplicate name — no retry needed
      if (
        error.code === '23505' ||
        error.message?.toLowerCase().includes('unique_avatar_name_per_user') ||
        error.message?.toLowerCase().includes('duplicate key')
      ) {
        throw new Error(`You already have an agent named "${validated.name}". Please choose a different name.`);
      }

      // RLS blocked the insert — could be a stale subscription_active flag
      if (isRlsError(error)) {
        let isPro = false;
        try {
          isPro = await hasActiveEntitlement();
        } catch { /* RevenueCat unavailable — fall through to error */ }

        if (isPro) {
          // User IS Pro but DB didn't know — sync and retry once
          console.log('Agent insert blocked by RLS but user has Pro entitlement — syncing and retrying');
          await syncSubscriptionToSupabase(userId, true);

          const retry = await supabase
            .from('avatar_profiles')
            .insert(insertData)
            .select()
            .single();

          if (retry.error) {
            if (isRlsError(retry.error)) {
              // Still blocked after sync — genuinely at the Pro limit
              throw new Error('You\'ve reached the Pro agent limit (10 active, 30 total). Archive an agent to create a new one.');
            }
            throw retry.error;
          }

          // Retry succeeded — continue with the created agent
          const retryAgent = retry.data as AgentProfile;
          Promise.resolve(supabase.rpc('can_access_agent_picks', { p_user_id: userId }))
            .then(({ data: canAccess }) => {
              if (canAccess) {
                supabase.from('avatar_profiles').update({ is_public: true }).eq('id', retryAgent.id);
              }
            })
            .catch(() => {});

          return retryAgent;
        }

        // Not Pro — show the free-tier limit message
        throw new Error('Free users can create 1 active agent. Upgrade to Pro for up to 10 active agents.');
      }

      throw error;
    }

    // Fire-and-forget: check entitlement and flip is_public if the user qualifies.
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
