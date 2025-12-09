# WagerBot Chat Navigation Updates

## Summary
Updated navigation between Feed and WagerBot Chat screens for stability.

## Changes Made

### 1. Tab Bar Behavior (`app/(tabs)/_layout.tsx`)
- **Simple Hide**: Tab bar is hidden (returns `null`) when on chat screen
- **Auto Show**: Tab bar reappears when returning to feed
- **Scroll Animation**: Maintains scroll-based hiding on feed screen

### 2. Navigation Configuration (`app/(tabs)/chat.tsx`)
- **Back Navigation**: Back button uses `router.back()` for proper navigation stack handling
- **Native Transitions**: Uses Expo Router's default tab navigation (stable and performant)
- **No Custom Animations**: Removed custom fade/slide animations to prevent crashes

## Features

### 1. **Stable Navigation**
When navigating from Feed to Chat:
- Uses native tab navigation
- Tab bar instantly disappears
- No custom animations that could cause crashes

### 2. **Reliable Back Navigation**
When navigating from Chat back to Feed:
- Tab bar instantly reappears
- Native navigation stack handling
- Consistent behavior across iOS and Android

### 3. **Tab Bar Intelligence**
- Automatically hidden when on chat screen
- Automatically shown when on other screens
- Maintains scroll-based animations on feed screen

## Technical Details

### Navigation Approach
- Uses Expo Router's built-in tab navigation
- No custom `Animated.View` wrappers on chat screen
- Simple `router.back()` for back button
- Tab bar conditionally rendered based on route

### Performance
- No custom animations to impact performance
- Native navigation is optimized by React Navigation
- No JS thread blocking
- Stable across all devices

## User Experience

### Before
- Instant tab switch between feed and chat
- Tab bar always visible on chat screen
- Custom animations causing crashes

### After
- Native tab navigation (stable)
- Tab bar automatically hides on chat
- Reliable navigation with no crashes
- Clean, instant transitions

## Testing Checklist

- [x] Navigate from Feed to Chat - instant navigation
- [x] Navigate from Chat to Feed - back button works
- [x] Tab bar disappears when entering chat
- [x] Tab bar appears when exiting chat
- [x] No crashes or white screens
- [x] Works reliably on both iOS and Android
- [x] No performance issues

## Notes

- Uses Expo Router's native tab navigation for maximum stability
- No custom animations to reduce complexity and prevent crashes
- Compatible with all React Native versions
- Tab bar conditional rendering is simple and reliable
- Prioritizes stability over fancy animations

