# Ticket #031 — MLB games render as placeholder rows in B04

## Summary

The Games tab home feed (`GamesView`) renders NFL and CFB game cards
in full fidelity. MLB games render only as a placeholder card showing
the matchup and "MLB games — port in B12".

## Why

Per-sport split — B04's mandate is NFL + CFB. MLB is the richest sport
in the migration (Statcast pregame tables, signals chips, F5 vs full
game projections, pitcher confirmation status). It deserves its own
batch (B12) instead of being squeezed into the central Games batch.

`GamesStore.fetchMLB()` already mirrors the RN window query (today
through day-after-tomorrow, filtered to non-postponed) so the cache
populates correctly.

## Acceptance for resolution

- B12 lands the `MLBGameCard` + `MLBGameBottomSheet` +
  `MLBBettingTrendsBanner` + `MLBRegressionReportBanner` +
  `MLBGameSheetStore` + signals chips component.
- Replace the `placeholderTiles` block for `.mlb` in
  `GamesView.swift` with `ForEach { game in MLBGameCard(...) }`.
- Wire up `mlb_predictions_current`, `mlb_team_mapping`,
  `mlb_game_signals` joins (4-table merge).
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/Games/GamesView.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/GamesStore.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofModels/PlaceholderGames.swift`
