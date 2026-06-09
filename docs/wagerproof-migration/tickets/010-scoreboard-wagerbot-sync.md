# Ticket #010 — Scoreboard → WagerBot suggestion store data sync deferred to B17

**Status:** open
**Filed by:** B07 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx:48,56–60` → `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift` + `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift`

## What we couldn't ship in scope

The RN scoreboard pushes its `games` array into `useWagerBotSuggestion().setScoreboardData(games)` on every change so the WagerBot AI assistant can answer questions about live games even when the user is on another tab. The Swift port doesn't do this push because `WagerBotSuggestionStore` belongs to B17 (Chat) and isn't ported yet. The `08-screen-native-spec.md` §2 "Edge cases preserved from RN" line explicitly lists this behavior: "Scoreboard data syncs to `WagerBotSuggestionStore` for AI assistant scanning even when not on screen."

## Why

Same as #009 — `WagerBotSuggestionStore` is owned by B17. Pushing `games` to a non-existent store would either require a stub (and a re-port in B17) or a no-op that lies about the surface. The sync line is trivial to add once B17 lands.

## Impact

The WagerBot suggestion engine won't see live scoreboard data until B17 lands. Users asking the AI assistant "are there any NBA games on now?" while off the scoreboard tab will get a stale or empty answer. The scoreboard tab itself is unaffected.

## Acceptance criteria

- `WagerBotSuggestionStore` exposes `setScoreboardData(_ games: [LiveGame])` (or equivalent).
- `LiveScoresStore.refresh()` (or a downstream observer) calls `wagerBotSuggestionStore.setScoreboardData(games)` after every successful fetch.
- The `// FIDELITY-WAIVER #010` comment in `ScoreboardView.swift` is removed.

## Linked code

- `// FIDELITY-WAIVER #010: LiveScoresStore.games will sync to WagerBotSuggestionStore.setScoreboardData(_:) after B17 lands.` in `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift` (inside `.task`)

## Notes

Track alongside #009 — both unblock when B17 ports `WagerBotSuggestionStore`. This is the issue the B07 reviewer brief specifically flagged.
