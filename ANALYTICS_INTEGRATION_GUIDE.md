# Analytics Integration Summary: Mixpanel & Facebook Event SDK

## Overview

This document provides a comprehensive guide to integrating **Mixpanel** for onboarding analytics and **Facebook (Meta) Event SDK** for purchase attribution in a Flutter app with FlutterFlow. The implementation is cross-platform (iOS and Android) with native SDK initialization and Flutter bridge for event logging.

---

## Part 1: Mixpanel Integration (Onboarding Flow)

### 1.1 Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  mixpanel_flutter: ^2.0.0
  universal_platform: ^1.0.0+1
```

### 1.2 App Constants Configuration

Create a constants file for your Mixpanel API key:

```dart
// lib/app_constants.dart
abstract class FFAppConstants {
  static const String mixpanelKey = 'YOUR_MIXPANEL_PROJECT_TOKEN';
}
```

### 1.3 Mixpanel Utility Class

Create a singleton utility class for Mixpanel operations:

```dart
// lib/flutter_flow/mixpanel_util.dart
import 'package:mixpanel_flutter/mixpanel_flutter.dart';
import 'package:universal_platform/universal_platform.dart';
import '/app_constants.dart';

class MixpanelUtil {
  static Mixpanel? _mixpanel;
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    // Skip on web platform
    if (UniversalPlatform.isWeb) {
      print("Mixpanel tracking is not supported in the web version!");
      return;
    }

    if (FFAppConstants.mixpanelKey.trim().isEmpty) {
      print("Mixpanel API key is missing!");
      return;
    }

    try {
      _mixpanel = await Mixpanel.init(
        FFAppConstants.mixpanelKey,
        trackAutomaticEvents: true,  // Enables automatic session tracking
      );
      _initialized = true;
      print("Mixpanel initialized successfully");
    } catch (e) {
      print("Error initializing Mixpanel: $e");
    }
  }

  static Future<void> identifyUser(String userId) async {
    if (!_initialized) await initialize();
    _mixpanel?.identify(userId);
  }

  static Future<void> setUserProperties(Map<String, dynamic> properties) async {
    if (!_initialized) await initialize();
    final people = _mixpanel?.getPeople();
    if (people != null) {
      properties.forEach((key, value) {
        people.set(key, value.toString());
      });
    }
  }

  static Future<void> trackEvent(String eventName, [Map<String, dynamic>? properties]) async {
    if (!_initialized) await initialize();
    _mixpanel?.track(eventName, properties: properties);
  }

  static Future<void> flush() async {
    if (!_initialized) await initialize();
    _mixpanel?.flush();
  }
}
```

### 1.4 Custom Action for Event Sending (with Remote Config Toggle)

This action allows you to toggle Mixpanel event sending via Firebase Remote Config:

```dart
// lib/custom_code/actions/send_event_to_mixpanel.dart
import 'package:mixpanel_flutter/mixpanel_flutter.dart';
import 'package:universal_platform/universal_platform.dart';
import '/app_constants.dart';

Future sendEventToMixpanel(
  String eventName,
  dynamic properties,
  bool? enableLogging,
  bool? sendImmediately,
  bool? sendMixpanelEventsOn,  // Remote config toggle
) async {
  // Check if event sending is enabled via remote config
  if (sendMixpanelEventsOn == false) {
    if (enableLogging == true) {
      print("Mixpanel event sending is disabled: $eventName");
    }
    return;
  }

  if (UniversalPlatform.isWeb) {
    print("Mixpanel tracking is not supported in the web version!");
    return;
  }

  if (FFAppConstants.mixpanelKey.trim().isEmpty) {
    print("Mixpanel API key is missing!");
    return;
  }

  Mixpanel mixpanel = await Mixpanel.init(
    FFAppConstants.mixpanelKey,
    trackAutomaticEvents: true,
  );
  mixpanel.setLoggingEnabled(enableLogging ?? false);
  mixpanel.track(eventName, properties: properties);
  
  if (enableLogging == true || sendImmediately == true) {
    mixpanel.flush();  // Force immediate send
  }
}
```

### 1.5 App Initialization (main.dart)

Initialize Mixpanel during app startup and identify users when they log in:

```dart
// In main.dart - During app initialization
import 'flutter_flow/mixpanel_util.dart';

// In initializeApp() function:
if (!kIsWeb) {
  try {
    await MixpanelUtil.initialize();
    print("Mixpanel initialized successfully");
  } catch (e) {
    print("Mixpanel initialization error (non-critical): $e");
    // Continue even if Mixpanel fails - it's non-critical
  }
}

// When user logs in (in your auth stream listener):
userStream.listen((user) {
  if (user.uid?.isNotEmpty == true) {
    // Identify user in Mixpanel
    try {
      MixpanelUtil.identifyUser(user.uid!);
      
      // Set user properties
      final properties = <String, String>{};
      if (user.email != null) {
        properties['email'] = user.email!;
      }
      if (user.displayName != null) {
        properties['name'] = user.displayName!;
      }
      MixpanelUtil.setUserProperties(properties);
    } catch (e) {
      print("Error setting Mixpanel user properties: $e");
    }
  }
});
```

### 1.6 Tracking Onboarding Events

Track events at each step of your onboarding flow:

```dart
// Example: In an onboarding page widget
await actions.sendEventToMixpanel(
  'Onboarding Step Completed',  // Event name
  <String, String>{
    'Step': '3',                // Step number
    'step_name': 'age_selection',
    'age': currentUserDocument?.agestring ?? '',
    'source': currentUserDocument?.hearaboutusstring ?? '',
  },
  true,   // enableLogging
  true,   // sendImmediately
  getRemoteConfigBool('SendMixpanelEventsOn'),  // Remote config toggle
);
```

### 1.7 Firebase Remote Config for Toggle

Set up remote config to enable/disable Mixpanel events:

```dart
// lib/flutter_flow/firebase_remote_config_util.dart
import 'package:firebase_remote_config/firebase_remote_config.dart';

Future initializeFirebaseRemoteConfig() async {
  try {
    await FirebaseRemoteConfig.instance.setConfigSettings(RemoteConfigSettings(
      fetchTimeout: const Duration(minutes: 1),
      minimumFetchInterval: const Duration(hours: 1),
    ));
    await FirebaseRemoteConfig.instance.setDefaults(const {
      'SendMixpanelEventsOn': false,  // Default to false, enable remotely
    });
    await FirebaseRemoteConfig.instance.fetchAndActivate();
  } catch (error) {
    print(error);
  }
}

bool getRemoteConfigBool(String key) =>
    FirebaseRemoteConfig.instance.getBool(key);
```

---

## Part 2: Facebook (Meta) Event SDK Integration (Purchase Flow)

### 2.1 Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  facebook_app_events: ^0.20.1
  app_tracking_transparency: ^2.0.3
  device_info_plus: 11.5.0
  package_info_plus: any
  http: ^1.4.0
```

### 2.2 iOS Configuration

#### Info.plist Configuration

Add these keys to `ios/Runner/Info.plist`:

```xml
<!-- Meta SDK Configuration -->
<key>FacebookAppID</key>
<string>YOUR_FACEBOOK_APP_ID</string>
<key>FacebookClientToken</key>
<string>YOUR_FACEBOOK_CLIENT_TOKEN</string>
<key>FacebookDisplayName</key>
<string>Your App Name</string>
<key>FacebookAutoLogAppEventsEnabled</key>
<true/>
<key>FacebookAdvertiserIDCollectionEnabled</key>
<true/>

<!-- Facebook URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fbYOUR_FACEBOOK_APP_ID</string>
    </array>
  </dict>
</array>

<!-- Query schemes for Facebook SDK -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>fbapi</string>
  <string>fb-messenger-share-api</string>
  <string>fbauth2</string>
  <string>fbshareextension</string>
</array>

<!-- SKAdNetwork Configuration for Facebook/Meta Attribution -->
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
  <!-- Add 28+ more Facebook partner network IDs for full coverage -->
</array>
```

#### AppDelegate.swift Configuration

```swift
// ios/Runner/AppDelegate.swift
import UIKit
import Flutter
import FBSDKCoreKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    
    // Initialize Facebook SDK
    ApplicationDelegate.shared.application(
      application,
      didFinishLaunchingWithOptions: launchOptions
    )
    
    // Configure Facebook SDK settings
    Settings.shared.isAutoLogAppEventsEnabled = true
    Settings.shared.isAdvertiserIDCollectionEnabled = true
    Settings.shared.isAdvertiserTrackingEnabled = true
    
    print("✅ Facebook SDK initialized successfully")
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Handle URL schemes for Facebook
  override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    if ApplicationDelegate.shared.application(app, open: url, options: options) {
      return true
    }
    return super.application(app, open: url, options: options)
  }
}
```

### 2.3 Android Configuration

#### MainApplication.kt

```kotlin
// android/app/src/main/kotlin/com/yourcompany/yourapp/MainApplication.kt
package com.yourcompany.yourapp

import android.app.Application
import android.util.Log
import com.facebook.FacebookSdk
import com.facebook.LoggingBehavior

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        try {
            // Initialize Facebook SDK early
            if (!FacebookSdk.isInitialized()) {
                FacebookSdk.sdkInitialize(applicationContext)
            }
            
            // Enable debug mode only for debug builds
            if (BuildConfig.DEBUG) {
                FacebookSdk.setIsDebugEnabled(true)
                FacebookSdk.addLoggingBehavior(LoggingBehavior.APP_EVENTS)
                Log.d("MainApplication", "Facebook SDK debug mode enabled")
            }
            
            // Enable advertiser ID collection and auto-logging
            FacebookSdk.setAdvertiserIDCollectionEnabled(true)
            FacebookSdk.setAutoLogAppEventsEnabled(true)
            
            // Auto-logging handles app activation automatically
            // Do NOT call AppEventsLogger.activateApp() - causes duplicate events
            
            Log.d("MainApplication", "Facebook SDK initialized successfully")
        } catch (e: Exception) {
            Log.e("MainApplication", "Error initializing Facebook SDK", e)
        }
    }
}
```

#### AndroidManifest.xml

Add Facebook meta-data inside `<application>` tag:

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

#### strings.xml

```xml
<!-- android/app/src/main/res/values/strings.xml -->
<resources>
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="facebook_client_token">YOUR_FACEBOOK_CLIENT_TOKEN</string>
</resources>
```

### 2.4 Complete Registration Event (Onboarding Completion)

This event fires when a user completes onboarding:

```dart
// lib/custom_code/actions/log_meta_complete_registration.dart
import 'package:facebook_app_events/facebook_app_events.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import 'package:package_info_plus/package_info_plus.dart';

Future<Map<String, dynamic>> logMetaCompleteRegistration(
  String userId,
  String registrationMethod, // 'onboarding', 'email', 'google', 'apple'
  String? ageRange,
  String? referralSource,
  bool isTestEvent,
) async {
  final Map<String, dynamic> responses = {
    'meta': {'success': false, 'message': 'Not sent'},
    'mixpanel': {'success': false, 'message': 'Not sent'},
    'api': {'success': false, 'message': 'Not sent'},
  };

  try {
    // Collect device data (same data Meta SDK auto-collects)
    String deviceId = 'unknown';
    String deviceModel = 'unknown';
    String osVersion = 'unknown';
    String appVersion = 'unknown';

    try {
      final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();

      if (Platform.isIOS) {
        // Get IDFA on iOS (requires ATT permission)
        try {
          final trackingStatus = await AppTrackingTransparency.trackingAuthorizationStatus;
          if (trackingStatus == TrackingStatus.authorized) {
            deviceId = await AppTrackingTransparency.getAdvertisingIdentifier();
          }
        } catch (e) {
          print('Error getting IDFA: $e');
        }

        final iosInfo = await deviceInfo.iosInfo;
        deviceModel = iosInfo.utsname.machine;
        osVersion = 'iOS ${iosInfo.systemVersion}';
      } else if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceModel = '${androidInfo.manufacturer} ${androidInfo.model}';
        osVersion = 'Android ${androidInfo.version.release}';
        try {
          deviceId = androidInfo.id;
        } catch (e) {
          print('Error getting Android ID: $e');
        }
      }

      final PackageInfo packageInfo = await PackageInfo.fromPlatform();
      appVersion = packageInfo.version;
    } catch (e) {
      print('Error collecting device data: $e');
    }

    // Prepare Meta SDK parameters for CompleteRegistration event
    final Map<String, dynamic> metaParameters = {
      'fb_registration_method': registrationMethod,
      'fb_content_name': 'onboarding_complete',
      'fb_success': 1,
    };

    // Send to Meta SDK
    try {
      final facebookAppEvents = FacebookAppEvents();

      await facebookAppEvents.logEvent(
        name: 'CompleteRegistration',
        parameters: metaParameters,
      );

      // Flush immediately to ensure events are sent
      await facebookAppEvents.flush();

      responses['meta'] = {
        'success': true,
        'message': 'Event logged successfully',
        'event': 'CompleteRegistration',
        'parameters': metaParameters,
      };
      print('✅ Meta SDK Event Logged: CompleteRegistration - $metaParameters');
    } catch (e) {
      responses['meta'] = {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
      print('❌ Meta SDK Event Error: $e');
    }

    // Also send to Mixpanel for cross-platform analytics
    try {
      final mixpanelData = {
        'registration_method': registrationMethod,
        'content_name': 'onboarding_complete',
        'success': 1,
        'device_id': deviceId,
        'device_model': deviceModel,
        'os_version': osVersion,
        'app_version': appVersion,
        'age_range': ageRange ?? 'unknown',
        'referral_source': referralSource ?? 'unknown',
        'is_test_event': isTestEvent,
      };

      await sendEventToMixpanel(
        'Meta SDK CompleteRegistration Event',
        mixpanelData,
        true,
        true,
        getRemoteConfigBool('SendMixpanelEventsOn'),
      );

      responses['mixpanel'] = {
        'success': true,
        'event': 'Meta SDK CompleteRegistration Event',
        'properties': mixpanelData,
      };
    } catch (e) {
      responses['mixpanel'] = {'success': false, 'message': e.toString()};
    }

    return responses;
  } catch (e) {
    print('❌ Fatal error in logMetaCompleteRegistration: $e');
    return responses;
  }
}
```

### 2.5 Subscription Purchase Event

This is the critical event for Facebook ad attribution:

```dart
// lib/custom_code/actions/log_meta_subscription_event.dart
import 'package:facebook_app_events/facebook_app_events.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'dart:io';
import 'package:package_info_plus/package_info_plus.dart';

Future<Map<String, dynamic>> logMetaSubscriptionEvent(
  String userId,
  String platform,
  double price,
  String currency,
  String subscriptionType, // 'Annual', 'Monthly', 'Weekly'
  String? transactionId,
  String? ageRange,
  String? referralSource,
  bool isTrial,
  bool isPromo,
  bool isTestEvent,
) async {
  final Map<String, dynamic> responses = {
    'meta': {'success': false, 'message': 'Not sent'},
    'mixpanel': {'success': false, 'message': 'Not sent'},
  };
  
  try {
    // Calculate predicted LTV based on subscription type
    double predictedLtv;
    if (subscriptionType == 'Monthly') {
      predictedLtv = price * 4;  // 4 month average retention
    } else if (subscriptionType == 'Weekly') {
      predictedLtv = price * 6;  // 6 week average retention
    } else {
      // Annual
      predictedLtv = price * 1.3;  // 30% renewal rate
    }

    // Map subscription type to content ID for Facebook
    String contentId;
    if (isPromo && subscriptionType == 'Annual') {
      contentId = 'annual_promo_subscription';
    } else if (isPromo && subscriptionType == 'Monthly') {
      contentId = 'monthly_promo_subscription';
    } else if (subscriptionType == 'Annual') {
      contentId = 'annual_subscription';
    } else if (subscriptionType == 'Monthly') {
      contentId = 'monthly_subscription';
    } else {
      contentId = 'weekly_subscription';
    }

    // Collect device data
    String deviceId = 'unknown';
    String deviceModel = 'unknown';
    String osVersion = 'unknown';
    String appVersion = 'unknown';

    try {
      final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();

      if (Platform.isIOS) {
        try {
          final trackingStatus = await AppTrackingTransparency.trackingAuthorizationStatus;
          if (trackingStatus == TrackingStatus.authorized) {
            deviceId = await AppTrackingTransparency.getAdvertisingIdentifier();
          }
        } catch (e) {
          print('Error getting IDFA: $e');
        }

        final iosInfo = await deviceInfo.iosInfo;
        deviceModel = iosInfo.utsname.machine;
        osVersion = 'iOS ${iosInfo.systemVersion}';
      } else if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceModel = '${androidInfo.manufacturer} ${androidInfo.model}';
        osVersion = 'Android ${androidInfo.version.release}';
        deviceId = androidInfo.id;
      }

      final PackageInfo packageInfo = await PackageInfo.fromPlatform();
      appVersion = packageInfo.version;
    } catch (e) {
      print('Error collecting device data: $e');
    }

    // Prepare Meta SDK parameters (Facebook standard purchase parameters)
    final Map<String, dynamic> metaParameters = {
      '_valueToSum': price,                    // Purchase amount
      'fb_currency': currency,                 // Currency code (USD)
      'fb_order_id': transactionId ?? 'unknown',
      'fb_content_type': 'product',
      'fb_content_id': contentId,              // Your product identifier
      'fb_success': 1,
      'fb_payment_info_available': 1,
      'fb_predicted_ltv': predictedLtv,        // Predicted lifetime value
    };

    // Send to Meta SDK
    try {
      final facebookAppEvents = FacebookAppEvents();
      
      await facebookAppEvents.logEvent(
        name: 'fb_mobile_purchase',  // Standard Facebook purchase event
        parameters: metaParameters,
      );

      // Flush immediately - critical for purchase attribution
      await facebookAppEvents.flush();
      
      responses['meta'] = {
        'success': true,
        'message': 'Event logged successfully',
        'event': 'Subscribe',
        'parameters': metaParameters,
      };
      print('✅ Meta SDK Event Logged: Subscribe - $metaParameters');
    } catch (e) {
      responses['meta'] = {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
      print('❌ Meta SDK Event Error: $e');
    }

    // Send to Mixpanel (with device data for complete picture)
    try {
      final mixpanelData = {
        'value': price,
        'currency': currency,
        'order_id': transactionId ?? 'unknown',
        'content_type': 'product',
        'content_id': contentId,
        'predicted_ltv': predictedLtv,
        'subscription_type': subscriptionType,
        'platform': platform,
        'is_trial': isTrial,
        'is_promo': isPromo,
        'device_id': deviceId,
        'device_model': deviceModel,
        'os_version': osVersion,
        'app_version': appVersion,
        'is_test_event': isTestEvent,
      };
      
      await sendEventToMixpanel(
        'Meta SDK Subscribe Event',
        mixpanelData,
        true,
        true,
        getRemoteConfigBool('SendMixpanelEventsOn'),
      );
      
      responses['mixpanel'] = {
        'success': true,
        'event': 'Meta SDK Subscribe Event',
        'properties': mixpanelData,
      };
    } catch (e) {
      responses['mixpanel'] = {'success': false, 'message': e.toString()};
    }
  } catch (e) {
    print('❌ Meta Subscription Event Error: $e');
  }
  
  return responses;
}
```

### 2.6 Calling Events from Paywall Pages

After a successful RevenueCat purchase:

```dart
// In your paywall widget, after purchase confirmation
if (_model.didPurchase!) {
  HapticFeedback.selectionClick();
  
  // Log to Facebook for attribution
  await actions.logMetaSubscriptionEvent(
    currentUserReference!.id,           // userId
    isiOS ? 'iOS' : 'Android',           // platform
    revenue_cat.offerings!.current!.annual!.storeProduct.price,  // price
    'USD',                                // currency
    'Annual',                             // subscriptionType
    revenue_cat.customerInfo?.originalAppUserId,  // transactionId
    valueOrDefault(currentUserDocument?.agestring, ''),  // ageRange
    valueOrDefault(currentUserDocument?.hearaboutusstring, ''),  // referralSource
    false,  // isTrial
    false,  // isPromo
    false,  // isTestEvent
  );
  
  // Also log to Mixpanel directly
  await actions.sendEventToMixpanel(
    'Subscription Purchased',
    <String, String>{
      'subscription_type': 'Annual',
      'price': price.toString(),
      'source': 'onboarding_paywall',
    },
    true,
    true,
    getRemoteConfigBool('SendMixpanelEventsOn'),
  );
}
```

---

## Part 3: Event Summary

### Mixpanel Events (Onboarding)

| Event Name | Trigger | Properties |
|------------|---------|------------|
| `Onboarding Step X` | Each onboarding screen | step, step_name, age, source |
| `Trial Prime` | Final onboarding step | step, age, source |
| `Meta SDK CompleteRegistration Event` | Onboarding complete | registration_method, device_data |

### Facebook/Meta Events (Purchase)

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `CompleteRegistration` | Onboarding complete | fb_registration_method, fb_content_name, fb_success |
| `fb_mobile_purchase` | Subscription purchase | _valueToSum, fb_currency, fb_content_id, fb_predicted_ltv |
| `fb_mobile_activate_app` | App launch (auto) | timestamp |

### Content IDs for Facebook Attribution

| Content ID | Description | Price Example |
|------------|-------------|---------------|
| `annual_subscription` | Full-price yearly | $59.99 |
| `annual_promo_subscription` | Discounted yearly | $39.99 |
| `monthly_subscription` | Monthly plan | $9.99 |
| `weekly_subscription` | Weekly plan | $7.99 |

---

## Part 4: Critical Implementation Notes

### ✅ Do's

1. **Always flush after purchase events** - Call `facebookAppEvents.flush()` immediately after logging purchase events for proper attribution
2. **Use predicted LTV** - Facebook uses this for ad optimization. Calculate based on your retention data
3. **Request ATT permission on iOS** - Required for IDFA collection and better attribution
4. **Initialize SDK in native code** - Use AppDelegate.swift and MainApplication.kt for reliable initialization
5. **Use Remote Config toggle** - Allows you to enable/disable Mixpanel without app update

### ❌ Don'ts

1. **Don't call `AppEventsLogger.activateApp()` on Android** - Auto-logging handles this; calling it causes duplicate events
2. **Don't manually log `fb_mobile_activate_app`** - SDK handles this automatically when `isAutoLogAppEventsEnabled = true`
3. **Don't forget SKAdNetwork IDs** - Required for iOS 14+ attribution (add 30+ Facebook network IDs)
4. **Don't enable debug mode in production** - Use `BuildConfig.DEBUG` check on Android

### 🔧 Debugging Tips

1. Check Facebook Events Manager → Test Events tab for immediate event verification
2. Use `enableLogging: true` in Mixpanel calls during development
3. Look for `✅` and `❌` print statements in console for event status
4. Events may take 24-72 hours to appear in Facebook Events Manager without ATT permission

---

## Part 5: File Structure Summary

```
lib/
├── app_constants.dart                          # Mixpanel API key
├── main.dart                                   # SDK initialization
├── flutter_flow/
│   ├── mixpanel_util.dart                      # Mixpanel utility class
│   └── firebase_remote_config_util.dart        # Remote config helpers
└── custom_code/actions/
    ├── send_event_to_mixpanel.dart             # Mixpanel event action
    ├── log_meta_complete_registration.dart     # FB CompleteRegistration
    └── log_meta_subscription_event.dart        # FB Purchase event

ios/Runner/
├── AppDelegate.swift                           # iOS SDK initialization
└── Info.plist                                  # iOS SDK configuration

android/app/src/main/
├── kotlin/.../MainApplication.kt               # Android SDK initialization
├── AndroidManifest.xml                         # Android SDK configuration
└── res/values/strings.xml                      # FB App ID & Client Token
```

---

## Part 6: SKAdNetwork IDs for Facebook

Add these to your iOS `Info.plist` under `SKAdNetworkItems`:

```xml
<!-- Facebook/Meta Primary Networks -->
<string>v9wttpbfk9.skadnetwork</string>
<string>n38lu8286q.skadnetwork</string>

<!-- Additional Facebook Partner Networks -->
<string>cstr6suwn9.skadnetwork</string>
<string>4fzdc2evr5.skadnetwork</string>
<string>4pfyvq9l8r.skadnetwork</string>
<string>2u9pt9hc89.skadnetwork</string>
<string>8s468mfl3y.skadnetwork</string>
<string>klf5c3l5u5.skadnetwork</string>
<string>ppxm28t8ap.skadnetwork</string>
<string>uw77j35x4d.skadnetwork</string>
<string>578prtvx9j.skadnetwork</string>
<string>prcb7njmu6.skadnetwork</string>
<string>yclnxrl5pm.skadnetwork</string>
<string>3rd42ekr43.skadnetwork</string>
<string>c6k4g5qg8m.skadnetwork</string>
<string>s39g8k73mm.skadnetwork</string>
<string>3qy4746246.skadnetwork</string>
<string>f38h382jlk.skadnetwork</string>
<string>hs6bdukanm.skadnetwork</string>
<string>9rd848q2bz.skadnetwork</string>
<string>3sh42y64q3.skadnetwork</string>
<string>cg4yq2srnc.skadnetwork</string>
<string>f73kdq92p3.skadnetwork</string>
<string>mlmmfzh3r3.skadnetwork</string>
<string>w9q455wk68.skadnetwork</string>
<string>p78axxw29g.skadnetwork</string>
<string>6xzpu9s2p8.skadnetwork</string>
<string>ggvn48r87g.skadnetwork</string>
<string>3qcr597p9d.skadnetwork</string>
```

---

*Generated from Honeydew codebase - January 2026*

