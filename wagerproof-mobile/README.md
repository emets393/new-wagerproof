# WagerProof Mobile (React Native) — ⚠️ DEPRECATED, PHASE-OUT IN PROGRESS

> **This app no longer ships. Do not add features to it.**
>
> WagerProof mobile has moved to two native codebases:
> - **iOS** → `wagerproof-ios-native/` (SwiftUI, ships via Xcode Cloud, currently 3.5.8)
> - **Android** → `wagerproof-android-native/` (Kotlin/Compose, ships via
>   `.github/workflows/android-native.yml`, currently versionCode 49)
>
> This tree is frozen as a release target: `app.json` still declares 3.5.6 / buildNumber 40
> and has not been updated since 2026-06-09. It claims the same bundle id
> (`com.wagerproof.mobile`) as the native apps, so it cannot be published alongside them.
> Nothing in CI builds it, and the `eas.json` production/submit profiles are dead.
>
> **Acceptable work here:** bug fixes for users still on an old build, and deletions as the
> phase-out proceeds. **Not acceptable:** new features — they ship into a binary nobody
> downloads.
>
> Known drift vs the native apps: 21-step v1 onboarding (iOS is 25-step v2), RevenueCat's
> stock paywall (iOS has a custom SwiftUI one), no Parlay God, no Systems, and a still-routed
> Editor's Picks tab for a retired feature.
>
> **Blocks the phase-out:** `wagerproof-mobile/services/agentPicksService.ts:181` is the only
> caller of the V2 generation endpoint (`request-avatar-picks-generation-v2`) left in the
> repo, so the V1/V2 edge functions can only be deleted after this app is retired.
> Do not confuse this with the web app's same-named `src/services/agentPicksService.ts`,
> which invokes `trigger-v3-run` (V3) and is very much live.

React Native + Expo mobile app for WagerProof.

## Setup

```bash
npm install
npx expo start
```

**Prerequisites**: Node 18+, Expo CLI, iOS Simulator (Mac) or Android emulator.

For device builds:
```bash
eas build --platform ios --profile development
eas build --platform android --profile development
```

## Navigation Structure

Uses Expo Router (file-based routing) with nested layouts:

```
app/
├── _layout.tsx                    # Root: auth guard, providers, deep linking
├── (auth)/                        # Unauthenticated screens
│   ├── login.tsx                  # Social + email login
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (onboarding)/                  # First-run flow (paywall, agent builder)
│   └── index.tsx
├── (drawer)/                      # Main app (drawer navigation)
│   ├── _layout.tsx                # Drawer menu
│   └── (tabs)/                    # Bottom tab bar
│       ├── index.tsx              # Feed (NFL/CFB/NBA/NCAAB/MLB game cards)
│       ├── agents/                # AI Agents feature
│       │   ├── index.tsx          # Agent hub + leaderboard
│       │   ├── create.tsx         # Agent creation wizard
│       │   ├── [id]/index.tsx     # Agent detail + picks
│       │   ├── [id]/settings.tsx  # Agent settings
│       │   └── public/[id].tsx    # Public agent view
│       ├── picks.tsx              # Editor picks
│       ├── outliers.tsx           # Value finds
│       ├── scoreboard.tsx         # Live scores (8 leagues)
│       ├── chat.tsx               # WagerBot AI chat
│       ├── voice-chat.tsx         # Voice chat (WebRTC)
│       ├── roast.tsx              # Roast Mode
│       └── settings.tsx           # App settings
├── (modals)/                      # Modal screens
│   ├── discord.tsx
│   ├── secret-settings.tsx
│   └── delete-account.tsx
├── pixel-office-debug.tsx         # Debug: pixel office viewer
└── asset-library.tsx              # Debug: pixel art asset browser
```

## Build Profiles

Defined in `eas.json`:

| Profile | Distribution | Use Case |
|---------|-------------|----------|
| `development` | Internal | Dev builds with Expo dev client |
| `preview` | Internal | QA testing (APK on Android) |
| `production` | Store | App Store / Google Play submission |

### Building for Production

```bash
# iOS
eas build --platform ios --profile production
eas submit --platform ios

# Android
eas build --platform android --profile production
eas submit --platform android
```

**Apple credentials**: Managed remotely via EAS. Apple Team ID: `88DXY6L653`.
**Android keystore**: `wagerproof-release-key.keystore` (managed by EAS).

## App Configuration

Key settings in `app.json` (frozen 2026-06-09 — this app no longer ships, see the banner above):
- **Version**: 3.5.6
- **Bundle ID**: `com.wagerproof.mobile` — collides with both native apps, which is why
  this one cannot be published
- **iOS Build Number**: 40
- **Android Version Code**: 48 (the shipping Android app is at 49 in
  `wagerproof-android-native/app/build.gradle.kts`)
- **New Architecture**: Enabled
- **Typed Routes**: Enabled

## iOS Widget

Home Screen widget showing editor picks, fade alerts, or Polymarket value. See [docs/ios-widget.md](docs/ios-widget.md).

Files:
- `targets/WagerProofWidget/` — Swift widget extension
- `modules/widget-data-bridge/` — Native bridge module
- `hooks/useWidgetDataSync.ts` — Auto-sync hook

## Key Dependencies

- **UI**: React Native Paper, Bottom Sheet, Moti animations, Skia
- **Charts**: Victory Native
- **Auth**: Google Sign-In, Apple Auth
- **Payments**: RevenueCat (Purchases + PaywallUI)
- **Voice**: WebRTC, Expo Speech Recognition
- **Analytics**: Mixpanel
- **Notifications**: Expo Notifications
