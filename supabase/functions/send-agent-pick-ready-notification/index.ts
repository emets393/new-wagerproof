// =============================================================================
// Send Agent Pick Ready Notification
// Edge Function: validates a generation run, sends Expo push notifications
// to the user's registered devices, and records an audit entry.
//
// Auth: verify_jwt = false, requires Bearer <SUPABASE_SERVICE_ROLE_KEY>.
// Called internally by the V2 worker after a successful auto-generation.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Validate Auth — service role key required
    // -------------------------------------------------------------------------
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!serviceKey || bearerToken !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Parse Input
    // -------------------------------------------------------------------------
    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: 'Missing run_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[push-notify] Processing run_id=${run_id}`);

    // -------------------------------------------------------------------------
    // 3. Initialize Supabase Client
    // -------------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // -------------------------------------------------------------------------
    // 4. Validate Run
    // -------------------------------------------------------------------------
    const { data: run, error: runError } = await supabaseClient
      .from('agent_generation_runs')
      .select('id, user_id, avatar_id, status, generation_type, picks_generated')
      .eq('id', run_id)
      .single();

    if (runError || !run) {
      console.error(`[push-notify] Run not found: ${run_id}`, runError);
      return jsonResponse({ status: 'error', message: 'Run not found' }, 404);
    }

    if (run.status !== 'succeeded') {
      console.log(`[push-notify] Run ${run_id} status=${run.status}, skipping`);
      return jsonResponse({ status: 'skipped', reason: 'run_not_succeeded' });
    }

    if (run.generation_type !== 'auto') {
      console.log(`[push-notify] Run ${run_id} type=${run.generation_type}, skipping`);
      return jsonResponse({ status: 'skipped', reason: 'not_auto_generation' });
    }

    if (!run.picks_generated || run.picks_generated <= 0) {
      console.log(`[push-notify] Run ${run_id} picks=${run.picks_generated}, skipping`);
      return jsonResponse({ status: 'skipped', reason: 'no_picks_generated' });
    }

    // -------------------------------------------------------------------------
    // 5. Check User Notification Preference
    // -------------------------------------------------------------------------
    const { data: prefs } = await supabaseClient
      .from('user_notification_preferences')
      .select('auto_pick_ready')
      .eq('user_id', run.user_id)
      .single();

    // No row → default true. Explicit false → skip.
    if (prefs && prefs.auto_pick_ready === false) {
      console.log(`[push-notify] User ${run.user_id} has auto_pick_ready=false, skipping`);
      await recordNotification(supabaseClient, {
        run_id: run.id,
        user_id: run.user_id,
        status: 'skipped',
        skip_reason: 'preference_disabled',
      });
      return jsonResponse({ status: 'skipped', reason: 'preference_disabled' });
    }

    // -------------------------------------------------------------------------
    // 6. Load Active Push Tokens
    // -------------------------------------------------------------------------
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('user_push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', run.user_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error(`[push-notify] Error fetching tokens:`, tokensError);
      await recordNotification(supabaseClient, {
        run_id: run.id,
        user_id: run.user_id,
        status: 'failed',
        error_message: `Token fetch error: ${tokensError.message}`,
      });
      return jsonResponse({ status: 'failed', reason: 'token_fetch_error' });
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[push-notify] No active tokens for user ${run.user_id}`);
      await recordNotification(supabaseClient, {
        run_id: run.id,
        user_id: run.user_id,
        status: 'skipped',
        skip_reason: 'no_active_tokens',
      });
      return jsonResponse({ status: 'skipped', reason: 'no_active_tokens' });
    }

    // -------------------------------------------------------------------------
    // 7. Fetch Agent Name & Emoji
    // -------------------------------------------------------------------------
    const { data: agent } = await supabaseClient
      .from('avatar_profiles')
      .select('name, avatar_emoji')
      .eq('id', run.avatar_id)
      .single();

    const agentName = agent?.name || 'Your agent';
    const agentEmoji = agent?.avatar_emoji || '🎯';
    const picksCount = run.picks_generated;

    // -------------------------------------------------------------------------
    // 8. Build & Send Expo Push Messages
    // -------------------------------------------------------------------------
    const messages = tokens.map((t: { id: string; expo_push_token: string }) => ({
      to: t.expo_push_token,
      sound: 'default' as const,
      title: `${agentEmoji} ${agentName}'s picks are ready!`,
      body: `${picksCount} new pick${picksCount === 1 ? '' : 's'} just dropped. Tap to view.`,
      channelId: 'agent-picks',
      data: {
        type: 'auto_pick_ready',
        agent_id: run.avatar_id,
        run_id: run.id,
      },
    }));

    let expoResponse: unknown = null;
    let tokensSucceeded = 0;
    let tokensFailed = 0;
    const tokensToDeactivate: string[] = [];

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[push-notify] Expo API error: ${response.status} ${errText.slice(0, 300)}`);
        await recordNotification(supabaseClient, {
          run_id: run.id,
          user_id: run.user_id,
          status: 'failed',
          tokens_attempted: tokens.length,
          error_message: `Expo API ${response.status}: ${errText.slice(0, 500)}`,
        });
        return jsonResponse({ status: 'failed', reason: 'expo_api_error' });
      }

      const result = await response.json();
      expoResponse = result;

      // Process tickets
      const tickets = result.data || [];
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok') {
          tokensSucceeded++;
        } else {
          tokensFailed++;
          // Soft-disable invalid tokens
          const errorType = ticket.details?.error;
          if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
            tokensToDeactivate.push(tokens[i].id);
            console.log(`[push-notify] Deactivating token ${tokens[i].id}: ${errorType}`);
          }
        }
      }
    } catch (fetchErr) {
      console.error(`[push-notify] Expo fetch error:`, (fetchErr as Error).message);
      await recordNotification(supabaseClient, {
        run_id: run.id,
        user_id: run.user_id,
        status: 'failed',
        tokens_attempted: tokens.length,
        error_message: (fetchErr as Error).message,
      });
      return jsonResponse({ status: 'failed', reason: 'expo_fetch_error' });
    }

    // -------------------------------------------------------------------------
    // 9. Deactivate Invalid Tokens
    // -------------------------------------------------------------------------
    if (tokensToDeactivate.length > 0) {
      await supabaseClient
        .from('user_push_tokens')
        .update({ is_active: false })
        .in('id', tokensToDeactivate);
    }

    // -------------------------------------------------------------------------
    // 10. Record Audit
    // -------------------------------------------------------------------------
    const finalStatus = tokensFailed === 0
      ? 'sent'
      : tokensSucceeded === 0
        ? 'failed'
        : 'partially_sent';

    await recordNotification(supabaseClient, {
      run_id: run.id,
      user_id: run.user_id,
      status: finalStatus,
      tokens_attempted: tokens.length,
      tokens_succeeded: tokensSucceeded,
      tokens_failed: tokensFailed,
      expo_response: expoResponse,
    });

    console.log(`[push-notify] Run ${run_id}: ${finalStatus} (${tokensSucceeded}/${tokens.length} tokens)`);
    return jsonResponse({ status: finalStatus, tokens_succeeded: tokensSucceeded, tokens_failed: tokensFailed });

  } catch (error) {
    console.error('[push-notify] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface NotificationRecord {
  run_id: string;
  user_id: string;
  status: string;
  skip_reason?: string;
  tokens_attempted?: number;
  tokens_succeeded?: number;
  tokens_failed?: number;
  expo_response?: unknown;
  error_message?: string;
}

async function recordNotification(
  client: ReturnType<typeof createClient>,
  record: NotificationRecord
) {
  try {
    const { error } = await client
      .from('sent_push_notifications')
      .insert({
        run_id: record.run_id,
        user_id: record.user_id,
        notification_type: 'auto_pick_ready',
        status: record.status,
        skip_reason: record.skip_reason || null,
        tokens_attempted: record.tokens_attempted || 0,
        tokens_succeeded: record.tokens_succeeded || 0,
        tokens_failed: record.tokens_failed || 0,
        expo_response: record.expo_response || null,
        error_message: record.error_message || null,
      });

    if (error) {
      // Check for unique constraint violation (dedupe hit)
      if (error.code === '23505') {
        console.log(`[push-notify] Dedupe hit for run=${record.run_id}, notification already sent`);
        return;
      }
      console.error(`[push-notify] Failed to record notification:`, error);
    }
  } catch (err) {
    console.error(`[push-notify] recordNotification error:`, err);
  }
}
