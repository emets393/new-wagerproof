# Ticket #021 — Outliers card → per-sport game-sheet route deferred to B12

**Status:** open
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx:830–882` (handleGamePress) → `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift:handleGameTap(_:)` and `Wagerproof/Features/Outliers/OutliersDetailView.swift` card-tap closures

## What we couldn't ship in scope

When the user taps a value alert, fade alert, or trend card the RN screen opens the relevant per-sport bottom sheet (`NFLGameSheet`, `CFBGameSheet`, `NBAGameSheet`, `NCAABGameSheet`, `MLBBettingTrendsSheet`) via the matching `useXxxGameSheet()` context. None of those bottom-sheet stores exist in the Swift port yet — they ship with B12 (per-sport game sheet store) and later batches. For now every card tap flips the `OutliersStore.loadingGameId` spinner for 500 ms and then clears it, with no sheet presentation.

## Why

Porting the per-sport game sheets is its own batch (B12+) — each sheet bundles per-sport data hydration, line/prediction layouts, and Polymarket integration. Trying to inline even a stub of those sheets here would tangle the Outliers screen with five future-batch concerns. The RN screen also fires the same 500 ms `loadingGameId` clear regardless of sheet open success, so the visible UX during the 500 ms spinner is identical between RN and Swift right now.

## Impact

Tapping any Outliers card visibly highlights the card (spinner overlay on the card's gradient surface) for 500 ms and then does nothing. There's no way to drill into a game's prediction details from the Outliers tab until B12 lands the game-sheet stores.

## Acceptance criteria

- Each of `NFLGameSheetStore`, `CFBGameSheetStore`, `NBAGameSheetStore`, `NCAABGameSheetStore`, and `MLBBettingTrendsSheetStore` exists in `WagerproofKit/Sources/WagerproofStores/`.
- `handleGameTap(_:)` in `OutliersView.swift` and the card-tap closures inside `OutliersDetailView.swift` call the appropriate `openGameSheet(...)` on the right store.
- For NBA / NCAAB accuracy cards, an `await lookupNBAFullGame(...) / lookupNCAABFullGame(...)` call hydrates the row first (matches RN's async path).
- The `// FIDELITY-WAIVER #012` comments are removed.

## Linked code

- `// FIDELITY-WAIVER #012: game-sheet route deferred to B12.` in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift` (in `handleGameTap(_:)`)
- Same waiver comment in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersDetailView.swift` (inside `valueAlertsList` / `fadeAlertsList` card closures)

## Notes

The `loadingGameId` 500 ms clear preserves the RN visual feedback. Once the real sheet route is wired up, the clear should still happen (RN clears it 500 ms after `openXxxSheet(...)` returns) — the sheet's own dismissal is independent.
