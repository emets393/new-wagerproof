# Ticket #036 — NBA games render as placeholder rows in B04

## Summary

The Games tab home feed (`GamesView`) renders NFL and CFB game cards
in full fidelity (`NFLGameCard`, `CFBGameCard`). NBA games render only
as a placeholder card showing the matchup and "NBA games — port in
B10".

## Why

B04's scope is explicitly NFL + CFB cards and sheets. NBA + NCAAB + MLB
each have their own component subdirectories
(`components/nba/`, `components/ncaab/`, `components/mlb/`) and the
sport-specific sheet types are non-trivial (NBA carries L3/L5 trends,
injury reports, ATS%, streaks). Forcing those into B04 would balloon
this batch past reviewability.

The `GamesStore.fetchNBA()` method still fetches from the canonical
`nba_input_values_view` table so the cache populates correctly and B10
can drop in the full per-sport UI without re-touching the data layer.

## Acceptance for resolution

- B10 lands the `NBAGameCard` + `NBAGameBottomSheet` + the
  `NBABettingTrendsBanner` + `NBAModelAccuracyBanner` + the
  `NBAGameSheetStore`.
- Replace the `placeholderTiles` block for `.nba` in
  `GamesView.swift` with `ForEach { game in NBAGameCard(...) }`.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/Games/GamesView.swift` (placeholderTiles)
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/GamesStore.swift` (fetchNBA)
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofModels/PlaceholderGames.swift` (NBAGameSummary)
