# Ticket #233 — NBA betting-trends bottom sheet inlined

**Status:** resolved
**Filed by:** B-Outliers-Detail implementer
**Filed:** 2026-05-24
**Closed:** 2026-06-10 — superseded by the shared `BettingTrendsDetailSheet` + `TrendsMatrixView` (Features/Outliers/Components), which all three sports' trends views now present with full RN parity (all situational pairs, records, consensus badges, How-to-Use guide); the inline NBA sheet and its `// FIDELITY-WAIVER #233` comment were removed from `NBABettingTrendsView.swift`.
**Affects screen / file:** `wagerproof-mobile/components/NBABettingTrendsBottomSheet.tsx` → `wagerproof_ios_native/Wagerproof/Features/Outliers/NBABettingTrendsView.swift`

## What we couldn't ship in scope

The NBA betting-trends detail screen needs a per-game bottom sheet (same pattern as MLB/NCAAB which both have dedicated `*BettingTrendsBottomSheet.swift` files in `Features/<sport>/Sheets/`). Rather than introduce a new file in the NBA sports area concurrently with the NBA game-sheet integration agent (which owns that directory), this batch inlines a minimal `NBABettingTrendsBottomSheet` struct at the bottom of `NBABettingTrendsView.swift`.

## Why

Avoids a merge conflict with the NBA game-sheet integration agent who has `Features/NBA/Sheets/` and `Features/NBA/Components/NBATrendsSituationSection.swift` open concurrently. The inlined sheet reuses the existing `NBATrendsSituationSection` and `GameCardTeamAvatar` primitives so structural parity holds.

## Impact

The inlined sheet renders 5 situation sections (last game, fav/dog, side fav/dog, rest bucket, rest comp) plus the header card. It lacks the "How to Use This Tool" guide block that lives at the bottom of RN's `NBABettingTrendsBottomSheet.tsx` (the NCAAB/MLB sheets include theirs). Users can still drill into per-team-side situational records — the analytical core is intact.

## Acceptance criteria

- Move the inlined `NBABettingTrendsBottomSheet` struct from `Features/Outliers/NBABettingTrendsView.swift` into a dedicated `Features/NBA/Sheets/NBABettingTrendsBottomSheet.swift`.
- Add the "How to Use This Tool" footer block matching the RN copy (ATS / Over-Under / Color Legend / Quick Tips sections, byte-identical to the NCAAB sheet's copy).
- `NBABettingTrendsView` imports the dedicated sheet view.

## Linked code

- `// FIDELITY-WAIVER #233:` in `wagerproof_ios_native/Wagerproof/Features/Outliers/NBABettingTrendsView.swift` (above the inline `NBABettingTrendsBottomSheet` struct)

## Notes

Lands naturally as part of the NBA sheet integration batch — that agent already owns the NBA Sheets directory, so they can lift the inlined struct in their pass.

---

**2026-06-11 note:** The trends list views referenced above (`MLBBettingTrendsView` / `NBABettingTrendsView` / `NCAABBettingTrendsView`) were retired — the datasets now render as `BettingTrendsInsightWidget` on the game detail sheets, expanding to the shared `BettingTrendsDetailSheet`.
