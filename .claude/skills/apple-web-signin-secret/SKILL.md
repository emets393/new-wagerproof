---
name: apple-web-signin-secret
description: >-
  Diagnose and fix "Sign in with Apple" failures on WagerProof's WEB OAuth flow
  (the MCP connector consent page and the web app), and regenerate the Apple
  client-secret JWT that Supabase uses to exchange Apple's authorization code.
  Use whenever Apple sign-in breaks with "Unable to exchange external code",
  invalid_client, or invalid_grant; whenever the Apple secret needs renewing (it
  expires every 6 months); or for any "Apple sign-in stopped working / Apple
  login broken / regenerate Apple secret" request. NOT for native iOS Apple
  sign-in, which uses a different mechanism entirely and needs no secret.
---

# Apple web sign-in — client secret

## The one thing to understand first

WagerProof signs in with Apple **two different ways**, and they share almost nothing:

| | Native (iOS app) | Web (MCP connector, web app) |
|---|---|---|
| Call | `signInWithIdToken(provider: .apple)` | `signInWithOAuth({provider:'apple'})` |
| Identifier | Bundle id `com.wagerproof.mobile` | Services ID `com.wagerproof.mobile.auth` |
| Client secret | **none needed** | **ES256 JWT, expires ≤6 months** |
| Code | `wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/AuthStore.swift:139` | `wagerproof-mcp/src/auth-app.ts`, `src/contexts/AuthContext.tsx` |

The native path is the one that gets exercised daily, and it never touches the
secret. So **the web secret expires silently**: iOS sign-in keeps working, and
nothing surfaces until someone uses web sign-in. Do not conclude "Apple sign-in
works, so the config is fine."

## Symptom → cause

Supabase error: `Unable to exchange external code: <code>`

This is GoTrue's message after Apple **already accepted** the sign-in and handed
back an authorization code, and the server-side POST to Apple's token endpoint
then failed. Every step before that exchange — Services ID, domain, Return URL,
the user tapping through Apple's UI — works *without* the secret. So this error
points at the secret with high specificity.

Distinguish the two failures at Apple's token endpoint:
- `invalid_client` → the secret is wrong, expired, or signed for the wrong `sub`
- `invalid_grant` → the secret is **fine**; only the code was bad/expired

## Diagnose

Confirm what Supabase actually sends to Apple (needs no credentials):

```bash
curl -s -D - -o /dev/null \
  "https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/authorize?provider=apple&redirect_to=<allowlisted-url>" \
  | grep -i "^location:" | tr '&' '\n' | grep -iE "client_id|redirect_uri|response_mode"
```

Expect `client_id=com.wagerproof.mobile.auth` (the Services ID — **not** the
bundle id) and `redirect_uri=https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback`.
If those are right, the problem is the secret.

## Fix

```bash
cd wagerproof-mcp
node scripts/apple-client-secret.mjs \
  --key "/path/to/AuthKey_95MV5NG3F9.p8" \
  --key-id 95MV5NG3F9 \
  --team-id 88DXY6L653 \
  --services-id com.wagerproof.mobile.auth
```

Known values (verified 2026-07-28):
- Sign in with Apple key: `~/Downloads/_Organized/Credentials/apple_wagerproof_signin_key/AuthKey_95MV5NG3F9.p8`
- Key ID `95MV5NG3F9` · Team ID `88DXY6L653` (also `wagerproof-ios-native/project.yml:33`)
- Services ID `com.wagerproof.mobile.auth`

There are many `AuthKey_*.p8` files in `~/Downloads` — App Store Connect API keys
and other apps' keys look identical by filename. Only the one under
`apple_wagerproof_signin_key/` is the Sign in with Apple key.

**Verify before pasting** — a dummy code proves whether Apple accepts the secret:

```bash
curl -s -X POST "https://appleid.apple.com/auth/token" \
  -H "content-type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=com.wagerproof.mobile.auth" \
  --data-urlencode "client_secret=$TOK" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=dummy" \
  --data-urlencode "redirect_uri=https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback"
```

`invalid_grant` = secret good. `invalid_client` = secret bad, do not paste it.

Then paste into **Supabase → Authentication → Providers → Apple → Secret Key (for
OAuth)** and save. No deploy is needed — this is a Supabase-side credential only.

While in that screen, confirm **Client IDs** lists *both* `com.wagerproof.mobile.auth`
(web) and `com.wagerproof.mobile` (native). Dropping the bundle id fixes web and
breaks the iOS app.

## Handling the secret

- The generated JWT is a live credential for ~6 months. Never write it inside the
  repo and never paste it into chat/logs. Write it beside the `.p8` under
  `~/Downloads/_Organized/Credentials/apple_wagerproof_signin_key/`, `chmod 600`.
- `wagerproof-mcp/.gitignore` blocks `*.jwt` and `.apple-client-secret.txt` as a
  backstop.
- Hand it over with `pbcopy < <file>` rather than printing it.

## Why the script exists rather than an npm package

No JWT dependency is needed: the script uses Node's WebCrypto, which signs ECDSA
as raw `r||s` — exactly what JWS requires. The obvious `crypto.sign()` route emits
a **DER**-encoded signature, which Apple rejects. If you rewrite this, keep
WebCrypto or convert DER→raw explicitly.

Related: `wagerproof-mcp/README.md` (One-time Supabase console setup),
`.claude/docs/06_auth_seo_deploy.md` (Apple sign-in section).
