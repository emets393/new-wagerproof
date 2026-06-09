# Ticket #008 — Per-team color/initials utilities for Scoreboard

**Status:** open
**Filed by:** B07 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/utils/teamColors.ts` → `wagerproof_ios_native/Wagerproof/Features/Scoreboard/Components/LiveScorePredictionCard.swift`, `wagerproof_ios_native/Wagerproof/Features/Scoreboard/Sheets/LiveScoreDetailModal.swift`

## What we couldn't ship in scope

The RN expanded prediction card + detail modal render team-branded gradient circles using `utils/teamColors.ts` (NFL/CFB/NBA/NCAAB lookup tables of primary/secondary hex codes + initials helpers). B07 ships placeholder gradient circles using the brand green palette and a generic abbreviation fallback. Per-team colors port with the sport-specific batches (B09–B12).

## Why

`teamColors.ts` is a ~500-line dictionary covering 32 NFL teams + 130+ CFB teams + 30 NBA + 350+ NCAAB. Porting it cleanly belongs with the sport-specific game card batches that also need these lookups for `NFLGameCard`, `CFBGameCard`, etc. — duplicating the table now would risk drift.

## Impact

Expanded prediction cards and the detail modal show a green-gradient circle with the team's abbreviation (e.g. "NE", "LAL") instead of the team's official primary/secondary colors. Score and matchup data is unaffected.

## Acceptance criteria

- `WagerproofKit/Sources/WagerproofDesign/TeamColors.swift` (or equivalent location) exposes `teamColors(league:teamName:) -> (primary: Color, secondary: Color)` covering all four leagues currently in `utils/teamColors.ts`.
- `TeamCircleView` in `LiveScorePredictionCard.swift` switches to that lookup.
- `LiveScoreDetailModal` does the same.
- The waiver comment in `LiveScorePredictionCard.swift` is removed.

## Linked code

- `// FIDELITY-WAIVER #008` reference in the `TeamCircleView` doc comment (no inline waiver tag since the visual is a clean fallback, not a missing feature).

## Notes

Should ship alongside (or before) the sport-specific game-card batches so those can share the lookup.
