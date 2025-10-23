# Login Screen Refactor - Quick Start Guide

## What Changed?

Your login screen (`wagerproof-mobile/app/(auth)/login.tsx`) has been completely transformed from a traditional email/password form into a modern, visually-stunning onboarding screen featuring:

✨ **Wagerproof Logo & Title** - Brand presence at the top  
📱 **Phone Mockup** - iPhone-style frame with your video playing  
🎬 **Auto-playing Video** - `wagerproof.mp4` loops muted in the background  
🔘 **Two Main CTAs** - "Continue with Google" and "Continue with Email"  

---

## Files Created/Modified

### ✅ Modified
- **`wagerproof-mobile/app/(auth)/login.tsx`** - Complete redesign of main login screen
- **`wagerproof-mobile/package.json`** - Added `expo-av` dependency for video playback

### ✨ New
- **`wagerproof-mobile/app/(auth)/email-login.tsx`** - New dedicated email login form (moved from old login screen)
- **`LOGIN_SCREEN_REFACTOR.md`** - Full documentation
- **`LOGIN_SCREEN_UI_STRUCTURE.txt`** - ASCII diagrams and component breakdown

---

## Installation Steps

### 1. Install Dependencies
```bash
cd wagerproof-mobile
npm install
# or
bun install
```

### 2. Run the App
```bash
npm start
```

### 3. Test on Device/Simulator
- Android: `npm run android` or scan QR code in Expo Go
- iOS: `npm run ios` or scan QR code in Expo Go

---

## What Users See

### Login Screen (Main Entry Point)
```
┌─────────────────────────┐
│   [LOGO]                │
│   WAGERPROOF            │
│   Smart Betting...      │
│                         │
│   ╔═════════════════╗   │
│   ║  📱📱📱📱📱📱ϖ  ║   │
│   ║  📱  VIDEO   📱  ║   │
│   ║  📱  PLAYING  📱  ║   │
│   ║  📱📱📱📱📱📱  ║   │
│   ╚═════════════════╝   │
│                         │
│ [Google Button]         │
│ [Email Button]          │
│                         │
│ Terms of Service Link   │
└─────────────────────────┘
```

**User Actions:**
- Click **Google** → OAuth flow → App home (if authenticated)
- Click **Email** → Navigate to Email Login Screen
- Tap **Terms** → Navigate to terms page

### Email Login Screen (New)
```
┌─────────────────────────┐
│ Welcome Back            │
│ Sign in to access...    │
│                         │
│ Email Input             │
│ Password Input          │
│ [Forgot Password]       │
│                         │
│ [Sign In Button]        │
│                         │
│ Don't have account?     │
│ [Sign Up]               │
└─────────────────────────┘
```

**User Actions:**
- Enter email & password
- Click Sign In
- Or navigate to Sign Up

---

## Technical Details

### Main Login Screen Features
| Feature | Implementation |
|---------|---|
| **Video** | `expo-av` Video component |
| **Playback** | Muted, looping, auto-play |
| **Phone Frame** | CSS-in-JS StyleSheet with 48px border radius |
| **Notch** | Absolute positioned 80x24px element |
| **Responsive** | Max 280px width, adapts to screen size |
| **Theme Support** | Uses `react-native-paper` theme colors |
| **Shadows** | Platform-native (elevation on Android, shadow on iOS) |

### Component Tree
```
AuthContainer
└── View (flex container, space-between layout)
    ├── View (header) - Logo, title, subtitle
    ├── View (phoneContainer) - Video showcase
    │   ├── View (phoneMockup)
    │   │   ├── View (notch)
    │   │   ├── View (videoContainer)
    │   │   │   └── Video (wagerproof.mp4)
    │   │   ├── View (frameLeft)
    │   │   └── View (frameRight)
    │   └── View (phoneShadow)
    ├── View (buttonContainer)
    │   ├── Button (Google)
    │   └── Button (Email)
    └── View (footer) - Terms link
```

---

## Configuration

### Video Properties (Can be customized)
```tsx
<Video
  source={require('@/assets/wagerproof.mp4')}  // Video source
  rate={1.0}                                    // Playback speed
  volume={1.0}                                  // Volume (0-1)
  isMuted={true}                                // Audio muted
  resizeMode="cover"                            // Fill frame
  isLooping                                     // Loop enabled
  shouldPlay                                    // Auto-play
  style={styles.video}
/>
```

### Phone Mockup Dimensions
```tsx
const phoneWidth = Math.min(screenWidth - 48, 280);  // Max 280px
const phoneHeight = phoneWidth * 2.165;               // iPhone ratio
```

### Styling (Update in `styles` object)
```tsx
phoneMockup: {
  borderRadius: 48,           // iPhone corners
  borderWidth: 8,             // Frame thickness
  elevation: 20,              // Android shadow
  shadowColor: '#000',        // iOS shadow
  shadowOpacity: 0.3,
  shadowRadius: 24,
}
```

---

## Troubleshooting

### Video Not Playing?
1. Ensure `expo-av` is installed: `npm install expo-av`
2. Check `wagerproof.mp4` exists in `wagerproof-mobile/assets/`
3. Clear cache: `npm run reset-cache`

### Buttons Not Responding?
1. Ensure `useAuth()` hook is properly configured
2. Check auth context in `@/contexts/AuthContext`
3. Verify OAuth providers are set up in Supabase

### Phone Mockup Not Showing?
1. Check dimensions: should see ~280px wide frame
2. Verify `Dimensions.get('window')` returns correct screen width
3. Ensure `overflow: 'hidden'` on videoContainer

### Styling Issues?
1. Check theme colors: Uses `react-native-paper` theme
2. Verify safe area insets: Handled by `AuthContainer`
3. Test on both light and dark modes

---

## Next Steps

1. **Test thoroughly** - Verify video plays and buttons work
2. **Customize colors** - Adjust to match your brand guidelines
3. **Add analytics** - Track which button users click
4. **A/B Test** - Compare with old login flow metrics
5. **Optimize video** - Consider compression for faster load
6. **Add animations** - Use `react-native-reanimated` for transitions

---

## Need Help?

### Related Files
- `LOGIN_SCREEN_REFACTOR.md` - Full documentation
- `LOGIN_SCREEN_UI_STRUCTURE.txt` - Component hierarchy & diagrams
- `/wagerproof-mobile/components/ui/Button.tsx` - Button component docs
- `/wagerproof-mobile/components/ui/AuthContainer.tsx` - Auth wrapper docs

### Useful Resources
- [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [React Native Paper Theme](https://callstack.github.io/react-native-paper/)
- [React Native Dimensions API](https://reactnative.dev/docs/dimensions)

---

**Last Updated:** October 23, 2025
