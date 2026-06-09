# Ticket #009 — WagerBot suggestion store `onPageChange` binding deferred to B17

**Status:** open
**Filed by:** B07 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx:51–53` → `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift`

## What we couldn't ship in scope

The RN scoreboard tab calls `useWagerBotSuggestion().onPageChange('scoreboard')` from a `useEffect` on mount so the WagerBot suggestion engine knows which tab the user is currently viewing. The Swift port has no equivalent call because `WagerBotSuggestionStore` is owned by the Chat batch (B17) and has not been ported yet.

## Why

`WagerBotSuggestionStore` is a Chat-feature dependency — B17 owns its port. Pulling a stub forward into B07 just to satisfy one binding would mean either (a) duplicating the store now and re-porting it in B17, or (b) shipping a one-method placeholder that misleads readers about the store's real surface. Neither is worth the cost when the binding is a single line that B17 can add naturally.

## Impact

The WagerBot suggestion bubble will not know the user is on the Scoreboard tab until B17 lands. The suggestion engine therefore can't tailor "what's live right now?" prompts to scoreboard-specific context. The scoreboard itself works normally.

## Acceptance criteria

- `WagerBotSuggestionStore` exists in `WagerproofKit/Sources/WagerproofStores/` with an `onPageChange(_ page: WagerBotPage)` API (or equivalent).
- `ScoreboardView.swift` calls `wagerBotSuggestionStore.onPageChange(.scoreboard)` from its `.task { ... }` block on mount.
- The `// FIDELITY-WAIVER #009` comment in `ScoreboardView.swift` is removed.

## Linked code

- `// FIDELITY-WAIVER #009: WagerBotSuggestionStore.onPageChange(.scoreboard) will fire here once B17 (Chat) ports the suggestion store.` in `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift` (inside `.task`)

## Notes

Track alongside #010 — both unblock when B17 ports `WagerBotSuggestionStore`.
