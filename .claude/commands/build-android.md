# Build Android AAB (Google Play)

Build a signed Android App Bundle of the **native** app for manual Play upload.

> Builds `wagerproof-android-native/` — the Kotlin/Compose app that ships.
> NOT `wagerproof-mobile/`, the retired React Native tree. It is frozen, claims the
> same `com.wagerproof.mobile` package id, and building it would ship the wrong app.

## Prefer the workflow

The normal release path is `.github/workflows/android-release.yml` — run it from the
Actions tab (pick a track) or push an `android-v*` tag. It builds and publishes in one
step. Use this command only when you need an AAB in hand to upload by hand, or when the
Play publishing secrets are not configured.

## 1. Bump the version

Edit `defaultConfig` in `wagerproof-android-native/app/build.gradle.kts`:

- **`versionCode`** — must be **strictly greater than the versionCode already live on
  Play**. Read the live number from the Play Console; do not infer it from the repo or
  from the iOS build number. Play rejects a duplicate outright.
- **`versionName`** — tracks iOS `MARKETING_VERSION` in
  `wagerproof-ios-native/Wagerproof/Configuration/Release.xcconfig`. Leave it alone when
  reshipping the same user-facing version (an Android-only fix); bump it on both
  platforms together when the release is a real version change.

`versionCode` starts from the iOS `CURRENT_PROJECT_VERSION` but is **allowed to drift
above it** — an Android-only respin still has to increment while iOS does not. Do not
"correct" the drift by lowering it back to the iOS number.

## 2. Build

Two flags are mandatory; without them Gradle will hand back a stale artifact. See the
trap below.

```bash
cd wagerproof-android-native
./gradlew :app:clean :app:bundleRelease --no-daemon --no-configuration-cache \
  -PWAGERPROOF_RELEASE_STORE_FILE=<abs path to keystore> \
  -PWAGERPROOF_RELEASE_STORE_PASSWORD=... \
  -PWAGERPROOF_RELEASE_KEY_ALIAS=... \
  -PWAGERPROOF_RELEASE_KEY_PASSWORD=...
```

Read the passwords from `wagerproof-mobile/android/keystore.properties` inside the shell
rather than pasting them into the command, so they never land in a transcript or shell
history.

Output: `wagerproof-android-native/app/build/outputs/bundle/release/app-release.aab`

### Signing credentials

All four `WAGERPROOF_RELEASE_*` values are read from Gradle properties or same-named env
vars. Supplying **none** produces an unsigned bundle (fine for a compile check, useless
for upload); supplying **some** fails the build deliberately. There is no debug-key
fallback for release.

### Meta credentials

Nothing to pass. `app/build.gradle.kts` defaults the Meta app id and client token to the
shared Meta app — the same pair `wagerproof-ios-native/Wagerproof/Info.plist` hardcodes.

They were injected-only until 2026-08, and because nothing ever injected them, every
Android build shipped with `BuildConfig.FACEBOOK_APP_ID = ""`: the SDK never initialized,
every event call no-oped, and Meta received **no Android app events at all**. Step 3
below now checks the artifact for it, since `BUILD SUCCESSFUL` never caught this.

`-PFACEBOOK_APP_ID` / `-PFACEBOOK_CLIENT_TOKEN` still override, and must be passed
together — a client token from a different Meta app is rejected for every event.

## 3. Verify the artifact — do not skip

`BUILD SUCCESSFUL` alone does not mean you got a correct bundle. Check the AAB itself:

```bash
A=wagerproof-android-native/app/build/outputs/bundle/release/app-release.aab
ls -la "$A"                                    # timestamp must be from THIS build
unzip -o "$A" base/manifest/AndroidManifest.xml -d /tmp/aabx
python3 -c "d=open('/tmp/aabx/base/manifest/AndroidManifest.xml','rb').read(); \
  i=d.find(b'versionCode'); print(repr(d[i:i+20]))"   # protobuf: versionCode then the value
jarsigner -verify -certs -verbose "$A" | grep -m1 X.509   # expect CN=Chris Habib, OU=WagerProof
wagerproof-android-native/scripts/verify-meta-attribution.sh "$A"   # Meta app id compiled in
```

`aapt2 dump` does not work on an `.aab` ("could not identify format of APK") — it reads
APKs only. Extract the protobuf manifest as above, or use `bundletool`.

jarsigner will warn that the chain is invalid and the cert self-signed. **That is normal**
for an upload key and not a failure.

## The stale-artifact trap

An incremental release build can report `BUILD SUCCESSFUL` while every bundle task says
`UP-TO-DATE`, leaving an old AAB in place — even after a `versionCode` change. The stale
file looks plausible and will be rejected by Play (duplicate versionCode) or, worse,
uploaded with the wrong contents.

Guard against it three ways, all of them cheap:

1. `:app:clean` and `--no-configuration-cache` in the build command
2. Move any existing `app-release.aab` aside before building
3. Confirm the output file's **timestamp and versionCode** afterward (step 3 above)

## Keystore

| | |
|---|---|
| Release keystore | `wagerproof-mobile/wagerproof-release-key.keystore` |
| Passwords / alias | `wagerproof-mobile/android/keystore.properties` |
| Key alias | `wagerproof-key` |
| Cert | `CN=Chris Habib, OU=WagerProof`, SHA256 `5E:D4:72:3F:…:E2:91`, expires 2053-04-20 |

The keystore still lives in the retired RN tree — that is where it was generated, and
`storeFile` in `keystore.properties` is relative to the RN Gradle module. Moving it is
fine but is a deliberate change, not a cleanup to do mid-release.

This is the **upload key**. Losing it means never updating `com.wagerproof.mobile` on Play
again. Keep it backed up outside the repo.

## Alternative: APK for device testing

```bash
cd wagerproof-android-native && ./gradlew :app:assembleRelease   # same -P flags
```
Output: `wagerproof-android-native/app/build/outputs/apk/release/app-release.apk`

A release APK is for sideloading onto a device. Play accepts the AAB only.
