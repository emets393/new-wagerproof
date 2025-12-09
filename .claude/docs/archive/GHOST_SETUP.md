# Ghost CMS Setup Guide for WagerProof

## 🎉 Ghost Instance Ready!

Your Ghost CMS instance is live at: **https://wagerproof.ghost.io**

---

## 📋 Step 1: Get Your Ghost Content API Key

1. Go to [https://wagerproof.ghost.io/admin](https://wagerproof.ghost.io/admin)
2. Sign in with your Ghost credentials
3. Navigate to **Settings** (bottom left sidebar)
4. Click **Integrations**
5. Click **Add custom integration**
6. Name it: `WagerProof Website`
7. Copy the **Content API Key** (read-only key for public access)

---

## 🔧 Step 2: Configure Environment Variables

Create a `.env` file in your project root with:

```
# Site Configuration
SITE_URL=https://wagerproof.bet

# Ghost CMS Configuration
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=your-content-api-key-here

# For Vite (client-side usage)
VITE_GHOST_URL=https://wagerproof.ghost.io
VITE_GHOST_CONTENT_KEY=your-content-api-key-here
```

Replace `your-content-api-key-here` with the key you copied from Ghost Admin.

---

## ☁️ Step 3: Set Netlify Environment Variables

1. Go to **Netlify Dashboard** → Your Site
2. Navigate to **Site settings** → **Build & deploy** → **Environment**
3. Add the following environment variables:
   - `SITE_URL` = `https://wagerproof.bet`
   - `GHOST_URL` = `https://wagerproof.ghost.io`
   - `GHOST_CONTENT_KEY` = (Your Content API key)
   - `VITE_GHOST_URL` = `https://wagerproof.ghost.io`
   - `VITE_GHOST_CONTENT_KEY` = (Your Content API key)

---

## 🚀 Step 4: Test the Connection

Run the build locally to test Ghost integration:

```bash
npm run build:blog
```

You should see output like:
```
🏗️  Starting blog build process...

✅ Found CSS bundle: /assets/index-xxx.css

📡 Fetching posts from Ghost: https://wagerproof.ghost.io
✅ Fetched 0 posts from Ghost (no posts published yet)
```

---

## 📝 Step 5: Create Your First Blog Post

1. Go to [https://wagerproof.ghost.io/admin](https://wagerproof.ghost.io/admin)
2. Click **Posts** in the left sidebar
3. Click **New post**
4. Write your content
5. Set:
   - **Title** - Your post title
   - **Slug** - URL-friendly name (e.g., `my-first-post`)
   - **Meta description** - Brief summary for SEO
   - **Featured image** - Cover image for the post
   - **Tags** - Categorize your content
6. Click **Publish** (or **Schedule** for later)

---

## 🔗 Step 6: Set Up Auto-Build Webhook

When you publish a post in Ghost, automatically rebuild your Netlify site:

### In Netlify:
1. Go to **Build hooks** → **Add build hook**
2. Name it: `Ghost Blog Publish`
3. Copy the webhook URL

### In Ghost:
1. Go to [https://wagerproof.ghost.io/admin](https://wagerproof.ghost.io/admin)
2. Settings → Integrations → Your custom integration
3. Click **Webhooks**
4. Add webhook:
   - **Event**: `post.published` (and optionally `post.updated`)
   - **Target URL**: Paste your Netlify build hook URL
5. Save

Now whenever you publish a post in Ghost, your website automatically rebuilds! ✨

---

## 📊 Your Setup

```
WagerProof Website Architecture
═══════════════════════════════════════════

Ghost CMS Instance (Content)
https://wagerproof.ghost.io
    ↓
    ├─ Published Posts
    ├─ Authors
    ├─ Tags
    └─ Metadata (SEO, images, etc.)
    
         ↓ [API Fetch during build]
    
React/Vite App (Frontend)
/Users/chrishabib/Documents/new-wagerproof
    ├─ Static HTML pages (dist/blog/*)
    ├─ Blog listing page (/blog)
    ├─ Individual post pages (/blog/:slug)
    ├─ Sitemap generation
    └─ SEO meta tags
    
         ↓ [Deploy to Netlify]
    
Live Website
https://wagerproof.bet
    ├─ /blog - Blog listing
    ├─ /blog/post-slug - Individual posts
    ├─ /press-kit - Press kit
    ├─ /privacy-policy - Legal
    └─ / - Homepage
```

---

## 🎯 What Happens on Publish

### In Ghost Admin:
```
Write Post → Set Meta Data → Click "Publish"
```

### Automatic Chain Reaction:
```
1. Post published in Ghost
2. Ghost webhook fires
3. Netlify build hook triggered
4. Build script fetches all Ghost posts
5. Static HTML generated for each post
6. Sitemap updated with new URLs
7. Site rebuilds and deploys
8. Post live at https://wagerproof.bet/blog/post-slug
```

**Time to live**: Usually 1-3 minutes from publish to live on web

---

## 📚 Useful Links

- **Ghost Admin**: https://wagerproof.ghost.io/admin
- **Your Blog**: https://wagerproof.bet/blog
- **Press Kit**: https://wagerproof.bet/press-kit
- **Ghost API Docs**: https://ghost.org/docs/content-api/

---

## 🆘 Troubleshooting

### Issue: "Ghost credentials not configured"

**Solution**: Make sure `.env` file has both:
```
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=your-actual-key
```

### Issue: No posts fetching during build

**Check**:
1. Posts are **published** (not drafts)
2. Content API key is correct
3. Ghost instance is accessible
4. Run locally: `npm run build:blog`

### Issue: Webhook not working

**Check**:
1. Webhook URL is correctly copied
2. Ghost Admin → Settings → Integrations → Your integration → Webhooks
3. Recent requests show in webhook history
4. Netlify build hook is active

---

## ✨ Best Practices

1. **Always use meta descriptions** - For SEO in search results
2. **Add featured images** - For social media sharing
3. **Use tags** - For organization and categorization
4. **Write excerpts** - Shows in blog listing
5. **Include author info** - For credibility
6. **Use keywords** - In title and meta description

---

## 🎊 You're All Set!

Your Ghost CMS is connected and ready to power your WagerProof blog!

Start writing, and watch your posts go live automatically. 🚀

---

**Ghost Instance**: https://wagerproof.ghost.io  
**Website**: https://wagerproof.bet  
**Blog**: https://wagerproof.bet/blog

Happy blogging! ✍️

