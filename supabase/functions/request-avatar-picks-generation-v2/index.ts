// =============================================================================
// DEPRECATED 2026-08-01 — legacy V2 generation entry point. Do not extend.
//
// Superseded by the V3 Trigger.dev engine (agents-v3/trigger/generateV3Picks.ts,
// task 'generate-v3-picks'), which shipping clients reach via the 'trigger-v3-run'
// edge function. Intentionally NOT migrated to gpt-5.6-luna. Retained on disk
// pending prod cron verification; nothing here is being deleted.
//
// Its only remaining caller is the deprecated React Native app
// (wagerproof-mobile/services/agentPicksService.ts:181). It enqueues onto the V2
// engine (:81 enqueue_manual_generation_run_v3 — V2 despite the name, :108
// dispatch_generation_workers_v2), so it cannot be retired before
// process-agent-generation-job-v2 and the 'v2-dispatch-workers' cron are verified in prod.
// =============================================================================

// =============================================================================
// Request Avatar Picks Generation V2
// Client-facing Edge Function for manual generation requests.
// Validates JWT, checks entitlement/ownership via SQL, enqueues a manual run.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Authenticate user from JWT
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Decode user ID from JWT (gateway already verified signature via verify_jwt=true)
    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    try {
      const payloadB64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadB64));
      userId = payload.sub;
      if (!userId) throw new Error('No sub claim');
      // Reject non-user JWTs (anon/service_role keys have role claim but no user sub)
      if (payload.role === 'anon' || payload.role === 'service_role') {
        return errorResponse(401, 'User JWT required');
      }
    } catch (e) {
      console.error('[request-generation-v2] JWT decode failed:', e);
      return errorResponse(401, 'Invalid token');
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // -------------------------------------------------------------------------
    // 2. Parse request body
    // -------------------------------------------------------------------------
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON in request body');
    }
    const avatarId = body.avatar_id;
    const idempotencyKey = body.idempotency_key || null;

    if (!avatarId || typeof avatarId !== 'string') {
      return errorResponse(400, 'Missing or invalid avatar_id');
    }

    const { hasPremiumAccess } = await resolvePremiumAccess(serviceClient, userId);
    if (!hasPremiumAccess) {
      return errorResponse(403, 'Upgrade to Pro to generate picks for this agent.');
    }

    // -------------------------------------------------------------------------
    // 3. Enqueue via SQL (ownership checked in DB function; entitlement verified above)
    // -------------------------------------------------------------------------
    const { data: runId, error: enqueueError } = await serviceClient.rpc(
      'enqueue_manual_generation_run_v3',
      {
        p_user_id: userId,
        p_avatar_id: avatarId,
        p_has_active_entitlement: true,
        p_idempotency_key: idempotencyKey,
      }
    );

    if (enqueueError) {
      console.error('[request-generation-v2] Enqueue error:', enqueueError);

      // Map SQL error codes to HTTP status
      if (enqueueError.message?.includes('Not authorized')) {
        return errorResponse(403, 'Not authorized to generate picks for this agent');
      }
      if (enqueueError.message?.includes('limit reached')) {
        return errorResponse(429, 'Daily manual generation limit reached (3 per day)');
      }

      return errorResponse(500, 'Failed to enqueue generation request');
    }

    // -------------------------------------------------------------------------
    // 4. Dispatch a worker immediately (fire-and-forget)
    // -------------------------------------------------------------------------
    void (async () => {
      const { error } = await serviceClient.rpc('dispatch_generation_workers_v2', { p_max_dispatches: 1 });
      if (error) {
        console.warn('[request-generation-v2] Dispatch hint failed (non-fatal):', error.message);
      }
    })();

    // -------------------------------------------------------------------------
    // 5. Return run metadata
    // -------------------------------------------------------------------------
    console.log(`[request-generation-v2] Enqueued run ${runId} for avatar ${avatarId} by user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        status: 'queued',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[request-generation-v2] Fatal error:', error);
    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});

function errorResponse(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
