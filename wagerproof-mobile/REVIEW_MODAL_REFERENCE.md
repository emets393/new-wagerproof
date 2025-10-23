# Review Modal - Quick Reference Card

## 🚀 What's New?

A two-stage review modal appears on the onboarding testimonials screen that helps collect app reviews from satisfied users.

## 📍 Location
- **Screen**: Onboarding Step 9 (Testimonials/Social Proof)
- **Component**: `ReviewRequestModal.tsx`
- **Integrated in**: `Step9_SocialProof.tsx`

## 📋 3-Step Setup

### Step 1: Find Your iOS App ID
1. Search Google: "WagerProof iOS App Store"
2. Look at the URL: `apps.apple.com/app/wagerproof/id**1234567890**`
3. Copy the number after `id`

### Step 2: Update iOS URL
**File**: `components/ReviewRequestModal.tsx` (around line 71)
```typescript
// BEFORE:
storeUrl = 'https://apps.apple.com/app/wagerproof/id1234567890?action=write-review';

// AFTER:
storeUrl = 'https://apps.apple.com/app/wagerproof/id<YOUR_NUMBER>?action=write-review';
```

### Step 3: Update Android Package Name
**File**: `components/ReviewRequestModal.tsx` (around line 75)
```typescript
// First, find package name in: android/app/build.gradle
// Look for: applicationId "com.wagerproof.app"

// Then update URL:
// BEFORE:
storeUrl = 'https://play.google.com/store/apps/details?id=com.wagerproof.app&showAllReviews=true';

// AFTER:
storeUrl = 'https://play.google.com/store/apps/details?id=<YOUR_PACKAGE>&showAllReviews=true';
```

## 🧪 Quick Test

```bash
# iOS
npm run ios

# Android
npm run android
```

**Test Flow**:
1. Go through onboarding
2. Reach testimonials screen
3. Modal appears → "Do you love WagerProof?"
4. Click "Yes, I love it!"
5. Rate with stars
6. Submit → Should open app store

## 📱 Two Stages

### Stage 1: Initial Question
```
❤️ Do you love WagerProof?
[Yes, I love it!] [Not now]
```

### Stage 2: Star Rating
```
😊 How would you rate us?
★ ★ ★ ★ ★ (tap to select)
[Submit Review] [Maybe later]
```

## 🎯 Smart Behavior

| Rating | Behavior |
|--------|----------|
| ⭐⭐⭐⭐⭐ (5) | Open App Store |
| ⭐⭐⭐⭐ (4) | Open App Store |
| ⭐⭐⭐ (3) | Show Thank You |
| ⭐⭐ (2) | Show Thank You |
| ⭐ (1) | Show Thank You |

## 💡 Key Features

✅ Haptic feedback on all taps
✅ Works on iOS & Android
✅ Dark/Light mode support
✅ Close button always available
✅ Smooth animations
✅ No new dependencies needed

## 🔌 How to Use Elsewhere

Want the modal on a different screen?

```typescript
import { ReviewRequestModal } from '@/components/ReviewRequestModal';

export function MyScreen() {
  const [showReview, setShowReview] = useState(false);
  
  return (
    <>
      <ReviewRequestModal 
        visible={showReview}
        onDismiss={() => setShowReview(false)}
      />
      {/* Rest of screen */}
    </>
  );
}
```

## 📚 Documentation Files

1. **REVIEW_MODAL_QUICK_START.md** - Get started in 5 minutes
2. **REVIEW_MODAL_SETUP.md** - Complete setup & troubleshooting
3. **REVIEW_MODAL_IMPLEMENTATION_SUMMARY.md** - Full feature overview

## ⚡ Common Issues

| Issue | Fix |
|-------|-----|
| Modal doesn't appear | Check you're on testimonials screen (Step 9) |
| App store link doesn't open | Update iOS App ID or Android package name |
| Haptics don't work | Use physical device (not simulator) |
| Wrong app store opens | Wrong App ID or package name - double-check! |

## 🎯 Files Changed

```
✅ NEW: components/ReviewRequestModal.tsx
✅ MODIFIED: components/onboarding/steps/Step9_SocialProof.tsx
✅ NEW: REVIEW_MODAL_SETUP.md
✅ NEW: REVIEW_MODAL_QUICK_START.md
✅ NEW: REVIEW_MODAL_IMPLEMENTATION_SUMMARY.md
```

## 📊 Expected Impact

- Increase app store reviews
- Better user feedback collection
- Positive review boost (ratings 4-5)
- Track user satisfaction (ratings 1-3)

## 🚨 IMPORTANT

**Before deploying to production:**
- ✅ Update iOS App ID
- ✅ Update Android package name
- ✅ Test on physical iOS device
- ✅ Test on physical Android device

## 📞 Need Help?

1. Modal appearance issues? → See REVIEW_MODAL_SETUP.md → Troubleshooting
2. Implementation questions? → See REVIEW_MODAL_QUICK_START.md
3. Want to customize? → See REVIEW_MODAL_IMPLEMENTATION_SUMMARY.md → Customization

---

**Time to Setup**: ~5 minutes
**Complexity**: Very Easy
**Testing Time**: ~10 minutes per platform
