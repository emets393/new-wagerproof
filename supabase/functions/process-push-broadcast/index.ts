// =============================================================================
// process-push-broadcast
// Worker: claim a batch of broadcast recipients, fan out via shared transport,
// update the ledger, deactivate dead tokens. Dual auth like enqueue-v3.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  ANDROID_CHANNEL_ID,
  isRetryableOutcome,
  sendPush,
  type PushTokenRow,
  type SendOutcome,
} from '../shared/pushTransport.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function waitUntil(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(p);
  } else {
    p.catch((e) => console.error('[process-push-broadcast] waitUntil task failed:', e));
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TIME_BUDGET_MS = 50_000;

interface RecipientRow {
  id: string;
  broadcast_id: string;
  user_id: string;
  attempt_count: number;
  max_attempts: number;
}

interface CampaignRow {
  id: string;
  title: string;
  body: string;
  deep_link_route: string;
  extra_data: Record<string, unknown> | null;
  target_platforms: string[] | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Missing Supabase configuration' }, 500);
    }

    const providedSecret = req.headers.get('x-internal-secret') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const secretMatches = !!internalSecret && providedSecret === internalSecret;
    const serviceRoleMatches = bearerToken === serviceKey;
    if (!secretMatches && !serviceRoleMatches) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: { limit?: number; lease_seconds?: number; broadcast_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // cron may post an empty body
    }

    const limit = clamp(body.limit ?? 200, 1, 500);
    const leaseSeconds = clamp(body.lease_seconds ?? 120, 30, 600);
    const workerId = `pb-${crypto.randomUUID()}`;
    const started = Date.now();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let claimedTotal = 0;
    let sentUsers = 0;
    let failedUsers = 0;
    let skippedUsers = 0;

    while (Date.now() - started < TIME_BUDGET_MS) {
      const { data: claimed, error: claimError } = await supabase.rpc(
        'claim_push_broadcast_recipients',
        {
          p_worker_id: workerId,
          p_limit: limit,
          p_lease_seconds: leaseSeconds,
          p_broadcast_id: body.broadcast_id ?? null,
        },
      );

      if (claimError) {
        console.error('[process-push-broadcast] claim failed:', claimError);
        return jsonResponse({ error: 'claim failed', details: claimError.message }, 500);
      }

      const recipients = (claimed || []) as RecipientRow[];
      if (recipients.length === 0) break;

      claimedTotal += recipients.length;
      const stats = await processBatch(supabase, recipients);
      sentUsers += stats.sent;
      failedUsers += stats.failed;
      skippedUsers += stats.skipped;

      if (recipients.length < limit) break;
    }

    await supabase.rpc('finalize_push_broadcasts');

    const remaining = await countRemaining(supabase, body.broadcast_id);
    if (remaining > 0 && Date.now() - started >= TIME_BUDGET_MS) {
      waitUntil(reinvoke(supabaseUrl, serviceKey, internalSecret, body));
    }

    return jsonResponse({
      claimed: claimedTotal,
      sent_users: sentUsers,
      failed_users: failedUsers,
      skipped_users: skippedUsers,
      remaining,
    });
  } catch (error) {
    console.error('[process-push-broadcast] unexpected:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

async function processBatch(
  supabase: ReturnType<typeof createClient>,
  recipients: RecipientRow[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const byBroadcast = new Map<string, RecipientRow[]>();
  for (const row of recipients) {
    const list = byBroadcast.get(row.broadcast_id) ?? [];
    list.push(row);
    byBroadcast.set(row.broadcast_id, list);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [broadcastId, rows] of byBroadcast) {
    const { data: campaign, error: campaignError } = await supabase
      .from('push_broadcasts')
      .select('id, title, body, deep_link_route, extra_data, target_platforms, status')
      .eq('id', broadcastId)
      .single();

    if (campaignError || !campaign || campaign.status === 'canceled') {
      await skipRows(supabase, rows, campaign?.status === 'canceled' ? 'canceled' : 'campaign_missing');
      skipped += rows.length;
      continue;
    }

    const result = await sendCampaignBatch(supabase, campaign as CampaignRow, rows);
    sent += result.sent;
    failed += result.failed;
    skipped += result.skipped;
  }

  return { sent, failed, skipped };
}

async function sendCampaignBatch(
  supabase: ReturnType<typeof createClient>,
  campaign: CampaignRow,
  rows: RecipientRow[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const userIds = rows.map((r) => r.user_id);
  const platforms = campaign.target_platforms?.length ? campaign.target_platforms : ['ios', 'android'];

  const { data: tokenRows } = await supabase
    .from('user_push_tokens')
    .select('id, user_id, expo_push_token, platform, apns_env')
    .in('user_id', userIds)
    .eq('is_active', true)
    .in('platform', platforms);

  const tokens = (tokenRows || []) as Array<PushTokenRow & { user_id: string }>;
  const tokensByUser = new Map<string, typeof tokens>();
  for (const token of tokens) {
    const list = tokensByUser.get(token.user_id) ?? [];
    list.push(token);
    tokensByUser.set(token.user_id, list);
  }

  const { data: prefRows } = await supabase
    .from('user_notification_preferences')
    .select('user_id, broadcast')
    .in('user_id', userIds);

  const optedOut = new Set(
    (prefRows || [])
      .filter((p: { user_id: string; broadcast: boolean | null }) => p.broadcast === false)
      .map((p: { user_id: string }) => p.user_id),
  );

  const skipUpdates: Array<{ id: string; reason: string }> = [];
  const sendable: RecipientRow[] = [];
  const sendableTokens: Array<PushTokenRow & { user_id: string }> = [];

  for (const row of rows) {
    if (optedOut.has(row.user_id)) {
      skipUpdates.push({ id: row.id, reason: 'preference_disabled' });
      continue;
    }
    const userTokens = tokensByUser.get(row.user_id) ?? [];
    if (userTokens.length === 0) {
      skipUpdates.push({ id: row.id, reason: 'no_active_tokens' });
      continue;
    }
    sendable.push(row);
    sendableTokens.push(...userTokens);
  }

  if (skipUpdates.length > 0) {
    for (const group of groupBy(skipUpdates, (s) => s.reason)) {
      await supabase
        .from('push_broadcast_recipients')
        .update({
          status: 'skipped',
          skip_reason: group[0].reason,
          lease_owner: null,
          lease_expires_at: null,
        })
        .in('id', group.map((g) => g.id));
    }
  }

  if (sendable.length === 0) {
    return { sent: 0, failed: 0, skipped: skipUpdates.length };
  }

  const extra = (campaign.extra_data || {}) as Record<string, unknown>;
  const extraStrings: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    extraStrings[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  const outcomes = await sendPush(sendableTokens, {
    title: campaign.title,
    body: campaign.body,
    data: {
      type: 'admin_broadcast',
      broadcast_id: campaign.id,
      route: campaign.deep_link_route || 'feed',
      ...extraStrings,
    },
    collapseId: campaign.id,
    threadId: `broadcast-${campaign.id}`,
    androidCollapseKey: `broadcast-${campaign.id}`,
    androidChannelId: ANDROID_CHANNEL_ID,
  }, {
    apnsConcurrency: 20,
    fcmConcurrency: 20,
    expoChunkSize: 100,
  });

  const outcomeByToken = new Map(outcomes.map((o) => [o.tokenId, o]));
  const deactivateIds = outcomes.filter((o) => o.deactivate).map((o) => o.tokenId);

  let sent = 0;
  let failed = 0;

  for (const row of sendable) {
    const userTokens = tokensByUser.get(row.user_id) ?? [];
    const userOutcomes: SendOutcome[] = userTokens
      .map((t) => outcomeByToken.get(t.id))
      .filter((o): o is SendOutcome => !!o);
    const succeeded = userOutcomes.filter((o) => o.ok).length;
    const failedCount = userOutcomes.length - succeeded;
    const retryable = userOutcomes.some(isRetryableOutcome) && succeeded === 0;
    const exhausted = row.attempt_count >= row.max_attempts;

    let status: string;
    if (succeeded > 0) {
      status = 'sent';
      sent += 1;
    } else if (retryable && !exhausted) {
      status = 'failed_retryable';
      failed += 1;
    } else {
      status = 'failed';
      failed += 1;
    }

    const backoffS = Math.min(600, 4 ** Math.max(row.attempt_count, 1));
    await supabase
      .from('push_broadcast_recipients')
      .update({
        status,
        skip_reason: status === 'sent' ? null : (userOutcomes.find((o) => !o.ok)?.error || 'send_failed'),
        tokens_attempted: userOutcomes.length,
        tokens_succeeded: succeeded,
        tokens_failed: failedCount,
        provider_response: { outcomes: userOutcomes },
        lease_owner: null,
        lease_expires_at: null,
        next_attempt_at: status === 'failed_retryable'
          ? new Date(Date.now() + backoffS * 1000).toISOString()
          : new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  if (deactivateIds.length > 0) {
    await supabase
      .from('user_push_tokens')
      .update({ is_active: false })
      .in('id', deactivateIds);
  }

  return { sent, failed, skipped: skipUpdates.length };
}

async function skipRows(
  supabase: ReturnType<typeof createClient>,
  rows: Array<{ id: string }>,
  reason: string,
) {
  if (rows.length === 0) return;
  await supabase
    .from('push_broadcast_recipients')
    .update({
      status: 'skipped',
      skip_reason: reason,
      lease_owner: null,
      lease_expires_at: null,
    })
    .in('id', rows.map((r) => r.id));
}

async function countRemaining(
  supabase: ReturnType<typeof createClient>,
  broadcastId?: string,
): Promise<number> {
  let query = supabase
    .from('push_broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'failed_retryable']);
  if (broadcastId) query = query.eq('broadcast_id', broadcastId);
  const { count } = await query;
  return count ?? 0;
}

function reinvoke(
  supabaseUrl: string,
  serviceKey: string,
  internalSecret: string,
  body: { limit?: number; lease_seconds?: number; broadcast_id?: string },
): Promise<unknown> {
  return fetch(`${supabaseUrl}/functions/v1/process-push-broadcast`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'x-internal-secret': internalSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      console.error('[process-push-broadcast] reinvoke failed', res.status, await res.text());
    }
  });
}

function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return [...map.values()];
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
