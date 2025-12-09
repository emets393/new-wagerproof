# Build Android AAB (Google Play)

Increment the version and build an Android App Bundle for Google Play upload.

## Instructions

1. **Read the current versions** from both files:
   - `wagerproof-mobile/app.json` (expo config)
   - `wagerproof-mobile/android/app/build.gradle` (native config)

2. **Increment the versions** in BOTH files:
   - `versionCode`: Increment by 1 (e.g., 5 -> 6)
   - `versionName` / `version`: Increment patch version (e.g., 3.0.2 -> 3.0.3)

   **IMPORTANT**: The native `android/app/build.gradle` takes precedence for builds. Both files must be updated to stay in sync.

   In `app.json`:
   - `expo.version`
   - `expo.android.versionCode`

   In `android/app/build.gradle` (inside `defaultConfig`):
   - `versionCode`
   - `versionName`

3. **Build the AAB** by running:
   ```bash
   cd wagerproof-mobile/android && ./gradlew bundleRelease
   ```

4. **Report the results**:
   - Show the old and new version numbers
   - Confirm the AAB location: `wagerproof-mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Keystore Information

The project has existing release keystores configured for signing:

### Release Keystore
- **Location**: `wagerproof-mobile/android/app/wagerproof-release-key.keystore`
- **Backup**: `wagerproof-mobile/wagerproof-release-key.keystore`
- **Key Alias**: `wagerproof-key`
- **Configuration**: `wagerproof-mobile/android/keystore.properties`

### Debug Keystore
- **Location**: `wagerproof-mobile/android/app/debug.keystore`

## Alternative: Build APK (for testing)

To build an APK instead of AAB (for direct device installation):
```bash
cd wagerproof-mobile/android && ./gradlew assembleRelease
```
APK location: `wagerproof-mobile/android/app/build/outputs/apk/release/app-release.apk`

## Alternative: EAS Cloud Build

For EAS cloud builds (requires keystore uploaded to EAS):
```bash
cd wagerproof-mobile && eas build --platform android --profile preview
```

To upload keystore to EAS (one-time setup):
```bash
cd wagerproof-mobile && eas credentials
```
- Select Android > preview profile
- Choose "Keystore" > "Upload a keystore"
- Use the keystore at `android/app/wagerproof-release-key.keystore`
- Key alias: `wagerproof-key`
- Passwords are in `android/keystore.properties`

**Important**: Keep keystores secure and backed up. If lost, you cannot update the app on Google Play Store with the same package name.
