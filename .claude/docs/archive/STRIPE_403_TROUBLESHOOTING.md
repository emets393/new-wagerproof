# Stripe 403 Error Troubleshooting Guide

## 🚨 The Problem
Getting a **403 Forbidden** error when trying to purchase in **production mode** on `www.wagerproof.bet`.

```
Failed to load resource: the server responded with a status of 403
api.stripe.com/v1/elements/sessions?...
```

---

## ✅ Quick Checklist

### 1. **RevenueCat Dashboard Configuration**

#### Navigate to: [RevenueCat Dashboard](https://app.revenuecat.com)

**A. Check Stripe Connection (CRITICAL)**
- Go to: **Project Settings** → **Integrations** → **Stripe**
- Verify: ✅ Stripe is connected in **LIVE MODE**
- Status should show: **"Connected"** with a green checkmark
- If not connected or only showing test mode:
  - Click **"Connect Stripe"** or **"Reconnect"**
  - Authorize with your **live** Stripe account
  - Grant all required permissions

**B. Verify Web Domain Whitelist**
- Go to: **Project Settings** → **General**
- Scroll to: **"Allowed domains for web purchases"**
- Add both:
  - `https://www.wagerproof.bet`
  - `https://wagerproof.bet`
- Save changes

**C. Check Products Exist in Live Environment**
- Go to: **Products** (top navigation)
- Toggle environment to: **PRODUCTION** (not Sandbox)
- Verify all 4 products exist:
  - `wagerproof_monthly_pro`
  - `wagerproof_pro_yearly`
  - `wagerproof_monthly_pro_discount`
  - `wagerproof_yearly_pro_discount`
- Each product should have:
  - ✅ Product ID set
  - ✅ Price configured
  - ✅ Associated with **"WagerProof Pro"** entitlement

**D. Check Offering Configuration**
- Go to: **Offerings** (top navigation)
- Environment: **PRODUCTION**
- Verify offering named **"default"** exists and is marked as **"Current"**
- Inside offering, verify packages:
  - `$rc_monthly` → `wagerproof_monthly_pro`
  - `$rc_annual` → `wagerproof_pro_yearly`
  - `$rc_monthly_discount` → `wagerproof_monthly_pro_discount`
  - `$rc_yearly_discount` → `wagerproof_yearly_pro_discount`

---

### 2. **Stripe Dashboard Configuration**

#### Navigate to: [Stripe Dashboard](https://dashboard.stripe.com)

**A. Account Activation Status**
- Toggle to: **LIVE MODE** (top right, should show "Viewing live data")
- Check for any activation banners at the top
- If account not activated:
  - Go to: **Settings** → **Account details**
  - Complete all required business information
  - Verify bank account/payout details
  - Submit for activation

**B. Verify Products Exist in Live Mode**
- Go to: **Products** → **Product Catalog**
- Make sure toggle is on: **LIVE MODE** (not Test mode)
- Verify products exist (created by RevenueCat):
  - Should see 4 products matching your RevenueCat products
  - Each should have a price configured
  - Status should be **"Active"**

**C. Check Payment Methods Enabled**
- Go to: **Settings** → **Payment methods**
- Verify: ✅ **Cards** is enabled
- Optional: Enable other methods if desired

**D. Review Radar Settings**
- Go to: **Radar** → **Rules**
- Check if any rules are **blocking** your domain or transactions
- Temporarily disable strict rules if testing

**E. Check API Restrictions**
- Go to: **Developers** → **API keys**
- Click on your **Publishable key** (starts with `pk_live_`)
- Check **"Restricted to"** section
- If restrictions exist, ensure `www.wagerproof.bet` is allowed

**F. Review Stripe Connect (If Applicable)**
- Go to: **Connect** → **Settings**
- Verify your Connect account ID: `acct_1SQZcvKBDcR0Q4gj`
- Check if there are any restrictions or issues

---

### 3. **Test in Sandbox Mode First**

Before debugging production further, verify everything works in sandbox:

1. Go to: `https://www.wagerproof.bet/admin`
2. Find: **"Sandbox CC Mode"** card
3. Toggle: **ON**
4. Page will auto-reload
5. Try purchasing with test card: **4242 4242 4242 4242**
6. If this works ✅ → Problem is only with production Stripe/RevenueCat config
7. If this fails ❌ → Problem is with code/integration

---

### 4. **Common Issues & Solutions**

#### **Issue: "Stripe account not activated"**
**Solution:**
- Complete Stripe onboarding
- Provide business details
- Add bank account
- Wait for Stripe approval (can take 1-2 business days)

#### **Issue: "Domain not whitelisted"**
**Solution:**
- RevenueCat → Project Settings → Add `www.wagerproof.bet` to allowed domains
- Save and wait 5 minutes for cache to clear

#### **Issue: "Products only exist in test mode"**
**Solution:**
- RevenueCat products must be created in **BOTH** environments
- Check RevenueCat → Toggle to **Production** → Recreate products if needed

#### **Issue: "Stripe API version mismatch"**
**Solution:**
- Error shows: `_stripe_version=2025-09-30` (future version)
- This is controlled by RevenueCat
- Contact RevenueCat support if this persists

#### **Issue: "Stripe Connect not authorized"**
**Solution:**
- RevenueCat Dashboard → Integrations → Stripe
- Click "Reconnect"
- Make sure you're logged into the correct Stripe account
- Grant all permissions

---

### 5. **Get More Error Details**

After the code changes, try purchasing again and check console for:

```
Environment: PRODUCTION
Package details: { identifier, productId, price, priceAmount }
Error details: { message, errorCode, underlyingErrorMessage, ... }
```

This will help pinpoint the exact issue.

---

## 🆘 Still Not Working?

### Contact RevenueCat Support
- Dashboard → Help (?) icon → "Contact Support"
- Provide:
  - User ID experiencing issue
  - Exact time of error (with timezone)
  - Error message from console
  - Confirmation that sandbox mode works

### Contact Stripe Support
- Dashboard → Help & Support
- Describe: "Getting 403 when RevenueCat tries to create payment session"
- Provide:
  - Your Stripe account ID
  - Connect account ID: `acct_1SQZcvKBDcR0Q4gj`
  - Domain: `www.wagerproof.bet`
  - Time of error

---

## 📝 Next Steps

1. ✅ Run through checklist above
2. ✅ Test in Sandbox mode to isolate issue
3. ✅ Try purchasing again with better logging
4. ✅ Share new console errors if still failing
5. ✅ Contact RevenueCat/Stripe support with details

The 403 error is almost always a **configuration issue**, not a code issue. The integration code is working correctly, but Stripe is rejecting the request due to account/permissions/domain restrictions.

