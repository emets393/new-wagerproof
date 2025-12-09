# Review Request Modal Setup Guide

## Overview
The review request modal has been added to the testimonial screen (Step 9 - SocialProof) of the onboarding flow. This modal displays automatically when users reach the testimonials section and asks them to rate the app.

## Features
✅ **Two-stage process:**
- Stage 1: Asks if the user loves the app
- Stage 2: Shows 5-star rating system for positive responses

✅ **Cross-platform support:**
- iOS: Redirects to Apple App Store with write-review action
- Android: Redirects to Google Play Store

✅ **User experience:**
- Haptic feedback on interactions
- Smooth animations
- Close button to dismiss at any time
- Theming support (dark/light mode)

## Files Created/Modified

### New Files:
- `components/ReviewRequestModal.tsx` - The review modal component

### Modified Files:
- `components/onboarding/steps/Step9_SocialProof.tsx` - Integrated the modal

## Configuration

### Important: Update App Store URLs

Before deploying, you **MUST** update the app store URLs in `components/ReviewRequestModal.tsx`:

#### iOS Setup:
1. Open `components/ReviewRequestModal.tsx`
2. Find the `openAppStore()` function
3. Replace `id1234567890` in this line:
   ```typescript
   storeUrl = 'https://apps.apple.com/app/wagerproof/id1234567890?action=write-review';
   ```
4. Get your actual iOS App ID:
   - Go to https://apps.apple.com/app/wagerproof/idXXXXXXXXXX
   - The number after `id` is your App ID

#### Android Setup:
1. Open `components/ReviewRequestModal.tsx`
2. Find the `openAppStore()` function
3. Replace `com.wagerproof.app` with your actual package name in:
   ```typescript
   storeUrl = 'https://play.google.com/store/apps/details?id=com.wagerproof.app&showAllReviews=true';
   ```
4. Your package name is typically defined in `android/app/build.gradle`:
   ```gradle
   android {
       defaultConfig {
           applicationId "com.wagerproof.app"  // <-- This value
       }
   }
   ```

## How It Works

### User Flow:
1. User reaches the testimonials screen during onboarding
2. Review modal appears automatically
3. If user taps "Yes, I love it!" → Shows star rating screen
4. After rating:
   - 4-5 stars: Opens app store for review
   - 1-3 stars: Shows thank you message (for future feedback integration)
5. User can dismiss at any time with the close button or "Not now"/"Maybe later"

### Customization Options

#### Show/Hide Modal on Other Screens:
You can add the ReviewRequestModal to any other screen by:

1. Import the component:
   ```typescript
   import { ReviewRequestModal } from '@/components/ReviewRequestModal';
   ```

2. Add state management:
   ```typescript
   const [showReviewModal, setShowReviewModal] = useState(true);
   ```

3. Add to JSX:
   ```tsx
   <ReviewRequestModal 
     visible={showReviewModal}
     onDismiss={() => setShowReviewModal(false)}
   />
   ```

#### Modify Behavior:
The modal can be customized by editing `components/ReviewRequestModal.tsx`:

- **Change trigger timing**: Modify initial `visible={showReviewModal}` state
- **Change star thresholds**: Edit the `if (selectedRating >= 4)` condition
- **Change icons/colors**: Edit the `MaterialCommunityIcons` names and colors
- **Change text**: Edit strings in the render sections

### Testing

#### iOS Testing:
1. Run `npm run ios` or build via Xcode
2. Complete onboarding flow
3. Reach testimonials screen - modal should appear
4. Test both "Yes" and "Not now" flows
5. Check that app store link opens correctly

#### Android Testing:
1. Run `npm run android` or build via Android Studio
2. Complete onboarding flow
3. Reach testimonials screen - modal should appear
4. Test both "Yes" and "Not now" flows
5. Check that Play Store link opens correctly

## Haptic Feedback
The modal includes haptic feedback on various interactions:
- ✓ Success haptic when clicking "Yes, I love it!"
- ✓ Warning haptic when clicking "Not now"
- ✓ Selection haptic when tapping stars
- ✓ Success haptic when submitting review

Note: Haptics require physical devices; they won't work on simulators/emulators.

## Integration with Analytics (Optional)

To track review requests, add logging to `ReviewRequestModal.tsx`:

```typescript
import { logEvent } from '@/services/analytics'; // Your analytics service

const handleLikeApp = () => {
  logEvent('review_modal_positive', { step: 'initial' });
  // ... rest of function
};

const handleRating = (rating: number) => {
  logEvent('review_modal_rated', { rating });
  // ... rest of function
};

const handleSubmitReview = () => {
  logEvent('review_modal_submitted', { rating: selectedRating });
  // ... rest of function
};
```

## Future Enhancements

Possible improvements:
1. **Native Review Dialog**: Use `expo-review` package for native review dialogs
2. **Smart Triggering**: Show after certain milestones (e.g., 5 predictions made)
3. **Frequency Capping**: Store in AsyncStorage to prevent showing more than once
4. **Feedback Form**: Integrate feedback collection for ratings < 4 stars
5. **A/B Testing**: Test different copy and timing strategies

### Example Smart Triggering:
```typescript
const [reviewDismissalCount, setReviewDismissalCount] = useState(0);
const [lastReviewPrompt, setLastReviewPrompt] = useState<Date | null>(null);

const shouldShowReview = () => {
  // Only show if never dismissed more than twice and not shown in last 7 days
  if (reviewDismissalCount >= 2) return false;
  if (lastReviewPrompt) {
    const daysSinceLastPrompt = 
      (new Date().getTime() - lastReviewPrompt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < 7) return false;
  }
  return true;
};
```

## Troubleshooting

### Modal doesn't appear on Android:
- Verify package name is correct in `android/app/build.gradle`
- Check that the app is properly signed for Play Store testing

### Modal doesn't appear on iOS:
- Verify App ID is correct
- Check that Xcode project settings match the App Store app

### App store links don't open:
- Test with physical device (simulators may have limited URL support)
- Verify URLs are correct and app exists on both stores
- Check device has proper internet connectivity

### Haptics not working:
- Use physical device (haptics don't work on simulator/emulator)
- Verify `expo-haptics` is properly installed

## Support

For issues or questions, refer to:
- Expo Documentation: https://docs.expo.dev/
- React Native Linking API: https://reactnative.dev/docs/linking
- Material Community Icons: https://materialdesignicons.com/
