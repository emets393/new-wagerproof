# Review Modal - Quick Start Guide

## 🎯 What Was Added

A **two-stage review request modal** that appears on the onboarding testimonials screen. It asks users if they like the app and collects star ratings.

## 📋 Implementation Checklist

### ✅ Already Done:
- [x] Created `ReviewRequestModal.tsx` component
- [x] Integrated modal into `Step9_SocialProof.tsx`
- [x] Added haptic feedback
- [x] Added cross-platform support (iOS & Android)
- [x] Added theme support (light/dark mode)
- [x] Styled with Material Design principles

### 🔧 You Need To Do:

#### 1. **Update iOS App ID** (REQUIRED)
   - File: `components/ReviewRequestModal.tsx`
   - Find: `id1234567890` (line ~71)
   - Replace with: Your actual iOS app ID
   ```typescript
   storeUrl = 'https://apps.apple.com/app/wagerproof/id<YOUR_APP_ID>?action=write-review';
   ```

#### 2. **Update Android Package Name** (REQUIRED)
   - File: `components/ReviewRequestModal.tsx`
   - Find: `com.wagerproof.app` (line ~75)
   - Replace with: Your actual package name from `android/app/build.gradle`
   ```typescript
   storeUrl = 'https://play.google.com/store/apps/details?id=com.wagerproof.app&showAllReviews=true';
   ```

## 🧪 Testing

```bash
# iOS
npm run ios

# Android
npm run android
```

### Test Steps:
1. Complete onboarding flow
2. When you reach "Trusted by data-driven bettors" (testimonials screen)
3. Modal should appear immediately
4. Test: Click "Yes, I love it!" → Star rating screen appears
5. Test: Click "Not now" → Modal closes
6. Test: Select stars → "Submit Review" button enables
7. Test: Submit → Opens app store link

## 📱 Modal Features

| Feature | Details |
|---------|---------|
| **Two Stages** | Initial question → Star rating |
| **Feedback** | Haptic feedback on all interactions |
| **Dismissal** | Close button, "Not now" button, backdrop tap |
| **Smart Routing** | Ratings 4-5 stars → App store, <4 stars → Thank you |
| **Theme Support** | Automatically adapts to light/dark mode |
| **Animations** | Smooth fade animation |

## 🔧 Customization Examples

### Change When Modal Shows
**Current**: Shows on testimonials screen (Step 9)

**To show on a different screen:**
```typescript
// In any component
const [showReviewModal, setShowReviewModal] = useState(true);

return (
  <>
    <ReviewRequestModal 
      visible={showReviewModal}
      onDismiss={() => setShowReviewModal(false)}
    />
    {/* ... rest of screen */}
  </>
);
```

### Change Star Rating Threshold
**Current**: 4-5 stars redirect to store

**To change to 3+ stars:**
```typescript
// In ReviewRequestModal.tsx, handleSubmitReview function
if (selectedRating >= 3) {  // Changed from >= 4
  await openAppStore();
}
```

### Change Modal Text
All text strings are in the JSX. Find and modify:
- "Do you love WagerProof?" → Your text
- "How would you rate us?" → Your text
- Button labels, etc.

## 📊 User Flow Diagram

```
User on Testimonials Screen
           ↓
   Review Modal Appears
           ↓
    "Do you love it?"
     /            \
   YES            NO
    ↓              ↓
Star Rating    Modal Closes
    ↓
Select Stars
    ↓
"Submit Review"
    ↓
   /          \
4-5 ⭐      1-3 ⭐
  ↓            ↓
App Store    Thank You
 Opens      Message
    ↓            ↓
  Closes      Modal Closes
```

## 🐛 Common Issues & Fixes

### "Modal doesn't appear"
- ✓ Make sure you're on the testimonials screen (Step 9)
- ✓ Check if `showReviewModal` state is `true`
- ✓ Verify modal is imported and used correctly

### "App store link doesn't work"
- ✓ Verify iOS App ID and Android package name are correct
- ✓ Use physical device (not simulator/emulator)
- ✓ Check internet connection

### "Haptics not working"
- ✓ Use physical device (simulator doesn't support haptics)
- ✓ Check device haptics are enabled in settings

## 📦 Dependencies Used

All dependencies already in `package.json`:
- `expo-haptics` - For vibration feedback
- `react-native` - Base components
- `react-native-paper` - Theme support
- `@expo/vector-icons` - For icons

No new packages needed! ✅

## 🚀 Next Steps

1. **Update app store URLs** (iOS App ID + Android package name)
2. **Test on physical devices** (iOS & Android)
3. **Deploy to app stores** with updated URLs
4. **Monitor reviews** in app store analytics
5. (Optional) **Add analytics tracking** to measure conversion

## 📚 Full Documentation

See `REVIEW_MODAL_SETUP.md` for:
- Advanced configuration
- Analytics integration
- Future enhancement ideas
- Complete troubleshooting guide

## 💡 Pro Tips

1. **Frequency Capping**: Currently shows every time. Consider limiting with AsyncStorage.
2. **Better Timing**: Move to a different step based on user engagement metrics
3. **Native Dialog**: Consider `expo-review` for native review sheet (iOS 10.3+, Android 5+)
4. **A/B Testing**: Test different text/timing to optimize conversion

---

**Status**: ✅ Ready to use | Just need to update app store URLs!
