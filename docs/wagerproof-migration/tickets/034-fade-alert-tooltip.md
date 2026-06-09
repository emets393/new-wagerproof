# Ticket #034 — FadeAlertTooltip not ported in B04

## Summary

The RN NFL/CFB bottom sheets render an inline `FadeAlertTooltip`
beneath each fade-alert pill (`probability >= 0.80`). The tooltip
shows a one-line suggested counter-bet (e.g. "Fade by taking Buffalo
+1.5"). B04 ships only the fade alert pill itself; the tooltip copy is
folded into the collapsible explanation block.

## Why

The tooltip uses a Moti spring animation + arrow positioning that
maps to a SwiftUI `Popover` or custom callout view. Because the
explanation expand-collapse already conveys the same information
inline, B04 leaves the dedicated tooltip out to keep the sheet's
state machinery simple.

## Acceptance for resolution

- Add `FadeAlertTooltip` SwiftUI view (callout shape pointing at the pill).
- Wire it into NFL + CFB bottom sheets next to each `fadeAlertPill`.
- Mirror the RN suggested-bet copy generator.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/NFL/Sheets/NFLGameBottomSheet.swift`
- `wagerproof_ios_native/Wagerproof/Features/CFB/Sheets/CFBGameBottomSheet.swift`
