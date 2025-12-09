# WagerProof Mobile

Cross-platform mobile app for WagerProof built with Expo and React Native.

## Features

- **iOS, Android, and Web** support from a single codebase
- **Expo Router** for file-based navigation
- **React Native Paper** for Material Design UI components
- **Supabase** for authentication and database
- **React Query** for data fetching and caching
- **Victory Native** for charts and data visualization

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode (for iOS simulator)
- Android: Android Studio (for Android emulator)
- Expo Go app on your physical device (for testing)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your actual Supabase URL and anon key (same as the web app).

### 3. Start Development Server

```bash
npm start
```

This will open Expo Dev Tools in your browser.

### 4. Run on Different Platforms

- **iOS Simulator**: Press `i` in the terminal or click "Run on iOS simulator" in Expo Dev Tools
- **Android Emulator**: Press `a` in the terminal or click "Run on Android device/emulator"
- **Web Browser**: Press `w` in the terminal or click "Run in web browser"
- **Physical Device**: Scan the QR code with Expo Go app (iOS) or Expo Go app (Android)

## Project Structure

```
wagerproof-mobile/
├── app/                      # Expo Router pages
│   ├── (tabs)/              # Bottom tab navigator
│   │   ├── index.tsx        # Home screen
│   │   ├── nfl.tsx          # NFL predictions
│   │   ├── cfb.tsx          # College Football
│   │   ├── scoreboard.tsx   # Live scores
│   │   └── more.tsx         # More menu
│   ├── (auth)/              # Authentication screens
│   ├── (modals)/            # Modal screens
│   └── _layout.tsx          # Root layout
├── components/              # Reusable components
│   ├── ui/                  # UI primitives
│   ├── game-cards/          # Game card components
│   ├── charts/              # Chart components
│   └── navigation/          # Navigation components
├── contexts/                # React contexts
│   └── AuthContext.tsx      # Authentication context
├── services/                # API services
│   └── supabase.ts          # Supabase client
├── hooks/                   # Custom React hooks
├── utils/                   # Utility functions
├── constants/               # Constants and theme
│   └── theme.ts             # Theme configuration
├── types/                   # TypeScript types
└── assets/                  # Images and static assets
```

## Available Scripts

- `npm start` - Start the development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run in web browser
- `npm run reset-cache` - Clear Metro bundler cache

## Development Status

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Expo Router configuration
- [x] Theme and styling
- [x] Authentication context
- [x] Tab navigation structure

### Phase 2: Core Pages (In Progress)
- [ ] NFL predictions page
- [ ] College Football page
- [ ] Scoreboard with live scores
- [ ] Account/Settings page
- [ ] WagerBot Chat integration

### Phase 3: Advanced Features (Planned)
- [ ] Game analysis details
- [ ] Bet slip grader
- [ ] Analytics and teaser tools
- [ ] Editors' picks
- [ ] Push notifications

## Testing

- **iOS**: Test on simulators for different iPhone models (iPhone 15, 15 Pro, SE)
- **Android**: Test on emulators for different Android versions (API 30+)
- **Web**: Test on Chrome, Safari, Firefox
- **Physical Devices**: Test on actual devices using Expo Go

## Building for Production

### iOS

```bash
eas build --platform ios
```

### Android

```bash
eas build --platform android
```

### Web

```bash
npx expo export:web
```

## Contributing

This is a migration of the WagerProof web app. When implementing features:

1. Reference the corresponding web app implementation
2. Adapt UI components for mobile-first design
3. Use React Native Paper components where possible
4. Ensure cross-platform compatibility (iOS, Android, Web)
5. Test on all platforms before merging

## License

Copyright © 2025 WagerProof. All rights reserved.

