# Ticket #032 — H2H Modal renders empty state until historical games store ports

## Summary

The Head-to-Head modal opened from `NFLGameBottomSheet` (and CFB's
equivalent) currently renders an `ContentUnavailableView` with
informational copy. The RN equivalent (`components/H2HModal.tsx` +
`components/nfl/H2HSection.tsx`) lists the most-recent head-to-head
matchups between two teams with score, cover, and over-under outcomes.

## Why

The H2H lookup requires a join against `nfl_historical_games` (and a
CFB equivalent) filtered by team name with score normalization. The
join + sort + spread-cover calculation logic is non-trivial and pulls
in `getTeamHistory` from `nflDataFetchers.ts` (~150 lines). It needs
its own focused store to be done right.

B04 ships the modal shell so the navigation path is correct — the
user can tap "Head-to-Head" and a sheet opens; future batches replace
the inner content with the real row list.

## Acceptance for resolution

- Add `HistoricalGamesStore` under `WagerproofKit/Sources/WagerproofStores/`.
- Port `getTeamHistory` (NFL) + CFB equivalent.
- Replace `H2HModal`'s `ContentUnavailableView` with a `List` of
  `H2HRow` items showing date, score, cover, O/U result.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/Wagerproof/Features/GameCards/Sheets/H2HModal.swift`
