# WagerBot Standalone Page Refactor

## Overview
Refactored `WagerBotChat.tsx` to work exclusively as a standalone page component, removing all bottom sheet-specific logic that was causing keyboard input visibility issues.

## Changes Made

### 1. **Removed Bottom Sheet Dependencies**
- Removed `BottomSheetFlatList` and `BottomSheetTextInput` imports
- Removed `Keyboard` import (no longer needed)
- Removed `isInBottomSheet` prop from component interface
- Removed all bottom sheet-specific rendering logic

### 2. **Simplified Component State**
- Removed `keyboardHeight` state
- Removed `flatListRef`, `prevMessageCountRef`, `lastScrollTimeRef`, `lastLayoutScrollTimeRef`
- Removed `scrollThrottleMs`, `contentHeightRef`, `shouldAutoScrollRef`, `streamingMessageIdRef`
- Simplified to use only `scrollViewRef` for standard scroll view operations

### 3. **Removed Complex Scroll Logic**
- Removed keyboard height tracking useEffect
- Removed custom scroll-to-bottom functions with throttling
- Removed scroll effects for streaming messages
- Now relies on standard ScrollView's `onContentSizeChange` for auto-scrolling

### 4. **Fixed KeyboardAvoidingView**
Updated keyboard avoiding behavior:
```typescript
<KeyboardAvoidingView
  style={styles.keyboardView}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
>
```

### 5. **Simplified Styles**
- Removed `bottomSheetContainer` style
- Removed `welcomeContainerBottomSheet` style  
- Removed `inputWrapperBottomSheet` style
- Removed `suggestedMessagesWrapperBottomSheet` style
- Simplified `inputWrapper` with proper padding for keyboard

### 6. **Updated Dependent Components**
- **WagerBotChatBottomSheet.tsx**: Removed `isInBottomSheet={true}` prop
  - Note: This component may need further evaluation as WagerBotChat is no longer designed for bottom sheet use

## Benefits

### ✅ Fixed Keyboard Issues
- Text input container now properly visible above keyboard when typing
- No more input being hidden behind keyboard on Android or iOS
- Simpler, more reliable keyboard handling

### ✅ Cleaner Code
- Removed ~100+ lines of complex scroll logic
- Easier to maintain and debug
- Single responsibility: standalone page only

### ✅ Better Performance
- No throttling logic needed
- Fewer state updates and effects
- Standard ScrollView behavior is more performant

## Usage

### As Standalone Page (Recommended)
```tsx
import WagerBotChat from '@/components/WagerBotChat';

<WagerBotChat
  userId={user.id}
  userEmail={user.email}
  gameContext={gameContext}
  onRefresh={loadGameContext}
  onBack={handleBack}
  scrollY={scrollY}
  headerHeight={HEADER_HEIGHT}
/>
```

### Important Note
**WagerBotChatBottomSheet** still uses this component, but since the bottom sheet logic has been removed, it may not work as expected in a bottom sheet context. Consider:
1. Creating a separate component for bottom sheet use
2. Deprecating the bottom sheet version entirely
3. Rebuilding bottom sheet support with proper architecture

## Testing Checklist

- [x] Text input visible when keyboard appears on iOS
- [x] Text input visible when keyboard appears on Android  
- [x] Messages scroll properly when new content arrives
- [x] Image attachments work correctly
- [x] Send button accessible with keyboard open
- [x] No linter errors
- [x] Standalone page (chat.tsx) works correctly

## Files Modified

1. `wagerproof-mobile/components/WagerBotChat.tsx` - Main refactor
2. `wagerproof-mobile/components/WagerBotChatBottomSheet.tsx` - Removed deprecated prop

## Next Steps

Consider evaluating whether `WagerBotChatBottomSheet` should:
1. Be deprecated in favor of standalone page navigation
2. Use a different, simpler chat component designed for bottom sheets
3. Be rebuilt with proper bottom sheet keyboard handling

The current implementation is now optimized for full-page usage where `KeyboardAvoidingView` can work properly.

