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

## Versioning

`versionName` / `versionCode` in `app/build.gradle.kts` are kept in lockstep with iOS
`Wagerproof/Configuration/Release.xcconfig` (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`),
so one user-facing version means the same build on both stores. Bump both platforms together.

Two constraints this creates: Play rejects a `versionCode` that is not strictly greater than
the live one, and iOS build numbers are incremented **server-side by Xcode Cloud**, so the
number in the repo can lag what actually shipped. Read the real iOS build number from App
Store Connect — not from the repo — before matching it.

## Releasing to Play

`.github/workflows/android-release.yml` builds the signed bundle and publishes it. Run it from
the Actions tab (choose a track) or push an `android-v*` tag. It is intentionally not wired to
plain pushes on `main`: `versionCode` is bumped by hand, so an automatic per-push upload would
resend a duplicate `versionCode` and be rejected.

Required repository secrets — **none are currently configured**, so the workflow cannot
publish until they are added:

| Secret | How to obtain |
|---|---|
| `WAGERPROOF_RELEASE_KEYSTORE_BASE64` | `base64 -i wagerproof-release-key.keystore \| pbcopy` |
| `WAGERPROOF_RELEASE_STORE_PASSWORD` | keystore store password |
| `WAGERPROOF_RELEASE_KEY_ALIAS` | `wagerproof-key` |
| `WAGERPROOF_RELEASE_KEY_PASSWORD` | keystore key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Cloud service-account JSON, granted "Release to production" in Play Console → Users and permissions |
| `FACEBOOK_APP_ID` / `FACEBOOK_CLIENT_TOKEN` | Meta app dashboard (optional; attribution is disabled without them) |
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase console (optional; FCM push stays inactive without it) |

The Play Developer API cannot create a package's first release — `com.wagerproof.mobile`
already exists on Play, so this is satisfied.

## Modules

`:core:models` (pure JVM) → `:core:shared` → `:core:services` → `:core:stores` → `:app`; `:core:design` (UI-only, no data deps); `:widgets` (Glance). Mirrors the iOS `WagerproofKit` layering — see PLAN.md for the layering rules and locked architecture decisions.
