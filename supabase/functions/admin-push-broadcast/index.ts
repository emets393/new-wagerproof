// =============================================================================
// admin-push-broadcast
// Gateway: test_send / send_now / schedule / cancel. JWT required + has_role.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  ANDROID_CHANNEL_ID,
  sendPush,
  type PushTokenRow,
} from '../shared/pushTransport.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function waitUntil(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(p);
  } else {
    p.catch((e) => console.error('[admin-push-broadcast] waitUntil task failed:', e));
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_ROUTES = new Set(['feed', 'agents', 'outliers']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Missing Supabase configuration' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const jwt = authHeader.slice('Bearer '.length).trim();

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Pass the JWT explicitly. persistSession is false, so getUser() with no
    // argument has no session to read and 401s even for a valid user token.
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userError || !user) {
      console.error('[admin-push-broadcast] getUser failed:', userError?.message);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (roleError || isAdmin !== true) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const payload = await req.json();
    const action = payload?.action as string | undefined;
    const broadcastId = payload?.broadcast_id as string | undefined;
    if (!action || !broadcastId) {
      return jsonResponse({ error: 'Missing action or broadcast_id' }, 400);
    }

    if (action === 'test_send') {
      return await handleTestSend(userClient, serviceClient(supabaseUrl, serviceKey), user.id, broadcastId);
    }
    if (action === 'send_now') {
      return await handleSendNow(userClient, supabaseUrl, serviceKey, internalSecret, broadcastId);
    }
    if (action === 'schedule') {
      const when = payload?.scheduled_for as string | undefined;
      if (!when) return jsonResponse({ error: 'Missing scheduled_for' }, 400);
      const { data, error } = await userClient.rpc('schedule_push_broadcast', {
        p_broadcast_id: broadcastId,
        p_when: when,
      });
      if (error) return mapRpcError(error);
      return jsonResponse({ success: true, broadcast: data });
    }
    if (action === 'cancel') {
      const { data, error } = await userClient.rpc('cancel_push_broadcast', {
        p_broadcast_id: broadcastId,
      });
      if (error) return mapRpcError(error);
      return jsonResponse({ success: true, broadcast: data });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[admin-push-broadcast] unexpected:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

function serviceClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function handleSendNow(
  userClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  internalSecret: string,
  broadcastId: string,
) {
  const { data, error } = await userClient.rpc('send_push_broadcast_now', {
    p_broadcast_id: broadcastId,
  });
  if (error) return mapRpcError(error);

  waitUntil(
    fetch(`${supabaseUrl}/functions/v1/process-push-broadcast`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'x-internal-secret': internalSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ broadcast_id: broadcastId, limit: 200 }),
    }).then(async (res) => {
      if (!res.ok) {
        console.error('[admin-push-broadcast] worker kickoff failed', res.status, await res.text());
      }
    }),
  );

  return jsonResponse({ success: true, broadcast: data });
}

async function handleTestSend(
  userClient: ReturnType<typeof createClient>,
  svc: ReturnType<typeof createClient>,
  userId: string,
  broadcastId: string,
) {
  const { data: campaign, error: campaignError } = await userClient
    .from('push_broadcasts')
    .select('id, title, body, deep_link_route, extra_data, target_platforms')
    .eq('id', broadcastId)
    .single();

  if (campaignError || !campaign) {
    return jsonResponse({ error: 'Broadcast not found' }, 404);
  }

  const route = ALLOWED_ROUTES.has(campaign.deep_link_route) ? campaign.deep_link_route : 'feed';
  const platforms: string[] = campaign.target_platforms?.length
    ? campaign.target_platforms
    : ['ios', 'android'];

  const { data: tokenRows, error: tokenError } = await svc
    .from('user_push_tokens')
    .select('id, expo_push_token, platform, apns_env')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('platform', platforms);

  if (tokenError) {
    return jsonResponse({ error: tokenError.message }, 500);
  }

  const tokens = (tokenRows || []) as PushTokenRow[];
  if (tokens.length === 0) {
    const result = { ok: false, error: 'no_devices_for_filter', tokens: 0 };
    await userClient.rpc('stamp_push_broadcast_test', {
      p_broadcast_id: broadcastId,
      p_result: result,
    });
    return jsonResponse({ success: false, error: 'no_devices_for_filter', tokens: 0 }, 400);
  }

  const outcomes = await sendPush(tokens, {
    title: campaign.title,
    body: campaign.body,
    data: {
      type: 'admin_broadcast_test',
      broadcast_id: campaign.id,
      route,
    },
    collapseId: `test-${campaign.id}`,
    threadId: `broadcast-test-${campaign.id}`,
    androidCollapseKey: `broadcast-test-${campaign.id}`,
    androidChannelId: ANDROID_CHANNEL_ID,
  });

  const succeeded = outcomes.filter((o) => o.ok).length;
  const result = {
    ok: succeeded > 0,
    tokens: tokens.length,
    tokens_succeeded: succeeded,
    tokens_failed: tokens.length - succeeded,
    outcomes,
  };

  await userClient.rpc('stamp_push_broadcast_test', {
    p_broadcast_id: broadcastId,
    p_result: result,
  });

  return jsonResponse({ success: succeeded > 0, ...result });
}

function mapRpcError(error: { message?: string; code?: string }) {
  const code = error.code || '';
  if (code === '55000') {
    return jsonResponse({ error: error.message || 'Conflict' }, 409);
  }
  if (code === '42501') {
    return jsonResponse({ error: error.message || 'Forbidden' }, 403);
  }
  return jsonResponse({ error: error.message || 'RPC failed' }, 400);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
