// OAuth Client IDs for authentication providers

// Google OAuth Client IDs for Android
// Note: Google Cloud Console only allows one SHA-1 fingerprint per Android OAuth client ID
// Therefore, you need separate client IDs for debug and release builds

// Debug Android OAuth Client ID (for development/testing)
// SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
export const GOOGLE_ANDROID_CLIENT_ID_DEBUG = '142325632215-gr9pao3j8dfi5tq0aksl46b06uhglm6e.apps.googleusercontent.com';

// Release Android OAuth Client ID (for production)
// TODO: Create a release OAuth client ID in Google Cloud Console with your production keystore SHA-1
// Once you create a production keystore, get its SHA-1 fingerprint and create a new Android OAuth client ID
export const GOOGLE_ANDROID_CLIENT_ID_RELEASE = 'YOUR_RELEASE_CLIENT_ID_HERE';

// Helper function to get the appropriate Android client ID based on build type
export const getGoogleAndroidClientId = (): string => {
  // __DEV__ is true in development/debug builds, false in release builds
  if (__DEV__) {
    return GOOGLE_ANDROID_CLIENT_ID_DEBUG;
  }
  return GOOGLE_ANDROID_CLIENT_ID_RELEASE;
};

