# SEO Testing Checklist - WagerProof

Complete this checklist after deploying to production to ensure all SEO improvements are working correctly.

---

## 🔍 Pre-Deployment Testing (Local)

### 1. Test Sitemap Accessibility
- [ ] Navigate to: `http://localhost:8080/sitemap.xml`
- [ ] Verify XML displays correctly
- [ ] Check all 4 URLs are listed
- [ ] Confirm no syntax errors

### 2. Test Robots.txt
- [ ] Navigate to: `http://localhost:8080/robots.txt`
- [ ] Verify ChatGPT-User is listed
- [ ] Confirm sitemap URL is correct
- [ ] Check all user agents are allowed

### 3. Test Meta Tags
**Landing Page (http://localhost:8080/ or /home):**
- [ ] Right-click → View Page Source
- [ ] Verify `<title>` contains "WagerProof"
- [ ] Check `og:image` uses absolute URL (https://www.wagerproof.bet/...)
- [ ] Verify `og:image:width` is 1200
- [ ] Verify `og:image:height` is 630
- [ ] Check Twitter card meta tags

**Privacy Policy (http://localhost:8080/privacy-policy):**
- [ ] View Page Source
- [ ] Verify custom title: "Privacy Policy | WagerProof"
- [ ] Check meta description exists
- [ ] Verify canonical URL

**Terms (http://localhost:8080/terms-and-conditions):**
- [ ] View Page Source
- [ ] Verify custom title: "Terms and Conditions | WagerProof"
- [ ] Check meta description exists
- [ ] Verify canonical URL

### 4. Test Structured Data (Local)
- [ ] Open landing page
- [ ] Right-click → View Page Source
- [ ] Search for `application/ld+json`
- [ ] Verify 3 schema blocks exist:
  - Organization
  - WebSite
  - FAQPage

---

## 🚀 Post-Deployment Testing (Production)

### Production URLs
Replace `www.wagerproof.bet` with your actual domain if different.

### 1. Verify Sitemap
```
https://www.wagerproof.bet/sitemap.xml
```
- [ ] Loads without errors
- [ ] Returns correct XML content
- [ ] All URLs use HTTPS

### 2. Verify Robots.txt
```
https://www.wagerproof.bet/robots.txt
```
- [ ] Loads successfully
- [ ] Sitemap reference is correct
- [ ] All crawlers allowed

### 3. Test with Google Tools

#### Rich Results Test
1. [ ] Go to: https://search.google.com/test/rich-results
2. [ ] Test URL: `https://www.wagerproof.bet/`
3. [ ] Verify results show:
   - Organization ✓
   - WebSite ✓
   - FAQPage ✓
4. [ ] Check for zero errors

#### Mobile-Friendly Test
1. [ ] Go to: https://search.google.com/test/mobile-friendly
2. [ ] Test URL: `https://www.wagerproof.bet/`
3. [ ] Verify "Page is mobile-friendly"

#### PageSpeed Insights
1. [ ] Go to: https://pagespeed.web.dev/
2. [ ] Test URL: `https://www.wagerproof.bet/`
3. [ ] Check scores for:
   - Performance
   - Accessibility
   - Best Practices
   - SEO

### 4. Test Social Media Previews

#### Facebook Sharing Debugger
1. [ ] Go to: https://developers.facebook.com/tools/debug/
2. [ ] Enter: `https://www.wagerproof.bet/`
3. [ ] Click "Debug"
4. [ ] Verify:
   - Image displays correctly (1200x630)
   - Title is correct
   - Description is correct
   - No warnings/errors

#### Twitter Card Validator
1. [ ] Go to: https://cards-dev.twitter.com/validator
2. [ ] Enter: `https://www.wagerproof.bet/`
3. [ ] Verify:
   - Card type: Summary with Large Image
   - Image displays correctly
   - Title and description correct

#### LinkedIn Post Inspector
1. [ ] Go to: https://www.linkedin.com/post-inspector/
2. [ ] Enter: `https://www.wagerproof.bet/`
3. [ ] Verify:
   - Image displays
   - Title and description correct
   - No errors

### 5. Test Schema Markup

#### Schema.org Validator
1. [ ] Go to: https://validator.schema.org/
2. [ ] Enter: `https://www.wagerproof.bet/`
3. [ ] Verify:
   - No errors
   - Organization schema valid
   - WebSite schema valid
   - FAQPage schema valid

---

## 🔧 Google Search Console Setup

### Initial Setup
1. [ ] Go to: https://search.google.com/search-console
2. [ ] Add property: `www.wagerproof.bet`
3. [ ] Verify ownership (DNS or HTML file)
4. [ ] Submit sitemap: `https://www.wagerproof.bet/sitemap.xml`

### Monitor These Metrics
- [ ] Pages indexed (should be 4+)
- [ ] Crawl errors (should be 0)
- [ ] Mobile usability issues (should be 0)
- [ ] Rich results status
- [ ] Average position for keywords
- [ ] Click-through rate

### Request Indexing
For each page:
1. [ ] Landing page: `/`
2. [ ] Privacy: `/privacy-policy`
3. [ ] Terms: `/terms-and-conditions`

Use "Request Indexing" in Search Console for immediate crawl.

---

## 📊 Analytics Setup (Recommended)

### Google Analytics 4
1. [ ] Create GA4 property
2. [ ] Add tracking code to site
3. [ ] Set up conversions:
   - Sign ups
   - Page views
   - Button clicks
4. [ ] Verify data is flowing

### Track These Events
- [ ] Landing page views
- [ ] Privacy policy views
- [ ] Terms page views
- [ ] CTA button clicks
- [ ] Social link clicks
- [ ] Sign up initiations

---

## 🤖 ChatGPT Discoverability Test

### Manual Verification
1. [ ] Check robots.txt allows `ChatGPT-User` and `GPTBot`
2. [ ] Verify sitemap is accessible
3. [ ] Ensure all public pages are in sitemap
4. [ ] Confirm no authentication required for public pages

### Test ChatGPT (After a few weeks)
1. [ ] Ask ChatGPT: "What is WagerProof?"
2. [ ] Check if it references your site
3. [ ] Verify information is accurate

---

## 🔍 SEO Audit Tools

### Run These Tools (Optional)
1. [ ] **Screaming Frog SEO Spider** - Crawl site for technical issues
2. [ ] **Ahrefs Site Audit** - Comprehensive SEO analysis
3. [ ] **SEMrush Site Audit** - SEO health check
4. [ ] **Lighthouse CI** - Automated testing

---

## ✅ Success Criteria

### Immediate (Day 1)
- ✅ All pages load without errors
- ✅ Sitemap accessible
- ✅ Robots.txt accessible
- ✅ Meta tags render correctly
- ✅ Structured data validates
- ✅ Social previews work

### Short-term (1-2 weeks)
- ✅ Google indexes all pages
- ✅ No crawl errors in Search Console
- ✅ Rich results appear in Search Console
- ✅ Mobile usability passes

### Long-term (1-3 months)
- ✅ Improved organic traffic
- ✅ Better keyword rankings
- ✅ Higher click-through rates
- ✅ More social shares
- ✅ FAQ appears in search results

---

## 🐛 Troubleshooting

### Sitemap Not Loading
- Check file exists in `/public` folder
- Verify build process includes public files
- Check server configuration

### Meta Tags Not Rendering
- Verify react-helmet-async is working
- Check browser doesn't block dynamic meta tags
- Test in production build (not just dev)

### Structured Data Errors
- Validate JSON-LD syntax
- Check all required fields present
- Test with Google Rich Results Test

### Social Previews Not Working
- Verify absolute URLs for images
- Check image dimensions (1200x630)
- Clear Facebook cache in debugger
- Wait 24-48 hours for cache update

### Not Indexed by Google
- Submit sitemap in Search Console
- Request indexing for each page
- Check for noindex tags
- Verify robots.txt allows Googlebot

---

## 📝 Notes

**Date Tested:** _______________

**Tester:** _______________

**Domain:** _______________

**Issues Found:**
```
[List any issues discovered during testing]
```

**Action Items:**
```
[List any follow-up tasks]
```

---

## 🎉 Completion

Once all items are checked:
- [ ] All tests passed
- [ ] Sitemap submitted to Google
- [ ] Analytics tracking verified
- [ ] Social previews confirmed
- [ ] No critical errors

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

**Last Updated:** October 15, 2025

