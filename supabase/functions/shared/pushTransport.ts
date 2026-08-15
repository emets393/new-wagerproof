// =============================================================================
// Shared Expo / APNs HTTP-2 / FCM v1 push transport.
//
// Imported by send-agent-pick-ready-notification (thin caller) and the
// broadcast worker. Token classification and per-provider deactivation rules
// are the load-bearing contract — see .claude/docs/agents/11_PUSH_NOTIFICATIONS.md.
// =============================================================================

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export const ANDROID_CHANNEL_ID = 'wagerproof_updates';
export const EXPO_CHANNEL_ID = 'agent-picks';

export interface PushTokenRow {
  id: string;
  expo_push_token: string;
  platform: string | null;
  user_id?: string;
  apns_env?: string | null;
}

export type Transport = 'expo' | 'apns' | 'fcm';

export interface SendOutcome {
  tokenId: string;
  transport: Transport;
  ok: boolean;
  /** Token is permanently dead (unregistered / wrong app) — soft-disable it. */
  deactivate: boolean;
  error?: string;
}

export interface PushContent {
  title: string;
  body: string;
  /** FCM requires string values. Also sent as Expo data and APNs custom keys. */
  data: Record<string, string>;
  collapseId?: string;
  threadId?: string;
  androidCollapseKey?: string;
  androidChannelId?: string;
  expoChannelId?: string;
}

export interface SendPushOptions {
  /** Max parallel APNs requests. Unset = unbounded (pick-ready fan-out). */
  apnsConcurrency?: number;
  /** Max parallel FCM requests. Unset = unbounded. */
  fcmConcurrency?: number;
  /** Expo messages per HTTP request. Unset = one request for the whole bucket. */
  expoChunkSize?: number;
}

const APNS_JWT_TTL_S = 50 * 60;
const FCM_TOKEN_TTL_S = 50 * 60;

let cachedApnsJwt: { token: string; exp: number; keyId: string } | null = null;
let cachedFcm: { token: string; projectId: string; exp: number } | null = null;

export function classifyToken(token: string, platform: string | null): Transport {
  const trimmed = token.trim();
  if (/^Expo(nent)?PushToken\[/i.test(trimmed)) return 'expo';
  if (platform !== 'android' && /^[0-9a-f]{64}$/i.test(trimmed)) return 'apns';
  return 'fcm';
}

export async function sendPush(
  tokens: PushTokenRow[],
  content: PushContent,
  options: SendPushOptions = {},
): Promise<SendOutcome[]> {
  const buckets: Record<Transport, PushTokenRow[]> = { expo: [], apns: [], fcm: [] };
  for (const row of tokens) {
    buckets[classifyToken(row.expo_push_token, row.platform)].push(row);
  }

  const [expoOutcomes, apnsOutcomes, fcmOutcomes] = await Promise.all([
    sendViaExpo(buckets.expo, content, options.expoChunkSize),
    sendViaApns(buckets.apns, content, options.apnsConcurrency),
    sendViaFcm(buckets.fcm, content, options.fcmConcurrency),
  ]);
  return [...expoOutcomes, ...apnsOutcomes, ...fcmOutcomes];
}

export function isRetryableOutcome(outcome: SendOutcome): boolean {
  if (outcome.ok || outcome.deactivate) return false;
  const err = (outcome.error || '').toLowerCase();
  return (
    err.includes('429') ||
    err.includes('503') ||
    err.includes('500') ||
    err.includes('timeout') ||
    err.includes('fetch') ||
    err.includes('network')
  );
}

// =============================================================================
// Expo
// =============================================================================

async function sendViaExpo(
  tokens: PushTokenRow[],
  content: PushContent,
  chunkSize?: number,
): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const size = chunkSize && chunkSize > 0 ? chunkSize : tokens.length;
  const chunks: PushTokenRow[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size));
  }

  const nested = await Promise.all(chunks.map((chunk) => sendExpoChunk(chunk, content)));
  return nested.flat();
}

async function sendExpoChunk(tokens: PushTokenRow[], content: PushContent): Promise<SendOutcome[]> {
  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default' as const,
    title: content.title,
    body: content.body,
    channelId: content.expoChannelId || EXPO_CHANNEL_ID,
    data: content.data,
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[push-transport] Expo API error: ${response.status} ${errText.slice(0, 300)}`);
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
    console.error(`[push-transport] Expo fetch error:`, (fetchErr as Error).message);
    return tokens.map((t) => failure(t, 'expo', (fetchErr as Error).message));
  }
}

// =============================================================================
// APNs
// =============================================================================

async function sendViaApns(
  tokens: PushTokenRow[],
  content: PushContent,
  concurrency?: number,
): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const keyId = Deno.env.get('APNS_KEY_ID') ?? '';
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY') ?? '';
  const topic = Deno.env.get('APNS_BUNDLE_ID') ?? '';

  if (!keyId || !teamId || !privateKey || !topic) {
    console.error('[push-transport] APNs secrets missing — skipping APNs tokens');
    return tokens.map((t) => failure(t, 'apns', 'apns_not_configured'));
  }

  let jwt: string;
  try {
    jwt = await apnsJwt(keyId, teamId, privateKey);
  } catch (err) {
    console.error('[push-transport] APNs JWT signing failed:', (err as Error).message);
    return tokens.map((t) => failure(t, 'apns', `apns_jwt_error: ${(err as Error).message}`));
  }

  const aps: Record<string, unknown> = {
    alert: { title: content.title, body: content.body },
    sound: 'default',
  };
  if (content.threadId) aps['thread-id'] = content.threadId;

  const payload = JSON.stringify({
    aps,
    ...content.data,
  });

  const sendOne = async (t: PushTokenRow): Promise<SendOutcome> => {
    const host = apnsHostFor(t);
    try {
      const headers: Record<string, string> = {
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      };
      if (content.collapseId) {
        headers['apns-collapse-id'] = content.collapseId.slice(0, 64);
      }

      const response = await fetch(`https://${host}/3/device/${t.expo_push_token.trim()}`, {
        method: 'POST',
        headers,
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
  };

  if (concurrency && concurrency > 0) {
    return await mapPool(tokens, concurrency, sendOne);
  }
  return await Promise.all(tokens.map(sendOne));
}

function apnsHostFor(token: PushTokenRow): string {
  const env = (token.apns_env || Deno.env.get('APNS_ENV') || 'production').toLowerCase();
  return env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
}

async function apnsJwt(keyId: string, teamId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && cachedApnsJwt.exp > now && cachedApnsJwt.keyId === keyId) {
    return cachedApnsJwt.token;
  }
  const token = await signJwt(
    { alg: 'ES256', kid: keyId },
    { iss: teamId, iat: now },
    privateKey,
    'ES256',
  );
  cachedApnsJwt = { token, exp: now + APNS_JWT_TTL_S, keyId };
  return token;
}

// =============================================================================
// FCM v1
// =============================================================================

async function sendViaFcm(
  tokens: PushTokenRow[],
  content: PushContent,
  concurrency?: number,
): Promise<SendOutcome[]> {
  if (tokens.length === 0) return [];

  const rawServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';
  if (!rawServiceAccount) {
    console.error('[push-transport] FCM_SERVICE_ACCOUNT_JSON missing — skipping FCM tokens');
    return tokens.map((t) => failure(t, 'fcm', 'fcm_not_configured'));
  }

  let projectId: string;
  let accessToken: string;
  try {
    const creds = await fcmAccess(rawServiceAccount);
    projectId = creds.projectId;
    accessToken = creds.token;
  } catch (err) {
    console.error('[push-transport] FCM auth failed:', (err as Error).message);
    return tokens.map((t) => failure(t, 'fcm', `fcm_auth_error: ${(err as Error).message}`));
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const channelId = content.androidChannelId || ANDROID_CHANNEL_ID;
  const collapseKey = content.androidCollapseKey || content.collapseId;

  const sendOne = async (t: PushTokenRow): Promise<SendOutcome> => {
    const android: Record<string, unknown> = {
      priority: 'HIGH',
      notification: {
        channel_id: channelId,
        sound: 'default',
      },
    };
    if (collapseKey) android.collapse_key = collapseKey.slice(0, 64);

    const message = {
      message: {
        token: t.expo_push_token.trim(),
        notification: { title: content.title, body: content.body },
        android,
        data: content.data,
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
      const deactivate = response.status === 404 || status === 'UNREGISTERED';
      console.error(`[push-transport] FCM error ${response.status} ${status} for token ${t.id}`);
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
  };

  if (concurrency && concurrency > 0) {
    return await mapPool(tokens, concurrency, sendOne);
  }
  return await Promise.all(tokens.map(sendOne));
}

async function fcmAccess(rawServiceAccount: string): Promise<{ token: string; projectId: string }> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcm && cachedFcm.exp > now) {
    return { token: cachedFcm.token, projectId: cachedFcm.projectId };
  }
  const serviceAccount = JSON.parse(rawServiceAccount) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  const token = await googleAccessToken(serviceAccount);
  cachedFcm = { token, projectId: serviceAccount.project_id, exp: now + FCM_TOKEN_TTL_S };
  return { token, projectId: serviceAccount.project_id };
}

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
    'RS256',
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
// Crypto + helpers
// =============================================================================

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  pem: string,
  alg: 'ES256' | 'RS256',
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
    encoder.encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

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

function success(token: PushTokenRow, transport: Transport): SendOutcome {
  return { tokenId: token.id, transport, ok: true, deactivate: false };
}

function failure(token: PushTokenRow, transport: Transport, error: string): SendOutcome {
  return { tokenId: token.id, transport, ok: false, deactivate: false, error };
}

function safeReason(body: string): string {
  try {
    return (JSON.parse(body).reason as string) || 'unknown';
  } catch {
    return body.slice(0, 100) || 'unknown';
  }
}

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

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  const n = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
