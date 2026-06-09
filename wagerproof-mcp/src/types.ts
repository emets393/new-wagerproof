import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/**
 * Worker bindings + config. Most values come from wrangler.jsonc `vars`;
 * `OAUTH_PROVIDER` is injected by @cloudflare/workers-oauth-provider, and
 * `OAUTH_KV` backs both the provider's storage and our per-grant encrypted
 * Supabase refresh-token / cached access-token store.
 *
 * Two Supabase projects: MAIN holds user data (agents, picks, follows,
 * community) + Polymarket + editor picks; CFB holds all sports predictions.
 */
export interface Env {
  OAUTH_KV: KVNamespace;
  /** OAuth 2.1 helper surface injected by the provider. */
  OAUTH_PROVIDER: OAuthHelpers;

  // Main Supabase (auth + user data). Anon key is publishable.
  MAIN_URL: string;
  MAIN_ANON_KEY: string;
  /** Service-role key for GLOBAL Main reads (Polymarket, editor picks). SECRET.
   *  Optional: when unset, global Main reads fall back to the anon key (so the
   *  connector is deployable for testing before the secret is configured). */
  MAIN_SERVICE_ROLE_KEY?: string;

  // CFB Supabase (sports predictions). Anon key is publishable; RLS/grants gate it.
  CFB_URL: string;
  CFB_ANON_KEY: string;

  MCP_BASE_URL: string;
  /** Comma-separated Origin allowlist for /mcp callers. */
  ALLOWED_ORIGINS: string;

  // Sign-in provider gates for the consent page.
  GOOGLE_ENABLED?: string;
  APPLE_ENABLED?: string;
  EMAIL_ENABLED?: string;

  /** Base64 32-byte AES-GCM key (wrangler secret) — encrypts refresh tokens at rest. */
  TOKEN_ENC_KEY?: string;
}

/**
 * Props bound to an issued MCP grant. The provider encrypts these at rest and
 * surfaces them as `ctx.props` on every tool call. We store only the Supabase
 * user id + an opaque `grantId`; the actual refresh token lives in KV under
 * `grant:<grantId>` and never travels inside an MCP token.
 */
export interface Props {
  userId: string;
  grantId: string;
  email: string | null;
  [key: string]: unknown;
}
