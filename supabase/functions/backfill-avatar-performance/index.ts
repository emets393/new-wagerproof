// =============================================================================
// Backfill Avatar Performance
// Triggers a full recalculation of performance cache for all active avatars.
// Intended for one-time or on-demand use after formula fixes or schema changes.
//
// Auth: verify_jwt = false, requires x-internal-secret header (admin only).
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth: require internal secret or service_role JWT
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    const providedSecret = req.headers.get('x-internal-secret');
    const authHeader = req.headers.get('authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const hasInternalSecret = internalSecret && providedSecret === internalSecret;
    const hasServiceRole = serviceRoleKey && authHeader.includes(serviceRoleKey);

    if (!hasInternalSecret && !hasServiceRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse options from request body
    let batchSize = 50;
    let dryRun = false;

    try {
      const body = await req.json();
      if (body.batch_size) batchSize = Math.min(Math.max(body.batch_size, 1), 200);
      if (body.dry_run !== undefined) dryRun = body.dry_run;
    } catch {
      // No body or invalid JSON — use defaults
    }

    console.log(`[backfill] Starting backfill: batch_size=${batchSize}, dry_run=${dryRun}`);

    // Call the SQL backfill function
    const { data, error } = await supabase.rpc('backfill_avatar_performance', {
      p_batch_size: batchSize,
      p_dry_run: dryRun,
    });

    if (error) {
      console.error('[backfill] RPC error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = Date.now() - startTime;
    const result = data as {
      processed: number;
      drifted: number;
      dry_run: boolean;
      drift_details: Array<{
        avatar_id: string;
        old_net_units: number;
        new_net_units: number;
        drift: number;
      }>;
    };

    console.log(`[backfill] Completed in ${duration}ms`);
    console.log(`[backfill] Processed: ${result.processed}, Drifted: ${result.drifted}`);

    if (result.drifted > 0) {
      console.warn(`[backfill] DRIFT DETECTED in ${result.drifted} avatars:`);
      for (const d of result.drift_details) {
        console.warn(`  ${d.avatar_id}: ${d.old_net_units} → ${d.new_net_units} (drift: ${d.drift})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[backfill] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
