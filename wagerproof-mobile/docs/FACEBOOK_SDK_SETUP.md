# Facebook/Meta SDK Setup Guide

This guide explains how to configure the Facebook SDK for purchase attribution events (`fb_mobile_purchase`).

## Prerequisites

1. **Facebook Developer Account** - Create at [developers.facebook.com](https://developers.facebook.com/)
2. **Facebook App** - Create a new app in the developer console
3. **App ID** and **Client Token** from your Facebook App settings

## iOS Configuration

### 1. Update Info.plist

Add the following to `ios/WagerProof/Info.plist` inside the `<dict>` tag:

```xml
<!-- Facebook SDK Configuration -->
<key>FacebookAppID</key>
<string>YOUR_FACEBOOK_APP_ID</string>
<key>FacebookClientToken</key>
<string>YOUR_FACEBOOK_CLIENT_TOKEN</string>
<key>FacebookDisplayName</key>
<string>WagerProof</string>
<key>FacebookAutoLogAppEventsEnabled</key>
<true/>
<key>FacebookAdvertiserIDCollectionEnabled</key>
<true/>
```

### 2. Add Facebook URL Scheme

Add to the existing `CFBundleURLTypes` array in Info.plist:

```xml
<dict>
  <key>CFBundleURLSchemes</key>
  <array>
    <string>fbYOUR_FACEBOOK_APP_ID</string>
  </array>
</dict>
```

### 3. Add LSApplicationQueriesSchemes

Add to Info.plist:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>fbapi</string>
  <string>fb-messenger-share-api</string>
  <string>fbauth2</string>
  <string>fbshareextension</string>
</array>
```

### 4. Add SKAdNetwork IDs (Required for iOS 14+ Attribution)

Add to Info.plist for Facebook ad attribution:

```xml
<key>SKAdNetworkItems</key>
<array>
  <!-- Facebook/Meta Primary Networks -->
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>v9wttpbfk9.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>n38lu8286q.skadnetwork</string>
  </dict>
  <!-- Facebook Partner Networks -->
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>4fzdc2evr5.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>4pfyvq9l8r.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>2u9pt9hc89.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>8s468mfl3y.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>klf5c3l5u5.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>ppxm28t8ap.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>uw77j35x4d.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>578prtvx9j.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>prcb7njmu6.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>yclnxrl5pm.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>3rd42ekr43.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>c6k4g5qg8m.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>s39g8k73mm.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>3qy4746246.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>f38h382jlk.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>hs6bdukanm.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>9rd848q2bz.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>3sh42y64q3.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cg4yq2srnc.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>f73kdq92p3.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>mlmmfzh3r3.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>w9q455wk68.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>p78axxw29g.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>6xzpu9s2p8.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>ggvn48r87g.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>3qcr597p9d.skadnetwork</string>
  </dict>
</array>
```

## Android Configuration

### 1. Update AndroidManifest.xml

Add inside the `<application>` tag in `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.facebook.sdk.ApplicationId"
    android:value="@string/facebook_app_id" />
<meta-data
    android:name="com.facebook.sdk.ClientToken"
    android:value="@string/facebook_client_token" />

<provider
    android:name="com.facebook.FacebookContentProvider"
    android:authorities="com.facebook.app.FacebookContentProviderYOUR_APP_ID"
    android:exported="false" />
```

### 2. Create/Update strings.xml

Create or update `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">WagerProof</string>
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="facebook_client_token">YOUR_FACEBOOK_CLIENT_TOKEN</string>
</resources>
```

## Events Tracked

### CompleteRegistration
- Triggered: When user completes onboarding
- Parameters: `fb_registration_method`, `fb_content_name`, `fb_success`

### fb_mobile_purchase (Purchase)
- Triggered: When user successfully purchases a subscription
- Parameters:
  - `_valueToSum`: Purchase price
  - `fb_currency`: Currency code (USD)
  - `fb_content_type`: "product"
  - `fb_content_id`: e.g., "yearly_subscription"
  - `fb_order_id`: Transaction ID
  - `fb_predicted_ltv`: Predicted lifetime value
  - `fb_success`: 1
  - `fb_payment_info_available`: 1

### Subscribe
- Triggered: After purchase (in addition to fb_mobile_purchase)
- Parameters: `fb_currency`, `fb_content_type`, `fb_content_id`

## Testing

1. Use Facebook Events Manager Test Events to verify events are being received
2. Check console logs for "✅ Analytics: Facebook Purchase event logged"
3. Events may take 24-72 hours to appear in Events Manager without ATT permission

## Troubleshooting

- **Events not appearing**: Check that App ID and Client Token are correct
- **iOS 14+ attribution issues**: Ensure SKAdNetwork IDs are added
- **Android issues**: Verify strings.xml values and AndroidManifest.xml configuration

## Resources

- [Facebook SDK for React Native](https://github.com/thebergamo/react-native-fbsdk-next)
- [Facebook Events Manager](https://business.facebook.com/events_manager)
- [SKAdNetwork Implementation](https://developers.facebook.com/docs/app-events/skadnetwork)
