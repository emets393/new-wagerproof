# RevenueCat Verification Guide

After rebuilding the app, use this guide to verify RevenueCat is working correctly.

## Quick Verification Steps

### 1. Check Console Logs

When the app starts, look for these messages in the console:

#### ✅ Success Messages:
```
RevenueCat initialized successfully
```

#### ⚠️ Warning Messages (if module not available):
```
RevenueCat module not available. Make sure the app is rebuilt after installing react-native-purchases.
RevenueCat native module (RNPurchases) not found. Run: cd ios && pod install && cd .. && npx expo run:ios
```

### 2. Test in Settings Screen

1. Navigate to the Settings screen in your app
2. Look for the subscription section:
   - **If not subscribed**: Should show "Upgrade to Pro" button
   - **If subscribed**: Should show "WagerProof Pro" with subscription status

3. Tap on the subscription item:
   - **If not subscribed**: Should open the paywall
   - **If subscribed**: Should open the customer center

### 3. Test Paywall

1. Open Settings
2. Tap "Upgrade to Pro" (if not subscribed)
3. The paywall should display:
   - Subscription options (Monthly, Yearly, Lifetime)
   - Pricing information
   - Purchase buttons

### 4. Test Customer Center

1. Open Settings
2. Tap "WagerProof Pro" (if subscribed)
3. Should show:
   - Subscription status
   - Product information
   - Expiration date (if applicable)
   - Restore purchases button

### 5. Verify Native Module

Add this temporary code to check if the native module is available:

```typescript
// Add to any component temporarily
import { NativeModules } from 'react-native';

console.log('RNPurchases available:', !!NativeModules.RNPurchases);
console.log('All native modules:', Object.keys(NativeModules));
```

## Expected Behavior

### ✅ Working Correctly:
- No "native event emitter" errors in console
- Settings screen shows subscription section
- Paywall opens without errors
- Customer center displays subscription info
- Console shows "RevenueCat initialized successfully"

### ❌ Still Having Issues:
- "native event emitter" error still appears
- Settings screen doesn't show subscription section
- Paywall doesn't open or shows errors
- Console shows warnings about module not available

## Troubleshooting

If you still see errors:

1. **Check you're using Expo Dev Client** (not Expo Go):
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```

2. **Verify the package is installed**:
   ```bash
   npm list react-native-purchases
   ```

3. **Check Metro bundler is restarted**:
   ```bash
   npx expo start --clear
   ```

4. **For iOS, verify pods are installed**:
   ```bash
   cd ios
   pod install
   ```

5. **Check the console for specific error messages** - the updated code provides detailed warnings

## Testing Purchases

⚠️ **Important**: To test actual purchases, you need:

1. **RevenueCat Dashboard Setup**:
   - Products configured
   - Entitlement created
   - Offering set up

2. **Store Configuration**:
   - iOS: Products in App Store Connect (sandbox)
   - Android: Products in Google Play Console (test track)

3. **Test Accounts**:
   - iOS: Sandbox test account
   - Android: Test account added in Play Console

## Next Steps

Once verified:
1. ✅ Configure products in RevenueCat dashboard
2. ✅ Set up products in App Store/Play Store
3. ✅ Test purchases in sandbox/test environment
4. ✅ Update API key to production before release

## Need Help?

Check `REVENUECAT_TROUBLESHOOTING.md` for detailed troubleshooting steps.

