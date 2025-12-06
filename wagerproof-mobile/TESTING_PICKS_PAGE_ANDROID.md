# Testing Guide: Picks Page Android Fix

## Quick Test Checklist

### 1. Build and Run
```bash
cd wagerproof-mobile
npx expo run:android --device
```

### 2. Navigate to Picks Page
1. Open the app
2. Tap on the "Picks" tab at the bottom
3. **Expected:** Page should load without crashing

### 3. Test Scenarios

#### ✅ Basic Functionality
- [ ] Page loads and displays picks
- [ ] Can swipe between sport tabs (All, NFL, CFB, NBA, NCAAB)
- [ ] Pick cards display correctly with team logos
- [ ] Gradient backgrounds render properly
- [ ] Pull to refresh works

#### ✅ Edge Cases
- [ ] Empty state displays when no picks available
- [ ] Loading shimmer shows while fetching data
- [ ] Error states display gracefully (if any)
- [ ] Picks with missing logos show team initials
- [ ] Archived picks display correctly

#### ✅ Sportsbook Buttons
- [ ] "Place Bet" button appears on published picks
- [ ] Modal opens when tapping "Place Bet"
- [ ] Sportsbook links work correctly

#### ✅ Visual Elements
- [ ] Header blur effect works (if supported)
- [ ] Team colors display correctly
- [ ] Pick badges show (WON, LOST, FREE PICK, etc.)
- [ ] Betting lines format correctly
- [ ] Analysis section expands/collapses

### 4. Performance Checks
- [ ] Smooth scrolling through picks list
- [ ] No lag when switching between sport tabs
- [ ] Fast refresh from pull-to-refresh
- [ ] Memory usage stays stable

### 5. Console Monitoring

Look for these expected logs (development mode only):
```
✅ "Failed to load [away/home] team logo: [url]" - Expected if logo URL is invalid
✅ "Error calculating gradient colors:" - Should not appear with fixes
✅ "PickCard Error:" - Should not appear unless there's a serious data issue
```

### 6. Stress Test

#### Test with Various Pick Types:
1. Recent picks (last 7 days)
2. Future picks
3. Completed picks (won/lost/push)
4. Free picks vs paid picks
5. Picks from all sports

#### Test with Different Network Conditions:
1. Good connection
2. Slow connection (throttled)
3. Offline mode (should show cached data or error)

### 7. Device Testing

Test on multiple Android versions if possible:
- [ ] Android 12+
- [ ] Android 10-11
- [ ] Android 9

Test on different manufacturers:
- [ ] Google Pixel
- [ ] Samsung
- [ ] OnePlus
- [ ] Other brands

## Known Issues (Non-Critical)

1. **Blur effects on Android**: The blur effect in the header may not work on all Android devices due to system settings or battery saver mode. This is expected behavior and handled by the `AndroidBlurView` component with fallback colors.

2. **Logo loading delays**: Team logos may take a moment to load depending on network speed. The app shows team initials as a fallback.

## If Crash Still Occurs

1. **Check Metro console** for error messages
2. **Check Android Logcat** for native errors:
   ```bash
   adb logcat | grep -i "error\|crash\|exception"
   ```
3. **Clear app data** and retry:
   ```bash
   adb shell pm clear [your.package.name]
   ```
4. **Clean rebuild**:
   ```bash
   cd wagerproof-mobile/android
   ./gradlew clean
   cd ..
   npx expo run:android --clean
   ```

## Success Criteria

- ✅ Picks page opens without crashing
- ✅ All picks display with proper formatting
- ✅ User can interact with all features
- ✅ No console errors related to gradients or colors
- ✅ Performance is smooth and responsive

## Reporting Issues

If you encounter a crash, please provide:
1. Android version
2. Device model
3. Steps to reproduce
4. Screenshots/screen recording
5. Console logs (if available)
6. Logcat output (if available)

