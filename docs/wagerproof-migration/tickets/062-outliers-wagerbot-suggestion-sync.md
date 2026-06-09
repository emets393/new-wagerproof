# Ticket #062 — Outliers → WagerBot suggestion store sync deferred to B17

**Status:** open
**Filed by:** orchestrator (post B06 review)
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx` (`setOutliersData` + `onPageChange('outliers')` calls) → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/OutliersStore.swift`

## What we couldn't ship in scope

RN's `outliers.tsx` calls `useWagerBotSuggestion().setOutliersData(valueAlerts, fadeAlerts)` on every refresh, and `onPageChange('outliers')` on mount. The Swift port has no equivalent because `WagerBotSuggestionStore` is owned by B17 (Chat) and does not exist yet.

## Why

`WagerBotSuggestionStore` is a cross-cutting store owned by the Chat batch. B06 cannot port the suggestion store just for one binding. Parallels the same deferral already tracked for B07 (#009/#010), B05 (#012), and any other batch that touches WagerBot suggestions before B17 lands.

## Impact

The WagerBot suggestion engine won't see live outlier value/fade alerts until B17 lands. No user-visible regression in the Outliers tab itself.

## Acceptance criteria

- `WagerBotSuggestionStore` exists in `WagerproofKit/Sources/WagerproofStores/` (delivered by B17).
- `OutliersStore.refresh(...)` (or its caller) calls `wagerBotSuggestionStore.setOutliersData(valueAlerts, fadeAlerts)` after every successful refresh.
- `OutliersView.task` calls `wagerBotSuggestionStore.onPageChange(.outliers)`.

## Linked code

- `// FIDELITY-WAIVER #062` in `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/OutliersStore.swift` at the `refresh` site.

## Notes

Joins the B17 sweep alongside #009 (scoreboard onPageChange), #010 (scoreboard sync), #012 (picks sync). A single integration pass can wire all four call sites once `WagerBotSuggestionStore` lands.
