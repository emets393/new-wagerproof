# WagerBot Bottom Sheet Fix

## Problem
The WagerBot chat bottom sheet was not opening when the chat button was pressed in the mobile app.

## Root Cause
The `WagerBotChatBottomSheet` component was using a controlled `index` prop (state-based) with excessive logging and retry logic. Other bottom sheets in the app (NBA, NFL, CFB, NCAAB) use a simple, clean ref-based approach with `snapToIndex()`.

## Solution
Completely refactored to **exactly match** the game bottom sheet pattern - simple, clean, and reliable.

## Changes Made

### 1. `wagerproof-mobile/contexts/WagerBotChatSheetContext.tsx`
Now **exactly matches** `NBAGameSheetContext.tsx` pattern:
```typescript
const openChatSheet = () => {
  bottomSheetRef.current?.snapToIndex(0);
};

const closeChatSheet = () => {
  bottomSheetRef.current?.close();
};
```
- Simple, clean, no logs, no retry logic, no error handling
- Just direct ref calls like all other bottom sheets

### 2. `wagerproof-mobile/components/WagerBotChatBottomSheet.tsx`
Now **exactly matches** `NBAGameBottomSheet.tsx` pattern:
- Uses `ref={bottomSheetRef}` with `index={-1}`
- Simple `onClose={closeChatSheet}` (no wrapper function)
- Clean `onChange` handler that only loads context when needed
- Removed all debug logging
- Removed unnecessary keyboard props

### 3. Button Press Handlers
Updated to match game card pattern:
```typescript
// Before: 
onPress={() => openChatSheet()}

// After:
onPress={openChatSheet}
```

## How It Works Now

**Exactly like game bottom sheets:**

1. **Opening**: 
   - User taps chat button
   - `openChatSheet()` → `bottomSheetRef.current?.snapToIndex(0)`
   - Sheet slides up immediately

2. **Loading Context**:
   - `onChange(0)` fired when sheet opens
   - Loads game context on first open only
   - `hasLoadedContext` ref prevents reloading

3. **Closing**:
   - Pan down or close button → `closeChatSheet()`
   - `bottomSheetRef.current?.close()`
   - Sheet slides down

## Testing

1. Build and run the mobile app
2. Navigate to Home or Picks tab
3. Tap the chat button (message icon) in top right
4. Bottom sheet should slide up smoothly
5. WagerBot chat interface should load
6. Game context loads automatically on first open

**Should feel identical to tapping a game card and opening the game detail sheet.**

## Similar Pattern

This now matches the pattern used by:
- `NBAGameBottomSheet`
- `NFLGameBottomSheet`
- `CFBGameBottomSheet`
- `NCAABGameBottomSheet`

All bottom sheets in the app now use the same ref-based approach for consistency and reliability.

