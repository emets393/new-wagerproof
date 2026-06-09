# Ticket #100 — WagerBotInsightPill detach-bubble integration

**Status:** open
**Filed by:** implementer (sport-sheet widgets batch)
**Filed:** 2026-05-24
**Affects screen / file:** `wagerproof-mobile/components/WagerBotInsightPill.tsx` → `wagerproof-ios-native/Wagerproof/Features/Components/Components/WagerBotInsightPill.swift`

## What we couldn't ship in scope

The Swift `WagerBotInsightPill` takes a plain `onTap` closure and exposes its
on-screen frame via `GeometryReader` instead of measuring its own node and
calling `WagerBotSuggestionContext.detachBubbleFromPill(...)`. The RN
implementation triggers the floating-bubble detach animation directly from
inside the pill's `onPress` handler.

## Why

`WagerBotSuggestionStore` (the Swift mirror of
`WagerBotSuggestionContext`) does not exist yet. The store is scheduled for
Phase 5 (Chat + Voice batch). Wiring the pill to a stub store now would
either (a) require a half-baked store, violating the "no stubs" rule, or
(b) reach into an unowned store layer from this batch's directory, which
breaks the implementer-scope contract.

## Impact

Tapping the pill in the sport-specific bottom sheets fires its `onTap`
closure but does NOT detach + float the WagerBot bubble from the pill's
position. The bubble does not yet exist on the screen anyway — the floating
launcher (`FloatingAssistantBubble.swift`) ships in a separate position and
plays no detach animation.

Visible-to-user: the position-aware animation that lets users see the bubble
"pop out" of the pill is missing. The pill button itself renders identically.

## Acceptance criteria

When Phase 5 (Chat + Voice) lands:

- `WagerBotSuggestionStore` exists with a `detachBubbleFromPill(x, y, w, h, game, sport)`
  method matching the RN signature.
- The pill reads the store from the environment, removes the `onTap` closure,
  and computes its own on-screen frame via `GeometryReader` or
  `coordinateSpace(name:)`.
- The detach animation runs end-to-end on tap.

## Linked code

- `// FIDELITY-WAIVER #100: <reason>` in
  `Wagerproof/Features/Components/Components/WagerBotInsightPill.swift`

## Notes

The pill is rendered in NFL / CFB / NBA / NCAAB bottom sheet headers. Once
B17 lands the `WagerBotSuggestionStore` it should be cheap to drop the
`onTap` parameter and wire to the store directly.
