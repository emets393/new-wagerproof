// =============================================================================
// Send Agent Pick Ready Notification
// Edge Function: validates a generation run, pushes to the user's registered
// devices, and records an audit entry.
//
// Auth: verify_jwt = false, requires Bearer <SUPABASE_SERVICE_ROLE_KEY>.
// Called internally by the V2 worker after a successful auto-generation.
//
// THREE transports, picked per token shape (see `classifyToken`) — the column
// is called `expo_push_token` for historical reasons but holds whatever the
// writing client had:
//   - `ExponentPushToken[…]`  → Expo Push API   (deprecated RN app)
//   - 64-hex, platform != android → APNs HTTP/2 (native iOS, raw device token)
//   - anything else           → FCM v1          (native Android registration token)
// A bare FCM/APNs token posted to Expo is rejected, which is why the native
// apps never received this notification before. See ticket #051 and
// .claude/docs/agents/11_PUSH_NOTIFICATIONS.md.
//
// Required secrets (a transport whose secrets are missing fails its tokens and
// is reported in the audit row — it never throws and never blocks the others):
//   APNs: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8 PEM), APNS_BUNDLE_ID,
//         APNS_ENV ("production" | "sandbox", default production)
//   FCM : FCM_SERVICE_ACCOUNT_JSON (the Firebase service-account JSON, verbatim)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// Android 8+ drops a notification whose channel does not exist on-device. Only
// two channels are ever created by the native app: `wagerproof_updates` (built
// at process launch in WagerproofApplication.onCreate and declared as
// `default_notification_channel_id` in AndroidManifest.xml) and
// `agent_generation` (created lazily, local manual-run banners only). Remote
// pushes must therefore use `wagerproof_updates`.
const ANDROID_CHANNEL_ID = 'wagerproof_updates';
// The deprecated RN app creates its own `agent-picks` channel via
// expo-notifications, so the Expo branch keeps addressing that one.
const EXPO_CHANNEL_ID = 'agent-picks';

// Deep-link host understood by DeepLinkRoute/RootRouter on Android and by the
// RN/iOS routers. Unknown values fall back to the feed, so send it explicitly.
const DEEP_LINK_ROUTE = 'agents';

interface PushTokenRow {
  id: string;
  expo_push_token: string;
  platform: string | null;
}

type Transport = 'expo' | 'apns' | 'fcm';

interface SendOutcome {
  tokenId: string;
  transport: Transport;
  ok: boolean;
  /** Token is permanently dead (unregistered / wrong app) — soft-disable it. */
  deactivate: boolean;
  error?: string;
}

interface PushContent {
  title: string;
  body: string;
  agentId: string;
  runId: string;
}

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

    const content: PushContent = {
      title: `${agentEmoji} ${agentName}'s picks are ready!`,
      body: `${picksCount} new pick${picksCount === 1 ? '' : 's'} just dropped. Tap to view.`,
      agentId: run.avatar_id,
      runId: run.id,
    };

    // -------------------------------------------------------------------------
    // 8. Fan Out Per Transport
    // -------------------------------------------------------------------------
    const rows = tokens as PushTokenRow[];
    const buckets: Record<Transport, PushTokenRow[]> = { expo: [], apns: [], fcm: [] };
    for (const row of rows) {
      buckets[classifyToken(row.expo_push_token, row.platform)].push(row);
    }
    console.log(
      `[push-notify] Run ${run_id} tokens: expo=${buckets.expo.length} ` +
      `apns=${buckets.apns.length} fcm=${buckets.fcm.length}`
    );

    // Transports are independent: one misconfigured provider must not stop the
    // others from delivering, so each returns outcomes instead of throwing.
    const [expoOutcomes, apnsOutcomes, fcmOutcomes] = await Promise.all([
      sendViaExpo(buckets.expo, content),
      sendViaApns(buckets.apns, content),
      sendViaFcm(buckets.fcm, content),
    ]);
    const outcomes = [...expoOutcomes, ...apnsOutcomes, ...fcmOutcomes];

    const tokensSucceeded = outcomes.filter((o) => o.ok).length;
    const tokensFailed = outcomes.length - tokensSucceeded;
    const tokensToDeactivate = outcomes.filter((o) => o.deactivate).map((o) => o.tokenId);

    // -------------------------------------------------------------------------
    // 9. Deactivate Invalid Tokens
    // -------------------------------------------------------------------------
    if (tokensToDeactivate.length > 0) {
      console.log(`[push-notify] Deactivating ${tokensToDeactivate.length} dead token(s)`);
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
      // Column predates the multi-transport split; it now holds the per-token
      // outcome list for every provider.
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

// =============================================================================
// Transport selection
// =============================================================================

/**
 * Expo wraps its tokens in a recognizable envelope; APNs device tokens are
 * exactly 64 hex chars; FCM registration tokens are long and contain `:` or
 * `-`. `platform` is only used to break the (theoretical) tie on a 64-hex
 * Android token — the writer sets it, the shape sniffing is the fallback.
 */
function classifyToken(token: string, platform: string | null): Transport {
  const trimmed = token.trim();
  if (/^Expo(nent)?PushToken\[/i.test(trimmed)) return 'expo';
  if (platform !== 'android' && /^[0-9a-f]{64}$/i.test(trimmed)) return 'apns';
  return 'fcm';
}

// =============================================================================
// Expo transport (deprecated RN app)
// =============================================================================

async function sendViaExpo(tokens: PushTokenRow[], content: PushContent): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default' as const,
    title: content.title,
    body: content.body,
    channelId: EXPO_CHANNEL_ID,
    data: {
      type: 'auto_pick_ready',
      agent_id: content.agentId,
      run_id: content.runId,
      route: DEEP_LINK_ROUTE,
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[push-notify] Expo API error: ${response.status} ${errText.slice(0, 300)}`);
      return tokens.map((t) => failure(t, 'expo', `Expo API ${response.status}: ${errText.slice(0, 200)}`));
    }

    const result = await response.json();
    const tickets = result.data || [];
    return tokens.map((t, i) => {
      const ticket = tickets[i];
      if (ticket?.status === 'ok') return success(t, 'expo');
      const errorType = ticket?.details?.error;
      return {
        tokenId: t.id,
        transport: 'expo' as const,
        ok: false,
        deactivate: errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials',
        error: errorType || ticket?.message || 'unknown_expo_error',
      };
    });
  } catch (fetchErr) {
    console.error(`[push-notify] Expo fetch error:`, (fetchErr as Error).message);
    return tokens.map((t) => failure(t, 'expo', (fetchErr as Error).message));
  }
}

// =============================================================================
// APNs transport (native iOS — raw hex device tokens)
// =============================================================================

async function sendViaApns(tokens: PushTokenRow[], content: PushContent): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const keyId = Deno.env.get('APNS_KEY_ID') ?? '';
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY') ?? '';
  const topic = Deno.env.get('APNS_BUNDLE_ID') ?? '';
  const host = (Deno.env.get('APNS_ENV') ?? 'production') === 'sandbox'
    ? 'api.sandbox.push.apple.com'
    : 'api.push.apple.com';

  if (!keyId || !teamId || !privateKey || !topic) {
    console.error('[push-notify] APNs secrets missing — skipping APNs tokens');
    return tokens.map((t) => failure(t, 'apns', 'apns_not_configured'));
  }

  let jwt: string;
  try {
    jwt = await signJwt(
      { alg: 'ES256', kid: keyId },
      { iss: teamId, iat: Math.floor(Date.now() / 1000) },
      privateKey,
      'ES256'
    );
  } catch (err) {
    console.error('[push-notify] APNs JWT signing failed:', (err as Error).message);
    return tokens.map((t) => failure(t, 'apns', `apns_jwt_error: ${(err as Error).message}`));
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title: content.title, body: content.body },
      sound: 'default',
      'thread-id': `agent-generation-${content.agentId}`,
    },
    type: 'auto_pick_ready',
    agent_id: content.agentId,
    run_id: content.runId,
    route: DEEP_LINK_ROUTE,
  });

  return await Promise.all(tokens.map(async (t) => {
    try {
      const response = await fetch(`https://${host}/3/device/${t.expo_push_token.trim()}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          // One live banner per run: a retry replaces rather than stacks.
          'apns-collapse-id': content.runId.slice(0, 64),
          'content-type': 'application/json',
        },
        body: payload,
      });

      if (response.ok) {
        await response.body?.cancel();
        return success(t, 'apns');
      }

      const errText = await response.text();
      const reason = safeReason(errText);
      // ONLY 410 Gone (Unregistered) is a dead token. A 400 BadDeviceToken most
      // often means APNS_ENV points at the wrong environment — deactivating on
      // it would silently unsubscribe every healthy iOS device in one run.
      const deactivate = response.status === 410;
      return {
        tokenId: t.id,
        transport: 'apns' as const,
        ok: false,
        deactivate,
        error: `${response.status} ${reason}`,
      };
    } catch (err) {
      return failure(t, 'apns', (err as Error).message);
    }
  }));
}

// =============================================================================
// FCM v1 transport (native Android)
// =============================================================================

async function sendViaFcm(tokens: PushTokenRow[], content: PushContent): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const rawServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';
  if (!rawServiceAccount) {
    console.error('[push-notify] FCM_SERVICE_ACCOUNT_JSON missing — skipping FCM tokens');
    return tokens.map((t) => failure(t, 'fcm', 'fcm_not_configured'));
  }

  let projectId: string;
  let accessToken: string;
  try {
    const serviceAccount = JSON.parse(rawServiceAccount) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    projectId = serviceAccount.project_id;
    accessToken = await googleAccessToken(serviceAccount);
  } catch (err) {
    console.error('[push-notify] FCM auth failed:', (err as Error).message);
    return tokens.map((t) => failure(t, 'fcm', `fcm_auth_error: ${(err as Error).message}`));
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  return await Promise.all(tokens.map(async (t) => {
    // notification + data (not data-only): Play services renders it while the
    // app is backgrounded, and WagerproofMessagingService.onMessageReceived
    // renders it in the foreground. Exactly one banner either way.
    const message = {
      message: {
        token: t.expo_push_token.trim(),
        notification: { title: content.title, body: content.body },
        android: {
          priority: 'HIGH',
          // Collapse repeats of the same run into one banner.
          collapse_key: `agent-picks-${content.agentId}`,
          notification: {
            channel_id: ANDROID_CHANNEL_ID,
            sound: 'default',
          },
        },
        data: {
          type: 'auto_pick_ready',
          agent_id: content.agentId,
          run_id: content.runId,
          // FCM data values must be strings. `route` is only consumed on the
          // FOREGROUND path, where WagerproofMessagingService builds its own
          // ACTION_VIEW PendingIntent. A Play-services-rendered background
          // banner opens the launcher with these as extras and nothing reads
          // them yet — see the Deep-Link Route section of
          // .claude/docs/agents/11_PUSH_NOTIFICATIONS.md.
          route: DEEP_LINK_ROUTE,
        },
      },
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        await response.body?.cancel();
        return success(t, 'fcm');
      }

      const errText = await response.text();
      const status = safeFcmStatus(errText);
      // UNREGISTERED (404) = app uninstalled or token rotated. INVALID_ARGUMENT
      // is NOT auto-deactivated: it is far more often a payload bug than a dead
      // token, and disabling on it would silently unsubscribe real devices.
      const deactivate = response.status === 404 || status === 'UNREGISTERED';
      console.error(`[push-notify] FCM error ${response.status} ${status} for token ${t.id}`);
      return {
        tokenId: t.id,
        transport: 'fcm' as const,
        ok: false,
        deactivate,
        error: `${response.status} ${status}`,
      };
    } catch (err) {
      return failure(t, 'fcm', (err as Error).message);
    }
  }));
}

/** Mint a short-lived OAuth2 access token from the Firebase service account. */
async function googleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    serviceAccount.private_key,
    'RS256'
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`google token ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const json = await response.json();
  if (!json.access_token) throw new Error('google token response had no access_token');
  return json.access_token as string;
}

// =============================================================================
// Crypto helpers (WebCrypto — no third-party JWT dep in the edge runtime)
// =============================================================================

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  pem: string,
  alg: 'ES256' | 'RS256'
): Promise<string> {
  const encoder = new TextEncoder();
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.` +
    `${base64UrlEncode(encoder.encode(JSON.stringify(payload)))}`;

  const keyData = pemToArrayBuffer(pem);
  const algorithm = alg === 'ES256'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const key = await crypto.subtle.importKey('pkcs8', keyData, algorithm, false, ['sign']);

  const signature = await crypto.subtle.sign(
    alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Strip the PEM armour and decode. Secrets pasted into the Supabase dashboard
 * routinely carry literal `\n` instead of real newlines — normalise both.
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// =============================================================================
// Helpers
// =============================================================================

function success(token: PushTokenRow, transport: Transport): SendOutcome {
  return { tokenId: token.id, transport, ok: true, deactivate: false };
}

function failure(token: PushTokenRow, transport: Transport, error: string): SendOutcome {
  return { tokenId: token.id, transport, ok: false, deactivate: false, error };
}

/** APNs error bodies are `{"reason":"BadDeviceToken"}`; empty on some 5xx. */
function safeReason(body: string): string {
  try {
    return (JSON.parse(body).reason as string) || 'unknown';
  } catch {
    return body.slice(0, 100) || 'unknown';
  }
}

/** FCM v1 errors nest the machine-readable code under error.details[].errorCode. */
function safeFcmStatus(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const detail = (parsed.error?.details as Array<Record<string, unknown>> | undefined)
      ?.find((d) => typeof d.errorCode === 'string');
    return (detail?.errorCode as string) || parsed.error?.status || 'unknown';
  } catch {
    return body.slice(0, 100) || 'unknown';
  }
}

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
