# RevenueCat Web Billing Setup Guide

This guide covers the setup and configuration of RevenueCat Web Billing for the WagerProof web application.

## Prerequisites

Before implementing, complete these steps in your RevenueCat dashboard:

### 1. Connect Stripe to RevenueCat

If you haven't already connected Stripe for Web Billing:
1. Go to RevenueCat Dashboard → Settings → Integrations
2. Connect your Stripe account for Web Billing
3. Complete the authorization flow

### 2. Create Web Billing App Configuration

1. Navigate to **Apps & providers** in your RevenueCat dashboard
2. Click **Add App** and select **Web Billing**
3. Configure the following:
   - **Stripe Account**: Select your connected Stripe account
   - **Default Currency**: USD
   - **App Name**: "WagerProof"
   - **Support Email**: Your support email address
   - **App Icon**: Upload your app logo
4. Save the configuration
5. **Important**: Note down both API keys:
   - **Public API Key** (for production)
   - **Sandbox API Key** (for testing)

### 3. Configure Products and Offerings

#### Products
Create these products in RevenueCat (must match mobile app):
- **Product ID**: `monthly`
  - **Price**: $40/month
  - **Entitlement**: "WagerProof Pro"
  
- **Product ID**: `yearly`
  - **Price**: $199/year
  - **Entitlement**: "WagerProof Pro"
  
- **Product ID**: `lifetime` (optional)
  - **Price**: Your lifetime price
  - **Entitlement**: "WagerProof Pro"

#### Offering
1. Go to **Offerings** in RevenueCat dashboard
2. Create or edit the "default" offering
3. Add packages:
   - **Package ID**: `monthly` → Link to `monthly` product
   - **Package ID**: `annual` → Link to `yearly` product
   - **Package ID**: `lifetime` → Link to `lifetime` product (if created)

### 4. Configure Entitlement

Ensure you have an entitlement configured:
- **Entitlement Identifier**: `WagerProof Pro`
- This must match exactly between web and mobile for cross-platform access

## Environment Variables Setup

Create a `.env` file in the project root with the following variables:

```bash
# RevenueCat Web Billing API Keys
VITE_REVENUECAT_WEB_PUBLIC_API_KEY=rcb_svnfisrGmflnfsiwSBNiOAfgIiNX
VITE_REVENUECAT_WEB_SANDBOX_API_KEY=rcb_cdAVOmoezOkchwMKKVutPMhPrXoL
```

### Getting Your API Keys

1. Go to RevenueCat Dashboard → **Apps & providers**
2. Select your **Web Billing** app
3. Copy the **Public API Key** (use in production)
4. Copy the **Sandbox API Key** (use in development/testing)

### Important Notes

- **Never commit** the `.env` file to version control
- Use the **Sandbox API Key** during development
- The app automatically uses the correct key based on `import.meta.env.DEV`
- For production builds, ensure `VITE_REVENUECAT_WEB_PUBLIC_API_KEY` is set

## Database Schema Updates (Optional but Recommended)

Add these columns to your Supabase `profiles` table for better performance:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;
```

These columns enable fast local subscription checks without always calling the RevenueCat API.

## Implementation Summary

### Files Created

1. **`src/services/revenuecatWeb.ts`**
   - Core service layer for RevenueCat Web SDK
   - Handles initialization, purchases, and entitlement checks

2. **`src/contexts/RevenueCatContext.tsx`**
   - React context provider for global state management
   - Automatically initializes when user authenticates
   - Syncs with Supabase on purchase/initialization

3. **`src/hooks/useRevenueCatWeb.ts`**
   - Custom hook for easy access to RevenueCat functionality
   - Provides `hasProAccess`, `purchase()`, etc.

4. **`src/utils/syncRevenueCatToSupabase.ts`**
   - Syncs RevenueCat subscription data to Supabase
   - Enables fast local checks and offline access

### Files Modified

1. **`src/components/Paywall.tsx`**
   - Updated to use RevenueCat Web Billing
   - Replaced direct Stripe links with `purchase()` calls
   - Dynamic pricing from RevenueCat offerings

2. **`src/hooks/useAccessControl.ts`**
   - Primary check: RevenueCat entitlements (authoritative)
   - Fallback: Supabase subscription_active
   - Legacy: RPC `user_has_access` function

3. **`src/App.tsx`**
   - Added `RevenueCatProvider` to provider hierarchy
   - Positioned after `AuthProvider` (requires user ID)

## Testing Guide

### Development Testing (Sandbox)

1. Ensure `VITE_REVENUECAT_WEB_SANDBOX_API_KEY` is set in `.env`
2. Start dev server: `npm run dev`
3. Sign in to the app
4. Navigate to paywall (onboarding step 16)
5. Use Stripe test cards:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
6. Verify purchase in RevenueCat dashboard → Customers
7. Check that `hasProAccess` becomes `true`
8. Verify Supabase `profiles` table updates

### Cross-Platform Testing

1. **Web → Mobile**: 
   - Purchase subscription on web
   - Sign in to mobile app with same account
   - Verify Pro access granted immediately

2. **Mobile → Web**:
   - Purchase subscription in mobile app
   - Sign in to web app with same account
   - Verify Pro access granted immediately

### Production Testing

1. Update `.env` with production API key
2. Build for production: `npm run build`
3. Test with real Stripe payment method
4. Monitor RevenueCat dashboard for successful purchases

## Key Configuration Values

These must match between web and mobile:

| Setting | Value |
|---------|-------|
| Entitlement Identifier | `WagerProof Pro` |
| Monthly Product ID | `monthly` |
| Yearly Product ID | `yearly` |
| Lifetime Product ID | `lifetime` |
| App User ID | Supabase `user.id` |

## Troubleshooting

### "RevenueCat API key not found"
- Ensure `.env` file exists in project root
- Verify environment variable names match exactly
- Restart dev server after adding environment variables

### Purchases not appearing
- Check RevenueCat dashboard → Customers
- Verify Stripe payment succeeded
- Check browser console for errors
- Ensure correct API key (sandbox vs production)

### Cross-platform access not working
- Verify same `user.id` used on both platforms
- Check entitlement name matches exactly
- Verify product IDs match exactly
- Check RevenueCat dashboard → Customer → Entitlements

### Supabase sync failing
- Check browser console for Supabase errors
- Verify database columns exist
- Check user permissions in Supabase RLS policies

## Support Resources

- [RevenueCat Web SDK Docs](https://www.revenuecat.com/docs/web/web-billing/web-sdk)
- [RevenueCat Dashboard](https://app.revenuecat.com/)
- [Stripe Test Cards](https://stripe.com/docs/testing)

## Migration Notes

If you have existing Stripe customers:
- They will need to repurchase through RevenueCat
- Or manually import them via RevenueCat API
- Consider offering discount codes for existing customers
- RevenueCat can track original Stripe customer IDs for reference

