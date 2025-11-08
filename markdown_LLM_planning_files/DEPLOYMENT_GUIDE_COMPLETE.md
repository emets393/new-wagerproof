# 🚀 Complete Ghost + Netlify Deployment Guide
## Step-by-Step Instructions (Explain Like I'm 5)

This guide assumes you know nothing. Follow every step exactly.

---

## 🎯 What You're Going to Do

You're going to connect your blog (Ghost) to your website (Netlify) so when you write a blog post, it automatically shows up on your website.

**Time needed**: 30-45 minutes

---

## 📋 PART 1: Get Your Ghost API Key

### Step 1.1: Open Ghost Admin

1. Open your web browser (Chrome, Safari, etc.)
2. Type this in the address bar: `https://wagerproof.ghost.io/admin`
3. Press Enter
4. Log in with your Ghost username and password

### Step 1.2: Navigate to Settings

1. Look at the **left side** of the screen
2. Scroll down to the **bottom** of the left sidebar
3. You'll see a **gear icon ⚙️** with the word "Settings"
4. Click on "Settings"

### Step 1.3: Open Integrations

1. You're now on the Settings page
2. Look for a menu on the **left side** with options like "General", "Design", etc.
3. Find and click on **"Integrations"**
4. You'll see a page that says "Integrations" at the top

### Step 1.4: Create a New Integration

1. Look for a button that says **"+ Add custom integration"**
2. Click that button
3. A popup window will appear

### Step 1.5: Name Your Integration

1. In the popup, you'll see a text field labeled "Name"
2. Type exactly: `WagerProof Website`
3. Click the **"Create"** button

### Step 1.6: Copy Your API Key

1. You'll see a new screen with details about your integration
2. Look for a section labeled **"Content API Key"**
3. You'll see a long string of letters and numbers (like `6a0d47bcaeaf7f13bbc20fce27`)
4. Click the **"Copy"** button next to it (looks like two overlapping squares)
5. **IMPORTANT**: Open a text file (Notes, TextEdit, Notepad) and paste this key there
6. You'll need this key in the next steps

✅ **Checkpoint**: You should have a key that looks like `6a0d47bcaeaf7f13bbc20fce27` saved somewhere

**Keep this browser tab open** - you'll come back to it later!

---

## 📋 PART 2: Create Your Local Environment File

### Step 2.1: Open Your Project in an Editor

1. Open **VS Code** (or whatever code editor you use)
2. Click **File** → **Open Folder**
3. Navigate to: `/Users/chrishabib/Documents/new-wagerproof`
4. Click **Open**

### Step 2.2: Create the .env File

1. In VS Code, look at the **left sidebar** (the file explorer)
2. You should see your project files
3. Right-click in the empty space in the file list
4. Choose **"New File"**
5. Name it exactly: `.env` (yes, it starts with a dot)
6. Press Enter

### Step 2.3: Add Your Environment Variables

1. The `.env` file should now be open in the editor
2. Copy and paste this **exactly** into the file:

```bash
# Site Configuration
SITE_URL=https://wagerproof.bet

# Ghost CMS Configuration
GHOST_URL=https://wagerproof.ghost.io
GHOST_CONTENT_KEY=PASTE_YOUR_KEY_HERE

# For Vite (client-side usage)
VITE_GHOST_URL=https://wagerproof.ghost.io
VITE_GHOST_CONTENT_KEY=PASTE_YOUR_KEY_HERE
```

3. Now, find the two places where it says `PASTE_YOUR_KEY_HERE`
4. Replace both with the key you copied from Ghost (the one you saved in your notes)
5. It should look like this:
```bash
GHOST_CONTENT_KEY=6a0d47bcaeaf7f13bbc20fce27
```

### Step 2.4: Save the File

1. Press **Cmd+S** (Mac) or **Ctrl+S** (Windows)
2. Or click **File** → **Save**

✅ **Checkpoint**: Your `.env` file should have 5 lines with environment variables, and your API key should be in two places

**IMPORTANT**: Keep this `.env` file secret! Never share it publicly or commit it to Git.

---

## 📋 PART 3: Test It Locally

### Step 3.1: Open Terminal

1. In VS Code, go to the top menu
2. Click **Terminal** → **New Terminal**
3. A terminal window will open at the bottom of VS Code

### Step 3.2: Make Sure You're in the Right Place

1. In the terminal, type: `pwd`
2. Press Enter
3. You should see: `/Users/chrishabib/Documents/new-wagerproof`
4. If not, type: `cd /Users/chrishabib/Documents/new-wagerproof` and press Enter

### Step 3.3: Run the Blog Build Command

1. Type exactly: `npm run build:blog`
2. Press Enter
3. Wait for it to finish (might take 10-20 seconds)

### Step 3.4: Check the Output

**What you SHOULD see** (good ✅):
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

**If you see errors** (need to fix ❌):
- `"Ghost credentials not configured"` → Your `.env` file isn't set up right. Go back to Part 2.
- `"dist/ directory not found"` → Type `npm run build` first, then try again
- `"Failed to fetch"` → Check your Ghost URL and API key are correct

### Step 3.5: Run Full Build

1. Type: `npm run build`
2. Press Enter
3. Wait for it to finish (might take 30-60 seconds)
4. You should see a lot of output ending with `✅ Blog build complete!`

✅ **Checkpoint**: The build completed without errors

---

## 📋 PART 4: Set Up Netlify

### Step 4.1: Log Into Netlify

1. Open a new browser tab
2. Go to: `https://app.netlify.com`
3. Log in with your Netlify account
4. You should see your dashboard with your sites

### Step 4.2: Find Your Site

1. Look for your WagerProof site in the list
2. Click on it
3. You'll see your site's dashboard

**Don't have a site yet?**
- Click **"Add new site"** → **"Import an existing project"**
- Connect your Git repository (GitHub, GitLab, etc.)
- Select the `new-wagerproof` repository
- Netlify will detect it's a Vite project automatically
- Click **"Deploy site"**

### Step 4.3: Go to Site Settings

1. You're on your site's dashboard
2. Look at the **top navigation tabs**: Overview, Deploys, Site configuration, etc.
3. Click on **"Site configuration"**

### Step 4.4: Open Environment Variables

1. On the left sidebar, look for **"Environment variables"**
2. Click on **"Environment variables"**
3. You'll see a page that might say "No environment variables" if this is your first time

### Step 4.5: Add Environment Variables (First Variable)

1. Click the **"Add a variable"** button
2. You'll see a dropdown, choose **"Add a single variable"**

**Variable 1: SITE_URL**
- In the **Key** field, type exactly: `SITE_URL`
- In the **Value** field, type exactly: `https://wagerproof.bet`
- Click **"Create variable"**

### Step 4.6: Add More Variables

Repeat Step 4.5 for each of these (click "Add a variable" each time):

**Variable 2: GHOST_URL**
- Key: `GHOST_URL`
- Value: `https://wagerproof.ghost.io`
- Click "Create variable"

**Variable 3: GHOST_CONTENT_KEY**
- Key: `GHOST_CONTENT_KEY`
- Value: [Paste your API key from Ghost - the long string you saved]
- Click "Create variable"

**Variable 4: VITE_GHOST_URL**
- Key: `VITE_GHOST_URL`
- Value: `https://wagerproof.ghost.io`
- Click "Create variable"

**Variable 5: VITE_GHOST_CONTENT_KEY**
- Key: `VITE_GHOST_CONTENT_KEY`
- Value: [Paste your API key from Ghost again]
- Click "Create variable"

✅ **Checkpoint**: You should now see 5 environment variables listed

---

## 📋 PART 5: Deploy to Netlify

### Step 5.1: Go Back to Your Terminal

1. You should still have VS Code open with the terminal at the bottom
2. If you closed it, open Terminal again (Terminal → New Terminal)

### Step 5.2: Check Git Status

1. Type: `git status`
2. Press Enter
3. You should see `.env` is NOT listed (it's in .gitignore - good!)
4. You might see other changed files - that's okay

### Step 5.3: Commit and Push Your Changes

1. Type: `git add .`
2. Press Enter
3. Type: `git commit -m "Configure environment for Ghost blog"`
4. Press Enter
5. Type: `git push origin main`
6. Press Enter

**If you get an error about "no changes to commit"**, that's okay - skip to Step 5.4

### Step 5.4: Watch Netlify Deploy

1. Go back to your Netlify browser tab
2. Click on **"Deploys"** in the top navigation
3. You should see a new deploy starting (it might say "Building")
4. Click on that deploy to see the logs
5. Wait for it to finish (2-5 minutes usually)

**What you're waiting for**:
- Status should change from "Building" to "Published"
- You'll see a green checkmark ✅

**If it fails**:
- Click on the failed deploy
- Look at the logs for error messages
- Most common issue: environment variables not set correctly (go back to Part 4)

✅ **Checkpoint**: Deploy shows "Published" with a green checkmark

---

## 📋 PART 6: Set Up Auto-Build Webhook

This makes Ghost automatically rebuild your Netlify site when you publish a post.

### Step 6.1: Create Netlify Build Hook

1. Still in Netlify, click on **"Site configuration"** in the top navigation
2. On the left sidebar, find and click **"Build & deploy"**
3. Scroll down to find **"Build hooks"** section
4. Click **"Add build hook"**

### Step 6.2: Configure the Build Hook

1. A popup will appear
2. For **"Build hook name"**, type: `Ghost Blog Publish`
3. For **"Branch to build"**, select: `main` (or whatever your production branch is)
4. Click **"Save"**

### Step 6.3: Copy the Webhook URL

1. You'll see your new build hook listed
2. It has a URL like: `https://api.netlify.com/build_hooks/xxxxxxxxxxxxxxxxxx`
3. Click the **copy icon** next to it (or right-click → copy)
4. **Save this URL** in your notes - you need it in the next step

### Step 6.4: Go Back to Ghost

1. Go back to your Ghost browser tab (from Part 1)
2. You should still be on your "WagerProof Website" integration page
3. If you closed it:
   - Go to `https://wagerproof.ghost.io/admin`
   - Settings → Integrations
   - Click on "WagerProof Website"

### Step 6.5: Add Webhook in Ghost

1. Look for a section called **"Webhooks"**
2. Click **"Add webhook"**
3. A form will appear

### Step 6.6: Configure Ghost Webhook

Fill in the form:

1. **Name**: Type `Netlify Auto Build`
2. **Event**: Click the dropdown and select **"Post published"**
3. **Target URL**: Paste the Netlify webhook URL you copied in Step 6.3
4. Click **"Create"**

**Optional but recommended**: Add another webhook for post updates
- Click "Add webhook" again
- Name: `Netlify Post Update`
- Event: **"Post updated"**
- Target URL: Same Netlify URL
- Click "Create"

✅ **Checkpoint**: You should see your webhooks listed in Ghost

---

## 📋 PART 7: Test Everything

### Step 7.1: Create a Test Blog Post

1. Still in Ghost Admin (`https://wagerproof.ghost.io/admin`)
2. Look at the left sidebar
3. Click on **"Posts"**
4. Click **"New post"** (big button in the top right)

### Step 7.2: Write Your Test Post

1. Click in the title area
2. Type a title: `Test Blog Post`
3. Click in the content area below
4. Type some content: `This is my first test blog post. If you can read this, everything is working!`
5. (Optional) Add a featured image by clicking the + button

### Step 7.3: Set URL Slug

1. Click the **Settings** icon (⚙️) in the top right
2. A sidebar will open
3. Find **"Post URL"**
4. Change it to: `test-blog-post` (all lowercase, dashes between words)

### Step 7.4: Add SEO Description

1. Still in the settings sidebar
2. Scroll down to **"Meta description"**
3. Type: `This is a test blog post to verify the Ghost and Netlify integration is working.`
4. Click the **X** to close the sidebar

### Step 7.5: Publish the Post

1. Look at the **top right corner**
2. Click the **"Publish"** button (might say "Preview" first, then "Publish")
3. A popup will appear
4. Click **"Publish"** again to confirm
5. Click **"Close"** or the X

### Step 7.6: Watch Netlify Auto-Build

1. Go to your Netlify tab in the browser
2. Click on **"Deploys"**
3. Within 10-30 seconds, you should see a **new deploy appear**!
4. It should say "Triggered by Ghost Blog Publish"
5. Wait for it to finish building (2-5 minutes)
6. Status should change to "Published" ✅

**If no new deploy appears**:
- Wait 1-2 minutes (sometimes there's a delay)
- Go back to Ghost → Settings → Integrations → Your Integration → Webhooks
- Check that the webhook URL is correct
- Try publishing another post

### Step 7.7: Check Your Live Blog

1. Open a new browser tab
2. Go to: `https://wagerproof.bet/blog`
3. You should see your blog post listed!
4. Click on your test post
5. You should see: `https://wagerproof.bet/blog/test-blog-post`
6. Your post content should be visible

### Step 7.8: Verify SEO (View Source)

1. On your blog post page, right-click anywhere
2. Choose **"View Page Source"** (or press Cmd+Option+U on Mac, Ctrl+U on Windows)
3. A new tab opens with HTML code
4. Press Cmd+F (Mac) or Ctrl+F (Windows) to search
5. Search for: `ssg-generated`
6. You should find: `<meta name="ssg-generated" content="true">`
7. This means your page is pre-rendered for SEO ✅

✅ **Checkpoint**: Your test post is live on your website!

---

## 📋 PART 8: Submit to Google

### Step 8.1: Open Google Search Console

1. Open a new browser tab
2. Go to: `https://search.google.com/search-console`
3. Log in with your Google account

### Step 8.2: Add Your Property (if not already added)

1. Click **"Add Property"** in the top left
2. Choose **"URL prefix"**
3. Type: `https://wagerproof.bet`
4. Click **"Continue"**

### Step 8.3: Verify Ownership

Google will give you several options to verify ownership:

**Easiest method: HTML tag**
1. Choose **"HTML tag"** method
2. Copy the meta tag
3. Go to your code editor (VS Code)
4. Open: `index.html`
5. Find the `<head>` section
6. Paste the meta tag inside `<head>`
7. Save the file
8. Commit and push:
   ```bash
   git add index.html
   git commit -m "Add Google verification tag"
   git push origin main
   ```
9. Wait for Netlify to deploy (2-5 minutes)
10. Go back to Google Search Console
11. Click **"Verify"**

**Alternative: DNS verification** (if you have access to your domain settings)
- Follow Google's instructions to add a TXT record

### Step 8.4: Submit Your Sitemap

1. Once verified, you'll be on your property dashboard
2. Look at the left sidebar
3. Click on **"Sitemaps"**
4. You'll see a field that says "Add a new sitemap"
5. Type: `sitemap.xml`
6. Click **"Submit"**
7. You should see "Success" ✅

### Step 8.5: Request Indexing (Optional but Recommended)

1. In the left sidebar, click **"URL Inspection"**
2. Type your blog post URL: `https://wagerproof.bet/blog/test-blog-post`
3. Press Enter
4. Wait for it to check
5. Click **"Request Indexing"**
6. Wait for confirmation

✅ **Checkpoint**: Your sitemap is submitted to Google!

---

## 📋 PART 9: Write Your First Real Post

### Step 9.1: Go to Ghost Posts

1. Go to `https://wagerproof.ghost.io/admin`
2. Click **"Posts"** in the left sidebar
3. Click **"New post"**

### Step 9.2: Write Great Content

**Title Best Practices**:
- Make it catchy and clear
- Include keywords your audience searches for
- Example: "How to Track Your Sports Betting ROI"

**Content Best Practices**:
- Write at least 300 words (longer is better for SEO)
- Use headings (H2, H3) to break up content
- Add images (click + button, choose Image)
- Link to other pages when relevant
- Write for humans first, search engines second

### Step 9.3: Add Featured Image

1. Click the **+** button at the top
2. Choose **"Image"**
3. Upload a relevant image (1200x630px recommended)
4. This image will show up when people share your post

### Step 9.4: Optimize for SEO

1. Click the **Settings** icon (⚙️) top right
2. **Post URL**: Make it short and descriptive
   - Good: `track-betting-roi`
   - Bad: `how-to-track-your-sports-betting-roi-in-2024-complete-guide`
3. **Meta Title**: Keep under 60 characters
4. **Meta Description**: 150-160 characters, make it compelling
5. **Tags**: Add relevant tags (creates categories)

### Step 9.5: Preview Before Publishing

1. Click **"Preview"** button (top right)
2. Review how it looks
3. Check for typos
4. Make sure images load
5. Close preview when satisfied

### Step 9.6: Publish

1. Click **"Publish"**
2. Confirm by clicking **"Publish"** again
3. Netlify will automatically build (2-5 minutes)
4. Your post will be live at `https://wagerproof.bet/blog/your-slug`

✅ **Checkpoint**: You've published your first real blog post!

---

## 🎉 YOU'RE DONE!

### What You've Accomplished

✅ Connected Ghost CMS to Netlify  
✅ Set up automatic deployments  
✅ Created environment variables  
✅ Published your first blog post  
✅ Configured webhooks for auto-builds  
✅ Submitted your sitemap to Google  
✅ Optimized for SEO  

### What Happens Now (Automatic Workflow)

1. **You write** a post in Ghost Admin
2. **You click** "Publish"
3. **Ghost tells** Netlify "new post published!" (webhook)
4. **Netlify builds** your entire site with the new post
5. **Your site updates** automatically (2-5 minutes)
6. **Google finds** your new post through the sitemap
7. **Readers enjoy** your content!

### Important URLs to Bookmark

- **Ghost Admin**: https://wagerproof.ghost.io/admin (write posts here)
- **Your Blog**: https://wagerproof.bet/blog (your live blog)
- **Netlify Dashboard**: https://app.netlify.com (check deploys)
- **Google Search Console**: https://search.google.com/search-console (SEO stats)

---

## 🆘 Common Problems & Solutions

### Problem: "Ghost credentials not configured"

**What it means**: Your `.env` file isn't set up correctly

**Fix**:
1. Open your `.env` file
2. Check that `GHOST_URL` and `GHOST_CONTENT_KEY` are there
3. Check there are no extra spaces or quotes
4. Should look like: `GHOST_URL=https://wagerproof.ghost.io`
5. Save and try again

### Problem: Blog post not showing up

**What to check**:
1. Is the post published (not draft)? Ghost Admin → Posts → check status
2. Did Netlify finish building? Netlify → Deploys → check latest status
3. Is the build successful? Check for errors in deploy logs
4. Try clearing your browser cache (Cmd+Shift+R / Ctrl+Shift+F5)

### Problem: Webhook not triggering builds

**What to check**:
1. Netlify → Site configuration → Build & deploy → Build hooks
2. Copy the webhook URL
3. Ghost Admin → Settings → Integrations → Your Integration
4. Check webhook URL matches
5. Try publishing a new post to test

### Problem: Build fails on Netlify

**What to check**:
1. Netlify → Deploys → Click on the failed deploy
2. Read the error message
3. Common causes:
   - Environment variables missing → Add them in Site configuration
   - Ghost API key wrong → Update in environment variables
   - Dependency error → Might need to update package.json

### Problem: Post shows but looks wrong

**What to check**:
1. Did you add CSS? Images?
2. Check Ghost post editor for broken formatting
3. Try re-publishing the post
4. Clear your browser cache

---

## 📞 Need More Help?

### Check These Files in Your Project

- `GHOST_SETUP.md` - Ghost configuration details
- `netlify.toml` - Netlify settings
- `package.json` - Build commands
- `scripts/build-blog.mjs` - Blog build script

### Useful Commands

```bash
npm run build          # Full build (Vite + Blog)
npm run build:blog     # Just build the blog
npm run verify:blog    # Check blog build is correct
npm run dev            # Development server
```

### Testing Locally

```bash
npm run build          # Build everything
npm run preview        # Preview the built site
```

Then visit: `http://localhost:4173/blog`

---

## 🎓 Pro Tips

### Writing Great Blog Posts

1. **Consistency**: Post regularly (weekly is good)
2. **Quality over quantity**: One great post > five mediocre ones
3. **Headlines matter**: Spend time on your title
4. **Use images**: Posts with images get more engagement
5. **Internal links**: Link to your other pages/posts
6. **CTA**: End with a call-to-action (sign up, download, etc.)

### SEO Best Practices

1. **Keywords**: Use naturally in title, headings, and content
2. **Meta descriptions**: Write compelling summaries
3. **URL slugs**: Keep short and descriptive
4. **Alt text**: Add to all images (Ghost settings → Image description)
5. **Internal linking**: Link between your posts
6. **Mobile-friendly**: Your site already is (Vite handles this)

### Performance Tips

1. **Optimize images**: Use tools like TinyPNG before uploading
2. **Recommended size**: 1200x630px for featured images
3. **Format**: Use JPG for photos, PNG for graphics
4. **File size**: Keep under 200KB when possible

### Content Ideas

1. Industry news and analysis
2. How-to guides and tutorials
3. Case studies and success stories
4. Data and statistics
5. Behind-the-scenes content
6. User stories and testimonials
7. FAQ posts
8. Seasonal/timely content

---

## ✨ Final Notes

Congratulations! You now have a fully functioning blog with:
- ✅ Automatic deployments
- ✅ SEO optimization
- ✅ Professional CMS (Ghost)
- ✅ Fast hosting (Netlify)
- ✅ Google indexing

**Time from "Publish" to "Live"**: 2-5 minutes ⚡

Now go write amazing content! 🚀✍️

---

**Questions? Issues? Stuck?**

Check the troubleshooting section above or review the detailed documentation files in your project.

Happy blogging! 🎉

