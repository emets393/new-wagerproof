# Native Google Sign-In Setup - Completion Guide

## ✅ What's Been Implemented

The following changes have been made to switch from web-based OAuth to native Google Sign-In:

1. **Package installed**: `@react-native-google-signin/google-signin`
2. **app.json updated**: Added Google Sign-In config plugin
3. **build.gradle updated**: Added Google Play Services Auth dependency
4. **strings.xml updated**: Added placeholder for client IDs
5. **AuthContext.tsx updated**: Replaced web OAuth with native Google Sign-In
6. **login.tsx updated**: Enhanced error handling

## 🔧 Required Configuration Steps

### Step 1: Get Your Web OAuth Client ID

You need the **Web OAuth Client ID** (not the Android client ID) to get ID tokens.

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find or create an **OAuth 2.0 Client ID** with type **Web application**
3. Copy the **Client ID** (it looks like: `XXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`)

### Step 2: Update strings.xml

Edit `/Users/chrishabib/Documents/new-wagerproof/wagerproof-mobile/android/app/src/main/res/values/strings.xml`:

Replace `YOUR_WEB_CLIENT_ID_HERE` with your actual Web OAuth Client ID:

```xml
<string name="web_client_id">YOUR_WEB_CLIENT_ID_HERE</string>
```

### Step 3: Update AuthContext.tsx

Edit `/Users/chrishabib/Documents/new-wagerproof/wagerproof-mobile/contexts/AuthContext.tsx`:

Line 8, replace `YOUR_WEB_CLIENT_ID_HERE` with your actual Web OAuth Client ID:

```typescript
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID_HERE', // Replace this
  offlineAccess: false,
});
```

### Step 4: Verify Google Cloud Console Configuration

Ensure you have **two** OAuth clients configured:

#### Android OAuth Client ID
- **Type**: Android
- **Package name**: `com.wagerproof.mobile`
- **SHA-1**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- **Client ID**: `142325632215-gr9pao3j8dfi5tq0aksl46b06uhglm6e.apps.googleusercontent.com`

#### Web OAuth Client ID
- **Type**: Web application
- **Name**: Any name you choose
- **Use**: This is what you'll configure in AuthContext and strings.xml

### Step 5: Add Test Users (Important!)

If your OAuth consent screen is in "Testing" mode:

1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Scroll to **Test users**
3. Add your Google account email
4. Without this, you'll get "Access blocked" errors

### Step 6: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq)
2. Navigate to **Authentication** → **Providers** → **Google**
3. Ensure Google provider is **enabled**
4. Enter your **Web OAuth Client ID** and **Client Secret**
5. Save changes

### Step 7: Rebuild the Android App

Since we added native modules, you must rebuild:

```bash
cd /Users/chrishabib/Documents/new-wagerproof/wagerproof-mobile
npx expo run:android
```

This will:
- Rebuild the app with native Google Sign-In module
- Install the updated app on your device/emulator

## 🧪 Testing

1. Open the app on Android device/emulator
2. Tap "Sign in with Google"
3. Should see native Google account picker (not a browser)
4. Select your Google account
5. App should sign you in and navigate to the home screen

## 🐛 Troubleshooting

### "Access blocked: This app's request is invalid"
- Add your Google account to **Test users** in OAuth consent screen

### "DEVELOPER_ERROR" or "Sign in failed"
- Verify Web Client ID is correct in both `strings.xml` and `AuthContext.tsx`
- Ensure Android OAuth client has correct package name and SHA-1
- Check that both OAuth clients are in the same Google Cloud project

### "Google Play Services not available"
- Update Google Play Services on your device
- Or use a different emulator image with Play Services included

### No response when tapping sign-in button
- Check console logs for errors
- Ensure you rebuilt the app after adding native modules
- Verify Google Play Services are installed on device

## 📋 Quick Checklist

- [ ] Get Web OAuth Client ID from Google Cloud Console
- [ ] Update `strings.xml` with Web Client ID
- [ ] Update `AuthContext.tsx` with Web Client ID
- [ ] Verify Android OAuth Client exists with correct package/SHA-1
- [ ] Add test users to OAuth consent screen
- [ ] Configure Supabase Google provider
- [ ] Rebuild app: `npx expo run:android`
- [ ] Test sign-in flow

## 🔑 Current Configuration

- **Package name**: `com.wagerproof.mobile`
- **SHA-1 (debug)**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- **Android Client ID**: `142325632215-gr9pao3j8dfi5tq0aksl46b06uhglm6e.apps.googleusercontent.com`
- **Web Client ID**: To be added by you
- **Supabase URL**: `https://gnjrklxotmbvnxbnnqgq.supabase.co`

## 📚 Resources

- [React Native Google Sign-In Docs](https://react-native-google-signin.github.io/docs/)
- [Supabase Auth with ID Token](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

