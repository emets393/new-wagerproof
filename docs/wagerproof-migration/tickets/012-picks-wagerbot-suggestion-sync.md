# Ticket #012 — Picks → WagerBot suggestion store data sync deferred to B17

**Status:** open
**Filed by:** orchestrator (post B05 review)
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx:852` → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift`

## What we couldn't ship in scope

RN `picks.tsx:852` calls `setPicksData(picks)` against the `useWagerBotSuggestion()` context every time the picks list updates. The Swift port has no equivalent because `WagerBotSuggestionStore` is owned by B17 (Chat) and does not exist yet.

## Why

`WagerBotSuggestionStore` is a cross-cutting store owned by the Chat batch. B05 cannot port a single binding into a store that has not been written. This mirrors the same deferral filed for B07 (#009 / #010 — Scoreboard's WagerBot bindings).

## Impact

The WagerBot suggestion engine will not have the latest Picks data until B17 lands. No user-visible regression in the Picks tab itself.

## Acceptance criteria

- `WagerBotSuggestionStore` exists in `WagerproofKit/Sources/WagerproofStores/` (delivered by B17).
- `EditorPicksStore.refresh(...)` (or equivalent) calls `wagerBotSuggestionStore.setPicksData(picks)` after every successful refresh.

## Linked code

- `// FIDELITY-WAIVER #012` in `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift` at the `refresh` site.

## Notes

Parallels #009 + #010 (Scoreboard). All three converge into the B17 WagerBot wiring sweep.
