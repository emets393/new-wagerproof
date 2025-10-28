# Paid Mode Migration Guide

This guide documents the steps to transition WagerProof from free beta (Launch Mode) to a paid subscription model with Stripe integration.

## Phase 1: Database Preparation

### Step 1: Add Free Access User Column

Run this migration in Supabase SQL Editor:

```sql
-- Migration: Add free_access_user flag to profiles
ALTER TABLE profiles ADD COLUMN is_free_access_user boolean DEFAULT true;

-- Add subscription columns
ALTER TABLE profiles ADD COLUMN (
  subscription_status text DEFAULT 'none', -- 'none', 'active', 'canceled', 'payment_failed'
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_plan text, -- 'monthly' or 'yearly'
  subscription_created_at timestamp,
  subscription_expires_at timestamp
);

-- Create indexes for faster lookups
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX idx_profiles_is_free_access_user ON profiles(is_free_access_user);
```

### Step 2: Migrate Existing Users (One-Time Query)

**CRITICAL: Run this BEFORE switching to paid mode**

This marks all current users as free access users so they retain access when you launch paid mode:

```sql
-- Mark all existing users as free access users (GRANDFATHERING)
UPDATE profiles 
SET is_free_access_user = true 
WHERE created_at < NOW();

-- Verify the update
SELECT COUNT(*) as free_access_users FROM profiles WHERE is_free_access_user = true;
SELECT COUNT(*) as total_users FROM profiles;
```

**What this does:**
- All users who signed up before this migration get `is_free_access_user = true`
- They will have perpetual access even after you turn on paid mode
- New signups after the migration will get `is_free_access_user = false` (or true if site is in free mode)
- This is your "grandfathering" strategy for early users

## Phase 2: Stripe Webhook Setup

### Step 3: Deploy Stripe Webhook Edge Function

Create file: `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature || "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );

    // Handle different Stripe events
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        // Optional: Send receipt email
        console.log("Payment succeeded for:", event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Webhook Error", { status: 400 });
  }
});

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const plan = subscription.items.data[0];
  const status = subscription.status;

  // Get the user by Stripe customer ID
  const { data: user, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (fetchError || !user) {
    console.error("User not found for customer:", customerId);
    return;
  }

  // Update user subscription status
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_status: status === "active" ? "active" : "pending",
      stripe_subscription_id: subscriptionId,
      subscription_plan: plan.plan.interval, // "monthly" or "yearly"
      subscription_created_at: new Date(subscription.created * 1000).toISOString(),
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq("user_id", user.user_id);

  if (updateError) {
    console.error("Error updating subscription:", updateError);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: user } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) return;

  // Mark subscription as canceled
  await supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_expires_at: new Date().toISOString(),
    })
    .eq("user_id", user.user_id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!user) return;

  // Update status to payment_failed
  await supabase
    .from("profiles")
    .update({
      subscription_status: "payment_failed",
    })
    .eq("user_id", user.user_id);
}
```

### Step 4: Configure Stripe Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter endpoint URL: `https://[YOUR_PROJECT_ID].supabase.co/functions/v1/stripe-webhook`
   - Find `[YOUR_PROJECT_ID]` in Supabase Project Settings → General
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing Secret** (starts with `whsec_`)

### Step 5: Add Stripe Secrets to Supabase

Go to Supabase Project → Settings → Secrets and add:

```
STRIPE_SECRET_KEY: sk_live_xxxxx (or sk_test_xxxxx for testing)
STRIPE_WEBHOOK_SECRET: whsec_xxxxx (from Step 4)
```

### Step 6: Deploy the Function

```bash
cd supabase
supabase functions deploy stripe-webhook
```

Verify deployment:
```bash
supabase functions list
```

## Phase 3: Update Access Control Logic

### Step 7: Update OnboardingGuard Component

The access check logic should be updated to:

```typescript
// In OnboardingGuard.tsx or your access control component
const userHasAccess = 
  isLaunchMode || // Site is in free mode
  user.is_free_access_user || // User signed up during free period
  (user.subscription_status === 'active' && 
   new Date(user.subscription_expires_at) > new Date()); // Valid paid subscription

if (!userHasAccess && onboardingStatus.completed === true) {
  // User finished onboarding but doesn't have access → show paywall
  return <Navigate to="/onboarding?showPaywall=true" replace />;
}
```

**Note:** The paywall component is already implemented and has no bypass button in paid mode.

## Phase 4: Testing Checklist

### Step 8: Pre-Launch Testing

Complete all tests before switching to paid mode:

- [ ] **Test 1: Free Mode Works**
  - Go to Admin Panel → Site Settings
  - Verify `Launch Mode (Free Access)` is toggled ON
  - Create new test user account
  - Complete onboarding → Should get `is_free_access_user = true`
  - Verify can access `/wagerbot-chat` without paywall

- [ ] **Test 2: Early Access Users Keep Access**
  - Use an existing user account (created during free beta)
  - Toggle Admin `Launch Mode` to OFF (paid mode)
  - Log in with that user
  - Verify they can still access app (should have `is_free_access_user = true`)
  - Verify no paywall appears

- [ ] **Test 3: New User in Paid Mode Sees Paywall**
  - Keep `Launch Mode` OFF (paid mode)
  - Create brand new test account
  - Complete onboarding flow
  - Should get redirected to paywall (Step 16)
  - Verify `is_free_access_user = false` in database

- [ ] **Test 4: Stripe Checkout Flow**
  - In paywall, select a plan and click "Go to Checkout"
  - Complete Stripe test payment (use `4242 4242 4242 4242` card)
  - Return from Stripe
  - Verify webhook fired: Check Stripe Dashboard → Webhooks → Recent Deliveries
  - Check database: User should have `subscription_status = 'active'`
  - User should now have app access

- [ ] **Test 5: Subscription Cancellation**
  - Cancel test subscription in Stripe Dashboard → Customers → [test customer] → Subscriptions → Cancel subscription
  - Verify webhook fires (check Recent Deliveries)
  - Log in as that user
  - Verify they get redirected to paywall
  - Verify `subscription_status = 'canceled'` in database

- [ ] **Test 6: Free Mode Promotion**
  - Toggle `Launch Mode` back to ON (free mode)
  - Create new test user
  - Complete onboarding
  - Verify `is_free_access_user = true`
  - Toggle back to OFF (paid mode)
  - Log in as that user
  - Verify they still have access (grandfathered)
  - Verify can access app without seeing paywall

- [ ] **Test 7: Webhook Error Handling**
  - Stop the webhook function: `supabase functions delete stripe-webhook`
  - Try to subscribe in Stripe
  - Check that app still works (no crash)
  - Redeploy function: `supabase functions deploy stripe-webhook`

## Phase 5: Admin Panel Updates (Already Done)

### Step 9: Admin Dashboard Features

Your admin panel already has:
- ✅ Launch Mode toggle (free/paid)
- ✅ Test Paywall button (opens onboarding)
- ✅ Site Settings with clear descriptions

No additional changes needed.

## Phase 6: Launch Day

### Step 10: Pre-Launch Checklist

**48 hours before launch:**
- [ ] Run Step 2 SQL query (mark all users as free access)
- [ ] Test all tests in Step 8
- [ ] Review this guide with team
- [ ] Brief admins on new paywall toggle

**1 hour before launch:**
- [ ] Deploy webhook function (Step 6)
- [ ] Add Stripe secrets (Step 5)
- [ ] Verify webhook endpoint responding: `curl https://[YOUR_PROJECT_ID].supabase.co/functions/v1/stripe-webhook`

**Launch moment:**
- [ ] Set `launch_mode = false` in Admin Panel
- [ ] Monitor in Supabase: `SELECT * FROM profiles WHERE created_at > NOW() - INTERVAL '1 hour'`
- [ ] Verify new users get `is_free_access_user = false`
- [ ] Verify new users see paywall

**First hour after launch:**
- [ ] Monitor Stripe webhook logs for errors
- [ ] Test a few real users through checkout
- [ ] Check for any error messages in browser console
- [ ] Monitor Supabase function logs: `supabase functions logs stripe-webhook`

**Post-launch monitoring:**
- [ ] Check database every 6 hours for subscription status updates
- [ ] Monitor Stripe webhook delivery status (should be 100% success)
- [ ] Track conversion rates (users completing payment)
- [ ] Monitor for support tickets about access

## Phase 7: Rollback Plan

If critical issues occur, revert immediately:

```sql
-- Emergency rollback: Go back to free mode for everyone
UPDATE site_settings SET launch_mode = true WHERE id = 1;

-- Everyone with is_free_access_user = true still has access
-- New users won't see paywall
-- Gives you time to debug
```

After rollback:
- [ ] Notify team
- [ ] Check Supabase logs for errors
- [ ] Check webhook logs for issues
- [ ] Fix issues
- [ ] Re-test Phase 6 tests
- [ ] Launch again

## Key Queries for Monitoring

After launch, use these queries to monitor your users:

```sql
-- Check subscription statuses
SELECT 
  subscription_status,
  COUNT(*) as user_count
FROM profiles
WHERE subscription_status != 'none'
GROUP BY subscription_status;

-- Find users stuck on paywall (completed onboarding but not paying)
SELECT user_id, email, onboarding_completed, is_free_access_user, subscription_status, created_at
FROM profiles
WHERE subscription_status = 'none'
AND onboarding_completed = true
AND is_free_access_user = false
ORDER BY created_at DESC
LIMIT 20;

-- Check for failed payments
SELECT user_id, email, subscription_status, created_at
FROM profiles
WHERE subscription_status = 'payment_failed'
ORDER BY created_at DESC;

-- Count early access users (grandfathered)
SELECT COUNT(*) as early_access_users
FROM profiles
WHERE is_free_access_user = true
AND created_at < '<DATE_WHEN_YOU_RAN_STEP_2>';

-- New paying users
SELECT user_id, email, subscription_plan, subscription_created_at
FROM profiles
WHERE subscription_status = 'active'
AND subscription_created_at > NOW() - INTERVAL '24 hours'
ORDER BY subscription_created_at DESC;
```

## Troubleshooting

### Issue: Users see paywall but shouldn't

**Check:**
1. `is_free_access_user = true`?
2. `subscription_status = 'active'`?
3. `launch_mode = true` in site_settings?

If all are false, user needs to subscribe.

### Issue: Webhook not updating subscriptions

**Diagnosis:**
1. Check Stripe Dashboard → Webhooks → Recent deliveries
2. Look for errors (red X = failed)
3. Click on failed event to see error message

**Fix:**
- Verify `STRIPE_WEBHOOK_SECRET` is correct in Supabase
- Check webhook endpoint is responding: `curl https://[YOUR_PROJECT_ID].supabase.co/functions/v1/stripe-webhook`
- Check function logs: `supabase functions logs stripe-webhook`
- Resend webhook from Stripe Dashboard if needed

### Issue: Early access users lost access

**Fix:**
1. Check: `SELECT COUNT(*) FROM profiles WHERE is_free_access_user = true`
2. If count is 0, re-run Step 2 SQL query
3. Verify no one toggled `launch_mode = false` before running Step 2

### Issue: New users getting free access when they shouldn't

**Check:**
1. Is `launch_mode = true`? (Should be false for paid mode)
2. Are they getting `is_free_access_user = true`? (Should be false)

**Fix:**
- Toggle `launch_mode = false` in Admin Panel
- New signups should get `is_free_access_user = false`

## Support & Escalation

**Before launching, have answers to:**
1. Who can access Stripe Dashboard?
2. Who can access Supabase secrets?
3. Who monitors webhook logs?
4. Who handles customer support for payment issues?
5. What's the process for refunds?

**Have these links ready:**
- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: https://app.supabase.com/projects
- Webhook logs: Dashboard → Functions → stripe-webhook → Logs
- Monitoring queries: Saved in a note for easy copy/paste

## Success Criteria

Launch is successful when:
- ✅ Early access users still have access
- ✅ New users see paywall
- ✅ Users can complete checkout
- ✅ Webhook updates subscription status
- ✅ Paid users can access app
- ✅ No error logs in webhooks
- ✅ No support tickets about access issues
