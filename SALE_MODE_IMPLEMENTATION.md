# Sale Mode Feature - Implementation Complete ✅

## Overview

Successfully implemented a global sale mode toggle that allows admins to switch between regular and discounted pricing across the entire platform. When enabled, the paywall shows 50% off pricing with strikethrough effects.

## What Was Built

### 1. Database Layer (`supabase/migrations/add_sale_mode.sql`)
- **`app_settings` table**: Global application settings storage
- **Sale mode setting**: Tracks enabled/disabled state and discount percentage
- **RLS Policies**: Public read, admin-only write
- **Functions**:
  - `get_sale_mode()`: Public function to fetch current sale status
  - `update_sale_mode()`: Admin-only function to toggle sale mode

### 2. React Hook (`src/hooks/useSaleMode.ts`)
- `useSaleMode()`: Easy access to sale mode state
- Returns:
  - `isSaleActive`: Boolean - is sale currently active
  - `discountPercentage`: Number - discount percentage (50%)
  - `updateSaleMode()`: Function to toggle sale mode (admin only)
  - `loading`, `isUpdating`: Loading states

### 3. Admin Component (`src/components/admin/SaleModeToggle.tsx`)
- Visual toggle switch for admins
- Shows current pricing for both modes
- Displays product codes being used
- Real-time updates with loading states

### 4. Updated Paywall (`src/components/Paywall.tsx`)
- **Regular Mode**:
  - Monthly: $40/mo
  - Yearly: $199/yr ($16.58/mo)
  - Uses products: `wagerproof_monthly_pro`, `wagerproof_pro_yearly`

- **Sale Mode**:
  - Shows "🔥 LIMITED TIME SALE - 50% OFF! 🔥" banner
  - Monthly: ~~$40~~ $20/mo (strikethrough + green text)
  - Yearly: ~~$199~~ $99/yr (strikethrough + green text)
  - Shows "Save 50%!" text
  - Uses products: `wagerproof_monthly_pro_discount`, `wagerproof_yearly_pro_discount`

### 5. Admin Integration (`src/pages/Admin.tsx`)
- Added Sale Mode card to admin dashboard
- Positioned below Site Settings
- Matches existing dashboard styling

## Quick Start

### Run the setup script:
```bash
cd /Users/chrishabib/Documents/new-wagerproof
./setup-revenuecat.sh
```

This will:
1. Create `.env` file with your API key
2. Show you the next steps

### Manual Setup:

1. **Create `.env` file**:
```bash
# In project root
VITE_REVENUECAT_WEB_PUBLIC_API_KEY=rcb_FimpgqhaUgXMNBUtlduWndNxaHLz
VITE_REVENUECAT_WEB_SANDBOX_API_KEY=rcb_TXEVSXWeblisvQJwlYTinPYQhbQH
```

2. **Run database migrations**:
   - Open Supabase SQL Editor
   - Run `supabase/migrations/add_revenuecat_columns.sql`
   - Run `supabase/migrations/add_sale_mode.sql`

3. **Start dev server**:
```bash
npm run dev
```

## RevenueCat Product Configuration

### Required Products in RevenueCat Dashboard:

#### Regular Products (Normal Pricing)
1. **Monthly Pro**
   - Product ID: `wagerproof_monthly_pro`
   - Price: $40/month
   - Entitlement: "WagerProof Pro"

2. **Yearly Pro**
   - Product ID: `wagerproof_pro_yearly`
   - Price: $199/year
   - Entitlement: "WagerProof Pro"

#### Discount Products (Sale Pricing)
3. **Monthly Pro Discount**
   - Product ID: `wagerproof_monthly_pro_discount`
   - Price: $20/month
   - Entitlement: "WagerProof Pro"

4. **Yearly Pro Discount**
   - Product ID: `wagerproof_yearly_pro_discount`
   - Price: $99/year
   - Entitlement: "WagerProof Pro"

### Setting Up in RevenueCat:
1. Go to **Products** → **Create Product**
2. Create each product with the exact IDs above
3. Set the correct prices
4. Link all to **"WagerProof Pro"** entitlement
5. Add all 4 products to your **"default"** offering

## How to Use

### As an Admin:

1. **Navigate to Admin Dashboard**:
   ```
   https://your-domain.com/admin
   ```

2. **Find the Sale Mode Card**:
   - Located below "Site Settings"
   - Shows current pricing for both modes

3. **Toggle Sale Mode**:
   - Switch ON: Activates 50% off sale pricing
   - Switch OFF: Returns to regular pricing
   - Changes are instant across the platform

4. **Verify Changes**:
   - Visit `/paywall-test` to see the paywall
   - Or complete onboarding to step 16

### As a User:

**Regular Mode** (Sale OFF):
- Sees standard pricing: $40/mo, $199/yr
- Clean, professional paywall
- No special banners

**Sale Mode** (Sale ON):
- Sees red banner: "🔥 LIMITED TIME SALE - 50% OFF! 🔥"
- Original prices shown with strikethrough
- Discounted prices in green
- "Save 50%!" badges
- Same RevenueCat checkout flow

## Technical Details

### Sale Mode Flow:

```
1. Admin toggles sale mode ON in dashboard
   ↓
2. update_sale_mode() function called (Supabase)
   ↓
3. app_settings table updated
   ↓
4. All clients refetch sale mode (every 2 minutes)
   ↓
5. Paywall re-renders with new pricing
   ↓
6. Users see discounted prices
   ↓
7. Checkout uses discount product codes
```

### Product Selection Logic:

```typescript
// Paywall automatically selects correct product based on sale mode
const monthlyProduct = isSaleActive 
  ? 'wagerproof_monthly_pro_discount'  // $20
  : 'wagerproof_monthly_pro';          // $40

const yearlyProduct = isSaleActive
  ? 'wagerproof_yearly_pro_discount'   // $99
  : 'wagerproof_pro_yearly';           // $199
```

### Cache & Refresh:

- **Sale mode cached**: 5 minutes
- **Auto-refetch**: Every 2 minutes
- **Manual refresh**: On admin toggle
- **Client updates**: Real-time via React Query

## Testing Checklist

### Pre-Launch Testing:

- [ ] Database migrations completed successfully
- [ ] All 4 products created in RevenueCat
- [ ] Products linked to "WagerProof Pro" entitlement
- [ ] `.env` file created with API key
- [ ] Dev server starts without errors

### Regular Mode Testing:

- [ ] Navigate to `/paywall-test`
- [ ] Verify $40/mo and $199/yr prices shown
- [ ] No sale banner visible
- [ ] Click "Go to Checkout" for monthly
- [ ] Verify RevenueCat checkout loads
- [ ] Use Stripe test card: `4242 4242 4242 4242`
- [ ] Confirm purchase completes
- [ ] Check RevenueCat dashboard for purchase

### Sale Mode Testing:

- [ ] Go to `/admin` as admin user
- [ ] Toggle Sale Mode ON
- [ ] Verify success toast appears
- [ ] Navigate to `/paywall-test`
- [ ] Verify "🔥 LIMITED TIME SALE" banner visible
- [ ] Verify strikethrough prices: ~~$40~~ ~~$199~~
- [ ] Verify green discount prices: $20, $99
- [ ] Verify "Save 50%!" text shown
- [ ] Click "Go to Checkout" for monthly
- [ ] Verify RevenueCat checkout loads with $20 price
- [ ] Use Stripe test card: `4242 4242 4242 4242`
- [ ] Confirm purchase completes
- [ ] Check RevenueCat dashboard shows discount product

### Cross-Platform Testing:

- [ ] Purchase on web with sale mode → Check mobile access
- [ ] Toggle sale mode → Verify change on multiple tabs
- [ ] Sign in on different device → Verify sale mode consistent

## UI/UX

### Regular Mode
```
┌─────────────────────────────────────┐
│         Choose Your Plan            │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │ Monthly  │      │ Yearly   │   │
│  │          │      │          │   │
│  │  $40/mo  │      │$16.58/mo │   │
│  │          │      │($199/yr) │   │
│  └──────────┘      └──────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Sale Mode
```
┌─────────────────────────────────────┐
│ 🔥 LIMITED TIME SALE - 50% OFF! 🔥 │
├─────────────────────────────────────┤
│         Choose Your Plan            │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │ Monthly  │      │ Yearly   │   │
│  │          │      │          │   │
│  │  ~~$40~~ │      │ ~~$199~~ │   │
│  │  $20/mo  │      │  $99/yr  │   │
│  │Save 50%! │      │Save 50%! │   │
│  └──────────┘      └──────────┘   │
│                                     │
└─────────────────────────────────────┘
```

## Files Modified/Created

### New Files:
- `supabase/migrations/add_sale_mode.sql`
- `src/hooks/useSaleMode.ts`
- `src/components/admin/SaleModeToggle.tsx`
- `setup-revenuecat.sh`
- `SALE_MODE_IMPLEMENTATION.md` (this file)
- `SETUP_ENV.md`

### Modified Files:
- `src/components/Paywall.tsx` - Added sale mode logic
- `src/pages/Admin.tsx` - Added sale mode toggle
- `src/services/revenuecatWeb.ts` - Fixed imports

## Troubleshooting

### Sale mode toggle not appearing in admin:
- Verify you're signed in as admin user
- Check `profiles.is_admin = true` in Supabase
- Ensure `add_sale_mode.sql` migration ran successfully

### Pricing not changing when toggled:
- Check browser console for errors
- Verify `get_sale_mode()` function exists in Supabase
- Clear browser cache and reload
- Check Network tab for sale mode API calls

### Wrong product being used in checkout:
- Verify product IDs match exactly in RevenueCat
- Check browser console for product selection logs
- Inspect `currentOffering.availablePackages` in console
- Ensure all 4 products are in the "default" offering

### Import errors persist:
```bash
rm -rf node_modules/.vite
npm run dev
```

## Production Deployment

### Before Going Live:

1. **Update API Key**: Change to production key in `.env`
2. **Create Products**: Set up all 4 products in RevenueCat production
3. **Test Thoroughly**: Complete full testing checklist above
4. **Monitor**: Watch RevenueCat dashboard during launch
5. **Announce**: Use sale mode for marketing campaigns

### Sale Campaign Strategy:

1. **Pre-Launch**: Keep sale mode OFF
2. **Launch Sale**: Toggle sale mode ON via admin dashboard
3. **Monitor**: Watch conversion rates in RevenueCat
4. **End Sale**: Toggle sale mode OFF when campaign ends
5. **No Code Changes**: Everything controlled via admin toggle

## Support

- **RevenueCat Docs**: https://www.revenuecat.com/docs/web/web-billing/web-sdk
- **Setup Guide**: `SETUP_ENV.md`
- **Implementation Details**: `REVENUECAT_WEB_IMPLEMENTATION_SUMMARY.md`
- **General Setup**: `REVENUECAT_WEB_SETUP.md`

---

**Status**: ✅ Complete and Ready for Testing  
**Implementation Date**: November 7, 2024  
**Features**: Sale mode toggle, strikethrough pricing, admin controls, real-time updates

