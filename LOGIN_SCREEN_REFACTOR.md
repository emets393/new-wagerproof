# Login Screen Refactor - Wagerproof Mobile

## Overview
The login screen has been completely refactored to feature a modern, visually engaging design with:
- **Wagerproof Logo and Title** at the top
- **Phone Mockup** displaying the wagerproof.mp4 video in the center
- **Two CTA Buttons**: "Continue with Google" and "Continue with Email"
- **Terms of Service footer** link

## Changes Made

### 1. **Modified Files**

#### `/wagerproof-mobile/app/(auth)/login.tsx`
**Before:** Traditional email/password login form with:
- Email input field
- Password input field  
- "Forgot Password" link
- Sign in button
- Social auth buttons (Google, Apple)

**After:** Showcase screen with:
- Logo and branded header
- Phone mockup with video player (looping the wagerproof.mp4)
- Two main CTA buttons
- Cleaner, more modern UX
- Video plays muted in an infinite loop

**Key Features:**
- Uses `expo-av` Video component for video playback
- Dynamic phone mockup sizing based on screen width
- iPhone-style notch design
- Responsive shadow effects
- Accessible and theme-aware styling

#### `/wagerproof-mobile/package.json`
**Added Dependency:**
- `expo-av: ^15.0.8` - For video playback functionality

### 2. **Created Files**

#### `/wagerproof-mobile/app/(auth)/email-login.tsx`
New dedicated email login screen that contains the original login form functionality:
- Email input with validation
- Password input
- Error handling
- "Forgot Password" link
- Sign in button
- Sign up link in footer

**Purpose:** Users who click "Continue with Email" on the main login screen are now routed here for traditional email/password authentication.

## Design Details

### Phone Mockup Styling
- **Dimensions:** 280px width (or max available with 24px padding), maintains iPhone aspect ratio (2.165:1)
- **Notch:** 80x24px with rounded bottom corners
- **Border:** 8px thick frame border
- **Corners:** 48px border radius for iPhone-like appearance
- **Shadow:** 20px elevation with 0.3 opacity for depth

### Button Hierarchy
1. **Primary Button (Google)** - Green/Primary color with Google icon
2. **Outline Button (Email)** - Outlined style with Email icon

### Video Implementation
- **Source:** `wagerproof.mp4` from assets
- **Playback:** Muted, looping, auto-play
- **Aspect Ratio:** Cover (fills the phone mockup)

## Flow
```
Login Screen (index)
├── Google OAuth
│   └── Authenticated user
└── Email Button
    └── Email Login Screen
        ├── Email/Password Sign In
        ├── Forgot Password
        └── Sign Up Link
```

## Installation

1. **Install dependencies:**
   ```bash
   cd wagerproof-mobile
   npm install
   # or
   bun install
   ```

2. **The expo-av package is now included** and will be installed automatically

## Testing

To test the new login screen:

1. Start the development server:
   ```bash
   npm start
   ```

2. The video should automatically play in the phone mockup (muted, looping)

3. Clicking "Continue with Google" triggers OAuth flow

4. Clicking "Continue with Email" navigates to the email login screen

## Styling System

All colors and typography respect the theme system:
- Uses Material Design 3 theme colors from `react-native-paper`
- Responsive to light/dark mode changes
- Safe area insets handled by AuthContainer

## Responsive Behavior

- Phone mockup scales based on screen width
- Maximum 280px width to maintain proportion
- Minimum padding of 24px on both sides
- Works on all device sizes (phone, tablet, landscape)

## Future Enhancements

Possible improvements:
- Add analytics tracking for button clicks
- Implement biometric authentication option
- Add animation transitions between screens
- Display testimonials or features on video overlay
- Add skip/demo mode for unauthenticated browsing
