import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRO_MAX_ACTIVE_AGENTS = 10;
const PRO_MAX_TOTAL_AGENTS = 30;
const FREE_AGENT_LIMIT = 1;

const EDITABLE_AGENT_FIELDS = new Set([
  'name',
  'avatar_emoji',
  'avatar_color',
  'preferred_sports',
  'archetype',
  'personality_params',
  'custom_insights',
  'auto_generate',
  'auto_generate_time',
  'auto_generate_timezone',
  'is_widget_favorite',
  'is_public',
  'is_active',
]);

type AgentAction =
  | 'detail_snapshot'
  | 'picks_page'
  | 'create_agent'
  | 'update_agent'
  | 'request_generation';

interface AgentActionRequest {
  action?: AgentAction;
  agent_id?: string;
  data?: Record<string, unknown>;
  filter?: 'all' | 'won' | 'lost' | 'pending' | 'push';
  page_size?: number;
  cursor?: string | null;
  include_overlap?: boolean;
  game_date?: string | null;
  idempotency_key?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: AgentActionRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON in request body');
    }

    const action = body.action;
    if (!action) {
      return errorResponse(400, 'Missing action');
    }

    const authHeader = req.headers.get('Authorization');
    const user = await getAuthenticatedUser(authHeader, supabaseUrl, supabaseAnonKey);
    const userId = user?.id ?? null;

    console.log(
      `[agent-authorized-action-v1] action=${action} hasAuthHeader=${!!authHeader} authHeaderStart=${authHeader?.substring(0, 20) ?? 'null'} resolvedUserId=${userId ?? 'null'}`,
    );

    const requiresAuth = action === 'create_agent' || action === 'update_agent' || action === 'request_generation';
    if (requiresAuth && !userId) {
      return errorResponse(401, 'User authentication required');
    }

    const { isAdmin, entitlement: rcEntitlement, hasPremiumAccess } = await resolvePremiumAccess(serviceClient, userId);

    switch (action) {
      case 'detail_snapshot': {
        const agentId = body.agent_id;
        if (!agentId) return errorResponse(400, 'Missing agent_id');

        const { data, error } = await serviceClient.rpc('get_agent_detail_snapshot_v3', {
          p_agent_id: agentId,
          p_viewer_user_id: userId,
          p_viewer_has_active_entitlement: hasPremiumAccess,
        });

        if (error) {
          console.error('[agent-authorized-action-v1] detail_snapshot error:', error);
          return errorResponse(500, 'Failed to load agent detail snapshot');
        }

        console.log(
          `[detail_snapshot] agent=${agentId} userId=${userId} hasPremiumAccess=${hasPremiumAccess} isAdmin=${isAdmin} todays_picks.len=${(data as any)?.todays_picks?.length ?? 'null'} can_view=${(data as any)?.can_view_agent_picks}`,
        );

        const augmented = {
          ...(data as any),
          _debug: {
            server_has_premium: hasPremiumAccess,
            server_is_admin: isAdmin,
            entitlement_source: (rcEntitlement as any)?.source ?? 'admin-or-null',
            entitlement_active: (rcEntitlement as any)?.isActive ?? null,
          },
        };

        return successResponse(augmented);
      }

      case 'picks_page': {
        const agentId = body.agent_id;
        if (!agentId) return errorResponse(400, 'Missing agent_id');

        const { data, error } = await serviceClient.rpc('get_agent_picks_page_v3', {
          p_agent_id: agentId,
          p_viewer_user_id: userId,
          p_viewer_has_active_entitlement: hasPremiumAccess,
          p_filter: body.filter ?? 'all',
          p_page_size: body.page_size ?? 20,
          p_cursor: body.cursor ?? null,
          p_include_overlap: body.include_overlap ?? false,
          p_game_date: body.game_date ?? null,
        });

        if (error) {
          console.error('[agent-authorized-action-v1] picks_page error:', error);
          return errorResponse(500, 'Failed to load agent picks');
        }

        return successResponse(data);
      }

      case 'request_generation': {
        const agentId = body.agent_id;
        if (!agentId || !userId) return errorResponse(400, 'Missing agent_id');

        const { data: runId, error } = await serviceClient.rpc('enqueue_manual_generation_run_v3', {
          p_user_id: userId,
          p_avatar_id: agentId,
          p_has_active_entitlement: hasPremiumAccess,
          p_idempotency_key: body.idempotency_key ?? null,
        });

        if (error) {
          console.error('[agent-authorized-action-v1] request_generation error:', error);
          if (error.message?.includes('Not authorized')) {
            return errorResponse(403, 'Upgrade to Pro to generate picks for this agent.');
          }
          if (error.message?.includes('limit reached')) {
            return errorResponse(429, 'Daily manual generation limit reached (3 per day)');
          }
          return errorResponse(500, 'Failed to enqueue generation request');
        }

        void (async () => {
          const { error: dispatchError } = await serviceClient.rpc('dispatch_generation_workers_v2', {
            p_max_dispatches: 1,
          });
          if (dispatchError) {
            console.warn('[agent-authorized-action-v1] dispatch hint failed:', dispatchError);
          }
        })();

        return successResponse({
          success: true,
          run_id: runId,
          status: 'queued',
        });
      }

      case 'create_agent': {
        if (!userId) return errorResponse(401, 'User authentication required');

        const payload = body.data ?? {};
        const validated = validateCreatePayload(payload);
        const counts = await getUserAgentCounts(serviceClient, userId);
        const requestedActive = validated.auto_generate === true;

        const allowed = isAdmin
          || (hasPremiumAccess
            ? counts.totalCount < PRO_MAX_TOTAL_AGENTS && (!requestedActive || counts.activeCount < PRO_MAX_ACTIVE_AGENTS)
            : counts.totalCount < FREE_AGENT_LIMIT && counts.activeCount < FREE_AGENT_LIMIT);

        if (!allowed) {
          return errorResponse(
            403,
            hasPremiumAccess
              ? 'You have reached the Pro agent limit (10 active, 30 total).'
              : 'Free users can create 1 active agent. Upgrade to Pro for more.'
          );
        }

        const insertData = {
          user_id: userId,
          name: validated.name,
          avatar_emoji: validated.avatar_emoji,
          avatar_color: validated.avatar_color,
          preferred_sports: validated.preferred_sports,
          archetype: validated.archetype ?? null,
          personality_params: validated.personality_params ?? null,
          custom_insights: validated.custom_insights ?? null,
          auto_generate: validated.auto_generate === true,
          auto_generate_time: validated.auto_generate_time ?? null,
          auto_generate_timezone: validated.auto_generate_timezone ?? null,
          is_widget_favorite: validated.is_widget_favorite === true,
          is_public: hasPremiumAccess,
          is_active: requestedActive,
        };

        const { data, error } = await serviceClient
          .from('avatar_profiles')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('[agent-authorized-action-v1] create_agent error:', error);
          if (
            error.code === '23505' ||
            error.message?.toLowerCase().includes('unique_avatar_name_per_user') ||
            error.message?.toLowerCase().includes('duplicate key')
          ) {
            return errorResponse(409, `You already have an agent named "${validated.name}". Please choose a different name.`);
          }
          return errorResponse(500, 'Failed to create agent');
        }

        return successResponse(data);
      }

      case 'update_agent': {
        const agentId = body.agent_id;
        if (!agentId || !userId) return errorResponse(400, 'Missing agent_id');

        const payload = body.data ?? {};
        const updateData = buildUpdatePayload(payload);
        const { data: existingAgent, error: existingAgentError } = await serviceClient
          .from('avatar_profiles')
          .select('id, user_id, name, is_active, is_public, auto_generate')
          .eq('id', agentId)
          .eq('user_id', userId)
          .single();

        if (existingAgentError || !existingAgent) {
          return errorResponse(404, 'Agent not found');
        }

        if (updateData.is_public === true && !hasPremiumAccess) {
          return errorResponse(403, 'Upgrade to Pro to make this agent public.');
        }

        if (updateData.auto_generate === true && !hasPremiumAccess) {
          return errorResponse(403, 'Upgrade to Pro to use autopilot.');
        }

        if (updateData.is_active === true && !existingAgent.is_active) {
          const counts = await getUserAgentCounts(serviceClient, userId, agentId);
          const canActivate = isAdmin
            || (hasPremiumAccess ? counts.activeCount < PRO_MAX_ACTIVE_AGENTS : counts.activeCount < FREE_AGENT_LIMIT);
          if (!canActivate) {
            return errorResponse(
              403,
              hasPremiumAccess
                ? 'You have reached the Pro live-agent limit (10 active).'
                : 'Free users can have 1 active agent. Upgrade to Pro for more.'
            );
          }
        }

        const { data, error } = await serviceClient
          .from('avatar_profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agentId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('[agent-authorized-action-v1] update_agent error:', error);
          if (
            error.code === '23505' ||
            error.message?.toLowerCase().includes('unique_avatar_name_per_user') ||
            error.message?.toLowerCase().includes('duplicate key')
          ) {
            return errorResponse(409, 'You already have an agent with that name.');
          }
          return errorResponse(500, 'Failed to update agent');
        }

        return successResponse(data);
      }

      default:
        return errorResponse(400, 'Unsupported action');
    }
  } catch (error) {
    console.error('[agent-authorized-action-v1] fatal error:', error);
    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});

async function getAuthenticatedUser(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  if (!authHeader) return null;

  // Strip "Bearer " prefix to get the raw JWT.
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pass the token explicitly to getUser — without it, supabase-js v2 looks
  // at the in-memory session (empty in edge function context) rather than
  // validating the Authorization header. That causes getUser to return no
  // user even when the header carries a valid JWT.
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    console.warn('[agent-authorized-action-v1] auth lookup failed:', error?.message);
    return null;
  }

  return data.user;
}

async function getUserAgentCounts(serviceClient: any, userId: string, excludeAgentId?: string) {
  let query = serviceClient
    .from('avatar_profiles')
    .select('id, is_active')
    .eq('user_id', userId);

  if (excludeAgentId) {
    query = query.neq('id', excludeAgentId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load agent counts: ${error.message}`);
  }

  const rows = data || [];
  return {
    totalCount: rows.length,
    activeCount: rows.filter((row: { is_active: boolean }) => row.is_active).length,
  };
}

function validateCreatePayload(payload: Record<string, unknown>) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const avatarEmoji = typeof payload.avatar_emoji === 'string' ? payload.avatar_emoji : '';
  const avatarColor = typeof payload.avatar_color === 'string' ? payload.avatar_color : '';
  const preferredSports = Array.isArray(payload.preferred_sports)
    ? payload.preferred_sports.filter((sport): sport is string => typeof sport === 'string')
    : [];

  if (!name) throw new Error('Agent name is required');
  if (name.length > 50) throw new Error('Agent name must be 50 characters or less');
  if (!avatarEmoji) throw new Error('Agent emoji is required');
  if (!avatarColor) throw new Error('Agent color is required');
  if (preferredSports.length === 0) throw new Error('At least one sport is required');

  return {
    name,
    avatar_emoji: avatarEmoji,
    avatar_color: avatarColor,
    preferred_sports: preferredSports,
    archetype: payload.archetype,
    personality_params: payload.personality_params,
    custom_insights: payload.custom_insights,
    auto_generate: payload.auto_generate === true,
    auto_generate_time: payload.auto_generate_time,
    auto_generate_timezone: payload.auto_generate_timezone,
    is_widget_favorite: payload.is_widget_favorite === true,
  };
}

function buildUpdatePayload(payload: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!EDITABLE_AGENT_FIELDS.has(key)) continue;

    if (key === 'name' && typeof value === 'string') {
      updateData[key] = value.trim();
      continue;
    }

    updateData[key] = value;
  }

  return updateData;
}

function successResponse(data: unknown) {
  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

function errorResponse(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
