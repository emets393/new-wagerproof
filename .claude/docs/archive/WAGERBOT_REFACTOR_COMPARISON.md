# WagerBot Bottom Sheet Refactor - Pattern Comparison

## The Pattern: Game Bottom Sheets

### How NBA Game Sheet Works

**Context (`NBAGameSheetContext.tsx`):**
```typescript
const [selectedGame, setSelectedGame] = useState<NBAGame | null>(null);
const bottomSheetRef = useRef<BottomSheet>(null);

const openGameSheet = (game: NBAGame) => {
  setSelectedGame(game);
  bottomSheetRef.current?.snapToIndex(0);
};

const closeGameSheet = () => {
  setSelectedGame(null);
  bottomSheetRef.current?.close();
};
```

**Component (`NBAGameBottomSheet.tsx`):**
```typescript
export function NBAGameBottomSheet() {
  const { selectedGame: game, closeGameSheet, bottomSheetRef } = useNBAGameSheet();
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeGameSheet}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      {game ? (
        /* Game content */
      ) : null}
    </BottomSheet>
  );
}
```

**Usage (Game Card):**
```typescript
const { openGameSheet: openNBAGameSheet } = useNBAGameSheet();

<NBAGameCard 
  game={item} 
  onPress={() => openNBAGameSheet(item)} 
/>
```

---

## The Refactored: WagerBot Chat Sheet

### Now Matches the Same Pattern

**Context (`WagerBotChatSheetContext.tsx`):**
```typescript
const bottomSheetRef = useRef<BottomSheet>(null);

const openChatSheet = () => {
  bottomSheetRef.current?.snapToIndex(0);
};

const closeChatSheet = () => {
  bottomSheetRef.current?.close();
};
```
✅ No state needed (chat doesn't receive data like games do)
✅ Simple, clean, direct ref calls
✅ No logging, no retry logic, no error handling

**Component (`WagerBotChatBottomSheet.tsx`):**
```typescript
export function WagerBotChatBottomSheet() {
  const { closeChatSheet, bottomSheetRef } = useWagerBotChatSheet();
  const snapPoints = useMemo(() => ['92%'], []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeChatSheet}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <View style={styles.container}>
        {user ? (
          /* Chat content */
        ) : (
          /* Login prompt */
        )}
      </View>
    </BottomSheet>
  );
}
```
✅ Same ref pattern
✅ Same props structure
✅ Simple `onClose={closeChatSheet}` (no wrapper)

**Usage (Chat Button):**
```typescript
const { openChatSheet } = useWagerBotChatSheet();

<TouchableOpacity onPress={openChatSheet}>
  <MaterialCommunityIcons name="message-text" size={24} />
</TouchableOpacity>
```
✅ Direct function reference (no arrow function wrapper)

---

## Key Differences from Game Sheets

1. **No Data Passing**: Chat sheet doesn't need `selectedGame` state - it just opens
2. **Context Loading**: Chat loads game context when opened (via `onChange`)
3. **Taller Height**: Chat uses 92% vs games use 85%/95%
4. **User Check**: Chat shows login prompt if no user

But the **core opening/closing mechanism** is identical!

---

## What Was Removed

### ❌ Removed from Context:
- `useState` for `sheetIndex` tracking
- All `console.log` debugging
- Retry logic with `setTimeout`
- Error try/catch blocks
- Ref availability checks

### ❌ Removed from Component:
- Mount/unmount logging
- `handleClose` wrapper function (just use `closeChatSheet` directly)
- Keyboard behavior props (causing issues)
- Debug logs in `onChange`

### ❌ Removed from Button Handlers:
- Arrow function wrappers: `onPress={() => openChatSheet()}`
- Now direct: `onPress={openChatSheet}`

---

## Why This Works

The `@gorhom/bottom-sheet` library is **designed** to work with refs and `snapToIndex()`. This is the documented, recommended approach. By overcomplicating with state, retries, and error handling, we were fighting the library instead of working with it.

The game bottom sheets prove this pattern works perfectly - they open instantly and reliably every time. Now the chat sheet does too.

---

## Files Changed

1. `wagerproof-mobile/contexts/WagerBotChatSheetContext.tsx` - Simplified to match game pattern
2. `wagerproof-mobile/components/WagerBotChatBottomSheet.tsx` - Cleaned up to match game pattern
3. `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx` - Updated button handler
4. `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx` - Updated button handler

Total: **4 files**, all simplified and cleaned up.

