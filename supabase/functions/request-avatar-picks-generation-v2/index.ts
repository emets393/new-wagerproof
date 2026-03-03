// =============================================================================
// Request Avatar Picks Generation V2
// Client-facing Edge Function for manual generation requests.
// Validates JWT, checks entitlement/ownership via SQL, enqueues a manual run.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // -------------------------------------------------------------------------
    // 3. Enqueue via SQL (entitlement + ownership checked in DB function)
    // -------------------------------------------------------------------------
    const { data: runId, error: enqueueError } = await serviceClient.rpc(
      'enqueue_manual_generation_run_v2',
      {
        p_user_id: userId,
        p_avatar_id: avatarId,
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
    serviceClient.rpc('dispatch_generation_workers_v2', { p_max_dispatches: 1 })
      .then(({ error }) => {
        if (error) console.warn('[request-generation-v2] Dispatch hint failed (non-fatal):', error.message);
      })
      .catch(() => { /* non-fatal: cron will pick it up */ });

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
