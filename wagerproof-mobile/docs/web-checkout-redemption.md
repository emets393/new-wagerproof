# RevenueCat Web Checkout with Redemption Links

This document explains how web checkout and redemption links work in the WagerProof mobile app.

## Overview

Web checkout allows users to purchase subscriptions through a web browser instead of native in-app purchases. This can be useful for:
- Offering different pricing (avoiding App Store/Play Store fees)
- Marketing campaigns and promotional links
- Users who prefer web-based checkout

After completing a web purchase, users receive a **redemption link** that opens the app and automatically activates their subscription.

## How It Works

### User Flow

1. User taps "Checkout on Web" in the paywall (handled by RevenueCat's dynamic paywall)
2. User is redirected to the web checkout page
3. User completes payment via Stripe
4. User receives a redemption link:
   - Displayed on the success page
   - Sent via email receipt
5. User taps the redemption link on their mobile device
6. The WagerProof app opens and processes the redemption
7. User's subscription is activated and entitlements are granted

### Redemption Link Format

```
rc-ff2fe0e0af://redeem_web_purchase?redemption_token=<TOKEN>
```

- `rc-ff2fe0e0af` - RevenueCat custom URL scheme (unique to WagerProof)
- `redeem_web_purchase` - Redemption endpoint
- `redemption_token` - One-time use token (expires after 60 minutes)

## Configuration Files

### 1. app.json
```json
"scheme": ["wagerproof", "rc-ff2fe0e0af"]
```
Registers the RevenueCat URL scheme with Expo.

### 2. AndroidManifest.xml
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="rc-ff2fe0e0af"/>
</intent-filter>
```
Allows Android to open the app when the redemption link is tapped.

### 3. iOS Info.plist
```xml
<key>CFBundleURLSchemes</key>
<array>
  <string>rc-ff2fe0e0af</string>
</array>
```
Allows iOS to open the app when the redemption link is tapped.

### 4. app/_layout.tsx
Contains the `WebPurchaseRedemptionHandler` component that:
- Listens for deep links on app cold start (`Linking.getInitialURL()`)
- Listens for deep links while app is running (`Linking.addEventListener()`)
- Parses redemption URLs with `Purchases.parseAsWebPurchaseRedemption()`
- Redeems purchases with `Purchases.redeemWebPurchase()`
- Shows appropriate alerts for success/error states

## RevenueCat Dashboard Setup

1. Navigate to your project in the RevenueCat dashboard
2. Go to your **Web Billing** app settings
3. Under **Redemption Links**, copy the custom URL scheme
4. Enable redemption links:
   - Use "Enable only for Sandbox" for testing
   - Enable for production when ready

## SDK Requirements

| SDK | Minimum Version |
|-----|-----------------|
| react-native-purchases | 8.5.0+ |

Current version in WagerProof: **9.6.9** (compatible)

## Testing

### Test in Sandbox Mode

1. Enable "Enable only for Sandbox" in RevenueCat dashboard
2. Build the app with the new URL schemes (`npx expo prebuild --clean`)
3. Install on a physical device
4. Use a sandbox Web Purchase Link to make a test purchase
5. Complete checkout and tap the redemption link
6. Verify the app opens and shows success message

### Test Deep Link Manually

Run this command to test the deep link handling (will show "Invalid Link" error as expected):

**iOS Simulator:**
```bash
xcrun simctl openurl booted "rc-ff2fe0e0af://redeem_web_purchase?redemption_token=test_token"
```

**Android (via ADB):**
```bash
adb shell am start -a android.intent.action.VIEW -d "rc-ff2fe0e0af://redeem_web_purchase?redemption_token=test_token"
```

## Redemption Result Types

| Result | Meaning | User Message |
|--------|---------|--------------|
| SUCCESS | Purchase activated | "Your WagerProof Pro subscription has been activated" |
| ERROR | General error | "There was an error activating your purchase" |
| INVALID_TOKEN | Link is malformed | "This activation link is invalid" |
| PURCHASE_BELONGS_TO_OTHER_USER | Already claimed by another account | "This purchase has already been claimed" |
| EXPIRED | Link older than 60 minutes | "A new link has been sent to your email" |

## Troubleshooting

### Link doesn't open the app

1. Verify the app is installed on the device
2. Check that native code was rebuilt after adding URL schemes
3. Ensure the link is tapped on mobile, not desktop
4. For iOS, verify CFBundleURLTypes in Info.plist
5. For Android, verify intent-filter in AndroidManifest.xml

### "Invalid Link" error on valid links

1. Ensure `react-native-purchases` is version 8.5.0+
2. Verify RevenueCat is initialized before handling the link
3. Check that the URL scheme matches exactly (`rc-ff2fe0e0af`)

### Expired link handling

- Links expire after 60 minutes
- When expired, RevenueCat automatically sends a new link to the user's email
- The app shows a message directing users to check their email

### Subscription not showing after redemption

1. Check RevenueCat dashboard for the transaction
2. Verify the entitlement name matches (`WagerProof Pro`)
3. Call `refreshCustomerInfo()` to sync latest data
4. Check for any errors in the console logs

## Important Notes

- Redemption links are **one-time use** - once redeemed, the same link cannot be used again
- Links expire after **60 minutes** - if expired, a new link is automatically emailed
- The app must be **installed** for the link to work - it won't work on desktop browsers
- Users can redeem on **multiple devices** by requesting new links from their email
- All redemption handling is **native-only** - web platform is skipped
