# Ticket #030 — NCAAB games render as placeholder rows in B04

## Summary

The Games tab home feed (`GamesView`) renders NFL and CFB game cards
in full fidelity. NCAAB games render only as a placeholder card
showing the matchup and "NCAAB games — port in B11".

## Why

Per-sport split — B04's mandate is NFL + CFB. NCAAB carries its own
`ncaab_team_mapping` join + `NCAABGameCard` + `NCAABGameBottomSheet`
+ `NCAABBettingTrendsBanner` that all belong in B11.

`GamesStore.fetchNCAAB()` already hits the canonical
`v_cbb_input_values` table so the data layer is ready.

## Acceptance for resolution

- B11 lands the `NCAABGameCard` + `NCAABGameBottomSheet` +
  `NCAABBettingTrendsBanner` + `NCAABModelAccuracyBanner` +
  `NCAABGameSheetStore`.
- Replace the `placeholderTiles` block for `.ncaab` in
  `GamesView.swift` with `ForEach { game in NCAABGameCard(...) }`.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/Games/GamesView.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/GamesStore.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofModels/PlaceholderGames.swift`
