# 🚀 Quick Deploy Guide - SEO Migration

## ⚡ Fast Setup (5 Minutes)

### 1. Set Environment Variables

Create `.env` file:
```bash
SITE_URL=https://wagerproof.bet
GHOST_URL=https://your-ghost-instance.ghost.io
GHOST_CONTENT_KEY=your-content-api-key
VITE_GHOST_URL=https://your-ghost-instance.ghost.io
VITE_GHOST_CONTENT_KEY=your-content-api-key
```

### 2. Set Netlify Environment Variables

In Netlify dashboard, add the same variables above.

### 3. Deploy

```bash
npm run build
```

Then push to Git (Netlify will auto-deploy) or use:
```bash
npx netlify-cli deploy --prod
```

### 4. Verify

✅ Visit `https://wagerproof.bet/blog` - Should show blog posts
✅ Visit `https://wagerproof.bet/sitemap.xml` - Should include blog URLs
✅ View page source - Should see `<meta name="ssg-generated" content="true">`

### 5. Submit to Google

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://wagerproof.bet`
3. Submit sitemap: `https://wagerproof.bet/sitemap.xml`

## 📋 Build Commands

```bash
npm run build          # Full build (Vite + Blog + Verify)
npm run build:blog     # Generate blog static pages only
npm run verify:blog    # Verify blog build output
npm run dev           # Development server
```

## 🔗 Ghost Webhook (Auto-Build)

1. Netlify → Build hooks → Copy URL
2. Ghost Admin → Settings → Integrations → Your Integration
3. Webhooks → Add webhook:
   - Event: `post.published`
   - URL: Paste Netlify build hook URL

## ✅ Success Checklist

- [ ] Environment variables set in `.env` and Netlify
- [ ] Build runs without errors
- [ ] `/blog` page loads and shows posts
- [ ] Individual post pages load (`/blog/post-slug`)
- [ ] Sitemap includes all pages
- [ ] Google Search Console property created
- [ ] Sitemap submitted to Search Console
- [ ] Ghost webhook configured for auto-builds

## 🆘 Quick Fixes

**No blog posts showing:**
- Check Ghost API credentials in `.env`
- Verify posts are published (not drafts) in Ghost

**Build fails:**
- Run `npm install` to ensure all dependencies are installed
- Check that Ghost API is accessible

**Wrong canonical URLs:**
- Ensure `SITE_URL=https://wagerproof.bet` (no www)

**CSS not loading:**
- Rebuild: `npm run build`
- Check `dist/assets/` for CSS bundle

---

See **SEO_MIGRATION_COMPLETE.md** for full documentation.

