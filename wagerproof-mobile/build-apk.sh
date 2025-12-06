#!/bin/bash

# Build APK for Google Play Store using EAS Build
# Make sure you're logged in: eas login

echo "🚀 Building APK for Google Play Store..."
echo ""
echo "📝 Note: Google Play Store prefers AAB (Android App Bundle) format."
echo "   This script builds APK. For AAB, use: eas build --platform android --profile production"
echo ""

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in to EAS. Please run: eas login"
    exit 1
fi

echo "✅ Logged in to EAS"
echo ""

# Build APK
echo "🔨 Starting build..."
eas build --platform android --profile production --non-interactive

echo ""
echo "✅ Build started! Check your email or visit https://expo.dev/accounts/[your-account]/builds"
echo ""
echo "📦 Once complete, download the APK from the Expo dashboard"
echo "   or use: eas build:list to see your builds"

