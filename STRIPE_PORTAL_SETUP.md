# Stripe Customer Portal Setup for RevenueCat Web Billing

## Overview

This guide explains how to set up the Stripe Customer Portal for WagerProof users to manage their subscriptions (cancel, update payment, view invoices).

---

## Setup Steps

### 1. Enable Stripe Customer Portal in Stripe Dashboard

#### For Test Mode:
1. Go to [Stripe Dashboard (Test Mode)](https://dashboard.stripe.com/test/settings/billing/portal)
2. Click **"Activate test link"** or **"Turn on"**
3. Configure the portal settings:
   - **Business Information**:
     - Business name: WagerProof
     - Support email: support@wagerproof.bet (or your support email)
   - **Features**:
     - ✅ Allow customers to update payment methods
     - ✅ Allow customers to cancel subscriptions
     - ✅ Show proration preview
     - ✅ Allow customers to update billing details
   - **Cancellation**:
     - Choose: "Cancel immediately" or "Cancel at period end" (recommended)
     - Optional: Add cancellation survey
   - **Products**:
     - Should automatically show your RevenueCat products
4. Click **Save**

#### For Production Mode:
1. Go to [Stripe Dashboard (Live Mode)](https://dashboard.stripe.com/settings/billing/portal)
2. Follow the same steps as test mode
3. Make sure to **activate for live mode** separately

### 2. Set Stripe Secret Key in Supabase

The Edge Function needs your Stripe secret key to create portal sessions.

#### Add Secret to Supabase:
```bash
# For production
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY

# For testing
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
```

Or manually in Supabase Dashboard:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Edge Functions**
4. Add secret: `STRIPE_SECRET_KEY` with your Stripe key

**Important**: Get your keys from:
- Test: https://dashboard.stripe.com/test/apikeys
- Live: https://dashboard.stripe.com/apikeys

### 3. Deploy the Edge Function

Deploy the `create-portal-session` function to Supabase:

```bash
cd /Users/chrishabib/Documents/new-wagerproof

# Deploy the function
npx supabase functions deploy create-portal-session

# Verify deployment
npx supabase functions list
```

### 4. Set Environment Variables

Add these to your `.env` file (if not already present):

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These should already be configured for your Supabase project.

---

## How It Works

### User Flow:
1. User clicks **"Manage Subscription with Stripe"** in Settings → Billing
2. Frontend calls Supabase Edge Function with user's email
3. Edge Function:
   - Looks up Stripe customer by email
   - Creates a temporary portal session (expires in 1 hour)
   - Returns portal URL
4. Portal URL opens in new tab
5. User can:
   - Cancel subscription
   - Update payment method
   - View invoices
   - Update billing address
6. After actions, user is redirected back to your app

### Security:
- ✅ Edge Function runs server-side (Stripe key never exposed)
- ✅ Portal sessions expire after 1 hour
- ✅ Users can only access their own subscription data
- ✅ All actions logged in Stripe Dashboard

---

## Testing

### Test the Portal (Sandbox Mode):

1. **Create a test subscription**:
   - Go to your app's paywall
   - Use test card: `4242 4242 4242 4242`
   - Complete purchase

2. **Access the portal**:
   - Go to Settings → Billing tab
   - Click "Manage Subscription with Stripe"
   - Should open Stripe portal in new tab

3. **Test actions**:
   - Update payment method (use another test card)
   - View invoice
   - Try to cancel subscription

4. **Verify in Stripe Dashboard**:
   - Go to [Stripe Test Customers](https://dashboard.stripe.com/test/customers)
   - Find your customer
   - Verify actions were recorded

---

## Troubleshooting

### Error: "No Stripe customer found"

**Cause**: Customer hasn't been created in Stripe yet.

**Solution**: This happens when:
- Purchase hasn't completed yet
- RevenueCat hasn't synced with Stripe
- User created account but never purchased

**Fix**: Wait 1-2 minutes after purchase, or contact support.

### Error: "Customer portal is not activated"

**Cause**: Customer Portal not enabled in Stripe Dashboard.

**Solution**: 
1. Go to Stripe Dashboard → Settings → Billing → Customer Portal
2. Click "Activate" for your environment (test/live)

### Error: "Failed to create portal session"

**Possible causes**:
1. **Stripe key not set**: Add `STRIPE_SECRET_KEY` to Supabase secrets
2. **Wrong Stripe key**: Make sure you're using the right key (test vs live)
3. **Edge Function not deployed**: Run `npx supabase functions deploy create-portal-session`

### Portal opens but shows error

**Cause**: Customer Portal not fully configured in Stripe.

**Solution**:
1. Go to Stripe Dashboard → Settings → Billing → Customer Portal
2. Complete all required fields
3. Save configuration

---

## Alternative: Static Portal Link (Not Recommended)

If you can't use the Edge Function, you can use a static portal link, but this has limitations:

1. Go to Stripe Dashboard → Settings → Billing → Customer Portal
2. Copy the **Portal link**
3. Update `SettingsModal.tsx`:

```typescript
const handleManageBilling = () => {
  // For test mode
  window.open('https://billing.stripe.com/p/login/test_YOUR_CODE', '_blank');
  
  // For production
  // window.open('https://billing.stripe.com/p/login/live_YOUR_CODE', '_blank');
};
```

**Limitations**:
- User must log in with email + verification code
- Extra step for users
- Less seamless experience

**Recommendation**: Use the Edge Function approach for better UX.

---

## Production Checklist

Before going live:

- [ ] Enable Customer Portal in **Live Mode** (not just test)
- [ ] Set `STRIPE_SECRET_KEY` in Supabase with **live key** (sk_live_...)
- [ ] Deploy Edge Function to production
- [ ] Test with real payment
- [ ] Verify cancellation flow works
- [ ] Verify refund policy is clear
- [ ] Add support email to portal settings

---

## Support Email Setup

Make sure support@wagerproof.bet (or your support email) is:
- ✅ Active and monitored
- ✅ Added to Stripe portal settings
- ✅ Shown in error messages
- ✅ Ready to handle subscription questions

---

## Files Modified

1. ✅ Created: `supabase/functions/create-portal-session/index.ts`
2. ✅ Updated: `src/components/SettingsModal.tsx`

---

## Next Steps

1. Deploy the Edge Function: `npx supabase functions deploy create-portal-session`
2. Enable Stripe Customer Portal in Stripe Dashboard (test mode first)
3. Test the billing management flow
4. Once working in test mode, configure for production

Need help? Check the troubleshooting section or contact Stripe support.

