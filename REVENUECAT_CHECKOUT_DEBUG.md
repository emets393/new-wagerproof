# RevenueCat Checkout Troubleshooting

## Your Configuration
- **RevenueCat App ID**: `ofrng5f087cd113`
- **Production API Key**: `rcb_FimpgqhaUgXMNBUtlduWndNxaHLz`
- **Sandbox API Key**: `rcb_TXEVSXWeblisvQJwlYTinPYQhbQH`
- **Stripe**: Connected in RevenueCat (no direct Stripe keys needed) ✅

## Critical Checklist for Stripe Checkout Issues

### 1. RevenueCat Dashboard - Products Setup
**URL**: https://app.revenuecat.com/projects/app/ofrng5f087cd113/products

**In PRODUCTION Environment:**
- [ ] Product: `wagerproof_monthly_pro` exists with price $40/month
- [ ] Product: `wagerproof_pro_yearly` exists with price $199/year
- [ ] Product: `wagerproof_monthly_pro_discount` exists with price $20/month (for sale mode)
- [ ] Product: `wagerproof_yearly_pro_discount` exists with price $99/year (for sale mode)
- [ ] All products are linked to entitlement: **"WagerProof Pro"**
- [ ] All products are **Active** (not draft/archived)
- [ ] All products have **Web Billing** platform selected

### 2. RevenueCat Dashboard - Offerings Configuration
**URL**: https://app.revenuecat.com/projects/app/ofrng5f087cd113/offerings

**In PRODUCTION Environment:**
- [ ] An offering named **"default"** exists
- [ ] The "default" offering is marked as **"Current"** (green checkmark)
- [ ] Inside "default" offering, these packages are configured:
  - [ ] Package `$rc_monthly` → Product `wagerproof_monthly_pro`
  - [ ] Package `$rc_annual` → Product `wagerproof_pro_yearly`
  - [ ] Package `$rc_monthly_discount` → Product `wagerproof_monthly_pro_discount`
  - [ ] Package `$rc_yearly_discount` → Product `wagerproof_yearly_pro_discount`

### 3. RevenueCat Dashboard - Stripe Connection
**URL**: https://app.revenuecat.com/projects/settings/integrations

- [ ] Stripe is connected with **green checkmark**
- [ ] Connection shows **"Live Mode"** (not just test mode)
- [ ] Click on Stripe integration - verify:
  - [ ] Your Stripe account email is correct
  - [ ] "Connected" status for both Test and Live modes

### 4. RevenueCat Dashboard - Web App Configuration
**URL**: https://app.revenuecat.com/projects/app/ofrng5f087cd113

- [ ] App Name: "WagerProof"
- [ ] Support Email: Set correctly
- [ ] **Allowed Domains** includes:
  - [ ] `https://www.wagerproof.bet`
  - [ ] `https://wagerproof.bet`
  - [ ] `http://localhost:5173` (for local testing)
- [ ] Default Currency: USD
- [ ] Public API Key matches: `rcb_FimpgqhaUgXMNBUtlduWndNxaHLz`

### 5. Stripe Dashboard Verification
**URL**: https://dashboard.stripe.com

**In LIVE MODE (toggle top-right):**
- [ ] Account is **fully activated** (no activation banners)
- [ ] Products → Product Catalog shows 4 products (created by RevenueCat)
- [ ] Settings → Payment methods → "Cards" is enabled
- [ ] No Radar rules blocking your domain

---

## Testing Steps

### Test in Sandbox First
1. Go to: `https://www.wagerproof.bet/admin`
2. Toggle **"Sandbox CC Mode"** to **ON**
3. Page will reload
4. Try checkout with test card: `4242 4242 4242 4242`
5. Check browser console for any errors

**If sandbox works but production fails:**
- ✅ Code is correct
- ❌ Issue is in Production RevenueCat/Stripe configuration

### Test in Production
1. Toggle "Sandbox CC Mode" to **OFF**
2. Try checkout with real card
3. Check browser console for detailed errors:

```javascript
// Your code already logs these details:
Environment: PRODUCTION
Package details: { identifier, productId, price, priceAmount }
Error details: { message, errorCode, underlyingErrorMessage }
```

---

## Common Issues & Solutions

### Issue: "No current offering found"
**Solution:**
- RevenueCat Dashboard → Offerings → Production
- Create "default" offering
- Click "Make Current"
- Add all 4 packages

### Issue: "403 Forbidden" from api.stripe.com
**Solution:**
- RevenueCat → Project Settings → Allowed Domains
- Add your domain: `https://www.wagerproof.bet`
- Wait 5 minutes for cache to clear

### Issue: "Products not found"
**Solution:**
- RevenueCat → Products → **Toggle to PRODUCTION**
- Create all 4 products if they don't exist
- Ensure they're linked to "WagerProof Pro" entitlement

### Issue: "Stripe account not activated"
**Solution:**
- Stripe Dashboard → Complete business verification
- Can take 1-2 business days for approval

---

## Debug Commands

### Check Current Environment
Open browser console on your site and run:

```javascript
// Check which API key is being used
console.log('Check sandbox mode setting in /admin');
```

### View Detailed Purchase Error
The code already logs detailed errors. After attempting a purchase, check console for:
- Environment (PRODUCTION vs SANDBOX)
- Package identifier being purchased
- Full error object with errorCode and underlyingErrorMessage

---

## Need RevenueCat Support?

If issue persists after verifying all above:

1. Go to RevenueCat Dashboard
2. Click Help (?) icon → "Contact Support"
3. Provide:
   - App ID: `ofrng5f087cd113`
   - User ID having issue (from your Supabase auth)
   - Exact timestamp of failed purchase attempt
   - Console error logs
   - Domain: `www.wagerproof.bet`

## What's Already Correct ✅

Your code implementation is solid:
- ✅ Using RevenueCat Web SDK correctly
- ✅ Proper initialization with userId
- ✅ Correct purchase flow with `rcPackage`
- ✅ No Stripe keys needed (handled by RevenueCat)
- ✅ Sandbox/Production mode toggle working
- ✅ Good error logging

**The issue is 99% likely a configuration problem in RevenueCat or Stripe dashboard, not in your code.**

