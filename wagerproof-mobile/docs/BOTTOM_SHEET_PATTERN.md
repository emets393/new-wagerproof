# Bottom Sheet Pattern

## Architecture Overview

Each sport's game detail sheet follows a four-part pattern:

1. **Context** (`contexts/{Sport}GameSheetContext.tsx`) -- Creates a React context holding `selectedGame`, `openGameSheet()`, `closeGameSheet()`, and a `bottomSheetRef`.
2. **Provider** (mounted in `app/_layout.tsx`) -- Wraps the app tree so any descendant can open the sheet. All five providers are nested inside `_layout.tsx`.
3. **Sheet component** (`components/{Sport}GameBottomSheet.tsx`) -- Renders the `@gorhom/bottom-sheet` using the ref and state from the context. Also rendered in `_layout.tsx`, outside the navigation tree.
4. **Hook** (`use{Sport}GameSheet()`) -- Consumers call this to read `selectedGame` or trigger `openGameSheet(game)`.

## Concrete Example (NFL)

```
NFLGameSheetContext.tsx
  - State: selectedGame (NFLPrediction | null)
  - openGameSheet(game): sets state, calls bottomSheetRef.snapToIndex(0)
  - closeGameSheet(): clears state, calls bottomSheetRef.close()

app/_layout.tsx
  - <NFLGameSheetProvider> wraps the app
  - <NFLGameBottomSheet /> rendered at root level

Any game card screen:
  const { openGameSheet } = useNFLGameSheet();
  onPress={() => openGameSheet(game)}
```

The sheet component always renders (even with no game selected); it starts at `index={-1}` (closed) and uses `enablePanDownToClose` to let users swipe it away.

## Per-Sport Sheets

| Context | Sheet Component | Game Type |
|---------|----------------|-----------|
| `NFLGameSheetContext` | `NFLGameBottomSheet` | `NFLPrediction` |
| `CFBGameSheetContext` | `CFBGameBottomSheet` | CFB prediction |
| `NBAGameSheetContext` | `NBAGameBottomSheet` | NBA prediction |
| `NCAABGameSheetContext` | `NCAABGameBottomSheet` | NCAAB prediction |
| `MLBGameSheetContext` | `MLBGameBottomSheet` | `MLBGame` |

**Betting trends variants** (no dedicated context -- they manage their own refs):
- `NBABettingTrendsBottomSheet`
- `NCAABBettingTrendsBottomSheet`

Both are rendered inside the provider nesting in `_layout.tsx`.

## Adding a New Sport Sheet

1. Define the game type in `types/{sport}.ts`.
2. Create `contexts/{Sport}GameSheetContext.tsx` -- copy the NFL context, swap the type.
3. Create `components/{Sport}GameBottomSheet.tsx` -- use the hook, define snap points, render sheet content.
4. In `app/_layout.tsx`:
   - Import and nest the new `{Sport}GameSheetProvider` around the app children.
   - Import and render `<{Sport}GameBottomSheet />` alongside the other sheet components.
5. Call `use{Sport}GameSheet().openGameSheet(game)` from any game card.

## Snap Points and Animation

All game sheets use the same snap points:

```ts
const snapPoints = useMemo(() => ['85%', '95%'], []);
```

- **Index 0 (85%)**: Default open position when `openGameSheet` calls `snapToIndex(0)`.
- **Index 1 (95%)**: User can drag up to near-fullscreen.
- **Index -1**: Closed (initial state).

Behavior flags used across all sheets:
- `enablePanDownToClose` -- swipe down dismisses the sheet.
- `onClose={closeGameSheet}` -- syncs context state when the sheet is dismissed via gesture.
- `BottomSheetBackdrop` -- semi-transparent overlay behind the sheet.
- `BottomSheetScrollView` -- scrollable content area inside the sheet.

Haptic feedback (`expo-haptics`, `ImpactFeedbackStyle.Light`) fires on interactive taps within the sheet content (e.g., expanding prediction explanations), not on open/close.
