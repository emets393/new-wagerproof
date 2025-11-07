# 🔑 Environment Variables Setup

## Your Ghost Credentials

**Ghost Instance URL**: https://wagerproof.ghost.io  
**Content API Key**: `6a0d47bcaeaf7f13bbc20fce27`

---

## ⚙️ Setup Instructions

### 1. Create `.env` File (Local Development)

Create a file named `.env` in your project root:

```bash
# Site Configuration
SITE_URL=https://wagerproof.bet

# Ghost CMS Configuration
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=6a0d47bcaeaf7f13bbc20fce27

# For Vite (client-side usage)
VITE_GHOST_URL=https://wagerproof.ghost.io
VITE_GHOST_CONTENT_KEY=6a0d47bcaeaf7f13bbc20fce27
```

### 2. Set Netlify Environment Variables

1. Go to your Netlify Site Dashboard
2. Navigate to: **Site settings** → **Build & deploy** → **Environment**
3. Click **Add environment variable** for each:

| Key | Value |
|-----|-------|
| `SITE_URL` | `https://wagerproof.bet` |
| `GHOST_URL` | `https://wagerproof.ghost.io` |
| `GHOST_CONTENT_KEY` | `6a0d47bcaeaf7f13bbc20fce27` |
| `VITE_GHOST_URL` | `https://wagerproof.ghost.io` |
| `VITE_GHOST_CONTENT_KEY` | `6a0d47bcaeaf7f13bbc20fce27` |

---

## ✅ Verification

### Test Locally

Run the build script to test Ghost connection:

```bash
npm run build:blog
```

You should see:
```
🏗️  Starting blog build process...
✅ Found CSS bundle: /assets/index-xxx.css
📡 Fetching posts from Ghost: https://wagerproof.ghost.io
✅ Fetched 0 posts from Ghost
```

If it says "Ghost credentials not configured", verify your `.env` file has both `GHOST_URL` and `GHOST_CONTENT_KEY`.

### Test Content API Directly

You can test the API with this curl command:

```bash
curl "https://wagerproof.ghost.io/ghost/api/content/posts/?key=6a0d47bcaeaf7f13bbc20fce27"
```

Should return a JSON response with your posts (currently empty).

---

## 🚀 Deploy to Netlify

Once environment variables are set in Netlify:

1. **Connect Git Repository** (recommended)
   - Netlify will automatically rebuild on push
   - Environment variables will be applied
   - Build script will fetch from Ghost

2. **Or Manual Deploy**
   ```bash
   npm run build
   npx netlify-cli deploy --prod
   ```

---

## 🔄 Test the Full Flow

1. **Create a blog post in Ghost**
   - Go to https://wagerproof.ghost.io/admin
   - Click "Posts" → "New post"
   - Write content and publish

2. **Trigger a build locally**
   ```bash
   npm run build:blog
   ```

3. **Check results**
   - Static HTML should be in `dist/blog/`
   - Visit `http://localhost:5173/blog` in dev mode
   - Post should appear

4. **Deploy to Netlify**
   - Push to Git or manual deploy
   - Post will be live at https://wagerproof.bet/blog

---

## 📋 Checklist

- [ ] `.env` file created with all 5 variables
- [ ] Netlify environment variables set
- [ ] Ran `npm run build:blog` successfully
- [ ] No "Ghost credentials not configured" errors
- [ ] Ghost instance is accessible
- [ ] Content API key is correct
- [ ] Ready to deploy!

---

## 🔐 Security Notes

⚠️ **Important:**
- The Content API Key is **read-only** (public)
- It can only fetch published posts
- Never use this for sensitive operations
- Don't share this key in public repositories
- Add `.env` to `.gitignore` (it should already be there)

---

## 📞 Troubleshooting

### "Ghost credentials not configured"

**Fix**: Verify `.env` file exists with:
```
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=6a0d47bcaeaf7f13bbc20fce27
```

### "Failed to fetch Ghost posts"

**Check**:
1. Ghost instance is online: https://wagerproof.ghost.io
2. Content API key is correct
3. No posts published yet (that's OK, it will show 0 posts)

### Posts not showing on website

**Check**:
1. Posts are **published** (not drafts)
2. Build script ran successfully
3. Static HTML files exist in `dist/blog/`
4. Netlify deployed the latest build

---

## 🎯 Next Steps

1. ✅ Create `.env` file (see above)
2. ✅ Set Netlify variables
3. ✅ Test locally: `npm run build:blog`
4. ✅ Deploy to Netlify
5. ✅ Create your first blog post in Ghost
6. ✅ Watch it appear at https://wagerproof.bet/blog

---

**You're all set! Your Ghost CMS is ready to power your blog.** 🎉

For more details, see: `GHOST_SETUP.md`

