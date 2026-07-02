// =============================================================================
// Trigger Run Status
// Server-side proxy for polling a Trigger.dev run's live status + metadata.
//
// WHY THIS EXISTS: the native client cannot read the run directly. Trigger.dev's
// run-retrieve API rejects hand-rolled "public access token" JWTs (verified:
// every HMAC-signed variant returns 401 "Invalid Public Access Token" — those
// tokens must be minted by Trigger's own SDK). So the app instead calls THIS
// function with the user's Supabase JWT; we fetch the run with the TRIGGER
// SECRET KEY (which works) and return just the fields the client renders. This
// is what powers the live turn/tool-call progress during a generation.
//
// Ownership is enforced: the run must belong to one of the caller's agents.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRIGGER_API_URL = 'https://api.trigger.dev';

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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON in request body');
    }

    const runId = body.run_id;
    if (!runId || typeof runId !== 'string') {
      return errorResponse(400, 'Missing or invalid run_id');
    }

    // Ownership: the run must map to a ledger row owned by the caller. Prevents a
    // signed-in user from reading another user's run metadata (avatar id, picks).
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: ledger, error: ledgerError } = await serviceClient
      .from('agent_generation_runs')
      .select('id, user_id')
      .eq('trigger_run_id', runId)
      .maybeSingle();
    if (ledgerError) {
      console.error('[trigger-run-status] ledger lookup error:', ledgerError);
      return errorResponse(500, 'Failed to verify run ownership');
    }
    if (!ledger) return errorResponse(404, 'Run not found');
    if (ledger.user_id !== userId) return errorResponse(403, 'Not authorized for this run');

    const triggerResponse = await fetch(`${TRIGGER_API_URL}/api/v3/runs/${runId}`, {
      headers: { Authorization: `Bearer ${triggerSecretKey}` },
    });
    if (!triggerResponse.ok) {
      const text = await triggerResponse.text().catch(() => '');
      console.error('[trigger-run-status] trigger fetch failed:', triggerResponse.status, text.slice(0, 200));
      return errorResponse(502, `Trigger.dev status request failed (${triggerResponse.status})`);
    }

    const run = await triggerResponse.json();
    // Return only what the client renders (the run object is large).
    return new Response(
      JSON.stringify({
        id: run.id,
        status: run.status,
        metadata: run.metadata ?? {},
        updatedAt: run.updatedAt ?? null,
        startedAt: run.startedAt ?? null,
        finishedAt: run.finishedAt ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[trigger-run-status] error:', err);
    return errorResponse(500, 'Internal error');
  }
});

function decodeUserId(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]));
    if (!payload.sub || payload.role === 'anon' || payload.role === 'service_role') return null;
    return payload.sub;
  } catch (e) {
    console.error('[trigger-run-status] JWT decode failed:', e);
    return null;
  }
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(base64);
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
