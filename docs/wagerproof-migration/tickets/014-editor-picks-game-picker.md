# Ticket #014 — Editor pick creator's "Select Game" picker shipped as TextField

**Status:** open
**Filed by:** b05-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/EditorPickCreatorBottomSheet.tsx` → `wagerproof_ios_native/Wagerproof/Features/EditorPicks/Sheets/EditorPickCreatorBottomSheet.swift`

## What we couldn't ship in scope

RN's creator sheet renders a horizontal `ScrollView` of game cards populated by `fetchActiveGames(league)` (a service call against the per-sport input tables). The Swift port currently lets the editor type the `game_id` directly into a `TextField` while we wait for the games store + service to port.

## Why

The Games tab + its supporting `GamesStore` / `EditorPicksGameStore` haven't been ported yet (B04 owns the games feed, and the editor-picks helper service isn't in scope for B05). Implementing a parallel "fetch active games per league" path here would duplicate work that B04 will deliver cleanly.

## Impact

Editors creating picks via the iOS app must know the `game_id` ahead of time. Internal admin tool, very limited audience — but still a regression vs RN until B04 wires the picker.

## Acceptance criteria

- `WagerproofServices/EditorPicksGameService.swift` exists and exposes `fetchActiveGames(league:)`
- `WagerproofStores/EditorPicksGameStore.swift` exists with the `@Observable` cache
- The creator sheet swaps the `TextField` for a `LazyHStack` of game cards driven by the store
- Selecting a card sets `selectedGameId` + caches the archived game data exactly like the RN port

## Linked code

- `// FIDELITY-WAIVER #014: GamesStore.fetchActiveGames not yet ported; editors can still type the game id` in `Wagerproof/Features/EditorPicks/Sheets/EditorPickCreatorBottomSheet.swift`

## Notes

The validation rule "must select a game" is preserved — entering anything in the text field passes; entering blank fails. So the form's safety net still works.
