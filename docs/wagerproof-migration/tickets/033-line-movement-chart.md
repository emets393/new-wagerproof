# Ticket #033 — Line Movement chart renders placeholder section in B04

## Summary

The Line Movement section embedded in `CFBGameBottomSheet` (plus the
button that opens `LineMovementModal` from `NFLGameBottomSheet`)
renders only static opening/current values and a placeholder caption.
The RN equivalent (`components/cfb/LineMovementSection.tsx` +
`components/LineMovementModal.tsx`) renders a Victory-style line
chart of the spread / total over the days leading up to the game.

## Why

Line movement requires querying `nfl_line_movement` and a CFB
equivalent (with multiple snapshot rows per game), then rendering a
Victory-Native chart. SwiftUI's native `Chart` API works for this, but
the data plumbing + decimation logic is substantial. It deserves a
focused pass once the historical line-movement data store ports.

## Acceptance for resolution

- Add `LineMovementStore` with per-sport snapshot fetchers.
- Port the chart UI using SwiftUI `Chart` (iOS 17+).
- Replace placeholders in `CFBLineMovementSection` + the
  `LineMovementModal` content with the real chart.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/CFB/Components/LineMovementSection.swift`
- `wagerproof_ios_native/Wagerproof/Features/GameCards/Sheets/LineMovementModal.swift`
- `wagerproof_ios_native/Wagerproof/Features/NFL/Sheets/NFLGameBottomSheet.swift` (lineMovementSection)
