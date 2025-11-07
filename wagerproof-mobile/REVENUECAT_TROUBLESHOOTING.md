# RevenueCat Native Event Emitter Error - Troubleshooting Guide

## Error: "new NativeEventEmitter() requires a non-null argument"

This error occurs when the RevenueCat native module isn't properly linked or initialized. Follow these steps to fix it:

## Solution Steps

### 1. Rebuild the App (REQUIRED)

After installing `react-native-purchases`, you **MUST** rebuild the native app. The module won't work with just a Metro reload.

#### For iOS:
```bash
cd wagerproof-mobile
cd ios
pod install
cd ..
npx expo run:ios
```

#### For Android:
```bash
cd wagerproof-mobile
npx expo run:android
```

### 2. Clear Cache and Rebuild

If the error persists, try clearing everything:

#### iOS:
```bash
cd wagerproof-mobile/ios
rm -rf build/ Pods/ Podfile.lock
pod install
cd ..
npx expo run:ios --clean
```

#### Android:
```bash
cd wagerproof-mobile/android
./gradlew clean
cd ..
npx expo run:android --clean
```

### 3. Restart Metro Bundler

After rebuilding, restart Metro bundler:
```bash
# Stop Metro (Ctrl+C)
# Then restart:
npx expo start --clear
```

### 4. Verify Native Module is Linked

Check if the native module is available:

```javascript
import { NativeModules } from 'react-native';
console.log('RNPurchases:', NativeModules.RNPurchases);
```

If `RNPurchases` is `null` or `undefined`, the module isn't linked properly.

### 5. Check Expo Configuration

Make sure you're using Expo Dev Client (not Expo Go). RevenueCat requires native modules which don't work in Expo Go.

Verify in `app.json`:
```json
{
  "expo": {
    "plugins": [
      "expo-router"
    ]
  }
}
```

### 6. Verify Package Installation

Check that the package is installed:
```bash
cd wagerproof-mobile
npm list react-native-purchases
```

Should show: `react-native-purchases@9.6.3`

### 7. Platform-Specific Notes

#### iOS:
- Make sure CocoaPods is installed: `sudo gem install cocoapods`
- Run `pod install` in the `ios` directory
- Open Xcode and verify the `RNPurchases` module is in the project

#### Android:
- Make sure Gradle sync completes successfully
- Check `android/app/build.gradle` for the module

### 8. If Testing on Web

RevenueCat **does not work on web**. The error is expected. The code now handles this gracefully and won't crash.

### 9. Alternative: Delay Initialization

If the error persists, you can delay RevenueCat initialization:

```typescript
// In RevenueCatContext.tsx, add a delay:
useEffect(() => {
  const timer = setTimeout(() => {
    initializeRevenueCat();
  }, 1000); // Wait 1 second after app starts
  
  return () => clearTimeout(timer);
}, []);
```

## Current Implementation

The code has been updated to:
1. ✅ Lazy load the RevenueCat module (prevents import-time errors)
2. ✅ Check if native module is available before use
3. ✅ Handle web platform gracefully
4. ✅ Provide helpful error messages

## Still Having Issues?

1. **Check the console logs** - The updated code provides detailed warnings about what's wrong
2. **Verify you're not using Expo Go** - Use `expo run:ios` or `expo run:android`
3. **Check React Native version compatibility** - RevenueCat 9.6.3 requires React Native 0.70+
4. **Try a fresh install**:
   ```bash
   rm -rf node_modules
   npm install
   cd ios && pod install && cd ..
   npx expo run:ios
   ```

## Expected Behavior

- **iOS/Android**: RevenueCat should initialize and work normally
- **Web**: RevenueCat will gracefully skip initialization (no error)
- **Expo Go**: Will show warnings but won't crash (native modules don't work in Expo Go)

## Verification

After rebuilding, check the console for:
- ✅ "RevenueCat initialized successfully" - Everything is working
- ⚠️ "RevenueCat module not available" - Need to rebuild
- ⚠️ "RNPurchases not found" - Need to run pod install (iOS) or rebuild (Android)

