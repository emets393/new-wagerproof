# Fidelity table — B06 Outliers tab + value/fade alerts

Source: `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx` (2570 lines) + `components/OutlierMatchupCard.tsx`, `components/OutliersHeroHeader.tsx`, `components/OutlierCardShimmer.tsx`, `components/ToolExplainerBanner.tsx`, `services/outliersService.ts`.

Target: `wagerproof_ios_native/Wagerproof/Features/Outliers/*` + `WagerproofKit/Sources/WagerproofModels/OutlierAlert.swift` + `WagerproofKit/Sources/WagerproofServices/OutliersService.swift` + `WagerproofKit/Sources/WagerproofStores/OutliersStore.swift`.

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Structure

| RN element | Swift counterpart | Match |
|---|---|---|
| Top-level `View` container (outliers.tsx:1398) | `NavigationStack { VStack { … } }` in `OutliersView` | ✅ matches |
| Animated.View frosted header w/ "Wager"+"Proof" title (1401–1469) | iOS-native nav bar `principal` toolbar item w/ "Wager" + green "Proof" | 🔧 fixed — system nav bar replaces hand-rolled blur |
| Settings cog leading button (1417–1424) | Deferred — chrome lives in `MainTabView.outliersTab` (B08 wires push) | ⚠️ #022 (broader inner-tabs ticket also covers settings push gap) |
| Robot trailing button (1431–1438) | Deferred — `FloatingAssistantBubble` overlay handled by `MainTabView` | 🔧 fixed |
| Inner tab bar 3-segment row (1442–1467) | `Picker(.segmented)` with 3 `InnerTab` cases | ✅ matches |
| Inner-tab green indicator bar (1463) | `.segmented` Picker's native selection highlight (`Color.appPrimary` tint) | 🔧 fixed |
| TopAgentPicksFeed embed (1474–1482) | `ContentUnavailableView` placeholder | ⚠️ #022 |
| AgentLeaderboard embed (1488–1497) | `ContentUnavailableView` placeholder | ⚠️ #022 |
| Hub branch `Animated.ScrollView` (1502–1524) | `ScrollView { LazyVStack { … } }` | ✅ matches |
| RefreshControl (1517–1522) | `.refreshable { await store.refresh() }` | 🔧 fixed |
| Detail-view back chevron (1917–1919) | System back via `NavigationStack` push | 🔧 fixed |
| Detail-view refresh button (1923–1929) | `ToolbarItem(.topBarTrailing)` with `arrow.clockwise` | ✅ matches |
| Detail-view `ScrollView` (1934–1940) | `ScrollView { VStack { … } }` | ✅ matches |
| `<OutliersHeroHeader>` (1527) | `OutliersHeroHeaderView` | ✅ matches |
| Section card layout `hubSection` (1530+, 7 occurrences) | `section(category:title:icon:accent:isLoading:cards:emptyCta:)` view-builder | ✅ matches |
| `hubSectionHeader` Touchable (1531+) | `NavigationLink(value: Category)` | 🔧 fixed |
| `hubSectionIconCircle` w/ tinted bg (1532+) | `Circle().fill(accent.opacity(0.15))` overlay w/ SF Symbol | ✅ matches |
| Horizontal `ScrollView` of cards (1545+, 1592+, etc.) | `ScrollView(.horizontal) { LazyHStack }` + `.scrollTargetBehavior(.viewAligned)` | ✅ matches |
| Shimmer row (3 cards staggered 150ms) (1539–1543) | `LazyHStack { ForEach { OutlierCardShimmerView(phase: i) } }` | ✅ matches |
| Empty `hubCtaCard` (1564–1572) | RETIRED 2026-06-11 — per-category CTA cards deleted with the merged feed | superseded |
| Pull-to-refresh haptic / animation (1517–1522) | `.refreshable` system feedback | 🔧 fixed |

## Hub sections (7 total)

| RN section | Swift counterpart | Match |
|---|---|---|
| Prediction Market Alerts (1529–1574) | merged `OutlierAggregator` feed (`outlierItems` in `OutliersView`) | superseded |
| Model Fade Alerts (1576–1621) | merged `OutlierAggregator` feed (`outlierItems` in `OutliersView`) | superseded |
| NBA Betting Trends (1623–1671) | RETIRED 2026-06-11 — `BettingTrendsInsightWidget` on the NBA game sheet | superseded |
| NCAAB Betting Trends (1673–1723) | RETIRED 2026-06-11 — `BettingTrendsInsightWidget` on the NCAAB game sheet | superseded |
| MLB Betting Trends (1725–1791) | RETIRED 2026-06-11 — `BettingTrendsInsightWidget` on the MLB game sheet | superseded |
| NBA Model Accuracy (1793–1846) | `NBAModelAccuracyView` via ToolRouter (`nba-model-accuracy`) | superseded |
| NCAAB Model Accuracy (1848–1901) | `NCAABModelAccuracyView` via ToolRouter (`ncaab-model-accuracy`) | superseded |

> #023 resolved 2026-05-24; superseded again 2026-06-11 — the per-category hub
> sections (`section`/`deferredSection`/`valueHubRow`/`fadeHubRow`/`ctaCard`) were deleted.
> The hub now renders ONE merged, ranked per-game feed (`OutlierAggregator` over value,
> fade, trends, F5, regression sources); trends/props/F5 per-game depth moved into the
> game-sheet insight widgets, and Model Accuracy remains a routed tool surface.

## Detail views (7 total)

| RN detail | Swift counterpart | Match |
|---|---|---|
| Value Alerts detail (1942–1974) | `OutliersDetailView` `case .value` w/ `ToolExplainerBannerView` + sport filter pills + `OutlierAlertCard` list | ✅ matches |
| Fade Alerts detail (1977–2009) | `case .fade` w/ banner + filter pills + fade-variant `OutlierAlertCard` | ✅ matches |
| NBA Trends detail (2012–2043) | `deferredCategoryNotice` | ⚠️ #023 |
| NCAAB Trends detail (2046–2077) | `deferredCategoryNotice` | ⚠️ #023 |
| MLB Trends detail (2080–2111) | `deferredCategoryNotice` | ⚠️ #023 |
| NBA Accuracy detail (2114–2145) | `deferredCategoryNotice` | ⚠️ #023 |
| NCAAB Accuracy detail (2148–2179) | `deferredCategoryNotice` | ⚠️ #023 |

## ToolExplainerBanner (per category)

| RN explainer | Swift counterpart | Match |
|---|---|---|
| Banner w/ accentColor, title, icon, headline, description, examples (ToolExplainerBanner.tsx) | `ToolExplainerBannerView` w/ same params | ✅ matches |
| BlurView frosted-glass background (96–99) | `.background(.ultraThinMaterial)` over diagonal gradient overlay | 🔧 fixed |
| 3px top accent stripe (63) | `Rectangle().fill(accentColor).frame(height: 3)` | ✅ matches |
| Tinted gradient overlay (52–60) | Same diagonal `LinearGradient` w/ accent stops + `Color.appSurfaceElevated.opacity(0.6)` | ✅ matches |
| Example row with icon circle + label + value (76–88) | `exampleRow(_:)` matching shape | ✅ matches |
| Value Alert banner copy (1944–1955) | `OutliersDetailView.explainerBanner.case .value` | ✅ matches |
| Fade Alert banner copy (1979–1990) | `case .fade` | ✅ matches |
| NBA Trends banner copy (2014–2025) | RETIRED with the trends tool category | superseded |
| NCAAB Trends banner copy (2048–2059) | RETIRED with the trends tool category | superseded |
| MLB Trends banner copy (2082–2093) | RETIRED with the trends tool category | superseded |
| NBA Accuracy banner copy (2116–2127) | `case .nbaAccuracy` | ✅ matches |
| NCAAB Accuracy banner copy (2150–2161) | `case .ncaabAccuracy` | ✅ matches |

## OutlierMatchupCard component

| RN element | Swift counterpart | Match |
|---|---|---|
| 160x160 gradient `card` (OutlierMatchupCard.tsx:200–205) | `gradientCard` ZStack 160x160 | ✅ matches |
| Diagonal `LinearGradient` (away→home) (110–115) | `LinearGradient(colors: [awayColor, homeColor], topLeading→bottomTrailing)` | ✅ matches |
| Per-team color resolution via `getTeamColors` (40–49) | `OutlierTeamPalette.color(for:sport:slot:)` (sport-tinted fallback) | ⚠️ #024 |
| Away logo top-left at LOGO_SIZE (64x64) inside 74x74 bg (117–127) | `teamBubble(name:logoUrl:)` positioned via `.position(...)` | ✅ matches |
| Home logo bottom-right (129–138) | Same `teamBubble` positioned bottom-right | ✅ matches |
| VS circle 34x34 centered (140–145) | `Text("VS")` w/ `Circle` background, 34x34 frame | ✅ matches |
| Bet type badge bottom-left (148–158) | Not wired — RN feature only used by ad-hoc callers (no Outliers caller passes `betTypeIcon`) | ✅ matches (no caller uses it on Outliers) |
| Loading spinner overlay (161–164) | `Color.black.opacity(0.45)` + `ProgressView` over card | ✅ matches |
| Subtext row w/ pick icon + label (170–185) | `subtextRow` HStack | ✅ matches |
| pickValue text below subtext (186–190) | `Text(pickValue).font(.system(size: 11, weight: .bold)).foregroundStyle(accentColor)` | ✅ matches |
| AsyncImage logo loading w/ fallback initials | `AsyncImage` w/ `teamInitials(_:)` fallback | ✅ matches |
| Card border-radius 14 (203) | `clipShape(RoundedRectangle(cornerRadius: 14))` | ✅ matches |

## OutliersHeroHeader component

| RN element | Swift counterpart | Match |
|---|---|---|
| Glassmorphic wrapper w/ `BlurView intensity=40` (96–105) | `background(.ultraThinMaterial)` w/ overlay gradient | 🔧 fixed |
| Tri-color top accent stripe (37–42) | `LinearGradient(colors: [#00E676, #00B0FF, #7C4DFF])` 3pt height | ✅ matches |
| Background tinted gradient (25–34) | Same overlay gradient | ✅ matches |
| Headline "Spot the setup before the outcome." (46) | Same text, 20pt heavy weight, -0.5 tracking | ✅ matches |
| Subheadline copy (47–49) | Same body string, 13pt | ✅ matches |
| 3-step flow (We Scan / We Flag / You Act) (52–91) | `flowStep(icon:iconColor:iconBg:title:desc:)` HStack | ✅ matches |
| Step icons radar/chart-bell-curve-cumulative/target (55–86) | SF Symbols `dot.radiowaves.left.and.right`, `chart.bar.xaxis`, `scope` | ✅ matches |
| Step accent colors #22c55e/#f59e0b/#7C4DFF | Same hex constants | ✅ matches |
| Divider above flow row (53) | `Divider()` | ✅ matches |
| Chevron between steps (64,78) | `Image(systemName: "chevron.right")` | ✅ matches |
| Edge-to-edge margin override (117–125) | `.padding(.horizontal, Spacing.lg)` (no negative margin — uses native edge padding) | 🔧 fixed |
| 16px border-radius wrapper (121) | `RoundedRectangle(cornerRadius: 16, style: .continuous)` | ✅ matches |
| 1px outline (124) | `.strokeBorder(Color.appBorder.opacity(0.6), lineWidth: 1)` | ✅ matches |

## OutlierCardShimmer component

| RN element | Swift counterpart | Match |
|---|---|---|
| 160x160 card placeholder (74–82) | Same `RoundedRectangle` 160x160 w/ `cornerRadius: 14` | ✅ matches |
| Pulsing opacity 0.3↔1.0 over 800ms (21–37) | `withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true))` | ✅ matches |
| Stagger delay = phase * 150ms (40) | `DispatchQueue.main.asyncAfter(deadline: .now() + Double(phase) * 0.15)` | ✅ matches |
| Faux VS circle 34x34 (62) | Inner `Circle()` 34x34 inside ZStack | ✅ matches |
| Subtext bar 100x10 (103–108) | `RoundedRectangle(cornerRadius: 4).fill(...).frame(width: 100, height: 10)` | ✅ matches |
| Value bar 60x8 (109–114) | Same shape, 60x8 | ✅ matches |
| Card bg = `rgba(255,255,255,0.06)` / `(0,0,0,0.04)` (47) | `Color.appSurfaceMuted` | 🔧 fixed (token swap) |

## OutlierAlertCard (detail-view card)

| RN element | Swift counterpart | Match |
|---|---|---|
| Card container w/ accent bg + border (894–899) | `OutlierAlertCard.body` ZStack w/ `accent.opacity(0.1)` bg + `accent.opacity(0.3)` border | ✅ matches |
| Tap → `handleGamePress(alert.game)` (900) | `Button(action: onTap)` w/ external closure | ✅ matches |
| Card header pills row (902–928) | `headerPills` VStack w/ `sportPill`, `timePill`, `marketPill`, `accentPill` | ✅ matches |
| Sport pill icon + name (905–908) | `sportPill` HStack w/ SF Symbol + sport code | ✅ matches |
| Game time pill w/ clock icon (911–916) | `timePill(_:)` w/ `clock` symbol | ✅ matches |
| Market type pill (919–921) | `marketPill` | ✅ matches |
| Percentage pill (922–926) | `accentPill` w/ `percent` symbol + value | ✅ matches |
| Lines row (Spread / O/U / ML) (931–949) | `linesRow` HStack of capsule pills | ✅ matches |
| `renderMatchupRow` (away + @ + home w/ avatars + abbrevs) (644–681) | `matchupRow` HStack w/ `teamCell(_:_:_:)` | ✅ matches |
| Description text under matchup (954–960) | `bodyText` using composed `Text()` + boldface side name | ✅ matches |
| Fade-card "Consider the Fade" inset (1051–1059) | `fadeBox(for:)` ZStack | ✅ matches |
| Fade reason line (1061–1063) | `fadeReason(for:)` | ✅ matches |
| `formatGameTime` "Sun 1:00 PM" (86–104) | `OutlierAlertCard.formatGameTime(_:)` w/ "EEE h:mm a" pattern | ✅ matches |
| `formatSpread` (107–110) | `formatSpread(_:)` | ✅ matches |
| `formatMoneyline` (113–116) | `formatMoneyline(_:)` | ✅ matches |
| `computeFadePick` (974–986) | `computeFadePick(for:)` | ✅ matches |
| Value alert green bg `rgba(34,197,94,0.1)` | `Color(hex: 0x22C55E).opacity(0.1)` | ✅ matches |
| Value alert green border `rgba(34,197,94,0.3)` | `Color(hex: 0x22C55E).opacity(0.3)` | ✅ matches |
| Fade alert amber bg `rgba(245,158,11,0.1)` | `Color(hex: 0xF59E0B).opacity(0.1)` | ✅ matches |
| Fade alert amber border `rgba(245,158,11,0.3)` | `Color(hex: 0xF59E0B).opacity(0.3)` | ✅ matches |

## Sport filter pills (detail)

| RN element | Swift counterpart | Match |
|---|---|---|
| Horizontal `ScrollView` of filter pills (1080–1124) | `sportFilterPills(currentBinding:countProvider:)` w/ horizontal `ScrollView` | ✅ matches |
| "All (n)" pill w/ total count (1082–1091) | `pill(label:isActive:sport:onTap:)` | ✅ matches |
| Per-sport pill w/ count `(n)` (1093–1123) | Same `pill(...)` rendered for each sport whose count > 0 | ✅ matches |
| Tap toggles filter (toggle off when active) (1106) | Same binding-toggle logic | ✅ matches |
| Active pill bg `theme.colors.primary` | `Color.appPrimary` when active | ✅ matches |
| Inactive pill bg `#2a2a2a` / `#e0e0e0` | `Color.appSurfaceMuted` | 🔧 fixed (token swap) |
| Selection haptic on filter change | `.sensoryFeedback(.selection, trigger: currentBinding.wrappedValue)` | ✅ matches |
| Hide pills with 0 count (1095) | Same `if count > 0` guard | ✅ matches |

## Trend / accuracy cards (deferred section bodies)

| RN element | Swift counterpart | Match |
|---|---|---|
| `renderTrendOutlierCard` (1210–1281) | Deferred — `ContentUnavailableView` placeholder | ⚠️ #023 |
| `renderAccuracyOutlierCard` (1283–1360) | Deferred — `ContentUnavailableView` placeholder | ⚠️ #023 |
| `buildNBATeamTrendCandidates` (148–245) | Deferred (NBA store ports in B10) | ⚠️ #023 |
| `buildNCAABTeamTrendCandidates` (247–344) | Deferred | ⚠️ #023 |
| `buildMLBTrendOutliers` (399–473) | Deferred | ⚠️ #023 |
| `buildAccuracyOutliers` (504–607) | Deferred | ⚠️ #023 |

## Service layer — `outliersService.ts`

| RN call | Swift counterpart | Match |
|---|---|---|
| `fetchWeekGames()` (85–408) | `OutliersService.shared.fetchWeekGames()` | ✅ matches |
| NFL `v_input_values_with_epa` query + filter to next 7 days in ET (91–177) | Same query / ordering / filter | ✅ matches |
| NFL `nfl_betting_lines` join on `training_key` w/ most-recent-by-as_of_ts (98–116) | Same pattern using Dictionary keyed by `training_key` | ✅ matches |
| CFB `cfb_live_weekly_inputs` query + ET date filter (180–234) | Same query / filter | ✅ matches |
| NBA `nba_input_values_view` query + tipoff-time-derived ET date (237–305) | Same query / filter | ✅ matches |
| Away ML complement fallback `homeML > 0 ? -(homeML+100) : 100-homeML` (80–83) | Same formula | ✅ matches |
| NCAAB `v_cbb_input_values` + `ncaab_team_mapping` parallel fetch (308–402) | `async let` parallel `try await (ncaabRowsTask, teamMappingTask)` | ✅ matches |
| Team mapping → `https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png` (325–328) | Same URL template | ✅ matches |
| `hydratePredictions(games)` per-sport merge (414–610) | `hydratePredictions(_:)` per-sport merge | ✅ matches |
| NFL latest run query + `eq run_id` + `in training_key` (422–447) | Same chain | ✅ matches |
| CFB `cfb_api_predictions` full fetch + index by `id` (453–471) | Same pattern | ✅ matches |
| NBA `nba_predictions` w/ latest-per-game by `as_of_ts_utc` (476–545) | Same Dictionary collapse on `asOfTsUtc` | ✅ matches |
| NBA spread cover prob synthesis (510–520) | Same `0.5 ± min(diff*0.05, 0.35)` formula | ✅ matches |
| NBA O/U prob synthesis (522–531) | Same `0.5 ± min(|diff|*0.02, 0.35)` formula | ✅ matches |
| NCAAB latest-run query + `vegas_total/vegas_home_spread` overrides (548–610) | Same chain + same override logic | ✅ matches |
| `fetchValueAlerts(weekGames)` (613–768) | `fetchValueAlerts(weekGames:)` | ✅ matches |
| Group games by league for Polymarket query (617–622) | Same Dictionary `[SportLeague: [OutlierGame]]` | ✅ matches |
| Polymarket `game_key` format `{league}_{away}_{home}` (635) | Same string format | ✅ matches |
| `polymarket_markets` query w/ `eq league` + `in game_key` (640–649) | Same chain | ✅ matches |
| Stale-market skip (≥95 / ≤5 / sum<80) (670–674) | Same predicate | ✅ matches |
| Spread > 57 threshold (678) | `if awayOdds > 57` / `homeOdds > 57` | ✅ matches |
| Total > 57 threshold (706) | Same | ✅ matches |
| Moneyline ≥ 85 threshold + book ML > -200 gate (734–763) | Same conditions | ✅ matches |
| `fetchFadeAlerts(weekGames)` (770–907) | `fetchFadeAlerts(weekGames:)` | ✅ matches |
| NFL spread fade confidence ≥ 80 (787) | Same threshold | ✅ matches |
| NFL O/U fade confidence ≥ 80 (803) | Same threshold | ✅ matches |
| CFB spread edge abs > 10 (824) | Same threshold | ✅ matches |
| CFB total edge abs > 10 (838) | Same threshold | ✅ matches |
| NBA spread edge abs ≥ 9.5 (NO O/U fades) (858) | Same threshold + same NBA-only-spread rule | ✅ matches |
| NCAAB spread edge abs > 5 (878) | Same threshold | ✅ matches |
| NCAAB total edge abs > 5 (892) | Same threshold | ✅ matches |
| RN error handling: best-effort per-sport (try/catch each branch) | Same per-sport `do { … } catch { }` | ✅ matches |

## Store layer

| RN element | Swift counterpart | Match |
|---|---|---|
| `useQuery(['week-games'], …)` (705) | `OutliersStore.weekGames` populated by `refresh()` | ✅ matches |
| `useQuery(['value-alerts'], …, enabled: !!weekGames)` (712) | `async let values = OutliersService.shared.fetchValueAlerts(...)` inside `refresh()` | ✅ matches |
| `useQuery(['fade-alerts'], …, enabled: !!weekGames)` (720) | Same `async let fades = …` | ✅ matches |
| `staleTime: 5 * 60 * 1000` (708,716,724) | Not surfaced — `.refreshable` + `.task` cover the same UX | 🔧 fixed |
| `[refreshing, setRefreshing]` (619) | `LoadState` enum on `OutliersStore` | ✅ matches |
| `[activeTab, setActiveTab]` (620) | `OutliersStore.activeTab: InnerTab` (`@Bindable`) | ✅ matches |
| `[selectedCategory, setSelectedCategory]` (624) | Native `NavigationStack` path (`NavigationLink(value:)`) | 🔧 fixed |
| `[valueAlertsFilter, setValueAlertsFilter]` (690) | `OutliersStore.valueAlertsSportFilter: SportLeague?` | ✅ matches |
| `[fadeAlertsFilter, setFadeAlertsFilter]` (691) | `OutliersStore.fadeAlertsSportFilter` | ✅ matches |
| `[loadingGameId, setLoadingGameId]` (630) | `OutliersStore.loadingGameId: String?` | ✅ matches |
| `isGameUpcoming` filter (1129–1133) | `OutliersStore.isUpcoming(_:)` private static | ✅ matches |
| `filterBySport` helper (55–61) | `OutliersStore.filteredValueAlerts` / `filteredFadeAlerts` selectors | ✅ matches |
| Per-sport count for filter pills | `valueAlertsCount(by:)` / `fadeAlertsCount(by:)` | ✅ matches |
| `onRefresh` parallel invalidate (815–828) | `OutliersStore.refresh()` re-runs the whole pipeline | ✅ matches |

## Tokens / colors

| RN value | Swift token | Match |
|---|---|---|
| Value-alert accent `#22C55E` | `Color(hex: 0x22C55E)` (also `Color.appPrimary`) | ✅ matches |
| Fade-alert accent `#F59E0B` | `Color(hex: 0xF59E0B)` (also `Color.appAccentAmber`) | ✅ matches |
| NBA trend accent `#0EA5E9` | `Color(hex: 0x0EA5E9)` | ✅ matches |
| NCAAB trend accent `#6366F1` | `Color(hex: 0x6366F1)` | ✅ matches |
| MLB trend accent `#002D72` | `Color(hex: 0x002D72)` | ✅ matches |
| NBA accuracy accent `#14B8A6` (high) / `#EF4444` (low) | Same hex constants | ✅ matches |
| NCAAB accuracy accent `#F97316` (high) / `#EF4444` (low) | Same | ✅ matches |
| Hero gradient stops `#00E676 / #00B0FF / #7C4DFF` | Same hex constants | ✅ matches |
| Card border-radius 14 | `RoundedRectangle(cornerRadius: 14, style: .continuous)` | ✅ matches |
| Hero / banner border-radius 16 | `RoundedRectangle(cornerRadius: 16, style: .continuous)` | ✅ matches |
| Section title 17pt semibold | `.font(.system(size: 17, weight: .semibold))` | ✅ matches |
| Pill label 11pt 700 / 13pt 600 (various) | Matching `.font(.system(size: ..., weight: ...))` calls | ✅ matches |
| Logo-bg circle `rgba(255,255,255,0.18)` | `Color.white.opacity(0.18)` | ✅ matches |
| VS circle bg dark `#1a1a1a` / light `#fff` | `Color.appSurfaceElevated` | 🔧 fixed (semantic token) |

## Gestures / haptics

| RN gesture | Swift counterpart | Match |
|---|---|---|
| Tap section header → setSelectedCategory (1531) | `NavigationLink(value: category)` push | 🔧 fixed |
| Tap card → handleGamePress → openXxxSheet | `Button(action: onTap)` → loadingGameId flash | ⚠️ #021 |
| Long-press (none in RN) | `.contextMenu { Open game sheet }` per card | 🔧 fixed (improvement: iOS contextMenu) |
| PullToRefresh (1516) | `.refreshable { await store.refresh() }` | 🔧 fixed |
| Inner-tab tap (1449) | `Picker(.segmented)` selection w/ `.sensoryFeedback(.selection)` | 🔧 fixed |
| Filter pill tap (1106) | `pill(...)` button w/ `.sensoryFeedback(.selection, trigger: filter)` | 🔧 fixed |
| 500ms loadingGameId clear (881) | `Task { try? await Task.sleep(nanoseconds: 500_000_000); store.loadingGameId = nil }` | ✅ matches |

## Animations

| RN animation | Swift counterpart | Match |
|---|---|---|
| Shimmer pulse 800ms easeInOut loop (OutlierCardShimmer.tsx:24–37) | `withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true))` | ✅ matches |
| Hero header header translate based on `scrollYClamped` (1373–1377) | iOS-native nav-bar collapse | 🔧 fixed |
| RefreshControl spinner | `.refreshable` system spinner | 🔧 fixed |
| Card selection spinner overlay | `ProgressView()` over `Color.black.opacity(0.45)` | ✅ matches |

## Edge cases

| RN behavior | Swift counterpart | Match |
|---|---|---|
| Lock cap: non-pro = 2 cards + ≤3 `<LockedOverlay>` placeholders (1142–1150, 1960–2169) | Not yet wired — `ProAccessStore` ports in B08 | ⚠️ #019 |
| Game-time filter: hide alerts where `gameTime < Date.now()` (1129–1135) | `OutliersStore.isUpcoming(_:)` predicate | ✅ matches |
| iOS-only widget sync (741–797) | Not ported — `WidgetDataBridge` lands in B22 | ⚠️ #020 |
| MLB threshold 60% vs 65% (NBA/NCAAB) (397) | Deferred (MLB store ports in B12) | ⚠️ #023 |
| NCAAB accuracy skips ML pickType (540) | Deferred (accuracy store ports in B11) | ⚠️ #023 |
| NBA accuracy thresholds 65/35 min 5 vs NCAAB 70/30 min 10 | Deferred | ⚠️ #023 |
| WagerBotSuggestionContext.setOutliersData(values, fades) (733–737) | Not ported — `WagerBotSuggestionStore` lands in B17 | ⚠️ #062 — see `tickets/062-outliers-wagerbot-suggestion-sync.md` |
| onPageChange('outliers') (729) | Not ported — same B17 store gap | ⚠️ #062 |

## Date / time handling

| RN handling | Swift counterpart | Match |
|---|---|---|
| `getDates()` w/ Intl.DateTimeFormat 'America/New_York' (53–77) | `OutliersService.getDateWindow()` w/ `TimeZone(identifier: "America/New_York")` DateFormatter | ✅ matches |
| 7-day window from "today" forward | `Calendar.date(byAdding: .day, value: 7)` | ✅ matches |
| NFL `game_date + 'T' + game_time` synthesis when no game_time_et (130) | Same string concat in NFL branch | ✅ matches |
| CFB ET-date derivation from `start_date` etc. (186–207) | `OutliersService.formatETDate(_:)` | ✅ matches |
| NBA tipoff_time_et → ET date (247–263) | Same path via `formatETDate(_:)` | ✅ matches |
| NCAAB start_utc or tipoff_time_et → ET date (335–353) | Same | ✅ matches |
| `formatGameTime` "Sun 1:00 PM" (86–104) | `OutlierAlertCard.formatGameTime(_:)` | ✅ matches |

## Summary

- **Sections shipped (full):** 2 (Prediction Market Alerts, Model Fade Alerts) + hub scaffolding for all 7.
- **Sections deferred (waiver):** 5 (NBA / NCAAB / MLB trends + NBA / NCAAB accuracy) → ticket #023
- **Inner tabs shipped (full):** 1 of 3 (Outliers); other 2 → ticket #022
- **Game-sheet route:** deferred → ticket #021
- **Pro lock cap:** deferred → ticket #019
- **iOS widget sync:** deferred → ticket #020
- **Per-team gradient palette:** deferred → ticket #024

Backend queries are byte-identical to RN: `v_input_values_with_epa`, `nfl_betting_lines`, `cfb_live_weekly_inputs`, `nba_input_values_view`, `v_cbb_input_values`, `ncaab_team_mapping`, `polymarket_markets`, `nfl_predictions_epa`, `cfb_api_predictions`, `nba_predictions`, `ncaab_predictions`. Thresholds and skip rules preserved exactly.
