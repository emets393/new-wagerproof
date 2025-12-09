# RevenueCat Quick Start Guide

## ✅ Installation Status

RevenueCat SDK is already installed:
- `react-native-purchases` (v9.6.3)
- `react-native-purchases-ui` (v9.6.3)

## 🚀 Quick Start

### 1. RevenueCat Dashboard Setup

1. **Log in to RevenueCat Dashboard**: https://app.revenuecat.com
2. **Create Products**:
   - Go to Products → Create Product
   - Create: `monthly`, `yearly`, `lifetime`
3. **Create Entitlement**:
   - Go to Entitlements → Create Entitlement
   - Name: `WagerProof Pro`
   - Attach all three products
4. **Create Offering**:
   - Go to Offerings → Create Offering
   - Name: `default` (or any name)
   - Add packages for each product

### 2. Store Configuration

#### iOS (App Store Connect)
1. Create in-app purchases:
   - Monthly subscription (auto-renewable)
   - Yearly subscription (auto-renewable)
   - Non-consumable (for lifetime)
2. Copy product IDs to RevenueCat products

#### Android (Google Play Console)
1. Create subscriptions:
   - Monthly subscription
   - Yearly subscription
2. Create managed product for lifetime
3. Copy product IDs to RevenueCat products

### 3. Test the Integration

The integration is already set up in the app. To test:

1. **Open Settings Screen**:
   - Tap on "Upgrade to Pro" (if not subscribed)
   - Or "WagerProof Pro" (if subscribed) to manage subscription

2. **Use Pro Feature Gate**:
   ```tsx
   import { ProFeatureGate } from '@/components/ProFeatureGate';
   
   <ProFeatureGate showUpgradePrompt={true}>
     <YourProFeature />
   </ProFeatureGate>
   ```

3. **Check Pro Status**:
   ```tsx
   import { useProAccess } from '@/hooks/useProAccess';
   
   const { isPro } = useProAccess();
   ```

## 📝 Code Examples

### Show Paywall
```tsx
import { useState } from 'react';
import { RevenueCatPaywall } from '@/components/RevenueCatPaywall';

const [paywallVisible, setPaywallVisible] = useState(false);

<RevenueCatPaywall
  visible={paywallVisible}
  onClose={() => setPaywallVisible(false)}
  onPurchaseComplete={() => {
    console.log('Purchase completed!');
    setPaywallVisible(false);
  }}
/>
```

### Gate Pro Features
```tsx
import { ProFeatureGate } from '@/components/ProFeatureGate';

<ProFeatureGate showUpgradePrompt={true}>
  <ProFeature />
</ProFeatureGate>
```

### Check Pro Status
```tsx
import { useProAccess } from '@/hooks/useProAccess';

function MyComponent() {
  const { isPro, isLoading } = useProAccess();
  
  if (isLoading) return <Loading />;
  if (!isPro) return <UpgradePrompt />;
  
  return <ProContent />;
}
```

### Show Customer Center
```tsx
import { CustomerCenter } from '@/components/CustomerCenter';

<CustomerCenter
  visible={customerCenterVisible}
  onClose={() => setCustomerCenterVisible(false)}
/>
```

## 🔧 Configuration

### API Key
Located in: `services/revenuecat.ts`
```typescript
const REVENUECAT_API_KEY = 'test_WwRgjLydsPjgngueRMOVfVgWZzg';
```

**⚠️ Important**: Update to production key before release!

### Entitlement Identifier
- `WagerProof Pro` (configured in `services/revenuecat.ts`)

### Product Identifiers
- `monthly` - Monthly subscription
- `yearly` - Yearly subscription  
- `lifetime` - Lifetime purchase

## 📚 Files Created

1. **Service**: `services/revenuecat.ts` - Core RevenueCat API wrapper
2. **Context**: `contexts/RevenueCatContext.tsx` - React context for state
3. **Hook**: `hooks/useProAccess.ts` - Easy entitlement checking
4. **Components**:
   - `components/RevenueCatPaywall.tsx` - Paywall UI
   - `components/CustomerCenter.tsx` - Subscription management
   - `components/ProFeatureGate.tsx` - Feature gating component

## 🧪 Testing

### iOS Sandbox
1. Create sandbox test account in App Store Connect
2. Sign out of Apple ID on device
3. Test purchases will be free in sandbox

### Android Testing
1. Add test accounts in Google Play Console
2. Upload test build
3. Test purchases will be free for testers

## 📖 Full Documentation

See `REVENUECAT_INTEGRATION.md` for complete documentation.

## 🆘 Troubleshooting

### Paywall not showing?
- Check RevenueCat dashboard for offering configuration
- Verify packages are added to offering
- Check network connectivity

### Purchases not working?
- Verify products configured in RevenueCat
- Check product IDs match between store and RevenueCat
- Ensure user is logged in

### Entitlement not activating?
- Check purchase completed successfully
- Verify entitlement linked to product
- Try restoring purchases

## ✅ Next Steps

1. Configure products in RevenueCat dashboard
2. Set up products in App Store Connect / Google Play Console
3. Link store products to RevenueCat products
4. Test purchases in sandbox/test environment
5. Update API key to production before release

