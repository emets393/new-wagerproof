# WagerProof Mobile

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

Key settings in `app.json`:
- **Version**: 3.5.0
- **Bundle ID**: `com.wagerproof.mobile`
- **iOS Build Number**: 30
- **Android Version Code**: 40
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
