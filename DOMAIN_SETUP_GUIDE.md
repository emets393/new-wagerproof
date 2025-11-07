# 🌐 Domain Setup Guide - Connect wagerproof.bet to Netlify

## Overview

This guide will help you point your domain `wagerproof.bet` to your Netlify site.

**Time needed**: 10-15 minutes (DNS propagation: 5 minutes to 48 hours)

---

## 📋 Prerequisites

- [ ] Domain registered: `wagerproof.bet`
- [ ] Access to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
- [ ] Netlify site deployed and working
- [ ] Netlify account access

---

## 🎯 PART 1: Add Domain to Netlify

### Step 1.1: Log Into Netlify

1. Go to: https://app.netlify.com
2. Log in with your account
3. Click on your **WagerProof site**

### Step 1.2: Navigate to Domain Settings

1. Click on **"Site configuration"** in the top navigation
2. In the left sidebar, click **"Domain management"**
3. You'll see your current Netlify subdomain (like `amazing-site-123456.netlify.app`)

### Step 1.3: Add Your Custom Domain

1. Look for **"Add a domain"** or **"Add custom domain"** button
2. Click it
3. A popup will appear asking for your domain

### Step 1.4: Enter Your Domain

1. Type: `wagerproof.bet`
2. Click **"Verify"** or **"Add domain"**

### Step 1.5: Confirm Domain Ownership

Netlify will check if you own the domain. You'll see one of two messages:

**Option A: "This domain is already registered"**
- Click **"Yes, add domain"** to continue

**Option B: "Verify you own this domain"**
- You'll need to add a verification record (we'll do this in DNS setup)

### Step 1.6: Set as Primary Domain

1. After adding the domain, you'll see it in your domains list
2. Click the **three dots (...)** next to `wagerproof.bet`
3. Select **"Set as primary domain"**
4. This ensures www redirects to the apex domain

### Step 1.7: Add WWW Subdomain (Optional but Recommended)

1. Click **"Add domain"** again
2. Enter: `www.wagerproof.bet`
3. Click **"Add domain"**
4. Netlify will automatically redirect www to your apex domain

---

## 🔧 PART 2: Configure DNS Records

Now you need to point your domain's DNS to Netlify. You have **two options**:

### Option A: Netlify DNS (Recommended - Easiest)
### Option B: External DNS (Your Current Registrar)

I'll show you both. Choose the one that works best for you.

---

## 🚀 OPTION A: Use Netlify DNS (Recommended)

This is the easiest option. Netlify manages your DNS automatically.

### Step A.1: Get Netlify Name Servers

1. In Netlify, go to **Domain management**
2. Click on your domain `wagerproof.bet`
3. You'll see a section: **"Awaiting External DNS"** or **"DNS Settings"**
4. Click **"Use Netlify DNS"** or **"Set up Netlify DNS"**
5. Netlify will show you 4 name servers like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   dns3.p01.nsone.net
   dns4.p01.nsone.net
   ```
6. **Copy these** - you'll need them in the next step

### Step A.2: Update Name Servers at Your Registrar

Now go to wherever you registered your domain (GoDaddy, Namecheap, etc.):

#### For GoDaddy:
1. Go to: https://dcc.godaddy.com/manage/dns
2. Find `wagerproof.bet`
3. Click **"Manage DNS"**
4. Scroll to **"Nameservers"**
5. Click **"Change"**
6. Select **"Custom"**
7. Enter the 4 Netlify nameservers (one per field)
8. Click **"Save"**

#### For Namecheap:
1. Go to: https://ap.www.namecheap.com/domains/list/
2. Find `wagerproof.bet`
3. Click **"Manage"**
4. Find **"NAMESERVERS"** section
5. Select **"Custom DNS"**
6. Enter the 4 Netlify nameservers
7. Click the green checkmark to save

#### For Google Domains:
1. Go to: https://domains.google.com/registrar
2. Click on `wagerproof.bet`
3. Click **"DNS"** in the left menu
4. Scroll to **"Name servers"**
5. Click **"Use custom name servers"**
6. Enter the 4 Netlify nameservers
7. Click **"Save"**

#### For Cloudflare:
1. Go to: https://dash.cloudflare.com
2. Click on `wagerproof.bet`
3. Go to **"DNS"** tab
4. At the top, click **"Change Nameservers"**
5. Enter the 4 Netlify nameservers
6. Click **"Continue"**

### Step A.3: Wait for DNS Propagation

1. Back in Netlify, it will say **"Waiting for DNS propagation"**
2. This can take:
   - **Fast**: 5-10 minutes
   - **Normal**: 1-2 hours
   - **Slow**: Up to 48 hours (rare)
3. Netlify will automatically verify and set up SSL once DNS propagates

### Step A.4: Verify It's Working

1. Wait at least 10 minutes
2. Try visiting: https://wagerproof.bet
3. Should show your site! ✅
4. Also try: https://www.wagerproof.bet (should redirect to apex)

---

## 🔧 OPTION B: Use External DNS (Keep Current Registrar DNS)

If you want to keep your DNS at your current registrar (GoDaddy, Namecheap, etc.):

### Step B.1: Get Netlify's Load Balancer IP

1. In Netlify, go to **Domain management**
2. Click on `wagerproof.bet`
3. Look for **"DNS Records"** or **"External DNS Configuration"**
4. Note the Netlify Load Balancer IP (usually shows as needed records)

**Netlify Load Balancer**: `75.2.60.5` (this is Netlify's main IP)

### Step B.2: Add DNS Records at Your Registrar

Go to your domain registrar's DNS management page:

#### Record 1: A Record (Apex Domain)

Add this record:
```
Type:  A
Host:  @ (or blank, or wagerproof.bet)
Value: 75.2.60.5
TTL:   3600 (or automatic)
```

#### Record 2: CNAME Record (WWW Subdomain)

Add this record:
```
Type:  CNAME
Host:  www
Value: [your-site-name].netlify.app (get this from Netlify)
TTL:   3600 (or automatic)
```

**To find your Netlify site name**:
- In Netlify, go to Site configuration
- Look at the default subdomain (e.g., `amazing-site-123456.netlify.app`)
- Use that as the CNAME value

### Step B.3: Add AAAA Record (IPv6 - Optional)

For IPv6 support (recommended):
```
Type:  AAAA
Host:  @ (or blank)
Value: 2600:1f18:24ba:c800:bb2e:f196:6348:8631
TTL:   3600
```

### Step B.4: Detailed Steps by Registrar

#### For GoDaddy:

1. Go to: https://dcc.godaddy.com/manage/dns
2. Find `wagerproof.bet` and click **"DNS"**
3. Click **"Add"** to add a new record

**Add A Record**:
- Type: `A`
- Name: `@`
- Value: `75.2.60.5`
- TTL: `1 Hour`
- Click **"Save"**

**Add CNAME Record**:
- Type: `CNAME`
- Name: `www`
- Value: `your-site-name.netlify.app` (replace with your actual Netlify subdomain)
- TTL: `1 Hour`
- Click **"Save"**

#### For Namecheap:

1. Go to: https://ap.www.namecheap.com/domains/list/
2. Find `wagerproof.bet` and click **"Manage"**
3. Go to **"Advanced DNS"** tab
4. Click **"Add New Record"**

**Add A Record**:
- Type: `A Record`
- Host: `@`
- Value: `75.2.60.5`
- TTL: `Automatic`
- Click the green checkmark

**Add CNAME Record**:
- Type: `CNAME Record`
- Host: `www`
- Value: `your-site-name.netlify.app`
- TTL: `Automatic`
- Click the green checkmark

#### For Cloudflare:

1. Go to: https://dash.cloudflare.com
2. Click on `wagerproof.bet`
3. Go to **"DNS"** tab
4. Click **"Add record"**

**Add A Record**:
- Type: `A`
- Name: `@` (or `wagerproof.bet`)
- IPv4 address: `75.2.60.5`
- Proxy status: `Proxied` (orange cloud) or `DNS only` (gray cloud)
- TTL: `Auto`
- Click **"Save"**

**Add CNAME Record**:
- Type: `CNAME`
- Name: `www`
- Target: `your-site-name.netlify.app`
- Proxy status: `Proxied` (orange cloud)
- TTL: `Auto`
- Click **"Save"**

### Step B.5: Verify DNS Configuration

Wait 10-30 minutes, then check if DNS is working:

**Option 1: Use Online Tool**
- Go to: https://dnschecker.org
- Enter: `wagerproof.bet`
- Check if A record shows `75.2.60.5`
- Check multiple locations

**Option 2: Use Terminal**
```bash
# Check A record
dig wagerproof.bet +short
# Should show: 75.2.60.5

# Check CNAME for www
dig www.wagerproof.bet +short
# Should show: your-site-name.netlify.app
```

### Step B.6: Enable HTTPS in Netlify

1. Back in Netlify, go to **Domain management**
2. Scroll to **"HTTPS"**
3. Netlify should automatically detect your DNS and provision SSL
4. Click **"Verify DNS configuration"** if needed
5. Wait 1-5 minutes for SSL certificate to be issued

---

## 🔒 PART 3: Enable HTTPS/SSL

### Step 3.1: Automatic SSL (Let's Encrypt)

Netlify automatically provisions SSL certificates:

1. In Netlify, go to **Domain management**
2. Scroll to **"HTTPS"** section
3. You should see: **"Let's Encrypt certificate"**
4. If it says "Waiting", wait a few minutes
5. Once provisioned, you'll see: **"Your site has HTTPS enabled"** ✅

### Step 3.2: Force HTTPS Redirect

Make sure all HTTP traffic redirects to HTTPS:

1. In the **"HTTPS"** section
2. Find **"Force HTTPS redirect"** or **"Force TLS connections"**
3. Toggle it **ON**
4. This ensures all visitors use HTTPS

### Step 3.3: HTTP Strict Transport Security (HSTS)

Optional but recommended for security:

1. In **"HTTPS"** section
2. Enable **"HSTS"** if available
3. This tells browsers to always use HTTPS

---

## ✅ PART 4: Verify Everything Works

### Step 4.1: Test Your Domain

Open your browser and test these URLs:

1. **http://wagerproof.bet** 
   - Should redirect to https://wagerproof.bet ✅

2. **https://wagerproof.bet**
   - Should load your site with green lock icon ✅

3. **http://www.wagerproof.bet**
   - Should redirect to https://wagerproof.bet ✅

4. **https://www.wagerproof.bet**
   - Should redirect to https://wagerproof.bet ✅

### Step 4.2: Check SSL Certificate

1. Visit: https://wagerproof.bet
2. Click the **lock icon** in browser address bar
3. Click **"Certificate"** or **"Connection is secure"**
4. Should show:
   - Issued by: Let's Encrypt
   - Valid for: wagerproof.bet and www.wagerproof.bet

### Step 4.3: Test Loading Speed

1. Go to: https://pagespeed.web.dev
2. Enter: `https://wagerproof.bet`
3. Click **"Analyze"**
4. Should get good scores (Netlify is fast!)

### Step 4.4: Check DNS Propagation

1. Go to: https://dnschecker.org
2. Enter: `wagerproof.bet`
3. Should show green checkmarks in most locations
4. If some are red, wait a bit longer for propagation

---

## 🔧 Troubleshooting

### Issue: "Domain not found" or DNS errors

**Solution:**
1. Wait longer (DNS can take up to 48 hours)
2. Clear your DNS cache:
   ```bash
   # Mac
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```
3. Try in incognito/private browsing mode
4. Try on mobile data (different DNS)

### Issue: SSL certificate not provisioning

**Solution:**
1. Verify DNS is pointing correctly (use dnschecker.org)
2. In Netlify, click **"Verify DNS configuration"**
3. Remove and re-add the domain
4. Wait 5-10 minutes after DNS is confirmed working

### Issue: "Too many redirects" error

**Solution:**
1. Check your netlify.toml redirects
2. Make sure you don't have conflicting redirects
3. If using Cloudflare, set SSL to "Full" mode (not "Flexible")

### Issue: Shows old/cached content

**Solution:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Try incognito mode

### Issue: WWW not redirecting to apex

**Solution:**
1. Make sure `wagerproof.bet` is set as **primary domain** in Netlify
2. Check that www CNAME record exists
3. Wait for DNS propagation

---

## 📊 Current Configuration Summary

After setup, your configuration should be:

### DNS Records (Option A - Netlify DNS)
```
Nameservers:
- dns1.p01.nsone.net
- dns2.p01.nsone.net
- dns3.p01.nsone.net
- dns4.p01.nsone.net
```

### DNS Records (Option B - External DNS)
```
Type    Host    Value
A       @       75.2.60.5
CNAME   www     your-site-name.netlify.app
AAAA    @       2600:1f18:24ba:c800:bb2e:f196:6348:8631 (optional)
```

### Netlify Settings
```
Primary Domain: wagerproof.bet
Aliases: www.wagerproof.bet
HTTPS: Enabled (Let's Encrypt)
Force HTTPS: Enabled
Branch Deploy: main
```

---

## 🎉 Success Checklist

- [ ] Domain added to Netlify
- [ ] DNS records configured (nameservers or A/CNAME)
- [ ] DNS propagation complete (checked with dnschecker.org)
- [ ] HTTPS/SSL certificate issued
- [ ] Force HTTPS enabled
- [ ] http://wagerproof.bet redirects to https://wagerproof.bet
- [ ] www.wagerproof.bet redirects to wagerproof.bet
- [ ] Site loads correctly with no errors
- [ ] Ghost blog works at /blog
- [ ] All pages load correctly

---

## ⏱️ Timeline

| Step | Time |
|------|------|
| Add domain to Netlify | 2 minutes |
| Configure DNS at registrar | 5 minutes |
| DNS propagation | 10 min - 48 hours |
| SSL certificate issuance | 1-5 minutes |
| Testing | 5 minutes |
| **Total (typical)** | **30 min - 2 hours** |

---

## 🔗 Useful Links

- **Netlify Dashboard**: https://app.netlify.com
- **DNS Checker**: https://dnschecker.org
- **SSL Checker**: https://www.ssllabs.com/ssltest/
- **PageSpeed Insights**: https://pagespeed.web.dev
- **Netlify DNS Docs**: https://docs.netlify.com/domains-https/netlify-dns/

---

## 📝 Next Steps After Domain Is Live

1. ✅ Update Ghost configuration to use new domain
2. ✅ Update any hardcoded URLs in your code
3. ✅ Submit new domain to Google Search Console
4. ✅ Update social media links
5. ✅ Test all functionality on live domain
6. ✅ Set up monitoring/analytics

---

## 🆘 Need Help?

### Check Netlify Status
- If nothing works, check: https://www.netlifystatus.com

### Netlify Support
- Docs: https://docs.netlify.com
- Forum: https://answers.netlify.com

### Common Commands

```bash
# Check where domain is pointing
dig wagerproof.bet +short

# Check www subdomain
dig www.wagerproof.bet +short

# Check nameservers
dig wagerproof.bet NS +short

# Check SSL
curl -I https://wagerproof.bet
```

---

**You're all set!** Once DNS propagates, your site will be live at `https://wagerproof.bet` 🎉

