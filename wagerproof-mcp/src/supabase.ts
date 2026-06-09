// Supabase glue for the connector (the WagerProof analog of Honeydew's
// firebase.ts). No service-account magic for user data: we
//   1. verify a client-posted access token server-side via GET /auth/v1/user
//      (authoritative — never trust a client token without this),
//   2. exchange the user's refresh token for fresh access tokens, and
//   3. build a USER-SCOPED Main client (their access token as Bearer) so RLS
//      applies exactly as in the app — isolation is structural AND rule-enforced.
//
// Two trust tiers per request (WagerProof-specific, unlike Honeydew):
//   - user-scoped Main client (RLS)        → the user's own agents/picks/follows
//   - service-role Main + anon CFB clients → global sports data (no identity)
//
// The refresh token is AES-GCM-encrypted before it touches KV (TOKEN_ENC_KEY).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseLikeClient } from "@wagerproof/tool-core";
import type { Env } from "./types";

// ---- token verification (replaces verifyFirebaseIdToken) -------------------

export interface VerifiedUser {
  userId: string;
  email: string | null;
}

/**
 * Verify a Supabase access token by asking Supabase who it belongs to. A 200
 * from /auth/v1/user means the signature/expiry/issuer are all valid for this
 * project — no local JWKS/secret handling needed. Returns the user id + email.
 */
export async function verifyAccessToken(accessToken: string, env: Env): Promise<VerifiedUser> {
  const res = await fetch(`${env.MAIN_URL}/auth/v1/user`, {
    headers: {
      apikey: env.MAIN_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Access token verification failed: ${res.status} ${await res.text()}`);
  }
  const user = (await res.json()) as { id?: string; email?: string | null };
  if (!user.id) throw new Error("Verified user response missing id");
  return { userId: user.id, email: user.email ?? null };
}

// ---- refresh-token store + access-token cache ------------------------------

const grantKey = (grantId: string) => `grant:${grantId}`;
const accessCacheKey = (grantId: string) => `access:${grantId}`;

async function importEncKey(env: Env): Promise<CryptoKey | null> {
  if (!env.TOKEN_ENC_KEY) return null;
  const raw = Uint8Array.from(atob(env.TOKEN_ENC_KEY), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(value: string, env: Env): Promise<string> {
  const key = await importEncKey(env);
  if (!key) return value; // no key → plaintext (Cloudflare still encrypts KV at rest)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv);
  blob.set(ct, iv.length);
  return "enc:" + btoa(String.fromCharCode(...blob));
}

async function decryptSecret(stored: string, env: Env): Promise<string> {
  if (!stored.startsWith("enc:")) return stored; // legacy plaintext
  const key = await importEncKey(env);
  if (!key) throw new Error("TOKEN_ENC_KEY missing — cannot decrypt stored token");
  const blob = Uint8Array.from(atob(stored.slice(4)), (c) => c.charCodeAt(0));
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/** Persist a user's Supabase refresh token (encrypted), keyed by opaque grantId. */
export async function storeGrantRefreshToken(
  grantId: string,
  refreshToken: string,
  env: Env,
): Promise<void> {
  await env.OAUTH_KV.put(grantKey(grantId), await encryptSecret(refreshToken, env));
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: { id?: string };
}

/**
 * Return a fresh Supabase access token + user id for the grant, refreshing via
 * /auth/v1/token when the cached one is stale. Supabase ROTATES the refresh
 * token on every refresh, so we re-persist it.
 */
export async function getUserAccessToken(
  grantId: string,
  env: Env,
): Promise<{ accessToken: string; userId: string }> {
  const cached = await env.OAUTH_KV.get(accessCacheKey(grantId), "json");
  if (cached && typeof cached === "object") {
    const c = cached as { accessToken?: string; userId?: string };
    if (c.accessToken && c.userId) return { accessToken: c.accessToken, userId: c.userId };
  }

  const stored = await env.OAUTH_KV.get(grantKey(grantId));
  if (!stored) throw new Error("No refresh token for grant (re-authentication required)");
  const refreshToken = await decryptSecret(stored, env);

  const res = await fetch(`${env.MAIN_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: env.MAIN_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Supabase token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as RefreshResponse;

  // Rotate the stored refresh token (Supabase issues a new one each refresh).
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await env.OAUTH_KV.put(grantKey(grantId), await encryptSecret(data.refresh_token, env));
  }

  // Derive userId: prefer the refresh response, else verify the new access token.
  const userId = data.user?.id ?? (await verifyAccessToken(data.access_token, env)).userId;

  const result = { accessToken: data.access_token, userId };
  const ttl = Math.max(60, Number(data.expires_in || 3600) - 300);
  await env.OAUTH_KV.put(accessCacheKey(grantId), JSON.stringify(result), { expirationTtl: ttl });
  return result;
}

// ---- client factories ------------------------------------------------------

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function toLike(client: SupabaseClient): SupabaseLikeClient {
  // The real client structurally satisfies the tool-core seam; cast at the boundary
  // so tool-core stays free of the supabase-js dependency.
  return client as unknown as SupabaseLikeClient;
}

/** User-scoped Main client — RLS applies (the user's own rows only). */
export function createUserMainClient(env: Env, accessToken: string): SupabaseLikeClient {
  return toLike(
    createClient(env.MAIN_URL, env.MAIN_ANON_KEY, {
      ...NO_PERSIST,
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }),
  );
}

/** Global Main client for non-user data (Polymarket, editor picks). Prefers the
 *  service-role key (bypasses RLS, matching the app's edge functions); falls back
 *  to the anon key when the secret isn't set, so the connector is deployable for
 *  testing without it — tools then see only what anon RLS permits. */
export function createServiceMainClient(env: Env): SupabaseLikeClient {
  const key = env.MAIN_SERVICE_ROLE_KEY || env.MAIN_ANON_KEY;
  return toLike(createClient(env.MAIN_URL, key, NO_PERSIST));
}

/** Anon CFB client — GLOBAL sports predictions. */
export function createCfbClient(env: Env): SupabaseLikeClient {
  return toLike(createClient(env.CFB_URL, env.CFB_ANON_KEY, NO_PERSIST));
}
