# WagerProof Android (native)

Jetpack Compose rebuild of the iOS native app (`../wagerproof-ios-native/`) with full feature parity.

- **Plan / architecture**: [docs/PLAN.md](docs/PLAN.md)
- **Parity status**: [docs/PARITY.md](docs/PARITY.md)
- **Parity contract** (exhaustive iOS inventory): [docs/inventory/](docs/inventory/)
- **Fidelity waivers**: [docs/waivers/](docs/waivers/)
- **On-device visual regression**: [docs/VISUAL_REGRESSION.md](docs/VISUAL_REGRESSION.md)

## Build

```bash
./gradlew :app:assembleDebug
```

Requires JDK 17 and the Android SDK (`local.properties` → `sdk.dir`). Target SDK 36, min SDK 31.

Run the same checks as CI with:

```bash
./gradlew testDebugUnitTest :app:lintDebug :app:assembleDebug :app:lintRelease :app:bundleRelease
```

## Production configuration

- Firebase/FCM: register Android package `com.wagerproof.mobile` in the existing Firebase project and place the console-issued `google-services.json` at `app/google-services.json` (the file is gitignored). Credential-free local builds intentionally skip the Google Services plugin; push registration becomes active when the file is present. CI expects the file as the base64-encoded `GOOGLE_SERVICES_JSON_BASE64` secret.
- Release signing: provide `WAGERPROOF_RELEASE_STORE_FILE`, `WAGERPROOF_RELEASE_STORE_PASSWORD`, `WAGERPROOF_RELEASE_KEY_ALIAS`, and `WAGERPROOF_RELEASE_KEY_PASSWORD` as environment variables or Gradle properties. A local release build without them is unsigned and never falls back to the debug key.
- Google Sign-In: the package name and release SHA fingerprints must be registered against the existing Google Cloud OAuth project. The client uses the existing web/server client ID as its ID-token audience.
- RevenueCat: the native app uses the existing Android public SDK key and entitlement `WagerProof Pro`; offerings for the onboarding and generic placements must remain configured in the RevenueCat dashboard.
- Meta attribution: provide `FACEBOOK_APP_ID` and `FACEBOOK_CLIENT_TOKEN` as environment variables or Gradle properties. They must be supplied together; with neither present the SDK stays disabled. In the Meta app dashboard, register the Android package, `com.wagerproof.app.MainActivity`, and release key hashes. Automatic events and advertiser-ID collection are disabled so only explicit registration/purchase/subscription events are emitted; the Meta anonymous ID is forwarded to RevenueCat for CAPI attribution joins.

CI release signing uses the equivalent secrets `WAGERPROOF_RELEASE_KEYSTORE_BASE64`, `WAGERPROOF_RELEASE_STORE_PASSWORD`, `WAGERPROOF_RELEASE_KEY_ALIAS`, and `WAGERPROOF_RELEASE_KEY_PASSWORD`. The workflow rejects partial secret sets and otherwise verifies an unsigned release bundle when no signing secrets are available.

## Modules

`:core:models` (pure JVM) → `:core:shared` → `:core:services` → `:core:stores` → `:app`; `:core:design` (UI-only, no data deps); `:widgets` (Glance). Mirrors the iOS `WagerproofKit` layering — see PLAN.md for the layering rules and locked architecture decisions.
