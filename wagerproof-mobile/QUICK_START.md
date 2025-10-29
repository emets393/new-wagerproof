# Quick Start Guide

## 🚀 Get Running in 3 Steps

### Step 1: Add Environment Variables

Create a `.env` file in this directory with your Supabase credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Find these in:** `../src/integrations/supabase/client.ts` (from the web app)

### Step 2: Start the Dev Server

```bash
npm start
```

### Step 3: Open the App

- **iOS**: Press `i` (requires Xcode)
- **Android**: Press `a` (requires Android Studio)
- **Web**: Press `w` (opens in browser)
- **Phone**: Scan QR code with Expo Go app

## ✅ What to Test

1. Navigate between all 5 tabs
2. Toggle system dark mode (theme should change)
3. Check "More" tab menu items
4. Try sign out (currently just clears auth state)

## 🎯 Current Status

- ✅ Project setup complete
- ✅ Navigation working
- ✅ Theme configured  
- ✅ Auth context ready
- 🏗️ Features to be migrated

## 📝 Common Commands

```bash
# Clear cache if issues
npm run reset-cache

# Install new package
npm install --legacy-peer-deps <package>

# View all routes
npx expo customize

# Check bundle size
npx expo export --dump-sourcemap
```

## ❓ Troubleshooting

**App won't start?**
- Run `npm run reset-cache`
- Delete `node_modules` and run `npm install`

**Can't connect to dev server?**
- Make sure you're on the same network
- Try restarting with `npm start --tunnel`

**Simulator not opening?**
- iOS: Open Xcode, then Xcode > Open Developer Tool > Simulator
- Android: Open Android Studio, then Tools > AVD Manager

## 🔜 Next Steps

See `MIGRATION_PROGRESS.md` for the full roadmap.

Next up: **Phase 2 - Auth screens and protected routes**

