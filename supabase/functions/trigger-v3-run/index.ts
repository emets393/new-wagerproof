// =============================================================================
// Trigger V3 Run
// Client-facing gateway for the native iOS Trigger.dev V3 path.
// Authenticates the user, creates/reuses an agent_generation_runs ledger row,
// triggers the Trigger.dev task, and returns a run-scoped public access token.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRIGGER_API_URL = 'https://api.trigger.dev';
const TASK_ID = 'generate-v3-picks';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse(401, 'Missing authorization header');

    const userId = decodeUserId(authHeader);
    if (!userId) return errorResponse(401, 'Invalid token');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const triggerSecretKey = Deno.env.get('TRIGGER_SECRET_KEY_PROD') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration');
    if (!triggerSecretKey) throw new Error('Missing TRIGGER_SECRET_KEY_PROD');

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON in request body');
    }

    const avatarId = body.avatar_id;
    if (!avatarId || typeof avatarId !== 'string') {
      return errorResponse(400, 'Missing or invalid avatar_id');
    }

    const idempotencyKey = typeof body.idempotency_key === 'string' && body.idempotency_key.length > 0
      ? body.idempotency_key
      : null;
    const dryRun = body.dry_run === true;
    const modelName = typeof body.model_name === 'string' && body.model_name.length > 0
      ? body.model_name
      : null;

    const { hasPremiumAccess } = await resolvePremiumAccess(serviceClient, userId);
    if (!hasPremiumAccess) {
      return errorResponse(403, 'Upgrade to Pro to generate picks for this agent.');
    }

    // In-flight coalesce: if this avatar already has a live run (queued or
    // processing, started in the last ~12 min — the task ceiling is 600s), a
    // second trigger JOINS it instead of enqueueing a duplicate. Prevents the
    // leave-page-and-retap race where two runs write the same slate.
    const inflightCutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString();
    const { data: activeRun } = await serviceClient
      .from('agent_generation_runs')
      .select('id, trigger_run_id, status, created_at')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .eq('engine_version', 'v3_trigger')
      .in('status', ['queued', 'processing'])
      .gte('created_at', inflightCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeRun?.trigger_run_id) {
      console.log(`[trigger-v3-run] coalesced onto in-flight run ${activeRun.trigger_run_id} (ledger ${activeRun.id})`);
      const publicAccessToken = await createTriggerPublicAccessToken(triggerSecretKey, activeRun.trigger_run_id);
      return successResponse({
        ledger_run_id: activeRun.id,
        run_id: activeRun.trigger_run_id,
        public_access_token: publicAccessToken,
        status: 'queued',
        coalesced: true,
      });
    }

    const { data: ledgerRunId, error: enqueueError } = await serviceClient.rpc(
      'enqueue_manual_generation_run_v3_trigger',
      {
        p_user_id: userId,
        p_avatar_id: avatarId,
        p_has_active_entitlement: true,
        p_idempotency_key: idempotencyKey,
        p_dry_run: dryRun,
        p_model_name: modelName,
      },
    );
    if (enqueueError || !ledgerRunId) {
      console.error('[trigger-v3-run] ledger enqueue error:', enqueueError);
      if (enqueueError?.message?.includes('Not authorized')) {
        return errorResponse(403, 'Not authorized to generate picks for this agent');
      }
      if (enqueueError?.message?.includes('limit reached')) {
        return errorResponse(429, 'Daily manual generation limit reached (3 per day)');
      }
      return errorResponse(500, 'Failed to create generation run');
    }

    const { data: ledger, error: ledgerError } = await serviceClient
      .from('agent_generation_runs')
      .select('id, avatar_id, user_id, target_date, generation_type, trigger_run_id, model_name, dry_run')
      .eq('id', ledgerRunId)
      .single();
    if (ledgerError || !ledger) {
      console.error('[trigger-v3-run] ledger lookup error:', ledgerError);
      return errorResponse(500, 'Failed to load generation run');
    }

    if (ledger.trigger_run_id) {
      const publicAccessToken = await createTriggerPublicAccessToken(triggerSecretKey, ledger.trigger_run_id);
      return successResponse({
        ledger_run_id: ledger.id,
        run_id: ledger.trigger_run_id,
        public_access_token: publicAccessToken,
        status: 'queued',
      });
    }

    const triggerResponse = await fetch(`${TRIGGER_API_URL}/api/v1/tasks/${TASK_ID}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${triggerSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          ledgerRunId: ledger.id,
          avatarId: ledger.avatar_id,
          targetDate: ledger.target_date,
          generationType: ledger.generation_type,
          dryRun: ledger.dry_run,
          modelName: ledger.model_name,
        },
        options: {
          idempotencyKey: `manual:${ledger.id}`,
          ttl: '2h',
          tags: [`avatar:${ledger.avatar_id}`, `user:${ledger.user_id}`, 'type:manual'],
          metadata: {
            phase: 'queued',
            avatarId: ledger.avatar_id,
            ledgerRunId: ledger.id,
            targetDate: ledger.target_date,
          },
          maxDuration: 600,
          machine: 'small-1x',
        },
      }),
    });

    if (!triggerResponse.ok) {
      const msg = await triggerResponse.text();
      console.error('[trigger-v3-run] Trigger.dev error:', triggerResponse.status, msg);
      await serviceClient
        .from('agent_generation_runs')
        .update({
          status: 'failed_terminal',
          completed_at: new Date().toISOString(),
          error_code: 'TRIGGER_START_FAILED',
          error_message: msg.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ledger.id);
      return errorResponse(502, 'Failed to start Trigger.dev run');
    }

    const triggerJson = await triggerResponse.json() as { id?: string };
    const runId = triggerJson.id;
    if (!runId) return errorResponse(502, 'Trigger.dev response missing run id');

    await serviceClient
      .from('agent_generation_runs')
      .update({ trigger_run_id: runId, updated_at: new Date().toISOString() })
      .eq('id', ledger.id);

    const headerToken = triggerResponse.headers.get('x-trigger-jwt');
    const claimsHeader = triggerResponse.headers.get('x-trigger-jwt-claims');
    const publicAccessToken = headerToken || await createTriggerPublicAccessToken(
      triggerSecretKey,
      runId,
      claimsHeader ? JSON.parse(claimsHeader) : undefined,
    );

    console.log(`[trigger-v3-run] Triggered ${runId} for ledger ${ledger.id}`);
    return successResponse({
      ledger_run_id: ledger.id,
      run_id: runId,
      public_access_token: publicAccessToken,
      status: 'queued',
    });
  } catch (error) {
    console.error('[trigger-v3-run] Fatal error:', error);
    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});

function decodeUserId(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]));
    if (!payload.sub || payload.role === 'anon' || payload.role === 'service_role') return null;
    return payload.sub;
  } catch (e) {
    console.error('[trigger-v3-run] JWT decode failed:', e);
    return null;
  }
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(base64);
}

async function createTriggerPublicAccessToken(
  secretKey: string,
  runId: string,
  claims: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iss: 'https://id.trigger.dev',
    aud: 'https://api.trigger.dev',
    iat: now,
    exp: now + 2 * 60 * 60,
    scopes: [`read:runs:${runId}`],
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const unsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncodeBytes(new Uint8Array(sig))}`;
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function successResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string, details?: unknown) {
  return new Response(JSON.stringify({ success: false, error: message, details }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
