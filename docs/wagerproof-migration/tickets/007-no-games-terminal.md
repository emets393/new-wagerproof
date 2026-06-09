# Ticket #007 — NoGamesTerminal scoreboard empty state deferred

**Status:** open
**Filed by:** B07 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/components/NoGamesTerminal.tsx` → `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift`

## What we couldn't ship in scope

The RN scoreboard renders a custom terminal-themed ASCII placeholder (`NoGamesTerminal`) when there are no live games. The B07 batch swaps it for an iOS-native `ContentUnavailableView` with `sportscourt.fill` symbol and matching copy. The bespoke terminal-animation port lands in B18 (DevTools batch) alongside the other terminal-themed dev components.

## Why

`NoGamesTerminal` ships with monospaced-font typewriter animation, ANSI-style color codes, and an animated cursor. Building that in SwiftUI would require either a custom `TimelineView`-driven animation or a `Text` mask trick; both are non-trivial and outside the scope of the scoreboard tab batch. The native `ContentUnavailableView` covers the user-facing job (communicate "no games right now") with HIG-blessed empty-state ergonomics.

## Impact

Users see a clean iOS-native empty state with system icon + headline + description instead of the terminal aesthetic. Functionally identical; visually less branded but more native.

## Acceptance criteria

- `NoGamesTerminalView.swift` exists under `Features/DevTools/` (since it's also used elsewhere in RN) and renders the typewriter animation faithfully.
- `ScoreboardView`'s `emptyState` branch swaps `ContentUnavailableView` for `NoGamesTerminalView(context: .scoreboard)`.
- The `// FIDELITY-WAIVER #007` comment in `ScoreboardView.swift` is removed.

## Linked code

- `// FIDELITY-WAIVER #007: ...` in `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift` (emptyState computed view)

## Notes

`NoGamesTerminal` is also referenced from RN's Games tab and Picks tab empty states, so the port should be generalized — not scoped to scoreboard.
