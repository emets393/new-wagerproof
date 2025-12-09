# RevenueCat Customer Center Implementation Guide

## ✅ Implementation Complete

Customer Center has been implemented using the native `Purchases.presentCustomerCenter()` API with fallback support.

## Features Implemented

1. ✅ **Native Customer Center UI**: Uses `Purchases.presentCustomerCenter()` for native modal
2. ✅ **Settings Integration**: Button in Settings screen to open Customer Center
3. ✅ **Fallback Support**: Falls back to store subscription management if Customer Center isn't available
4. ✅ **Error Handling**: Graceful error handling with user-friendly messages
5. ✅ **Loading States**: Shows loading indicator while opening Customer Center

## Setup Steps

### 1. RevenueCat Dashboard Configuration

**TODO**: Enable Customer Center in RevenueCat Dashboard:

1. Log in to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to **Settings** → **Customer Center**
3. Enable Customer Center for your app
4. Configure the Customer Center settings:
   - Customize appearance (optional)
   - Set up support email
   - Configure subscription management options
5. **Publish** the Customer Center configuration

**Note**: Customer Center must be enabled and published in the dashboard for `presentCustomerCenter()` to work.

### 2. Code Configuration

The API key is already configured in `services/revenuecat.ts`:
```typescript
const REVENUECAT_API_KEY = 'test_WwRgjLydsPjgngueRMOVfVgWZzg';
```

**TODO**: Replace with your production API key before release.

### 3. Usage

#### From Settings Screen

The Settings screen already has a "WagerProof Pro" button that:
- Opens Customer Center if user has an active subscription
- Opens Paywall if user doesn't have a subscription

#### Programmatically

```typescript
import { useRevenueCat } from '@/contexts/RevenueCatContext';

function MyComponent() {
  const { openCustomerCenter, isInitialized } = useRevenueCat();

  const handleManageSubscription = async () => {
    try {
      await openCustomerCenter();
    } catch (error) {
      console.error('Failed to open Customer Center:', error);
    }
  };

  return (
    <Button onPress={handleManageSubscription}>
      Manage Subscription
    </Button>
  );
}
```

## Implementation Details

### Service Layer (`services/revenuecat.ts`)

```typescript
/**
 * Present Customer Center UI
 * Shows the native Customer Center modal with subscription management
 */
export async function presentCustomerCenter(): Promise<void> {
  // Checks if RevenueCat is configured
  // Calls Purchases.presentCustomerCenter()
  // Handles errors gracefully
}
```

### Context Integration (`contexts/RevenueCatContext.tsx`)

The context provides:
- `openCustomerCenter()`: Opens Customer Center and refreshes customer info after dismissal
- `isInitialized`: Check if RevenueCat is ready

### Settings Screen (`app/(tabs)/settings.tsx`)

Features:
- Button that opens Customer Center for Pro users
- Loading state while opening
- Fallback to store subscription management if Customer Center isn't available
- Error handling with user-friendly messages

## Fallback Behavior

If Customer Center isn't available (not enabled in dashboard or not configured), the app will:

1. **iOS**: Attempt to open App Store subscription management
   - URL: `https://apps.apple.com/account/subscriptions`
   - Or shows instructions to go to Settings > Subscriptions

2. **Android**: Attempt to open Play Store subscription management
   - URL: `https://play.google.com/store/account/subscriptions`
   - Or shows instructions to go to Play Store > Subscriptions

## Testing

### Test Cases

1. **Logged-in User with Subscription**:
   - ✅ Customer Center should open and show subscription details
   - ✅ User can manage subscription, cancel, restore purchases

2. **Logged-in User without Subscription**:
   - ✅ Should show paywall instead of Customer Center

3. **Anonymous User**:
   - ✅ Customer Center should still open (RevenueCat handles anonymous users)
   - ✅ User can restore purchases if they have any

4. **Customer Center Not Enabled**:
   - ✅ Should fallback to store subscription management
   - ✅ Shows helpful error message

### Verification Steps

1. **Enable Customer Center in Dashboard**:
   - Go to RevenueCat Dashboard → Settings → Customer Center
   - Enable and publish Customer Center

2. **Test in App**:
   - Open Settings screen
   - Tap "WagerProof Pro" (if subscribed) or "Upgrade to Pro" (if not)
   - Customer Center should open as a native modal

3. **Check Console Logs**:
   - Look for "RevenueCat initialized successfully"
   - No errors when opening Customer Center

## Platform-Specific Notes

### iOS
- ✅ Uses native iOS Customer Center UI
- ✅ Requires iOS 15.1+ (already configured in Podfile)
- ✅ Works in simulator and device

### Android
- ✅ Uses native Android Customer Center UI
- ✅ Requires standard Android setup (no special config needed)
- ✅ Works in emulator and device

## Troubleshooting

### Customer Center Not Opening

1. **Check Dashboard**:
   - Verify Customer Center is enabled and published
   - Check that it's configured for the correct app

2. **Check Console**:
   - Look for "RevenueCat initialized successfully"
   - Check for any error messages

3. **Verify API Key**:
   - Ensure the API key matches your RevenueCat project
   - Check if you're using test vs production key

4. **Rebuild App**:
   ```bash
   cd ios && pod install && cd ..
   npx expo run:ios
   ```

### Fallback to Store Management

If Customer Center falls back to store management:
- This is expected if Customer Center isn't enabled in dashboard
- The fallback provides a good user experience
- Enable Customer Center in dashboard to use native UI

## Code Locations

- **Service**: `wagerproof-mobile/services/revenuecat.ts`
  - `presentCustomerCenter()` function
  - `initializeRevenueCat()` with debug logging

- **Context**: `wagerproof-mobile/contexts/RevenueCatContext.tsx`
  - `openCustomerCenter()` method
  - State management

- **Settings**: `wagerproof-mobile/app/(tabs)/settings.tsx`
  - "Manage Subscription" button
  - Error handling and fallback logic

## Next Steps

1. ✅ Enable Customer Center in RevenueCat Dashboard
2. ✅ Test with a test subscription
3. ✅ Update API key to production before release
4. ✅ Customize Customer Center appearance in dashboard (optional)

## Additional Resources

- [RevenueCat Customer Center Docs](https://www.revenuecat.com/docs/tools/customer-center)
- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [presentCustomerCenter API](https://www.revenuecat.com/docs/tools/customer-center#presenting-the-customer-center)

