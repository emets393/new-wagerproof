# B12 — MLB game card + sheet + betting trends + regression report — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/components/MLBGameCard.tsx` (449 lines)
- `wagerproof-mobile/components/MLBGameBottomSheet.tsx` (973 lines)
- `wagerproof-mobile/components/MLBBettingTrendsBottomSheet.tsx` (424 lines)
- `wagerproof-mobile/components/mlb/MLBTrendsSituationSection.tsx`
- `wagerproof-mobile/components/mlb/MLBRegressionPicksSection.tsx`
- `wagerproof-mobile/app/(drawer)/(tabs)/mlb-regression-report.tsx` (1897 lines)
- `wagerproof-mobile/types/mlb.ts`
- `wagerproof-mobile/constants/mlbTeams.ts`

Port targets (Swift):
- `Wagerproof/Features/MLB/Components/MLBGameCard.swift`
- `Wagerproof/Features/MLB/Components/MLBRegressionPicksSection.swift`
- `Wagerproof/Features/MLB/Components/MLBTrendsSituationSection.swift`
- `Wagerproof/Features/MLB/Sheets/MLBGameBottomSheet.swift`
- `Wagerproof/Features/MLB/Sheets/MLBBettingTrendsBottomSheet.swift`
- `Wagerproof/Features/Analytics/MlbRegressionReportView.swift`

Match legend:
- ✅ matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- ❌ missing — fail

---

## 1. MLBGameCard

### Structure

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Outer `Card` with rounded 20 + favorite-color gradient bg | `Button { … }.background(cardBackground).clipShape(RoundedRectangle(20))` | ✅ |
| 2 | Top horizontal 4-color gradient strip (away/home primary+secondary) | `topGradientBar` LinearGradient | ✅ |
| 3 | Date label + ET time pill | `dateRow` HStack with `MLBFormatting.dateLabel` + `gameTime` | ✅ |
| 4 | Teams row: away avatar + abbr + ML/spread pills, center "@", home equiv | `teamsRow` HStack | ✅ |
| 5 | TeamLogo: async image fallback to gradient circle with abbrev | `MLBTeamLogo` view with `AsyncImage` + initials fallback | ✅ |
| 6 | Center O/U pill from `total_line` | `centerColumn` rounded pill | ✅ |
| 7 | "Model Picks" header with brain icon | `modelPicksSection` header (uses `baseball` SF symbol — RN uses `brain`) | 🔧 |
| 8 | ML pick pill: DB edge precedence → win-prob fallback, % colored by strong signal | `mlPickPill` + `mlPickSide` computed prop | ✅ |
| 9 | O/U pick pill: direction arrow + edge % colored strong/moderate/weak | `ouPickPill` | ✅ |
| 10 | "Predictions pending" placeholder when nothing | `noPredictionsPill` | ✅ |
| 11 | `Haptics.impactAsync(Medium)` on press | `.sensoryFeedback(.impact(weight: .medium))` | ✅ |
| 12 | `getContrastingTextColor` luminance threshold for initials | `MLBTeamLogo.contrastingText(primary:)` | ✅ |

## 2. MLBGameBottomSheet

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | `BottomSheet` snap points 85%/95% | `.presentationDetents([.fraction(0.85), .large])` | ✅ |
| 2 | Postponed banner short-circuit | `postponedBanner` rendered when `isPostponed == true` | ✅ |
| 3 | Header card: date/time, Final/Preliminary pill, matchup with 3-row line stack (ML / Run Line / O/U), starting pitchers row | `headerCard` → `topRow` + `matchupRow` + `startingPitchersRow` | ✅ |
| 4 | Polymarket widget | `PolymarketWidget(league: "mlb", …)` | ✅ |
| 5 | Projected Score with Full Game / 1st 5 toggle | `projectedScoreCard` + `projToggle` (uses `.appQuick` animation, no raw spring) | ✅ |
| 6 | Pythagorean run split (exponent 1.83) for full game | `game.fullGameRuns` extension in WagerproofModels | ✅ |
| 7 | F5 runs: `(total ± margin) / 2` | `game.f5Runs` extension | ✅ |
| 8 | ML Projection card (collapsible): Vegas implied vs Model + edge to team + accuracy badge + explanation | `moneylineCard` + `mlExpanded` toggle + `accuracyBadge(...)` lookup | ✅ |
| 9 | F5 implied prob derivation: `winProb - edge/100` (no DB column for F5) | `pickImplied` block | ✅ |
| 10 | O/U Projection card (collapsible) with chevron icon + edge to Over/Under + delta pts | `overUnderCard` | ✅ |
| 11 | Regression Report picks inline | `regressionPicksCard` reads from passed `MLBRegressionReportStore` | ✅ |
| 12 | Game Signals list with category icon + severity color | `signalsCard` + `MLBSignalColors.colorsFor/iconFor` | ✅ |
| 13 | Weather section: temp / sky / wind arrow / roof type | `MLBWeatherSection` with rotating wind arrow (no raw spring — `.easeOut` only) | ✅ |
| 14 | Roof detection `getVenueRoofType` (dome / retractable) | `roofType(_:)` inline map | ✅ |
| 15 | Wind compass degrees | `windDirectionDegrees(_:)` inline map | ✅ |
| 16 | `WindArrow` animated rotation | `.rotationEffect` + `.task` with `.easeOut(0.8)` | ✅ |

## 3. MLBBettingTrendsBottomSheet

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Header card with gradient strip + away/home avatars + ET time pill | `headerCard` (same shape as NCAAB) | ✅ |
| 2 | 7 `MLBTrendsSituationSection` rows (last game, home/away, fav/dog, rest bucket, rest comp, league, division) with exact tooltips | Same 7 sections with verbatim tooltip copy | ✅ |
| 3 | "How to Use This Tool" guide block (4 sub-sections + color legend) | `howToUseSection` | ✅ |
| 4 | Per-row Win% + Over% (no W-L records like NCAAB) | `MLBTrendsSituationSection` content() — 2 rows | ✅ |
| 5 | `getPctColor` thresholds: ≥55 green, 45–54 yellow, <45 red | `pctColor(_:)` | ✅ |

## 4. MLBRegressionPicksSection (embedded in game sheet)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Filtered list of `suggested_picks` matching `game.game_pk` | Parent passes pre-filtered list via store helper | ✅ |
| 2 | Per-pick card: bet-type label, confidence pill, pick line, alignment row, edge/bucket/win% stats, reasoning | `pickCard(_:)` mirrors structure | ✅ |
| 3 | Alignment detection (aligns / contradicts / unknown) by team-name substring match | Deferred — see #110 | ⚠️ #110 |

## 5. MlbRegressionReportView (mlb-regression-report tab)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Sticky `SectionHeader` per block | Plain `sectionCard` (non-sticky) | ⚠️ #110 |
| 2 | Markdown narrative renderer (`react-native-markdown-display`) | Plain `Text` block | ⚠️ #110 |
| 3 | `HeroTile` cumulative stats (Wins / Losses / W%) | `cumulativeCard` 6-stat grid | ✅ |
| 4 | `RecapBody` per-pick recap with result pills | `recapCard` | ✅ |
| 5 | `AccuracyBody` segmented bucket accuracy charts | Deferred — covered by `MLBBucketAccuracyStore` data plumbing | ⚠️ #110 |
| 6 | `PicksBody` suggested picks with confidence pill | `picksCard` | ✅ |
| 7 | `PitcherRegressionBody` (negative + positive) with segmented tabs | Two `pitcherRegressionCard` blocks (no tab toggle) | ⚠️ #110 |
| 8 | `BattingRegressionBody` (heat-up + cool-down) with tabs | Two `battingCard` blocks | ⚠️ #110 |
| 9 | `BullpenBody` with flag colors | `bullpenCard` | ✅ |
| 10 | `PerfectStormBody` with score | `perfectStormCard` | ✅ |
| 11 | `WeatherBody` flags with custom icons | `weatherFlagsCard` + `FlowLayout` for pill wrap | ✅ |
| 12 | `LRSplitsBody` notable highlights | `lrSplitsCard` | ✅ |
| 13 | Paywall gating via `useProAccess` | Deferred to paywall wiring batch | ⚠️ #110 |

## Fidelity waivers / open tickets

- **#110 — MLB regression report parity** — Sticky section headers, segmented per-section tabs, markdown narrative renderer, accuracy charts, and `useProAccess` paywall gating. The current Swift port lands all content blocks in a scrolling `LazyVStack`; per-section tab controls and sticky headers ship in a follow-up.

## Build status

`xcodebuild` against `iPhone 16 Pro` simulator: **BUILD SUCCEEDED**.

## Parity screenshots

Best-effort: parity screenshots deferred — sim build verified compilation; visual review will pull live MLB data when the sport has an active slate. RN MLB tab has been seeded with a few open-air and dome games (LAA @ TEX, NYY @ BAL) for reviewer comparison.
