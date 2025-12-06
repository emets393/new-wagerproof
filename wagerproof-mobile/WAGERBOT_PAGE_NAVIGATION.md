# WagerBot Page Navigation Implementation

## Overview
Changed WagerBot chat from a bottom sheet to a standalone page with bottom-to-top transition animation and hidden tab bar.

## Changes Made

### 1. **Updated Tab Layout Configuration**
**File:** `app/(drawer)/(tabs)/_layout.tsx`

- Added `presentation: 'modal'` to chat screen for modal-style presentation
- Added `animation: 'slide_from_bottom'` for bottom-to-top transition
- Added logic to hide floating tab bar when on chat screen:

```typescript
// Hide tab bar on chat screen
const isOnChatScreen = pathname.includes('/chat') || segments.includes('chat');
if (isOnChatScreen) {
  return null;
}
```

### 2. **Updated All Tab Screens to Use Navigation**
Replaced `openChatSheet()` with `router.push('/chat')` in:

- **index.tsx** (Feed screen)
  - Removed `useWagerBotChatSheet` import
  - Added `router.push('/chat' as any)` to chat button

- **picks.tsx** (Picks screen)
  - Removed `useWagerBotChatSheet` import
  - Added `router.push('/chat' as any)` to chat button

- **outliers.tsx** (Outliers screen)
  - Removed `useWagerBotChatSheet` import
  - Added `useRouter` import
  - Added `router.push('/chat' as any)` to chat button

- **scoreboard.tsx** (Scoreboard screen)
  - Removed `useWagerBotChatSheet` import
  - Added `router.push('/chat' as any)` to chat button

### 3. **Chat Screen Configuration**

```typescript
<Tabs.Screen
  name="chat"
  options={{
    title: 'Chat',
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name="message-text" size={size} color={color} />
    ),
    href: null, // Not in tab bar
    presentation: 'modal', // Modal presentation
    animation: 'slide_from_bottom', // Bottom-to-top
  }}
/>
```

## User Experience

### Before
- Tapping robot icon opened a bottom sheet
- Bottom sheet had keyboard issues
- Tab bar visible behind sheet
- Complex scroll and keyboard handling

### After ✅
- Tapping robot icon navigates to full-page chat
- **Bottom-to-top transition animation** (like iOS modal)
- **Tab bar automatically hidden** on chat screen
- Clean, native feel with proper keyboard handling
- Back button returns to previous screen

## Benefits

1. **Better Keyboard Handling**
   - Full KeyboardAvoidingView support
   - Input always visible above keyboard
   - No complex workarounds needed

2. **Cleaner UI**
   - No tab bar interference
   - Full-screen chat experience
   - Native modal presentation

3. **Improved Navigation**
   - Standard navigation patterns
   - Back button works correctly
   - Can use swipe gestures to dismiss

4. **Simpler Code**
   - No bottom sheet context needed in most screens
   - Standard router navigation
   - Easier to maintain

## Technical Details

### Modal Presentation
The `presentation: 'modal'` option tells Expo Router to present the screen as a modal, which:
- Overlays the entire screen
- Has its own navigation stack
- Dismisses with back button or swipe gesture
- Automatically handles transitions

### Tab Bar Hiding
The floating tab bar detects the current route and hides itself when on the chat screen:
```typescript
const isOnChatScreen = pathname.includes('/chat') || segments.includes('chat');
if (isOnChatScreen) {
  return null;
}
```

### Navigation Path
Using `/chat` as the path works because:
- Expo Router resolves it within the current navigation context
- The `as any` cast bypasses TypeScript's strict path checking
- The route is defined in the tabs layout

## Testing Checklist

- [x] Robot icon navigation works from Feed screen
- [x] Robot icon navigation works from Picks screen
- [x] Robot icon navigation works from Outliers screen
- [x] Robot icon navigation works from Scoreboard screen
- [x] Bottom-to-top animation plays when opening
- [x] Tab bar hidden on chat screen
- [x] Back button returns to previous screen
- [x] Keyboard input visible when typing
- [x] No linter errors

## Files Modified

1. `app/(drawer)/(tabs)/_layout.tsx` - Tab bar hiding + modal presentation
2. `app/(drawer)/(tabs)/index.tsx` - Navigation update
3. `app/(drawer)/(tabs)/picks.tsx` - Navigation update
4. `app/(drawer)/(tabs)/outliers.tsx` - Navigation update + router import
5. `app/(drawer)/(tabs)/scoreboard.tsx` - Navigation update

## Future Considerations

### WagerBotChatBottomSheet Component
The `WagerBotChatBottomSheet` component and `WagerBotChatSheetContext` are now mostly unused. Consider:
1. **Deprecating them** if no longer needed
2. **Removing them** to reduce bundle size
3. **Keeping them** only if used elsewhere in the app

### Alternative Navigation
If you ever need to show chat from outside the tab navigator, you can still use:
```typescript
router.push('/chat' as any)
```

This works from anywhere in the app, not just within tabs.

