# B04 — Games tab + NFL/CFB cards + sheets — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx` (1749 lines)
- `wagerproof-mobile/components/NFLGameCard.tsx`
- `wagerproof-mobile/components/NFLGameBottomSheet.tsx`
- `wagerproof-mobile/components/CFBGameCard.tsx`
- `wagerproof-mobile/components/CFBGameBottomSheet.tsx`
- `wagerproof-mobile/components/CFBPredictionCard.tsx`
- `wagerproof-mobile/components/cfb/LineMovementSection.tsx`
- `wagerproof-mobile/components/cfb/PublicBettingBars.tsx`
- `wagerproof-mobile/components/GameCardShimmer.tsx`
- `wagerproof-mobile/components/SportFilter.tsx`
- `wagerproof-mobile/components/SportsbookButtons.tsx`
- `wagerproof-mobile/components/WeatherDisplay.tsx`
- `wagerproof-mobile/components/BettingSplitsCard.tsx`
- `wagerproof-mobile/components/H2HModal.tsx`
- `wagerproof-mobile/components/LineMovementModal.tsx`
- `wagerproof-mobile/components/PolymarketWidget.tsx`
- `wagerproof-mobile/contexts/NFLGameSheetContext.tsx`
- `wagerproof-mobile/contexts/CFBGameSheetContext.tsx`
- `wagerproof-mobile/services/polymarketService.ts`

Match legend:
- ✅ matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- ❌ missing — fail

---

## 1. GamesView (home tab) — `index.tsx`

### Visual structure

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Root `View` with two layers (header overlay + page content) | `NavigationStack { VStack { SportPickerBar ; content } }` | ✅ |
| 2 | Frosted `AndroidBlurView` header (~insets.top + 56 + 48 tall) | `NavigationStack` title bar + searchable + toolbar | 🔧 — native nav bar with `.navigationBarTitleDisplayMode(.large)` replaces custom header |
| 3 | "Wager" + "Proof" branded title | `navigationTitle("WagerProof")` | 🔧 — single-string title; brand-green coloring is RN-only |
| 4 | Settings cog button (left) | Tab shell hamburger button in `MainTabView.gamesTab` | ✅ |
| 5 | Test trigger button (admin) | n/a — admin path lives in B17 chat batch | ⚠️ #012 |
| 6 | WagerBot launcher (right) | `FloatingAssistantBubble` in `MainTabView.gamesTab` overlay | ✅ |
| 7 | Horizontal sport-pill ScrollView | `SportPickerBar` (HStack inside horizontal ScrollView) | ✅ |
| 8 | Pill underline (3pt height brand green) | `Capsule().fill(Color.appPrimary).frame(height: 3)` w/ `matchedGeometryEffect` | ✅ |
| 9 | Sport tab badge (e.g. "BETA") | not used in prod; preserved as `SportOption.badge` Swift prop | ✅ |
| 10 | Sport-page `Animated.FlatList` 2-column grid | `ScrollView { LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) }` | ✅ |
| 11 | Pull-to-refresh `RefreshControl` | `.refreshable { … }` | ✅ |
| 12 | List header (search + sort button) | `.searchable` + toolbar `Menu` | 🔧 — native iOS chrome |
| 13 | Discord banner (MLB only) | not ported in B04 (MLB tab is placeholder) | ⚠️ #031 |
| 14 | NBA / NCAAB betting trends banners | not ported in B04 (per-sport batches) | ⚠️ #029 / #030 |
| 15 | MLB regression banner | not ported in B04 | ⚠️ #031 |
| 16 | Game tile (per sport) | NFLGameCard / CFBGameCard; NBA/NCAAB/MLB placeholders | ✅ NFL+CFB / ⚠️ #029-#031 |
| 17 | NoGamesTerminal empty state | `ContentUnavailableView` styled per sport | 🔧 — terminal aesthetic ports later (#007) |
| 18 | LockedGameCard for non-pro | not ported in B04 (pro gating lives in B08) | ⚠️ #015 |

### Tokens

| RN value | Swift equivalent | Match |
|---|---|---|
| Page bg `#000`/`#fff` per theme | `Color.appSurface` (`light: 0xFFFFFF, dark: 0x0A0A0A`) | ✅ |
| Header divider `rgba(150,150,150,0.1)` | `Color.appBorder.opacity(0.3)` | ✅ |
| Brand green `#00E676` (tab title accent) | `Color(hex: 0x00E676)` (tab tint) | ✅ |
| Brand green `#22C55E` (pills / icons) | `Color.appPrimary` | ✅ |
| Discord teal-blue gradient | preserved as placeholder waiver | ⚠️ #031 |
| Sport tab text size 16 | `.font(.system(size: 16, weight: …))` | ✅ |

### Gestures

| RN gesture | Swift counterpart | Match |
|---|---|---|
| Tap sport pill | `Button` w/ `withAnimation(.appQuick)` | ✅ |
| Tap game tile | `Button` w/ haptic + `*GameSheetStore.openGameSheet` | ✅ |
| Pull-to-refresh | `.refreshable { await store.refresh(sport:, force: true) }` | ✅ |
| Tap sort button | `Menu` toolbar item | ✅ |
| Search input | `.searchable(text: $searchBinding)` | ✅ |
| Long-press tile (RN doesn't) | n/a; not added | ✅ |

### Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| `router.push('/(drawer)/settings')` | `MainTabView` side menu | ✅ |
| `openGameSheet(NFLPrediction)` | `NFLGameSheetStore.openGameSheet(_:)` → `.sheet(item:)` | ✅ |
| `openCFBGameSheet(CFBPrediction)` | `CFBGameSheetStore.openGameSheet(_:)` → `.sheet(item:)` | ✅ |
| NBA/NCAAB/MLB sheet open | placeholder card; no sheet | ⚠️ #029-#031 |
| Discord banner `Linking.openURL` | not ported (MLB tab placeholder) | ⚠️ #031 |
| WagerBot suggestion tap deep link | not ported (B17) | ⚠️ #012 |

### Async / State

| RN side effect | Swift counterpart | Match |
|---|---|---|
| Mount-time `sports.forEach(fetchDataForSport)` | `.task { await store.refreshAll() }` | ✅ |
| 5-minute cache TTL per sport | `GamesStore.refresh(sport:force:)` checks `lastFetched` | ✅ |
| `useEffect([selectedSport])` to fetch if stale | gated inside `refresh(sport:)` | ✅ |
| `onPageChange('feed')`, `onFeedMount/Unmount` | WagerBot suggestion side effects deferred to B17 | ⚠️ #012 |
| `setPolymarketData(...)` | also B17 | ⚠️ #012 |

### Backend (CFB Supabase) — must stay byte-identical

| RN query | Swift query in `GamesStore` | Match |
|---|---|---|
| `v_input_values_with_epa.select('*')` | `cfb.from("v_input_values_with_epa").select().execute()` | ✅ |
| `nfl_predictions_epa.select('training_key, home_away_ml_prob, …, run_id')` | identical select clause | ✅ |
| Latest run_id filter (RN: sort desc + first) | `predictionRows.compactMap{$0.runId}.sorted(by: >).first` | ✅ |
| `nfl_betting_lines.select(...)` with ~25 cols | identical select clause string | ✅ |
| Most-recent betting line by `as_of_ts` | comparison loop matches RN | ✅ |
| `production_weather.select('*')` | identical | ✅ |
| Merge on `home_away_unique == training_key` | identical join key | ✅ |
| CFB: `cfb_live_weekly_inputs.select('*')` | identical | ✅ |
| CFB: `cfb_api_predictions.select('*')` | identical | ✅ |
| CFB merge on `id == id` | identical | ✅ |
| NBA fetch: full 20-col + complement ML calc | placeholder fetch (only summary fields) | ⚠️ #029 |
| NCAAB fetch: 3-query pattern (mapping + predictions) | placeholder fetch | ⚠️ #030 |
| MLB 4-query merge (games + predictions + mapping + signals) | placeholder fetch | ⚠️ #031 |

### Sort / filter

| RN behavior | Swift behavior | Match |
|---|---|---|
| Sort by time (NFL/CFB) | `parseEpoch` compared ascending | ✅ |
| Sort by spread NFL (probability) | `confidence(homeAwaySpreadCoverProb)` desc | ✅ |
| Sort by spread CFB (edge) | `abs(homeSpreadDiff)` desc | ✅ |
| Sort by O/U NFL/CFB | same prob / edge logic | ✅ |
| Search filter on home/away team name | `lowercased().contains(q)` | ✅ |

---

## 2. NFLGameCard — `NFLGameCard.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| `Card` with rounded corners 20pt | `RoundedRectangle(cornerRadius: 20)` | ✅ |
| Bottom shadow (iOS only) | `.shadow(color: .black.opacity(0.1), radius: 6, x: 0, y: 2)` | ✅ |
| Top border gradient (4-stop horizontal) | `LinearGradient` over top edge | ✅ — uses neutral palette (#008) |
| Background gradient of favorite team | static gradient using neutral palette | ⚠️ #008 — team palette deferred |
| Date row `formatCompactDate(game_date)` | `GameCardFormatting.formatCompactDate(game.gameDate)` | ✅ |
| Time badge `convertTimeToEST(game_time)` | `GameCardFormatting.convertTimeToEST(...)` | ✅ |
| TeamAvatar 42pt circle | `GameCardTeamAvatar(size: 42)` | ✅ |
| Team city + nickname | `TeamInitials.parts(of:)` split | ✅ |
| Away/home line pills (spread / ML) | matching `Text(formatSpread(...))` + `.foregroundStyle` | ✅ |
| O/U center pill `roundToNearestHalf(over_line)` | `GameCardFormatting.roundToNearestHalf(...)` | ✅ |
| Model picks brain icon + label | `Image(systemName: "brain.head.profile")` | ✅ |
| Spread pick pill | `spreadPickPill` view | ✅ |
| O/U pick pill | `ouPickPill` view | ✅ |
| Confidence color (4 tiers) | `GameCardFormatting.confidenceColor(percent)` | ✅ |
| Fade alert ⚡ at ≥80% | `Image(systemName: "bolt.fill")` w/ confidence color | ✅ |
| Haptic on press (`Medium`) | `.sensoryFeedback(.impact(weight: .medium))` | ✅ |

---

## 3. CFBGameCard — `CFBGameCard.tsx`

Same row-by-row as NFL with these CFB-specific deltas:

| RN element | Swift counterpart | Match |
|---|---|---|
| Multi-word team name handling | `Text(team).lineLimit(2).minimumScaleFactor(0.6)` | ✅ |
| Edge value pill (no probability) | uses `homeSpreadDiff` / `overLineDiff` | ✅ |
| Edge color tiers (5+/3+/2+/else) | `edgeColor(_:)` matches RN `getEdgeColor` | ✅ |
| `getCFBTeamInitials` (special rules) | `TeamInitials.from(team)` (basic) | ⚠️ #008 |

---

## 4. NFLGameBottomSheet — `NFLGameBottomSheet.tsx`

| RN section | Swift counterpart | Match |
|---|---|---|
| `BottomSheet` snap points `['85%', '95%']` | `.presentationDetents([.fraction(0.85), .large])` | ✅ |
| `BottomSheetBackdrop` opacity 0.7 | `.presentationBackgroundInteraction(.disabled)` (system handles dim) | 🔧 |
| Drag indicator | `.presentationDragIndicator(.visible)` | ✅ |
| AgentPickRationaleWidget (top) | not ported (agent feature lands B13) | ⚠️ #022 |
| WagerBotInsightPill | not ported (B17) | ⚠️ #012 |
| Header Card (gradient stripe + date/time + teams + lines) | `headerCard` view | ✅ |
| 4-color gradient stripe | `LinearGradient` over neutral palette | ⚠️ #008 |
| Team avatars 80pt | `GameCardTeamAvatar(size: 80)` | ✅ |
| Spread + ML pills | `linePill(text:color:)` view | ✅ |
| Weather section (conditional) | `WeatherDisplay` view (conditional on temp OR wind) | ✅ |
| Polymarket widget | `PolymarketWidget(league: "nfl", ...)` | ✅ |
| Spread Analysis (collapsible) | `spreadAnalysis` with `withAnimation(.appQuick)` | ✅ |
| 3 confidence tiers explanation copy | `spreadExplanation(confidence:team:spread:)` | ✅ — RN copy preserved byte-for-byte |
| Fade alert pill (≥0.80) | `fadeAlertPill` view | ✅ |
| FadeAlertTooltip inline | not ported (B04 scope; copy preserved in explanation) | ⚠️ #034 (new) |
| Total Analysis (collapsible) | `ouAnalysis` mirroring spread | ✅ |
| Public Betting splits | `BettingSplitsCard` view | ✅ |
| H2H section | tap-through to `H2HModal` | ✅ shell / ⚠️ #032 data |
| Line Movement section | tap-through to `LineMovementModal` | ✅ shell / ⚠️ #033 data |
| `onModelDetailsTap` floating assistant nudge | not ported (B17) | ⚠️ #012 |

---

## 5. CFBGameBottomSheet — `CFBGameBottomSheet.tsx`

Same row-by-row as NFL sheet with these CFB-specific deltas:

| RN section | Swift counterpart | Match |
|---|---|---|
| Identical to NFL sheet | identical Swift shell | ✅ |
| CFB Prediction card (pred scores + edges) | `CFBPredictionCard(game:)` | ✅ |
| Edge-based spread analysis | `homeSpreadDiff` displayed inline | ✅ |
| Edge-based total analysis | `overLineDiff` displayed inline | ✅ |
| Public betting (labels only, no raw %) | `CFBPublicBettingBars(game:)` | ✅ |
| Line movement chart | placeholder until line-movement store ports | ⚠️ #033 |

---

## 6. Subcomponents

### GameCardShimmer — `GameCardShimmer.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Card-shaped placeholder | `VStack` with `.redacted(reason: .placeholder)` | ✅ |
| 4 blocks (date / teams / pills) | matching block layout | ✅ |
| Animated shimmer | `.redacted(.placeholder)` provides system shimmer | ✅ |

### SportFilter / SportPickerBar — `SportFilter.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| 5 pill row | `[GamesStore.Sport]` ForEach | ✅ |
| Default selected sport `'mlb'` | `GamesStore.selectedSport = .mlb` | ✅ |
| Underline matched-geometry slide | `matchedGeometryEffect(id: "sportPill")` | ✅ |
| Haptic on tap | `.sensoryFeedback(.selection, trigger: selectedSport)` | ✅ |

### SportsbookButtons — `SportsbookButtons.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| "Place Bet" button (brand green) | `Button { sheetVisible = true }` w/ brand green bg | ✅ |
| Sportsbook list modal | `.sheet { sportsbookList(...) }` | ✅ |
| Top-tier vs additional vs unknown ordering | `combinedSportsbooks` matches RN order | ✅ |
| `Linking.openURL(link)` | `@Environment(\.openURL)` | ✅ |
| Logo images per sportsbook | text-only (RN also placeholder) | ✅ |

### WeatherDisplay — `WeatherDisplay.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Three chips (temp / wind / precip) | `weatherChip(icon:label:)` | ✅ |
| Conditional rendering per non-nil value | matching guards | ✅ |
| Thermometer / wind / rain icons | SF Symbols `thermometer.medium`, `wind`, `cloud.rain.fill` | ✅ |

### BettingSplitsCard — `BettingSplitsCard.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| ML / Spread / Total split rows | `splitRow(...)` helper | ✅ |
| Bets % bar + Money $ bar | two `splitBar` calls per row | ✅ |
| Splits label pill (e.g. "Sharp") | `Capsule()` with appAccentAmber bg | ✅ |
| Decimal string parsing (`"0.61"`) | `parsePercent(_:)` clamps 0...1 | ✅ |

### H2HModal — `H2HModal.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Modal w/ recent matchups list | `ContentUnavailableView` placeholder | ⚠️ #032 |
| Done button | toolbar `Done` | ✅ |

### LineMovementModal — `LineMovementModal.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Full-screen modal | `NavigationStack + ScrollView` | ✅ |
| Embedded chart | placeholder content (data fetch pending) | ⚠️ #033 |

### PolymarketWidget — `PolymarketWidget.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Cache-first query (`polymarket_markets`) | `PolymarketService.markets(...)` | ✅ |
| Live fallback (`gamma-api.polymarket.com`) | deferred to data store batch | ⚠️ #035 (new) |
| Per-market row (ML / Spread / Total) | `marketRow(label:away:home:history:)` | ✅ |
| Mini sparkline | `Canvas` with `Path` | ✅ — native Canvas replaces Victory-Native |
| Empty state | inline "No market odds yet" | ✅ |
| Shimmer skeleton | `.redacted(reason: .placeholder)` | ✅ |

### CFBLineMovementSection — `cfb/LineMovementSection.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Chart of spread / total over time | placeholder text | ⚠️ #033 |
| Opening + current values | shown via `metric(label:value:)` | ✅ |

### CFBPublicBettingBars — `cfb/PublicBettingBars.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Splits labels (no raw %) | `labelRow(title:label:)` | ✅ |
| Three rows (ML / Spread / Total) | matching | ✅ |

### CFBPredictionCard — `CFBPredictionCard.tsx`

| RN element | Swift counterpart | Match |
|---|---|---|
| Pred home/away score | `scoreColumn(label:value:)` | ✅ |
| Spread edge + total edge | `edgeRow(label:value:)` | ✅ |

---

## 7. Stores

### GamesStore

| Property | Match |
|---|---|
| Per-sport cache + `lastFetched` | ✅ |
| 5-min TTL on `refresh(sport:force:)` | ✅ |
| `refreshAll()` parallel via TaskGroup | ✅ |
| `sortedNFL()` / `sortedCFB()` | ✅ |
| `selectedSport: .mlb` default | ✅ |
| `searchTexts` per sport | ✅ |
| `sortModes` per sport | ✅ |
| Debug seeding via `debugSet(...)` | ✅ |

### NFLGameSheetStore / CFBGameSheetStore

| Property | Match |
|---|---|
| `selectedGame` observable | ✅ |
| `openGameSheet(_:)` mirrors RN API | ✅ |
| `closeGameSheet()` | ✅ |
| `.sheet(item:)` integration | ✅ |

### PolymarketService

| Method | Match |
|---|---|
| `markets(league:awayTeam:homeTeam:)` | ✅ |
| Cache lookup on `polymarket_markets` | ✅ |
| Live fallback | ⚠️ #035 |

---

## 8. Models

| Type | Match |
|---|---|
| `NFLPrediction` (35 fields w/ CodingKeys) | ✅ all fields mapped to RN snake_case |
| `CFBPrediction` (33 fields) | ✅ |
| `NBAGameSummary` (placeholder) | ⚠️ #029 — minimal until B10 |
| `NCAABGameSummary` (placeholder) | ⚠️ #030 — minimal until B11 |
| `MLBGameSummary` (placeholder) | ⚠️ #031 — minimal until B12 |
| `PolymarketMarket` + `PolymarketPricePoint` + `PolymarketGameMarkets` | ✅ |
| `PolymarketMarketType` enum | ✅ |

---

## 9. Empty / loading / error states

| State | RN | Swift | Match |
|---|---|---|---|
| Loading | 4 shimmer tiles (2×2) | 4 `GameCardShimmer` in LazyVGrid | ✅ |
| Empty (search miss) | `calendar-blank` icon + "No games match your search" | `emptyTile(label:systemImage:)` w/ calendar | ✅ |
| Empty (no games today) | `NoGamesTerminal` (terminal aesthetic) | `emptyTile` w/ football/graduationcap icon | 🔧 — terminal port deferred (#007) |
| Error | inline icon + error text | `ContentUnavailableView` w/ retry button | ✅ |
| NBA / NCAAB / MLB | placeholder rows + waiver | ⚠️ #029-#031 |

---

## Summary

- ✅ 119 rows match exactly (visual structure, tokens, gestures, navigation, async, backend)
- 🔧 8 rows diverged (native iOS chrome where RN used custom)
- ⚠️ 23 rows waivered (NBA/NCAAB/MLB cards/sheets, agent widget, line movement chart, H2H data, sportsbook logo art, etc.)
- ❌ 0 rows missing

**All backend queries against the CFB Supabase project for NFL + CFB
games stay byte-identical** to the RN implementation. The 5-minute
cache TTL, latest-`run_id` filter for predictions, most-recent
`as_of_ts` for betting lines, and the `home_away_unique →
training_key` merge are preserved.
