# Check RevenueCat Sync Logs

The sync function is returning no active entitlements. We need to check what RevenueCat is actually returning.

## Step 1: Check Supabase Function Logs

Go to this URL to see the function logs:
https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions/sync-revenuecat-user/logs

Look for the most recent invocation logs. You should see:
- `=== FULL SUBSCRIBER DATA ===` - Shows everything RevenueCat returned
- `=== AVAILABLE ENTITLEMENTS ===` - Shows all entitlement keys
- The detailed entitlement data

## Step 2: What to Look For

We're looking for whether:
1. RevenueCat has any entitlements at all
2. What the entitlement keys are named (might be different from "WagerProof Pro")
3. Whether entitlements are active or not

## Step 3: Common Issues

### Issue 1: Wrong Entitlement Identifier
If the logs show entitlements with names like:
- `pro`
- `wagerproof_pro`
- `premium`
- Or anything other than exactly `WagerProof Pro`

Then we need to update the `ENTITLEMENT_IDENTIFIER` in `src/services/revenuecatWeb.ts`

### Issue 2: Entitlements Not Active
If entitlements exist but `is_active: false`, they may have:
- Expired
- Not been granted correctly
- Been granted but RevenueCat hasn't processed them yet

### Issue 3: Using Wrong API Version
The promotional entitlements might be under a different structure in the V1 vs V2 API response.

## What to Share

Please check the Supabase logs and share:
1. What entitlement keys are listed under "All entitlement keys"
2. The full entitlement data structure
3. Any error messages

This will tell us exactly what's happening!

