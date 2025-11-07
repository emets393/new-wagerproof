# 🌐 GoDaddy Domain Setup - Connect wagerproof.bet to Netlify

## Step-by-Step Guide for GoDaddy

This guide is specifically for GoDaddy. Follow every step exactly.

**Time needed**: 15-20 minutes (DNS propagation: 10 minutes to 2 hours)

---

## 📋 PART 1: Add Domain to Netlify First

### Step 1.1: Log Into Netlify

1. Open your browser
2. Go to: https://app.netlify.com
3. Log in with your Netlify account
4. Click on your **WagerProof site** (or create a new site if needed)

### Step 1.2: Add Your Domain

1. In Netlify, click **"Site configuration"** (top navigation)
2. In the left sidebar, click **"Domain management"**
3. Click the **"Add domain"** button
4. A popup will appear

### Step 1.3: Enter Your Domain

1. In the popup, type: `wagerproof.bet`
2. Click **"Verify"** or **"Add domain"**
3. Netlify will check if you own the domain

### Step 1.4: Set as Primary Domain

1. After adding, you'll see `wagerproof.bet` in your domains list
2. Click the **three dots (...)** next to `wagerproof.bet`
3. Select **"Set as primary domain"**

### Step 1.5: Add WWW Subdomain

1. Click **"Add domain"** again
2. Enter: `www.wagerproof.bet`
3. Click **"Add domain"**
4. Netlify will automatically redirect www to your apex domain

---

## 🎯 PART 2: Configure GoDaddy DNS

Now we'll point your GoDaddy domain to Netlify. You have **two options**:

### 🚀 OPTION A: Use Netlify DNS (RECOMMENDED - Easiest)

This is the easiest method. Netlify manages your DNS automatically.

#### Step A.1: Get Netlify Nameservers

1. In Netlify, go to **Domain management**
2. Click on your domain `wagerproof.bet`
3. You'll see a section: **"Awaiting External DNS"** or **"DNS Settings"**
4. Click **"Use Netlify DNS"** or **"Set up Netlify DNS"**
5. Netlify will show you 4 nameservers like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   dns3.p01.nsone.net
   dns4.p01.nsone.net
   ```
6. **Copy all 4 nameservers** - you'll need them in the next step

#### Step A.2: Log Into GoDaddy

1. Open a new browser tab
2. Go to: https://www.godaddy.com
3. Click **"Sign In"** (top right)
4. Enter your GoDaddy username and password
5. Click **"Sign In"**

#### Step A.3: Navigate to DNS Management

1. After signing in, you'll see your GoDaddy dashboard
2. Click **"My Products"** (top navigation)
3. Find **"Domains"** section
4. Look for `wagerproof.bet` in your domain list
5. Click the **three dots (...)** next to `wagerproof.bet`
6. Click **"Manage DNS"**

**Alternative path**:
- Go directly to: https://dcc.godaddy.com/manage/dns
- Find `wagerproof.bet` and click **"DNS"**

#### Step A.4: Change Nameservers

1. You're now on the DNS management page
2. Scroll down to find **"Nameservers"** section
3. You'll see current nameservers (probably GoDaddy's default ones)
4. Click **"Change"** button next to Nameservers

#### Step A.5: Select Custom Nameservers

1. A popup will appear with options:
   - "GoDaddy Nameservers" (default)
   - "Custom"
2. Select **"Custom"**
3. You'll see 2-4 input fields for nameservers

#### Step A.6: Enter Netlify Nameservers

1. Delete any existing nameservers in the fields
2. Enter the 4 Netlify nameservers you copied:
   - **Field 1**: `dns1.p01.nsone.net`
   - **Field 2**: `dns2.p01.nsone.net`
   - **Field 3**: `dns3.p01.nsone.net`
   - **Field 4**: `dns4.p01.nsone.net`
3. Double-check for typos (no spaces, correct spelling)
4. Click **"Save"** button

#### Step A.7: Confirm Changes

1. GoDaddy will ask you to confirm
2. Click **"Save"** or **"Confirm"** again
3. You might see a warning - that's normal, click **"Continue"**
4. You'll see: **"Nameservers updated successfully"** ✅

#### Step A.8: Wait for DNS Propagation

1. Go back to Netlify
2. In **Domain management**, you'll see: **"Waiting for DNS propagation"**
3. This usually takes:
   - **Fast**: 10-30 minutes
   - **Normal**: 1-2 hours
   - **Slow**: Up to 48 hours (rare)

#### Step A.9: Verify It's Working

1. Wait at least 10 minutes
2. In Netlify, click **"Verify DNS configuration"** (if available)
3. Or wait for Netlify to automatically detect it
4. Once verified, Netlify will automatically:
   - Set up DNS records
   - Provision SSL certificate
   - Enable HTTPS

#### Step A.10: Test Your Site

1. Open a new browser tab
2. Visit: https://wagerproof.bet
3. Your site should load! ✅
4. Also try: https://www.wagerproof.bet (should redirect to apex)

**That's it!** Option A is complete. Skip to Part 3.

---

### 🔧 OPTION B: Keep GoDaddy DNS (Advanced)

If you want to keep your DNS at GoDaddy (maybe you have other records):

#### Step B.1: Get Netlify's IP Address

1. In Netlify, go to **Domain management**
2. Click on `wagerproof.bet`
3. Look for **"External DNS Configuration"** or **"DNS Records"**
4. Note the IP address: `75.2.60.5` (Netlify's load balancer)

#### Step B.2: Get Your Netlify Site Name

1. In Netlify, go to **Site configuration**
2. Look at the default subdomain (e.g., `amazing-site-123456.netlify.app`)
3. **Copy this** - you'll need it for the CNAME record

#### Step B.3: Log Into GoDaddy

1. Go to: https://www.godaddy.com
2. Sign in
3. Go to: https://dcc.godaddy.com/manage/dns
4. Find `wagerproof.bet` and click **"DNS"**

#### Step B.4: Delete Existing A Record (if exists)

1. On the DNS management page, find any existing **A Record** with:
   - Name: `@` or blank
   - Points to: (any IP address)
2. Click the **three dots (...)** next to it
3. Click **"Delete"**
4. Confirm deletion

#### Step B.5: Add New A Record

1. Click **"Add"** button
2. A form will appear
3. Fill in:
   - **Type**: Select **"A"** from dropdown
   - **Name**: Type `@` (or leave blank if it says "Enter hostname")
   - **Value**: Type `75.2.60.5`
   - **TTL**: Select **"1 Hour"** (or "600 seconds")
4. Click **"Save"**

#### Step B.6: Add CNAME Record for WWW

1. Click **"Add"** button again
2. Fill in:
   - **Type**: Select **"CNAME"** from dropdown
   - **Name**: Type `www`
   - **Value**: Type your Netlify site name (e.g., `amazing-site-123456.netlify.app`)
   - **TTL**: Select **"1 Hour"**
3. Click **"Save"**

#### Step B.7: Verify Records

Your DNS records should now look like this:

```
Type    Name    Value                              TTL
A       @       75.2.60.5                         1 Hour
CNAME   www     your-site-name.netlify.app        1 Hour
```

#### Step B.8: Wait for DNS Propagation

1. Wait 10-30 minutes
2. Check DNS propagation: https://dnschecker.org
   - Enter: `wagerproof.bet`
   - Should show `75.2.60.5` in most locations

#### Step B.9: Enable HTTPS in Netlify

1. Back in Netlify, go to **Domain management**
2. Scroll to **"HTTPS"** section
3. Click **"Verify DNS configuration"** (if available)
4. Netlify will automatically provision SSL certificate
5. Wait 1-5 minutes for SSL to be issued

---

## 🔒 PART 3: Enable HTTPS/SSL

### Step 3.1: Automatic SSL Provision

Netlify automatically provisions SSL certificates:

1. In Netlify, go to **Domain management**
2. Scroll to **"HTTPS"** section
3. You should see: **"Let's Encrypt certificate"**
4. Status will show:
   - **"Provisioning"** - Wait a few minutes
   - **"Active"** - ✅ SSL is working!

### Step 3.2: Force HTTPS Redirect

1. In the **"HTTPS"** section
2. Find **"Force HTTPS redirect"** toggle
3. Turn it **ON**
4. This ensures all HTTP traffic redirects to HTTPS

### Step 3.3: Verify HTTPS Works

1. Visit: http://wagerproof.bet
2. Should automatically redirect to: https://wagerproof.bet ✅
3. Check for green lock icon in browser address bar

---

## ✅ PART 4: Final Verification

### Step 4.1: Test All URLs

Open your browser and test these URLs:

1. **http://wagerproof.bet**
   - Should redirect to https://wagerproof.bet ✅

2. **https://wagerproof.bet**
   - Should load your site with green lock ✅

3. **http://www.wagerproof.bet**
   - Should redirect to https://wagerproof.bet ✅

4. **https://www.wagerproof.bet**
   - Should redirect to https://wagerproof.bet ✅

### Step 4.2: Check SSL Certificate

1. Visit: https://wagerproof.bet
2. Click the **lock icon** 🔒 in the address bar
3. Click **"Connection is secure"** or **"Certificate"**
4. Should show:
   - **Issued by**: Let's Encrypt
   - **Valid for**: wagerproof.bet and www.wagerproof.bet

### Step 4.3: Test Your Blog

1. Visit: https://wagerproof.bet/blog
2. Should load your Ghost blog ✅
3. Test a blog post: https://wagerproof.bet/blog/your-post-slug

### Step 4.4: Check DNS Propagation

1. Go to: https://dnschecker.org
2. Enter: `wagerproof.bet`
3. Select **"A"** record type
4. Click **"Search"**
5. Should show green checkmarks ✅ in most locations
6. If some are red, wait a bit longer (propagation can take time)

---

## 🆘 Troubleshooting

### Issue: "Nameservers not updating" in GoDaddy

**Solution:**
1. Make sure you clicked **"Save"** after entering nameservers
2. Check for typos in nameserver addresses
3. Try logging out and back into GoDaddy
4. Wait 15-30 minutes and check again

### Issue: "Domain not found" or DNS errors

**Solution:**
1. Wait longer (DNS can take up to 48 hours, but usually 1-2 hours)
2. Clear your DNS cache:
   ```bash
   # Mac
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   ```
3. Try in incognito/private browsing mode
4. Try on mobile data (different DNS)

### Issue: SSL certificate not provisioning

**Solution:**
1. Verify DNS is pointing correctly:
   - Go to: https://dnschecker.org
   - Check if A record shows `75.2.60.5` (Option B) or Netlify nameservers (Option A)
2. In Netlify, click **"Verify DNS configuration"**
3. Wait 5-10 minutes after DNS is confirmed working
4. If still not working, remove and re-add the domain in Netlify

### Issue: Shows old/cached content

**Solution:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Try incognito mode
4. Wait a few minutes (DNS propagation)

### Issue: "Too many redirects" error

**Solution:**
1. Check your `netlify.toml` file for conflicting redirects
2. Make sure you don't have redirect loops
3. If using Cloudflare (unlikely with GoDaddy), set SSL to "Full" mode

### Issue: Can't find DNS settings in GoDaddy

**Solution:**
1. Make sure you're logged into the correct GoDaddy account
2. Try direct link: https://dcc.godaddy.com/manage/dns
3. Look for "DNS" or "Manage DNS" button
4. If domain is locked, unlock it first (Domain settings → Lock)

---

## 📊 What Your GoDaddy DNS Should Look Like

### If Using Option A (Netlify DNS):

**Nameservers Section:**
```
dns1.p01.nsone.net
dns2.p01.nsone.net
dns3.p01.nsone.net
dns4.p01.nsone.net
```

**All other DNS records** will be managed by Netlify automatically.

### If Using Option B (GoDaddy DNS):

**DNS Records:**
```
Type    Name    Value                              TTL
A       @       75.2.60.5                         1 Hour
CNAME   www     your-site-name.netlify.app        1 Hour
```

**Keep any other records** you need (email, etc.).

---

## ⏱️ Timeline

| Step | Time |
|------|------|
| Add domain to Netlify | 2 minutes |
| Change nameservers in GoDaddy | 5 minutes |
| DNS propagation | 10 min - 2 hours |
| SSL certificate issuance | 1-5 minutes |
| Testing | 5 minutes |
| **Total (typical)** | **30 min - 2 hours** |

---

## 🎉 Success Checklist

- [ ] Domain added to Netlify
- [ ] Nameservers changed in GoDaddy (Option A) OR DNS records added (Option B)
- [ ] DNS propagation complete (checked with dnschecker.org)
- [ ] HTTPS/SSL certificate issued
- [ ] Force HTTPS enabled
- [ ] http://wagerproof.bet redirects to https://wagerproof.bet
- [ ] www.wagerproof.bet redirects to wagerproof.bet
- [ ] Site loads correctly with no errors
- [ ] Ghost blog works at /blog
- [ ] All pages load correctly

---

## 🔗 Useful Links

- **GoDaddy DNS Management**: https://dcc.godaddy.com/manage/dns
- **Netlify Dashboard**: https://app.netlify.com
- **DNS Checker**: https://dnschecker.org
- **SSL Checker**: https://www.ssllabs.com/ssltest/
- **GoDaddy Help**: https://www.godaddy.com/help

---

## 📝 Quick Reference Commands

### Check DNS from Terminal

```bash
# Check A record
dig wagerproof.bet +short
# Should show: 75.2.60.5 (if using Option B)

# Check nameservers
dig wagerproof.bet NS +short
# Should show Netlify nameservers (if using Option A)

# Check www subdomain
dig www.wagerproof.bet +short
# Should show: your-site-name.netlify.app

# Check SSL
curl -I https://wagerproof.bet
# Should show: HTTP/2 200
```

---

## 🎯 Recommended: Use Option A

**Why Option A (Netlify DNS) is better:**
- ✅ Easier to set up (just change nameservers)
- ✅ Netlify manages all DNS automatically
- ✅ Automatic SSL provisioning
- ✅ Better performance
- ✅ Less maintenance

**When to use Option B:**
- You have other DNS records you need to keep
- You're using GoDaddy email or other services
- You want more control over DNS

---

## ✨ You're All Set!

Once DNS propagates (usually 10-30 minutes), your site will be live at:

**https://wagerproof.bet** 🎉

If you run into any issues, check the troubleshooting section above or let me know!

