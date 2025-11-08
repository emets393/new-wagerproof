# 🚀 Complete Netlify & Ghost Blog Deployment - Step by Step

This guide will walk you through completing the deployment of your Ghost blog on Netlify.

---

## ✅ Prerequisites Check

Before starting, verify you have:
- [ ] Ghost CMS instance at https://wagerproof.ghost.io (already set up ✓)
- [ ] Netlify account
- [ ] Git repository connected to Netlify (or ability to deploy manually)
- [ ] Access to Ghost Admin panel

---

## 📋 Step 1: Get Ghost Content API Key

1. **Go to Ghost Admin**
   - Visit: https://wagerproof.ghost.io/admin
   - Sign in with your Ghost credentials

2. **Navigate to Integrations**
   - Click **Settings** (bottom left sidebar)
   - Click **Integrations**

3. **Create Custom Integration**
   - Click **Add custom integration**
   - Name it: `WagerProof Website`
   - Click **Create**

4. **Copy the Content API Key**
   - Find the **Content API Key** section
   - Click **Copy** to copy the key
   - ⚠️ **Save this key** - you'll need it in the next steps
   - Example format: `6a0d47bcaeaf7f13bbc20fce27`

---

## 🔧 Step 2: Set Up Local Environment Variables

1. **Create `.env` file** in your project root (`/Users/chrishabib/Documents/new-wagerproof/`)

2. **Add the following content** (replace `your-content-api-key-here` with the key from Step 1):

```bash
# Site Configuration
SITE_URL=https://wagerproof.bet

# Ghost CMS Configuration
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=your-content-api-key-here

# For Vite (client-side usage)
VITE_GHOST_URL=https://wagerproof.ghost.io
VITE_GHOST_CONTENT_KEY=your-content-api-key-here
```

3. **Save the file**

4. **Verify `.env` is in `.gitignore`** (to prevent committing secrets)
   - Check that `.gitignore` includes `.env`
   - If not, add it

---

## ☁️ Step 3: Configure Netlify Environment Variables

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Select your site (or create a new site)

2. **Navigate to Environment Variables**
   - Go to: **Site settings** → **Build & deploy** → **Environment**
   - Click **Add environment variable**

3. **Add Each Variable** (click "Add variable" for each):

   | Key | Value |
   |-----|-------|
   | `SITE_URL` | `https://wagerproof.bet` |
   | `GHOST_URL` | `https://wagerproof.ghost.io` |
   | `GHOST_CONTENT_KEY` | `[paste your Content API key from Step 1]` |
   | `VITE_GHOST_URL` | `https://wagerproof.ghost.io` |
   | `VITE_GHOST_CONTENT_KEY` | `[paste your Content API key from Step 1]` |

4. **Save all variables**

---

## 🧪 Step 4: Test the Build Locally

1. **Open terminal** in your project directory

2. **Run the blog build script**:
   ```bash
   npm run build:blog
   ```

3. **Expected output**:
   ```
   🏗️  Starting blog build process...
   ✅ Found CSS bundle: /assets/index-xxx.css
   📡 Fetching posts from Ghost: https://wagerproof.ghost.io
   ✅ Fetched 0 posts from Ghost (no posts published yet)
   📝 Generating blog post pages...
   📄 Generating blog index page...
   🗺️  Generating sitemap...
   ✅ Blog build complete!
   ```

4. **If you see errors**:
   - "Ghost credentials not configured" → Check your `.env` file
   - "Failed to fetch" → Verify Ghost URL and API key are correct
   - "dist/ directory not found" → Run `npm run build` first

5. **Run full build**:
   ```bash
   npm run build
   ```
   This will:
   - Build your React app
   - Generate blog static pages
   - Verify the build output

---

## 🌐 Step 5: Configure Netlify Site Settings

1. **Set Build Command** (if not already set)
   - Go to: **Site settings** → **Build & deploy** → **Build settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - ✅ These should already be configured in `netlify.toml`

2. **Set Domain** (if not already set)
   - Go to: **Site settings** → **Domain management**
   - Set `wagerproof.bet` as **Primary domain**
   - Add `www.wagerproof.bet` as additional domain (optional)
   - Netlify will automatically redirect www → apex (configured in `netlify.toml`)

---

## 🚀 Step 6: Deploy to Netlify

### Option A: Git-Based Deployment (Recommended)

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Configure Ghost blog deployment"
   git push origin main
   ```

2. **Netlify will automatically build and deploy**
   - Go to Netlify Dashboard → **Deploys** tab
   - Watch the build progress
   - Wait for "Published" status

### Option B: Manual Deployment

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Deploy using Netlify CLI**:
   ```bash
   npx netlify-cli deploy --prod
   ```
   - If first time, you'll need to authenticate
   - Follow the prompts

---

## 🔗 Step 7: Set Up Auto-Build Webhook (Ghost → Netlify)

This will automatically rebuild your site when you publish a post in Ghost.

### A. Create Netlify Build Hook

1. **Go to Netlify Dashboard**
   - Navigate to: **Site settings** → **Build & deploy** → **Build hooks**

2. **Add Build Hook**
   - Click **Add build hook**
   - Name: `Ghost Blog Publish`
   - Branch: `main` (or your production branch)
   - Click **Save**

3. **Copy the Webhook URL**
   - Example: `https://api.netlify.com/build_hooks/xxxxxxxxxxxxx`
   - ⚠️ **Save this URL** - you'll need it in the next step

### B. Configure Ghost Webhook

1. **Go to Ghost Admin**
   - Visit: https://wagerproof.ghost.io/admin
   - Navigate to: **Settings** → **Integrations**

2. **Select Your Integration**
   - Click on the **WagerProof Website** integration you created earlier

3. **Add Webhook**
   - Click the **Webhooks** tab
   - Click **Add webhook**

4. **Configure Webhook**:
   - **Event**: Select `post.published` (and optionally `post.updated`)
   - **Target URL**: Paste the Netlify build hook URL from Step 7A
   - Click **Save**

5. **Test the Webhook**:
   - Publish a test post in Ghost
   - Go to Netlify Dashboard → **Deploys** tab
   - You should see a new build triggered automatically!

---

## ✅ Step 8: Verify Deployment

### 1. Check Blog Index Page

- Visit: `https://wagerproof.bet/blog`
- **View page source** (Ctrl+U / Cmd+Option+U)
- Verify you see:
  - `<meta name="ssg-generated" content="true">`
  - Full blog post list in HTML (not just a loading spinner)
  - JSON-LD structured data

### 2. Check Blog Post Pages (if you have posts)

- Visit: `https://wagerproof.bet/blog/your-post-slug`
- **View page source**
- Verify you see:
  - `<meta name="ssg-generated" content="true">`
  - Full post content in `<article id="post-content">`
  - JSON-LD with `@type: "BlogPosting"`
  - Canonical URL: `https://wagerproof.bet/blog/your-post-slug`

### 3. Check Sitemap

- Visit: `https://wagerproof.bet/sitemap.xml`
- Verify it includes:
  - Homepage (`/`)
  - Blog listing (`/blog`)
  - All blog posts (`/blog/post-slug`)
  - Static pages (privacy, terms, etc.)

### 4. Test Auto-Build Webhook

1. **Create a test post in Ghost**:
   - Go to Ghost Admin → **Posts** → **New post**
   - Write some content
   - Click **Publish**

2. **Check Netlify**:
   - Go to Netlify Dashboard → **Deploys** tab
   - You should see a new build triggered automatically
   - Wait for it to complete

3. **Verify the post is live**:
   - Visit: `https://wagerproof.bet/blog/your-test-post-slug`
   - The post should be visible

---

## 📝 Step 9: Create Your First Blog Post

1. **Go to Ghost Admin**
   - Visit: https://wagerproof.ghost.io/admin
   - Click **Posts** in the left sidebar
   - Click **New post**

2. **Write Your Content**
   - Add a **Title**
   - Write your post content
   - Add a **Featured image** (optional but recommended)
   - Add **Tags** for categorization

3. **Set SEO Metadata** (important!)
   - Click the **Settings** icon (⚙️) in the post editor
   - **Meta title**: Your SEO title (defaults to post title)
   - **Meta description**: Brief summary (150-160 characters)
   - **URL slug**: URL-friendly name (e.g., `my-first-post`)

4. **Publish**
   - Click **Publish** (or **Schedule** for later)
   - If webhook is configured, Netlify will rebuild automatically
   - Post will be live at: `https://wagerproof.bet/blog/your-slug`

---

## 🔍 Step 10: Submit to Search Engines

### Google Search Console

1. **Go to Google Search Console**
   - Visit: https://search.google.com/search-console

2. **Add Property**
   - Click **Add Property**
   - Enter: `https://wagerproof.bet`
   - Verify ownership (DNS, HTML file, or HTML tag)

3. **Submit Sitemap**
   - Go to **Sitemaps** in the left menu
   - Enter: `https://wagerproof.bet/sitemap.xml`
   - Click **Submit**

### Bing Webmaster Tools (Optional)

1. Visit: https://www.bing.com/webmasters
2. Add your site
3. Submit sitemap: `https://wagerproof.bet/sitemap.xml`

---

## 🎯 Final Checklist

- [ ] Ghost Content API Key obtained and saved
- [ ] `.env` file created with all 5 environment variables
- [ ] Netlify environment variables configured (all 5 variables)
- [ ] Local build test successful (`npm run build:blog`)
- [ ] Netlify site deployed successfully
- [ ] Blog index page accessible at `/blog`
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] Netlify build hook created
- [ ] Ghost webhook configured and tested
- [ ] First blog post created and published
- [ ] Post appears on live site
- [ ] Sitemap submitted to Google Search Console

---

## 🆘 Troubleshooting

### Issue: "Ghost credentials not configured"

**Solution**: 
- Check `.env` file exists in project root
- Verify `GHOST_URL` and `GHOST_CONTENT_KEY` are set
- Restart your terminal/IDE after creating `.env`

### Issue: Build fails on Netlify

**Check**:
1. Netlify environment variables are set correctly
2. Build logs show any specific errors
3. Ghost instance is accessible: https://wagerproof.ghost.io

### Issue: Blog posts not showing

**Check**:
1. Posts are **published** (not drafts) in Ghost
2. Build completed successfully
3. Check Netlify build logs for errors
4. Verify Ghost API credentials are correct

### Issue: Webhook not triggering builds

**Check**:
1. Webhook URL is correctly copied (no extra spaces)
2. Ghost webhook event is set to `post.published`
3. Netlify build hook is active
4. Check Ghost webhook history for delivery status

### Issue: Posts not updating after publish

**Solution**:
- Manually trigger a Netlify build
- Or wait a few minutes (webhook may have delay)
- Check Netlify deploy logs

---

## 📚 Additional Resources

- **Ghost Admin**: https://wagerproof.ghost.io/admin
- **Your Blog**: https://wagerproof.bet/blog
- **Ghost API Docs**: https://ghost.org/docs/content-api/
- **Netlify Docs**: https://docs.netlify.com/

---

## ✨ You're All Set!

Your Ghost blog is now fully integrated with Netlify! 

**What happens now:**
1. Write posts in Ghost Admin
2. Click "Publish"
3. Ghost webhook triggers Netlify build
4. Netlify fetches posts and generates static HTML
5. Site rebuilds automatically
6. Post is live at `https://wagerproof.bet/blog/your-slug`

**Time to live**: Usually 1-3 minutes from publish to live on web 🚀

Happy blogging! ✍️

