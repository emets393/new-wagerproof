# Payments & Billing (RevenueCat)

> Last verified: December 2024

## Overview

WagerProof uses RevenueCat for subscription management across both web and mobile platforms. The implementation differs significantly between platforms.

---

## Architecture Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| **Package** | `@revenuecat/purchases-js` ^1.18.0 | `react-native-purchases` ^9.6.9 |
| **UI Package** | Custom components | `react-native-purchases-ui` ^9.6.9 |
| **Paywall** | Custom-built | RevenueCat Paywalls V2 |
| **Checkout** | RevenueCat Web → Stripe | Native IAP (App Store/Play) |
| **API Keys** | Hardcoded in code | Platform-specific |
| **Sandbox Toggle** | Admin DB setting | Test accounts only |
| **Customer Center** | Email-based | Native UI component |

---

## Subscription Products

| Identifier | Type | Description |
|------------|------|-------------|
| `$rc_monthly` / `monthly` | Monthly | Monthly subscription |
| `$rc_annual` / `yearly` | Yearly | Annual subscription |
| `$rc_lifetime` / `lifetime` | One-time | Lifetime access |
| `$rc_monthly_discount` | Monthly | 50% off monthly (sale) |
| `$rc_yearly_discount` | Yearly | 50% off yearly (sale) |

**Entitlement ID**: `WagerProof Pro`

---

## Web Implementation

### Files
```
src/
├── services/revenuecatWeb.ts        # Service layer
├── contexts/RevenueCatContext.tsx    # React context
├── hooks/useRevenueCatWeb.ts        # Custom hook
├── hooks/useAccessControl.ts        # 3-tier access checking
├── hooks/useSaleMode.ts             # Sale mode toggle
├── hooks/useSandboxMode.ts          # Sandbox toggle
├── components/Paywall.tsx           # Custom paywall UI
└── utils/syncRevenueCatToSupabase.ts # Subscription sync
```

### API Keys (Currently Hardcoded)
```typescript
// src/services/revenuecatWeb.ts
const PRODUCTION_API_KEY = 'rcb_FimpgqhaUgXMNBUtlduWndNxaHLz';
const SANDBOX_API_KEY = 'rcb_TXEVSXWeblisvQJwlYTinPYQhbQH';
```

**Note**: Keys should be moved to environment variables.

### Context Provider
```typescript
// RevenueCatContext.tsx
interface RevenueCatContextValue {
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  hasProAccess: boolean;
  isLoading: boolean;
  purchase: (pkg: Package) => Promise<void>;
  syncPurchasesManually: () => Promise<void>;
}
```

### Access Control (3-Tier Checking)
```typescript
// useAccessControl.ts
// Priority order:
1. RevenueCat entitlements
2. Supabase subscription_active flag
3. Legacy RPC check
// Admin role bypasses all checks
```

### Sandbox Mode Toggle
```typescript
// useSandboxMode.ts
// Admin can switch between production and sandbox
await supabase.rpc('update_sandbox_mode', { enabled: true });
// Requires page reload to take effect
```

---

## Mobile Implementation

### Files
```
wagerproof-mobile/
├── services/revenuecat.ts           # Service layer
├── contexts/RevenueCatContext.tsx   # React context
├── hooks/useProAccess.ts            # Pro access hook
├── components/RevenueCatPaywall.tsx # Paywall component
└── components/ProFeatureGate.tsx    # Feature gating
```

### API Keys (Platform-Specific)
```typescript
// services/revenuecat.ts
const IOS_API_KEY = 'test_WwRgjLydsPjgngueRMOVfVgWZzg';
const ANDROID_API_KEY = 'goog_cilRlGISDEjNmpNebMglZPXnPLb';
```

### RevenueCat Paywalls V2 (Mobile Only)
```typescript
import { PaywallComponent } from 'react-native-purchases-ui';

// Present paywall
await Purchases.presentPaywall();

// Present if needed (checks entitlements first)
await Purchases.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'WagerProof Pro' });
```

### Customer Center (Mobile Only)
```typescript
import { CustomerInfoView } from 'react-native-purchases-ui';

// Present native subscription management
await Purchases.presentCustomerCenter();
```

### Context Provider (Mobile)
```typescript
interface RevenueCatContextValue {
  isPro: boolean;
  subscriptionType: string | null;
  packages: Package[];
  purchase: (pkg: Package) => Promise<void>;
  restore: () => Promise<void>;
  checkEntitlement: () => Promise<boolean>;
  openCustomerCenter: () => Promise<void>;
}
```

---

## Sale Mode

### Database Tables
```sql
-- sale_mode table
CREATE TABLE sale_mode (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions
get_sale_mode() -> boolean
update_sale_mode(enabled: boolean) -> void
```

### Implementation
```typescript
// useSaleMode.ts
const { saleEnabled, toggleSaleMode } = useSaleMode();

// Paywall.tsx - Sale mode features:
// 1. "🔥 LIMITED TIME SALE - 50% OFF! 🔥" banner
// 2. Strikethrough original pricing
// 3. Dynamic discount calculation from actual package prices
// 4. Switches to discount products when enabled
```

### Admin Toggle
```typescript
// SaleModeToggle.tsx
<Switch
  checked={saleEnabled}
  onCheckedChange={toggleSaleMode}
/>
```

---

## Billing Management

### Web Approach
- Uses RevenueCat's built-in email customer portal
- No Supabase Edge Functions required
- Settings → Billing Tab shows subscription info

### Mobile Approach
- Native `CustomerCenter` UI component
- Direct integration with App Store/Play Store
- In-app subscription management

### Support Flow
1. User clicks "Manage Subscription"
2. Web: Instructions to email `admin@wagerproof.bet`
3. Mobile: Opens native customer center

---

## Database Integration

### Profiles Table
```sql
-- Subscription-related columns
ALTER TABLE profiles ADD COLUMN
  subscription_active BOOLEAN DEFAULT false,
  subscription_tier TEXT,
  subscription_expires_at TIMESTAMPTZ,
  revenuecat_customer_id TEXT,
  last_purchase_date TIMESTAMPTZ;
```

### Sync to Supabase
```typescript
// syncRevenueCatToSupabase.ts
async function syncSubscriptionStatus(userId: string, customerInfo: CustomerInfo) {
  await supabase.from('profiles').update({
    subscription_active: hasProAccess(customerInfo),
    subscription_tier: getSubscriptionTier(customerInfo),
    subscription_expires_at: getExpirationDate(customerInfo)
  }).eq('id', userId);
}
```

---

## Key Implementation Details

### Web Paywall (`Paywall.tsx`)
```typescript
// Dynamic pricing display
const actualDiscount = Math.round(
  (1 - (discountPrice / regularPrice)) * 100
);
// Shows "Save {actualDiscount}%!" instead of hardcoded 50%

// Sale banner (lines 520-536)
{saleEnabled && (
  <div className="sale-banner">
    🔥 LIMITED TIME SALE - 50% OFF! 🔥
  </div>
)}

// Strikethrough pricing (lines 595-609)
{saleEnabled && (
  <span className="line-through">${regularPrice}</span>
)}
```

### Mobile Paywall
- Uses RevenueCat V2 Paywalls
- Configured in RevenueCat dashboard
- Attached to offerings
- Customizable without code changes

---

## Troubleshooting

### Web: Purchase Not Working
1. Check if sandbox mode is enabled (admin setting)
2. Verify API keys in revenuecatWeb.ts
3. Check browser console for errors
4. Verify Stripe integration in RevenueCat dashboard

### Mobile: IAP Issues
1. Check platform-specific API key
2. Verify app signing (production vs debug)
3. Check RevenueCat dashboard for errors
4. Test with sandbox/test accounts

### Subscription Not Recognized
1. Check Supabase profiles table
2. Verify sync ran after purchase
3. Check entitlement name matches ("WagerProof Pro")
4. Try manual sync via context

### Sale Mode Not Working
1. Check database sale_mode.enabled value
2. Verify admin permission for toggle
3. Check discount products exist in RevenueCat
4. Verify package identifiers match

---

## Migration Notes

### From Stripe-Only to RevenueCat
1. RevenueCat handles Stripe integration for web
2. Mobile uses native IAP directly
3. Legacy subscription_active flag as fallback
4. Admin role always bypasses checks

### Future Considerations
1. Move API keys to environment variables
2. Consider unified paywall design
3. Add analytics for conversion tracking
4. Implement promotional offers
