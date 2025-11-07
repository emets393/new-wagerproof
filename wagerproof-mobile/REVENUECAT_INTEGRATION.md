# RevenueCat Integration Guide

This document provides a comprehensive guide for using RevenueCat in the WagerProof mobile app.

## Overview

RevenueCat has been fully integrated into the WagerProof app to handle subscription management. The integration includes:

- **Service Layer**: Core RevenueCat API wrapper (`services/revenuecat.ts`)
- **Context Provider**: React context for state management (`contexts/RevenueCatContext.tsx`)
- **UI Components**: Paywall and Customer Center components
- **Hooks**: Custom hooks for easy entitlement checking (`hooks/useProAccess.ts`)

## Configuration

### API Key
The RevenueCat API key is configured in `services/revenuecat.ts`:
```typescript
const REVENUECAT_API_KEY = 'test_WwRgjLydsPjgngueRMOVfVgWZzg';
```

**Note**: This is a test key. Update it to your production key before releasing.

### Entitlement Identifier
The app uses the entitlement identifier: `WagerProof Pro`

### Product Identifiers
The following product identifiers are configured:
- `monthly` - Monthly subscription
- `yearly` - Yearly subscription
- `lifetime` - Lifetime purchase

## Setup Instructions

### 1. RevenueCat Dashboard Configuration

Before using the app, you need to configure products in the RevenueCat dashboard:

1. **Create Products**:
   - Go to RevenueCat Dashboard → Products
   - Create three products:
     - `monthly` (Monthly subscription)
     - `yearly` (Yearly subscription)
     - `lifetime` (Lifetime purchase)

2. **Create Entitlement**:
   - Go to RevenueCat Dashboard → Entitlements
   - Create entitlement: `WagerProof Pro`
   - Attach all three products to this entitlement

3. **Create Offerings**:
   - Go to RevenueCat Dashboard → Offerings
   - Create an offering (e.g., "default")
   - Add packages for monthly, yearly, and lifetime products

4. **Configure Store Products**:
   - For iOS: Configure products in App Store Connect
   - For Android: Configure products in Google Play Console
   - Link these store products to RevenueCat products

### 2. App Store / Play Store Setup

#### iOS (App Store Connect)
1. Create in-app purchase products:
   - Monthly subscription
   - Yearly subscription (auto-renewable)
   - Non-consumable (for lifetime)

2. Note the product IDs and configure them in RevenueCat

#### Android (Google Play Console)
1. Create subscription products:
   - Monthly subscription
   - Yearly subscription

2. Create a managed product for lifetime purchase

3. Note the product IDs and configure them in RevenueCat

## Usage

### Basic Entitlement Checking

Use the `useProAccess` hook to check if a user has Pro access:

```typescript
import { useProAccess } from '@/hooks/useProAccess';

function MyComponent() {
  const { isPro, isLoading } = useProAccess();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isPro) {
    return <UpgradePrompt />;
  }

  return <ProFeature />;
}
```

### Showing the Paywall

```typescript
import { useState } from 'react';
import { RevenueCatPaywall } from '@/components/RevenueCatPaywall';

function MyScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setPaywallVisible(true)}>
        Upgrade to Pro
      </Button>
      
      <RevenueCatPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchaseComplete={() => {
          console.log('Purchase completed!');
          setPaywallVisible(false);
        }}
      />
    </>
  );
}
```

### Showing Customer Center

```typescript
import { useState } from 'react';
import { CustomerCenter } from '@/components/CustomerCenter';

function SettingsScreen() {
  const [customerCenterVisible, setCustomerCenterVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setCustomerCenterVisible(true)}>
        Manage Subscription
      </Button>
      
      <CustomerCenter
        visible={customerCenterVisible}
        onClose={() => setCustomerCenterVisible(false)}
      />
    </>
  );
}
```

### Using RevenueCat Context Directly

For more advanced use cases, you can use the RevenueCat context directly:

```typescript
import { useRevenueCat } from '@/contexts/RevenueCatContext';

function MyComponent() {
  const {
    isPro,
    customerInfo,
    packages,
    purchase,
    restore,
    refreshCustomerInfo,
  } = useRevenueCat();

  const handlePurchase = async (packageToPurchase) => {
    try {
      await purchase(packageToPurchase);
      console.log('Purchase successful!');
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <View>
      {packages.map((pkg) => (
        <Button
          key={pkg.identifier}
          onPress={() => handlePurchase(pkg)}
        >
          Buy {pkg.product.title}
        </Button>
      ))}
    </View>
  );
}
```

## Gating Pro Features

### Method 1: Using the Hook

```typescript
import { useProAccess } from '@/hooks/useProAccess';

function ProFeature() {
  const { isPro, isLoading } = useProAccess();

  if (isLoading) return <LoadingSpinner />;
  if (!isPro) return <UpgradePrompt />;

  return <ProContent />;
}
```

### Method 2: Conditional Rendering

```typescript
import { useProAccess } from '@/hooks/useProAccess';

function MyScreen() {
  const { isPro } = useProAccess();

  return (
    <View>
      <FreeFeature />
      {isPro && <ProFeature />}
    </View>
  );
}
```

### Method 3: Navigation Guards

```typescript
import { useProAccess } from '@/hooks/useProAccess';
import { useRouter } from 'expo-router';

function ProScreen() {
  const { isPro } = useProAccess();
  const router = useRouter();

  useEffect(() => {
    if (!isPro) {
      router.replace('/paywall');
    }
  }, [isPro]);

  return <ProContent />;
}
```

## API Reference

### RevenueCat Service (`services/revenuecat.ts`)

#### `initializeRevenueCat(userId?: string)`
Initializes the RevenueCat SDK. Called automatically by the provider.

#### `setRevenueCatUserId(userId: string)`
Sets the user ID for RevenueCat. Called automatically when user logs in.

#### `logOutRevenueCat()`
Logs out the current user. Called automatically when user logs out.

#### `getCustomerInfo()`
Returns the current customer info.

#### `hasActiveEntitlement()`
Checks if user has active entitlement.

#### `getOfferings()`
Gets available offerings.

#### `purchasePackage(packageToPurchase: PurchasesPackage)`
Purchases a package.

#### `restorePurchases()`
Restores previous purchases.

### RevenueCat Context (`contexts/RevenueCatContext.tsx`)

#### State
- `isInitialized`: Whether RevenueCat is initialized
- `isLoading`: Whether data is being loaded
- `customerInfo`: Current customer info
- `offering`: Current offering
- `packages`: Available packages
- `isPro`: Whether user has Pro access
- `subscriptionType`: Current subscription type ('monthly' | 'yearly' | 'lifetime' | null)
- `error`: Any error that occurred

#### Methods
- `refreshCustomerInfo()`: Refresh customer info
- `refreshOfferings()`: Refresh offerings
- `purchase(packageToPurchase)`: Purchase a package
- `restore()`: Restore purchases
- `checkEntitlement()`: Check entitlement status

### useProAccess Hook (`hooks/useProAccess.ts`)

#### Returns
- `isPro`: Boolean indicating Pro access
- `isLoading`: Loading state
- `hasProAccess()`: Function to check Pro access
- `refreshAccess()`: Function to refresh access status
- `getSubscriptionType()`: Get subscription type
- `isSubscriptionActive()`: Check if subscription is active
- `customerInfo`: Customer info object

## Best Practices

### 1. Always Check Loading State
```typescript
const { isPro, isLoading } = useProAccess();

if (isLoading) {
  return <LoadingSpinner />;
}
```

### 2. Handle Errors Gracefully
```typescript
try {
  await purchase(packageToPurchase);
} catch (error) {
  if (error.message === 'Purchase cancelled by user') {
    // User cancelled, don't show error
    return;
  }
  Alert.alert('Error', error.message);
}
```

### 3. Refresh After Purchase
The context automatically refreshes customer info after purchase, but you can manually refresh if needed:

```typescript
const { refreshCustomerInfo } = useRevenueCat();

// After purchase
await refreshCustomerInfo();
```

### 4. Use Entitlement Checking, Not Product Checking
Always check entitlements, not individual products:

```typescript
// ✅ Good
const { isPro } = useProAccess();

// ❌ Bad
const productId = customerInfo?.entitlements.active['WagerProof Pro']?.productIdentifier;
```

### 5. Handle Subscription Expiration
The `isSubscriptionActive()` function checks if a subscription is still valid:

```typescript
const { isSubscriptionActive } = useProAccess();

if (!isSubscriptionActive()) {
  // Subscription expired
  showRenewalPrompt();
}
```

## Testing

### Sandbox Testing (iOS)
1. Create sandbox test accounts in App Store Connect
2. Sign out of your Apple ID on the device
3. When prompted, sign in with a sandbox account
4. Test purchases will be free in sandbox

### Testing (Android)
1. Add test accounts in Google Play Console
2. Upload a test build
3. Add testers to the test track
4. Test purchases will be free for testers

### RevenueCat Test Mode
The app uses the test API key. Switch to production key before release.

## Troubleshooting

### Purchases Not Appearing
1. Check that products are configured in RevenueCat dashboard
2. Verify product IDs match between store and RevenueCat
3. Ensure entitlement is properly configured
4. Check that user is logged in (RevenueCat needs user ID)

### Paywall Not Showing
1. Check that an offering is configured in RevenueCat
2. Verify packages are added to the offering
3. Check network connectivity
4. Review console logs for errors

### Entitlement Not Activating
1. Verify purchase completed successfully
2. Check RevenueCat dashboard for purchase status
3. Ensure entitlement is linked to the purchased product
4. Try restoring purchases

## Production Checklist

Before releasing to production:

- [ ] Update API key to production key
- [ ] Configure products in App Store Connect / Google Play Console
- [ ] Link store products to RevenueCat products
- [ ] Test purchases in sandbox/test environment
- [ ] Test restore purchases functionality
- [ ] Verify entitlement checking works correctly
- [ ] Test paywall display and purchase flow
- [ ] Test customer center functionality
- [ ] Set up webhook endpoints (if needed)
- [ ] Configure analytics (if needed)

## Support

For RevenueCat-specific issues, refer to:
- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [RevenueCat Support](https://www.revenuecat.com/support)

For app-specific issues, check the code comments or contact the development team.

