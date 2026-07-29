# Auth, SEO & Deployment

> Last verified: December 2024

## Authentication

### Implementation (VERIFIED ACCURATE)

**Web** (`src/contexts/AuthContext.tsx`):
```typescript
const signInWithProvider = async (provider: 'google' | 'apple') => {
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/wagerbot-chat` }
  });
};
```

**Mobile** (`wagerproof-mobile/contexts/AuthContext.tsx`):
- Uses `@react-native-google-signin/google-signin`
- Native Google Sign-In integration
- Supabase auth with email/password

### Components
- `ModernAuthForm.tsx` - Login/signup form
- `Welcome.tsx` - Welcome page with Google button
- `Account.tsx` - Account settings

### Sign in with Apple — two mechanisms, do not conflate (verified 2026-07-28)

Apple sign-in works one way natively and a completely different way on the web.
They share no credential, so one can be healthy while the other is broken.

| | Native (iOS app) | Web (MCP connector, web app) |
|---|---|---|
| Call | `signInWithIdToken(provider: .apple)` | `signInWithOAuth({provider:'apple'})` |
| Identifier | Bundle id `com.wagerproof.mobile` | Services ID `com.wagerproof.mobile.auth` |
| Client secret | **none** | **ES256 JWT, Apple caps at 6 months** |
| Code | `wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/AuthStore.swift:139` | `wagerproof-mcp/src/auth-app.ts` |

**The web secret expires silently.** The native path is what gets exercised
daily and never touches the secret, so nothing surfaces until someone uses web
sign-in. "Apple login works on the app" is not evidence the web config is fine.

The failure mode is Supabase's `Unable to exchange external code: <code>`. That
error comes *after* Apple has already accepted the sign-in and returned an
authorization code — every step before the token exchange works without the
secret, so this message points squarely at the secret. Renew it with
`wagerproof-mcp/scripts/apple-client-secret.mjs`; full procedure, known key/team
IDs, and the pre-paste validation check are in the **`apple-web-signin-secret`
skill** (`.claude/skills/apple-web-signin-secret/SKILL.md`).

Supabase's **Client IDs** field must list *both* identifiers — dropping the
bundle id fixes web and breaks the iOS app.

### Supabase redirect allowlist (verified 2026-07-28)

GoTrue glob-matches the **entire** `redirect_to` against Auth → URL
Configuration, and on any mismatch it does not error — it silently substitutes
the project Site URL. The symptom is landing on wagerproof.bet mid-sign-in.
A query string breaks the match, which is why the connector's consent page
carries its login-state handle in same-origin `localStorage` rather than a
`?ls=` param.

---

## SEO (Web Only)

### Configuration Files
- `/public/sitemap.xml` - Site pages
- `/public/robots.txt` - Crawler rules (allows GPTBot, ChatGPT-User)
- `/index.html` - Meta tags, Open Graph

### SEO Components
- `src/components/landing/SEO.tsx` - Meta tag manager
- `src/components/landing/StructuredData.tsx` - JSON-LD schemas

### Known Issue: Domain Inconsistency
- `index.html` uses `www.wagerproof.bet`
- `SEO.tsx` uses `wagerproof.bet` (no www)
- `netlify.toml` redirects www → apex

**Recommendation**: Standardize to `wagerproof.bet` (no www)

---

## Deployment

### Netlify Configuration (`netlify.toml`)
```toml
[build]
  command = "npm run build"
  publish = "dist"

# Blog redirects
[[redirects]]
  from = "/blog"
  to = "/blog/index.html"
  status = 200

# SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# www redirect
[[redirects]]
  from = "https://www.wagerproof.bet/*"
  to = "https://wagerproof.bet/:splat"
  status = 301
  force = true
```

### Build Scripts
```json
{
  "build": "vite build && npm run build:blog && npm run verify:blog",
  "build:blog": "node scripts/build-blog.mjs",
  "postbuild": "node scripts/prerender.js"
}
```

### Ghost CMS (Blog)
- API URL: Set via `GHOST_URL` env var
- Content key: Set via `GHOST_CONTENT_KEY`
- Static blog pages generated at build time

---

## Prerendering

### Status: CONFIGURED BUT NOT PRODUCING OUTPUT

**Script exists**: `scripts/prerender.js`
**Uses**: Puppeteer v24.25.0
**Routes**: `/`, `/home`, `/privacy-policy`, `/terms-and-conditions`

**Issue**: Current `dist/index.html` is 7.2KB with empty `<div id="root">`, not the expected 168KB pre-rendered content.

### Hydration Support (`main.tsx`)
```typescript
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}
```

---

## Mobile Deployment

### Expo/EAS Configuration (`eas.json`)
- Development, preview, production builds
- Android: APK for preview, app-bundle for production
- iOS: Standard Expo build

### App Configuration (`app.json`)
- Name: "WagerProof"
- Version: 3.5.0
- Bundle IDs: `com.wagerproof.mobile`

---

## Key Files

**Auth**: `src/contexts/AuthContext.tsx`, `wagerproof-mobile/contexts/AuthContext.tsx`
**SEO**: `src/components/landing/SEO.tsx`, `public/sitemap.xml`
**Deploy**: `netlify.toml`, `scripts/prerender.js`
