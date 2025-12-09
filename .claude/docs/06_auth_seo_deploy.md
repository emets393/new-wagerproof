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
- Version: 3.0.1
- Bundle IDs: `com.wagerproof.mobile`

---

## Key Files

**Auth**: `src/contexts/AuthContext.tsx`, `wagerproof-mobile/contexts/AuthContext.tsx`
**SEO**: `src/components/landing/SEO.tsx`, `public/sitemap.xml`
**Deploy**: `netlify.toml`, `scripts/prerender.js`
