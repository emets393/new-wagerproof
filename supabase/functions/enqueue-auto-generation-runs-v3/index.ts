import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { disableUserAutopilot, resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    const providedSecret = req.headers.get('x-internal-secret') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const secretMatches = !!internalSecret && providedSecret === internalSecret;
    const serviceRoleMatches = !!supabaseServiceKey && bearerToken === supabaseServiceKey;
    if (!secretMatches && !serviceRoleMatches) {
      return errorResponse(401, 'Unauthorized');
    }

    let body: { limit?: number; now?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for cron callers.
    }

    const limit = Math.max(1, Math.min(body.limit ?? 50, 200));
    const nowIso = body.now && !Number.isNaN(Date.parse(body.now))
      ? new Date(body.now).toISOString()
      : new Date().toISOString();

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: candidateUsers, error: candidatesError } = await serviceClient.rpc(
      'get_due_auto_generation_candidate_users_v3',
      {
        p_now: nowIso,
        p_limit: limit,
      },
    );

    if (candidatesError) {
      console.error('[enqueue-auto-generation-runs-v3] candidate lookup failed:', candidatesError);
      return errorResponse(500, 'Failed to load auto-generation candidates');
    }

    const candidateRows = (candidateUsers || []) as Array<{ user_id: string | null }>;
    const userIds = Array.from(new Set(candidateRows.map((row) => row.user_id).filter((userId): userId is string => !!userId)));
    let liveChecks = 0;

    for (const userId of userIds) {
      const access = await resolvePremiumAccess(serviceClient, userId);
      if (access.entitlement?.source === 'live') {
        liveChecks++;
      }
      if (!access.hasPremiumAccess && access.entitlement?.source === 'live') {
        await disableUserAutopilot(serviceClient, userId);
      }
    }

    const { data: enqueuedCount, error: enqueueError } = await serviceClient.rpc(
      'enqueue_due_auto_generation_runs_v2',
      {
        p_now: nowIso,
        p_limit: limit,
      },
    );

    if (enqueueError) {
      console.error('[enqueue-auto-generation-runs-v3] enqueue failed:', enqueueError);
      return errorResponse(500, 'Failed to enqueue auto-generation runs');
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_users: userIds.length,
        live_checks: liveChecks,
        enqueued_runs: enqueuedCount ?? 0,
        now: nowIso,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[enqueue-auto-generation-runs-v3] fatal error:', error);
    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});

function errorResponse(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
