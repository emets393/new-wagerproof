# WagerProof MCP connector

A remote **MCP server** ("Sign in with WagerProof") that lets a user link their
WagerProof account to an AI assistant (Claude, ChatGPT, …) and ask about **their
own data** plus WagerProof's **model analytics** — **read-only**.

It is a single **Cloudflare Worker** that is BOTH the MCP server AND its own
OAuth 2.1 authorization server (Dynamic Client Registration + PKCE), adapted
from the Honeydew connector pattern. Tool logic lives in the shared, runtime-
agnostic [`@wagerproof/tool-core`](../wagerproof-tool-core) package so the same
tools can later back WagerBot chat and agent generation.

## Architecture

```
Claude/ChatGPT ──OAuth──▶ /authorize (consent = Supabase sign-in)
                         └▶ /callback  (verify token → encrypt refresh token in KV → mint grant)
Claude/ChatGPT ──Bearer─▶ POST /mcp (JSON-RPC: initialize / tools/list / tools/call)
                         └▶ per call: refresh user access token → build clients → run tool
```

- **Two trust tiers per request** (WagerProof-specific):
  - `scope: "user"` tools → a **user-JWT Main client** (RLS enforces isolation).
  - `scope: "global"` tools → **service-role Main** + **anon CFB** clients (public data).
- **No password is ever seen**: the consent page runs Supabase sign-in client-side
  and posts only the resulting `{access_token, refresh_token}` to `/callback`.
- **Token verification** is delegated to Supabase (`GET /auth/v1/user`) — no JWT
  secret/JWKS in the Worker.
- The **refresh token** is AES-GCM-encrypted in KV; the MCP token carries only an
  opaque `grantId`.

### Source map
| File | Role |
|------|------|
| `src/index.ts` | `OAuthProvider` wiring (apiRoute `/mcp`, `/authorize` `/token` `/register`) |
| `src/mcp-handler.ts` | Stateless Streamable-HTTP JSON-RPC; builds per-tool two-tier context |
| `src/auth-app.ts` | Consent page (Supabase sign-in), `/oauth-return`, `/callback`, `/docs` `/privacy` `/terms`, icon, RFC 9728 metadata |
| `src/supabase.ts` | Token verify, refresh exchange (+ rotation), AES-GCM, client factories |
| `src/instructions.ts` | The `initialize` instructions string + serverInfo |
| `src/icon.ts` | Connector icon (**placeholder — replace with the real logo**) |

### Tools (all read-only)
**Your data** (RLS-scoped): `list_my_agents`, `get_agent_performance`,
`list_my_agent_picks`, `list_my_follows`, `get_my_community_activity`,
`get_my_record`.
**Public analytics**: `get_sport_predictions`, `get_game_detail`, `search_games`,
`get_market_odds`, `get_editor_picks`.

## Local development

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc   # fill in anon keys; wrangler.jsonc is gitignored
npm run typecheck
npm run dev          # serves on http://localhost:8787
```

Public endpoints work without auth: `/`, `/docs`, `/privacy`, `/terms`,
`/icon.png`, `/.well-known/oauth-protected-resource`,
`/.well-known/oauth-authorization-server`. `POST /mcp` returns 401 until a grant
exists (complete the sign-in flow against a deployed instance with real keys).

## Config & secrets

`vars` in `wrangler.jsonc` (publishable): `MAIN_URL`, `MAIN_ANON_KEY`, `CFB_URL`,
`CFB_ANON_KEY`, `MCP_BASE_URL`, `ALLOWED_ORIGINS`, `GOOGLE_ENABLED`,
`APPLE_ENABLED`, `EMAIL_ENABLED`.

Secrets (`wrangler secret put`):
- `MAIN_SERVICE_ROLE_KEY` — service-role key for **global** Main reads (Polymarket, editor picks).
- `TOKEN_ENC_KEY` — `openssl rand -base64 32` (encrypts refresh tokens at rest).

## One-time Supabase console setup

1. **Allowed redirect URLs** (Auth → URL Configuration): add
   `https://<worker-host>/oauth-return` (workers.dev URL first, then the custom
   domain). Required for Google/Apple sign-in.
2. **Providers**: enable Email, and Google/Apple if you flip their `*_ENABLED`
   vars to `"true"`. (Email works with no extra provider config.)
3. **RLS audit** (critical — see below) before exposing user tools.

## Deploy

```bash
wrangler login
wrangler kv namespace create OAUTH_KV     # paste id into wrangler.jsonc
wrangler secret put MAIN_SERVICE_ROLE_KEY
wrangler secret put TOKEN_ENC_KEY
wrangler deploy                            # Stage 1: *.workers.dev
# Stage 2 (custom domain, zone on Cloudflare): add to wrangler.jsonc
#   "routes": [{ "pattern": "mcp.wagerproof.bet", "custom_domain": true }]
# then set MCP_BASE_URL to the custom domain and redeploy.
```

## Validation checklist

- [ ] `npx @modelcontextprotocol/inspector` against the live `…/mcp`: sign in,
      run **every** tool, run one **invalid input** (expect a clean `isError`),
      eyeball `initialize` (serverInfo + instructions).
- [ ] **Isolation test**: sign in as two seeded accounts; confirm `list_my_*`
      returns only the signed-in user's rows; confirm sports tools return the
      same global data for both.
- [ ] Seed a **test account** so every tool returns non-empty data.
- [ ] Favicon shows the brand mark (replace `src/icon.ts` placeholder first):
      `https://www.google.com/s2/favicons?domain=<host>`.
- [ ] `/docs`, `/privacy`, `/terms` live and public.

## RLS audit (do before exposing user tools)

The connector trusts Supabase RLS to scope `scope:"user"` tools. Confirm these
policies restrict `SELECT` to `auth.uid()` (and that public rows are intended):
`avatar_profiles`, `avatar_picks` (via `avatar_id → avatar_profiles.user_id`),
`avatar_performance_cache`, `user_avatar_follows`, `community_picks`,
`user_wins`. See `supabase/migrations/20260205000002_create_avatar_rls_policies.sql`.

## Connectors Directory submission (stretch)

Read Only · OAuth 2.0 + DCR · Streamable HTTP · tool list with titles +
`readOnlyHint`. Frame as **analytics over your own data + public model outputs** —
not betting advice or wagering facilitation. Staking (`units`) is intentionally
omitted from tool output; confidence is surfaced as a 1-5 analytic score.

## Notes / risks

- `@supabase/supabase-js` runs under `nodejs_compat` (verified: bundles to
  ~188 KiB gzip). If a future version breaks on Workers, fall back to
  `@supabase/postgrest-js` over `fetch`.
- Supabase rotates refresh tokens on every refresh — handled in
  `getUserAccessToken` (re-persists the rotated token).
- Writes are a deliberate v2 seam; this release is read-only by construction.
