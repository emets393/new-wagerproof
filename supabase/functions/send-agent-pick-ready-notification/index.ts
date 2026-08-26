// =============================================================================
// Send Agent Pick Ready Notification
// Edge Function: validates a generation run, pushes to the user's registered
// devices, and records an audit entry.
//
// Auth: verify_jwt = false, requires Bearer <SUPABASE_SERVICE_ROLE_KEY>.
// Called internally by the V2 worker after a successful auto-generation.
//
// Transport lives in ../shared/pushTransport.ts (Expo / APNs HTTP/2 / FCM v1).
// This file is the run-scoped caller: same payload as before the extract.
//
// Required secrets (a transport whose secrets are missing fails its tokens and
// is reported in the audit row — it never throws and never blocks the others):
//   APNs: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8 PEM), APNS_BUNDLE_ID,
//         APNS_ENV ("production" | "sandbox", default production)
//   FCM : FCM_SERVICE_ACCOUNT_JSON (the Firebase service-account JSON, verbatim)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  ANDROID_CHANNEL_ID,
  EXPO_CHANNEL_ID,
  sendPush,
  type PushTokenRow,
} from '../shared/pushTransport.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEP_LINK_ROUTE = 'agents';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // Strict equality broke on 2026-08-26: the Trigger.dev worker holds a
    // validly-signed service_role JWT with a different iat than the env-injected
    // key, so `!==` 401'd every pick-ready push. Accept any Supabase-signed
    // service_role token instead: the role claim sits inside the signed payload
    // (unforgeable without the JWT secret), and PostgREST's signature validation
    // is the authenticity check. Owner-approved change, 2026-08-26.
    if (!serviceKey || !(await isServiceRoleToken(bearerToken, serviceKey))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: 'Missing run_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[push-notify] Processing run_id=${run_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

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

    const { data: prefs } = await supabaseClient
      .from('user_notification_preferences')
      .select('auto_pick_ready')
      .eq('user_id', run.user_id)
      .single();

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

    const { data: tokens, error: tokensError } = await supabaseClient
      .from('user_push_tokens')
      .select('id, expo_push_token, platform')
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

    const { data: agent } = await supabaseClient
      .from('avatar_profiles')
      .select('name, avatar_emoji')
      .eq('id', run.avatar_id)
      .single();

    const agentName = agent?.name || 'Your agent';
    const agentEmoji = agent?.avatar_emoji || '🎯';
    const picksCount = run.picks_generated;

    const rows = tokens as PushTokenRow[];
    console.log(`[push-notify] Run ${run_id} tokens=${rows.length}`);

    const outcomes = await sendPush(rows, {
      title: `${agentEmoji} ${agentName}'s picks are ready!`,
      body: `${picksCount} new pick${picksCount === 1 ? '' : 's'} just dropped. Tap to view.`,
      data: {
        type: 'auto_pick_ready',
        agent_id: run.avatar_id,
        run_id: run.id,
        route: DEEP_LINK_ROUTE,
      },
      collapseId: run.id,
      threadId: `agent-generation-${run.avatar_id}`,
      androidCollapseKey: `agent-picks-${run.avatar_id}`,
      androidChannelId: ANDROID_CHANNEL_ID,
      expoChannelId: EXPO_CHANNEL_ID,
    });

    const tokensSucceeded = outcomes.filter((o) => o.ok).length;
    const tokensFailed = outcomes.length - tokensSucceeded;
    const tokensToDeactivate = outcomes.filter((o) => o.deactivate).map((o) => o.tokenId);

    if (tokensToDeactivate.length > 0) {
      console.log(`[push-notify] Deactivating ${tokensToDeactivate.length} dead token(s)`);
      await supabaseClient
        .from('user_push_tokens')
        .update({ is_active: false })
        .in('id', tokensToDeactivate);
    }

    const finalStatus = tokensFailed === 0
      ? 'sent'
      : tokensSucceeded === 0
        ? 'failed'
        : 'partially_sent';

    const errorMessages = outcomes
      .filter((o) => !o.ok && o.error)
      .map((o) => `${o.transport}: ${o.error}`);

    await recordNotification(supabaseClient, {
      run_id: run.id,
      user_id: run.user_id,
      status: finalStatus,
      tokens_attempted: outcomes.length,
      tokens_succeeded: tokensSucceeded,
      tokens_failed: tokensFailed,
      expo_response: { outcomes },
      error_message: errorMessages.length > 0 ? errorMessages.join(' | ').slice(0, 500) : undefined,
    });

    console.log(`[push-notify] Run ${run_id}: ${finalStatus} (${tokensSucceeded}/${outcomes.length} tokens)`);
    return jsonResponse({ status: finalStatus, tokens_succeeded: tokensSucceeded, tokens_failed: tokensFailed });

  } catch (error) {
    console.error('[push-notify] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

/**
 * True when `token` is a service-role credential for THIS project: either the
 * env-injected key verbatim, or a JWT whose signed payload carries
 * role=service_role and whose signature PostgREST accepts. A forged or
 * anon/user token fails one of the two checks.
 */
async function isServiceRoleToken(token: string, serviceKey: string): Promise<boolean> {
  if (!token) return false;
  if (token === serviceKey) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload?.role !== 'service_role') return false;
    // Signature check: PostgREST returns 401 for any token not signed with the
    // project's JWT secret; the root endpoint reads nothing sensitive.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
