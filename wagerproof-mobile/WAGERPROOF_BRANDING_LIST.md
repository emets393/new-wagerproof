# WagerProof Branding - User-Facing Text and Icons

This document lists all instances of "WagerProof" text and WagerProof icons displayed to users in the mobile app.

## User-Facing Text Instances

### App Name/Display Name
1. **app.json** (line 3)
   - `"name": "WagerProof"` - App display name

2. **Android strings.xml** (line 2)
   - `<string name="app_name">WagerProof</string>` - Android app name

3. **iOS Info.plist** (line 12)
   - `<string>WagerProof</string>` - iOS CFBundleDisplayName

### Header Titles (Split "Wager" / "Proof")
4. **app/(drawer)/(tabs)/index.tsx** (lines 1096-1097)
   - Header title split: `"Wager"` and `"Proof"` (Proof in green #00E676)

5. **app/(drawer)/(tabs)/scoreboard.tsx** (lines 152-153)
   - Header title split: `"Wager"` and `"Proof"` (Proof in green #00E676)

### Subscription/Pro References
6. **components/RevenueCatPaywall.tsx** (line 107)
   - Header title: `"Upgrade to WagerProof Pro"`

7. **app/(drawer)/(tabs)/settings.tsx** (line 274)
   - Settings item title: `"WagerProof Pro"` (when user has Pro)
   - Settings item title: `"Upgrade to Pro"` (when user doesn't have Pro)

8. **components/SideMenu.tsx** (line 192)
   - Menu item title: `"WagerProof Pro"` (when user has Pro)
   - Menu item title: `"Upgrade to Pro"` (when user doesn't have Pro)

9. **services/revenuecat.ts** (line 16)
   - Entitlement identifier: `'WagerProof Pro'` (used in RevenueCat)

10. **app/_layout.tsx** (line 164)
    - Alert message: `"Your WagerProof Pro subscription has been activated. Enjoy full access to all features!"`

11. **app/(drawer)/(tabs)/settings.tsx** (line 529)
    - Alert message: `"Welcome to WagerProof Pro!"`

12. **components/SideMenu.tsx** (line 397)
    - Alert message: `"Welcome to WagerProof Pro!"`

### Contact/Support References
13. **app/(drawer)/(tabs)/settings.tsx** (line 96)
    - Email subject: `"Contact Us - WagerProof Mobile"`

14. **components/SideMenu.tsx** (line 51)
    - Email subject: `"Contact Us - WagerProof Mobile"`

15. **app/(drawer)/(tabs)/settings.tsx** (lines 95, 104, 107, 139, 147, 299)
    - Email addresses: `admin@wagerproof.bet` (multiple instances in error messages and alerts)

16. **components/SideMenu.tsx** (lines 50, 59, 62)
    - Email addresses: `admin@wagerproof.bet` (multiple instances in error messages)

### Discord Screen
17. **app/(modals)/discord.tsx** (line 258)
    - Text: `"As a member of the WagerProof community, you have access to our private Discord server!"`

### iOS Widget Screen
18. **app/(modals)/ios-widget.tsx** (line 117)
    - Widget preview brand text: `"WagerProof"` (displayed in widget header)

19. **app/(modals)/ios-widget.tsx** (line 273)
    - Screen title: `"WagerProof Widget"`

20. **app/(modals)/ios-widget.tsx** (line 377)
    - Instruction text: `Search for "WagerProof"` (in widget setup instructions)

### iOS Widget (Native Swift)
21. **targets/WagerProofWidget/Views/SharedComponents.swift** (line 65)
    - Widget header brand text: `"WagerProof"` (displayed in native iOS widget)

## User-Facing Icon/Logo Instances

### Logo Images
1. **components/ui/AuthContainer.tsx** (line 35)
   - Logo image: `require('@/assets/wagerproof-logo.png')`
   - Used in: Login/signup screens

2. **assets/wagerproof-logo.png**
   - Main logo file used in authentication screens

### App Icons
3. **assets/icon.png**
   - Main app icon (referenced in app.json line 7)

4. **assets/splash-icon.png**
   - Splash screen icon (referenced in app.json line 12)

5. **assets/adaptive-icon.png**
   - Android adaptive icon foreground (referenced in app.json line 31)

6. **assets/favicon.png**
   - Web favicon (referenced in app.json line 40)

7. **ios/AppIcon.icon/**
   - iOS app icon set (contains wagerprooflogowhitetransparent.png)

### Additional Brand Assets
8. **assets/wagerproof.gif**
   - Animated logo/gif file

9. **assets/wagerproofGreenDark.png**
   - Dark theme variant of logo

10. **assets/wagerproofGreenLight.png**
    - Light theme variant of logo

11. **android/app/src/main/res/drawable-*/splashscreen_logo.png**
    - Android splash screen logos (multiple density versions: hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)

12. **android/app/src/main/res/mipmap-*/ic_launcher*.webp**
    - Android launcher icons (foreground, round variants, multiple densities)

## Summary

### Text Instances: 21 locations
- App names: 3
- Header titles (split): 2 screens
- Pro/Subscription: 7
- Contact/Support: 6
- Discord: 1
- iOS Widget: 3

### Icon/Logo Instances: 12+ locations
- Logo images: 1 component usage
- App icons: 4 main icon files
- Brand assets: 4 additional logo variants
- Platform-specific icons: Multiple Android/iOS icon sets

## Notes
- The header titles use a split format: "Wager" (normal color) + "Proof" (green #00E676)
- Most user-facing text uses "WagerProof" as a single word
- The iOS widget displays "WagerProof" as brand text in the widget header
- Email addresses use "wagerproof.bet" domain
- Subscription references use "WagerProof Pro" format
