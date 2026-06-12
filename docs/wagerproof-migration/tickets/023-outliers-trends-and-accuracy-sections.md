# Ticket #023 — Outliers MLB trends + NBA/NCAAB trends + NBA/NCAAB accuracy sections deferred

**Status:** resolved
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** 2026-05-24
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx:1623–1901, 2011–2179` (5 deferred sections) → `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift:deferredSection(...)` and `Wagerproof/Features/Outliers/OutliersDetailView.swift:deferredCategoryNotice`

## What we couldn't ship in scope

5 of the 7 Spotify-style sections on the Outliers hub depend on stores/services that ship in later batches:
- **NBA Betting Trends** → needs `NBABettingTrendsStore` (B10)
- **NCAAB Betting Trends** → needs `NCAABBettingTrendsStore` (B11)
- **MLB Betting Trends** → needs `MLBBettingTrendsStore` (B12)
- **NBA Model Accuracy** → needs `NBAModelAccuracyStore` (B10)
- **NCAAB Model Accuracy** → needs `NCAABModelAccuracyStore` (B11)

B06 ships the first two sections (Prediction Market Alerts + Model Fade Alerts) with full functionality, plus the navigation scaffolding for the other 5. Each deferred section renders a CTA card that pushes a detail view with a `ContentUnavailableView` ("Coming in B10/B11/B12") notice.

## Why

Each trend / accuracy store is its own thick port: NBA trends alone has 5 situational buckets × ATS/O-U records × home+away teams = ~30 distinct columns per game. NBA model accuracy pulls from a separate `nba_accuracy_buckets` table with its own join logic. Trying to inline even minimal versions inside B06 would either:
1. Quadruple the LoC of OutliersStore and bury the value/fade logic that *is* B06's core deliverable, or
2. Ship broken queries that violate the "backend untouched / no @State fakes" rules.

The scaffold approach — section headers tap to a detail view that explains the deferral — keeps the hub structurally identical to RN.

## Impact

The Outliers hub shows 7 sections, but tapping any of the 5 deferred ones pushes a "Coming soon" notice instead of showing real trend cards. Hub-level shimmer placeholders never play for those 5 since the hub knows up front they're deferred.

## Acceptance criteria

- `NBABettingTrendsStore`, `NCAABBettingTrendsStore`, `MLBBettingTrendsStore`, `NBAModelAccuracyStore`, `NCAABModelAccuracyStore` exist in `WagerproofStores/`.
- Each `deferredSection(...)` call inside `OutliersView.swift` is replaced with a real `section(...)` call against the right store.
- The `deferredCategoryNotice` body in `OutliersDetailView.swift` is replaced with the matching list of `OutlierAlertCard` rows (or a `TrendCard` variant if the design demands it).
- The `// FIDELITY-WAIVER #017` comment is removed.

## Linked code

- `// FIDELITY-WAIVER #017: deferred trend/accuracy detail bodies.` in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersDetailView.swift` (above `deferredCategoryNotice`)
- The 5 `deferredSection(...)` calls inside `hubScroll` in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift`.

## Notes

The hub already runs the right NavigationLink routes for each deferred category, so once the stores land, the section bodies are the only thing that needs swapping — the navigation path is already in place.

## Resolution (2026-05-24)

All 5 deferred categories now route to dedicated list views with full RN parity:
- `Features/Outliers/NBABettingTrendsView.swift` (`NBABettingTrendsStore`)
- `Features/Outliers/NCAABBettingTrendsView.swift` (`NCAABBettingTrendsStore`)
- `Features/Outliers/MLBBettingTrendsView.swift` (`MLBBettingTrendsStore`)
- `Features/Outliers/NBAModelAccuracyView.swift` (`NBAModelAccuracyStore`)
- `Features/Outliers/NCAABModelAccuracyView.swift` (`NCAABModelAccuracyStore`)

A new `OutliersStore.Category.mlbRegression` case was added with its own
`Features/Outliers/MLBRegressionReportView.swift`. The `// FIDELITY-WAIVER #023`
comments were removed from `OutliersView.swift` and `OutliersDetailView.swift`.

Two follow-up waivers were filed:
- #233 — NBA betting-trends bottom sheet is inlined in the detail view; the dedicated `NBABettingTrendsBottomSheet.swift` lands with the NBA sheet integration batch.
- #234 — Outliers hub sections still render a single CTA card each instead of real preview cards (to keep cold-start cost bounded).

## Addendum (2026-06-10 tools revamp)

- The trends list views now open the shared `Features/Outliers/Components/BettingTrendsDetailSheet.swift` (+ `TrendsMatrixView`) as the primary tap action; per-sport trends bottom sheets were deleted and #233 is resolved.
- `Features/Outliers/MLBRegressionReportView.swift` was deleted — `OutliersStore.Category.mlbRegression` now routes (via `ToolRouter`) to the rebuilt `Features/Analytics/MlbRegressionReportView.swift`.

---

**2026-06-11 note:** The trends list views referenced above (`MLBBettingTrendsView` / `NBABettingTrendsView` / `NCAABBettingTrendsView`) were retired — the datasets now render as `BettingTrendsInsightWidget` on the game detail sheets, expanding to the shared `BettingTrendsDetailSheet`.
