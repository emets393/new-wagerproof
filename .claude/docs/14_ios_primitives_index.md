# iOS Primitives Index — Page Surfaces & Their Primitives

Reference catalog of every page surface in the native iOS app (`wagerproof-ios-native/`) and the
self-contained UI "primitives" each one is built from. Two purposes:

1. **Search surfacing** — any Tier-1/Tier-2 primitive below is a candidate result type for the
   Search page (render the card inline, tap → navigate to its home surface).
2. **Agentic coding** — when adding a feature, check here first for an existing primitive before
   building a new one.

All paths are relative to `wagerproof-ios-native/Wagerproof/` unless noted.

## Primitive tiers

- **Tier 1 — Entity cards (list-row primitives):** render a whole entity from one identifier
  (a game, a prop, an agent, a pick). These are the natural *search result* primitives.
- **Tier 2 — Detail widgets:** live inside a detail sheet; render one *facet* of an entity
  (public betting, weather, injuries, a prop market). Surfaceable in search/chat given the parent
  entity's id + the facet name. The WagerBot `appComponents` vocabulary (see Chat section) is the
  existing cross-surface schema for these.
- **Tier 3 — Chrome / design system:** glass containers, shimmers, pills, heroes. Not search
  results themselves; the building blocks of Tiers 1–2.

---

## 1. Games (Games tab)

### 1a. Games list — `Features/Games/GamesView.swift`

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **GameRowCard** (Matchup Line Item) | 1 | `GameCards/Components/GameRowCard.swift:20` | sport + prediction model (`NFLPrediction` / `CFBPrediction` / `NBAGame` / `NCAABGame` / `MLBGame`) — i.e. **sport + game id** |
| ToolBannerCard | 1 | `Games/Tools/ToolBannerCard.swift:7` | `SportTool` (tool category enum) |
| SportPickerBar | 3 | `Games/Components/SportPickerBar.swift` | sport + sort bindings |
| GameCardShimmer | 3 | `GameCards/Components/GameCardShimmer.swift` | — |

`GameRowCard` is shared across all 5 sports (MLB variant swaps the sparkline for an odds
breakdown table). This is the canonical "Matchup Line Item".

### 1b. Game detail carousel (all sports) — shared engine

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **GameDetailCarousel** | 3 | `GameCards/Components/GameDetailCarousel.swift:23` | slate of games + closures for colors/chip/page |
| CarouselMatchupChip | 3 | `GameDetailCarousel.swift:156` | away/home abbr + logos |
| CollapsingWidgetScroll (iOS-Weather collapse engine) | 3 | `Components/Components/CollapsingWidgetScroll.swift:22` | hero + widget sections |
| PinnedWidgetScroll (legacy pinned engine) | 3 | `Components/Components/PinnedWidgetScroll.swift` | widget sections |
| MatchupGlassHero (morphing disc hero) | 3 | `GameCards/Components/MatchupGlassHero.swift:24` | logos, abbrs, colors, stat rows, progress |

Per-sport entries: `NFLGameCarousel` → `NFLGameBottomSheet`, `CFBGameCarousel` →
`CFBGameBottomSheet`, `NBAGameCarousel` → `NBAGameBottomSheet`, `NCAABGameCarousel` →
`NCAABGameBottomSheet`, `MLBGameCarousel` → `MLBGameBottomSheet` (each under
`Features/<SPORT>/Sheets/`).

### 1c. Game detail widgets (Tier 2 — the per-facet primitives)

Shared across sports:

| Widget | File | Facet | Sports |
|---|---|---|---|
| **PolymarketWidget** | `Components/Polymarket/PolymarketWidget.swift:13` | market odds + sparklines | all 5 (needs league + team names) |
| Spread / O/U / ML Prediction Cards | inline in each sport's BottomSheet | Vegas vs model edge | all 5 |
| FadeAlertTooltip | `Components/Components/FadeAlertTooltip.swift:14` | fade suggestion at extreme edge | all 5 (inside prediction cards) |
| WeatherDisplay | `GameCards/Components/WeatherDisplay.swift:9` | temp/wind/precip chips | NFL, CFB (MLB has its own pro-gated card) |
| **BettingTrendsInsightWidget** | `Outliers/Components/BettingTrendsInsightWidget.swift:11` — mounted at `MLB/Sheets/MLBGameBottomSheet.swift:725`, `NBA/Sheets/NBAGameBottomSheet.swift:204`, `NCAAB/Sheets/NCAABGameBottomSheet.swift:474` | situational-trends digest (verdict + top-3 signal tug bars; expands to `BettingTrendsDetailSheet`) — insight-widget pattern, §7b | MLB, NBA, NCAAB (hidden when the game has no trends row; MLB store hoisted to MainTabView, NBA/NCAAB sheet-local) |
| ModelAccuracyWidget | `GameCards/Components/ModelAccuracyWidget.swift:14` | spread/ML/O/U accuracy buckets | NBA, NCAAB |
| Match Simulator (model-projected final score) | inline per sheet | projected score | CFB, NBA, NCAAB; MLB = Projected Score card w/ Full-game ⁄ F5 toggle |
| **AgentPickRationaleWidget** | `Agents/Components/AgentPickRationaleWidget.swift:22` | agent pick reasoning for this game | all 5 (renders only when audit store matches game keys) |
| H2HModal / LineMovementModal | `GameCards/Sheets/` | head-to-head, line movement | NFL (LineMovement is placeholder) |

Sport-specific:

| Widget | File | Facet |
|---|---|---|
| NFLPublicBettingBars | `NFL/Components/NFLPublicBettingBars.swift:16` | bet% + money% gauges (ML/spread/total) |
| CFB PublicBettingBars | `CFB/Components/PublicBettingBars.swift` | splits labels (simpler) |
| CFBLineMovementSection | `CFB/Components/LineMovementSection.swift:14` | opening vs current spread/total |
| NBAInjuryReportWidget | `NBA/Components/NBAInjuryReportWidget.swift:12` | per-team injuries + PIE impact |
| NBARecentTrendsWidget | `NBA/Components/NBARecentTrendsWidget.swift` | L-N record/ATS trends |
| MLBMatchupPropsWidget | `MLB/Components/MLBMatchupPropsWidget.swift:12` | player-props digest (starter Ks + hot/cold bats w/ hit strips; rows zoom-push `PlayerPropDetailView`, expands to `MatchupPropsDetailSheet`) — insight-widget pattern, §7b |
| F5SplitsInsightWidget | `MLB/Components/F5SplitsInsightWidget.swift:10` | First-5-innings splits digest (win% / runs-scored / runs-allowed tug bars; expands to `F5SplitsDetailSheet`) — insight-widget pattern, §7b |
| MLBRegressionPicksSection | `MLB/Components/MLBRegressionPicksSection.swift:14` | regression-report picks for this game |
| MLB Game Signals card / Weather card | inline in `MLBGameBottomSheet` | pro-gated signals, weather + roof |

### 1d. Games-page tools (each is its own leaf surface)

Routed by **ToolRouter** (`Games/Tools/ToolRouter.swift:8`); registry in
`Games/Tools/SportTool.swift:33`. Banners shown per sport above the games list; same router
serves the Outliers hub.

| Tool surface | Entry view | Sport |
|---|---|---|
| MLB Regression Report | `MlbRegressionReportView` (`Analytics/MlbRegressionReportView.swift:24`; feed of the regression primitives below) | MLB |
| NBA Model Accuracy | `NBAModelAccuracyView` | NBA |
| NCAAB Model Accuracy | `NCAABModelAccuracyView` | NCAAB |

NFL/CFB currently have no tools.

The five former list tools (MLB/NBA/NCAAB Betting Trends, Player Prop Matchups, MLB F5
Splits) were retired 2026-06-11 — their data now lives as per-matchup insight widgets on the
game sheets (§7) and as Search insight chips; the Outliers hub's merged feed still scans the
same stores slate-wide.

#### Shared betting-trends detail layer (sport-agnostic, 2026-06-10)

One renderer + one sheet serve MLB/NBA/NCAAB; per-sport `enum` adapters map store models into
the shared section/row types. The legacy per-sport sheets
(`MLBBettingTrendsBottomSheet`, `*TrendsSituationSection`, inline NBA sheet from waiver #233)
are deleted. Since 2026-06-11 this layer is the **expand surface** of
`BettingTrendsInsightWidget` (§7b) — game sheets and Search both present it; the `.compact`
style + `TrendsMatrixCompactSkeleton` were deleted with the standalone tool views.

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **BettingTrendsDetailSheet** | 2 | `Outliers/Components/BettingTrendsDetailSheet.swift:13` | teams + time + stripe colors + `[TrendsMatrixSection]` + optional matchup action — i.e. **sport + game id** via an adapter |
| **TrendsMatrixView** (card style) | 2 | `Outliers/Components/TrendsMatrixView.swift:69` | `[TrendsMatrixSection]` (RN color thresholds 55/45, per-section consensus badges, no-data state) |
| TrendsMatrixSection / TrendsMatrixMetricRow / TrendsConsensusBadge | 3 | `TrendsMatrixView.swift:46,27,16` | value types fed by adapters |
| TrendsTeamAvatar | 3 | `BettingTrendsDetailSheet.swift:204` | logo URL + abbr + color |
| MLB / NBA / NCAAB adapters | 3 | `Outliers/Components/{MLB,NBA,NCAAB}TrendsMatrixAdapter.swift:9` | sport trends model → sections (MLB: 7 WIN%/OVER% pairs via `formatMLBSituation`, `WagerproofModels/MLBTeam.swift:352`; NBA/NCAAB: 5 ATS + O/U pairs with records) |

Data: `mlb_situational_trends(_today)`, `nba_game_situational_trends(_today)`,
`ncaab_game_situational_trends(_today)` (CFB Supabase) via the per-sport
`*BettingTrendsStore`s. All three stores expose a per-game lookup +
`refreshIfNeeded(maxAge:)` for the game-sheet insight widgets (§7b); the MLB store is
hoisted to the MainTabView shell (shared with Search), NBA/NCAAB stay sheet-local.

#### F5 Splits primitives

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **F5GameCardView** (head-to-head F5 splits card) | 1 | `MLB/Components/F5GameCardView.swift:10` | `MLBF5SplitRow` pair — i.e. **MLB game pk** (pitching matchup header, 5-row offense splits, 3-row defense-by-own-starter-hand splits, advantage coloring, small-sample warnings, 11 tap-to-alert help texts); rendered by `F5SplitsDetailSheet` (the F5 widget's expand surface, §7b) and `OutlierMatchupDetailView` |

Data: `mv_mlb_f5_team_splits` + `mlb_games_today` via `MLBF5SplitsStore`
(`refreshIfStale` 10-min window mirrors the RN react-query staleTime; `matchup(for gamePk:)`
feeds the §7b widget; store hoisted to MainTabView).

#### Regression Report primitives (`Features/Analytics/Components/`, 2026-06-10)

The report is a feed of per-entity cards — each renders one block of the
`mlb_regression_report` row (or a sibling table noted below):

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| RegressionNarrativeCard | 2 | `RegressionNarrativeCard.swift:8` | narrative markdown (block-level via shared `WagerBotMarkdownText`) |
| RegressionAccuracySection | 2 | `RegressionAccuracySection.swift:8` | model accuracy 2x2 + segmented bucket drill-down (`mlb_model_bucket_accuracy` via `MLBBucketAccuracyStore`) |
| RegressionModelBreakdownSection | 2 | `RegressionModelBreakdownSection.swift:9` | by-team / by-day-of-week tables (`mlb_model_breakdown_accuracy` via `MLBModelBreakdownStore`) |
| RegressionRecapSection | 2 | `RegressionRecapSection.swift:10` | YESTERDAY + ALL-TIME hero tiles + per-pick recap rows (`mlb_graded_picks` via `MLBPerfectStormRecordsStore`) |
| **PerfectStormPickCard** + PerfectStormTierRecordsGrid | 1 / 2 | `PerfectStormPickCard.swift:76,32` | `MLBSuggestedPick` (+ tier records) — i.e. **MLB game pk + pick**; includes per-pick model-alignment context via `MLBPickAlignment` (`WagerproofModels/MLBRegressionInsights.swift:182`) |
| PitcherRegressionCard / BattingRegressionCard | 2 | `PitcherRegressionCard.swift:8`, `BattingRegressionCard.swift:7` | pitcher / batter regression entries (xwOBA gaps) |
| BullpenFatigueCard | 2 | `BullpenFatigueCard.swift:8` | OVERWORKED / DECLINING bullpen flags |
| LRSplitsSection | 2 | `LRSplitsSection.swift:7` | notable L/R platoon splits |
| SeriesSignalCard | 2 | `SeriesSignalCard.swift:7` | `MLBSeriesSignal` — ★ BACK / ⚠ FADE G2/G3 carryover (`mlb_game_signals`, category `series`, via `MLBSeriesSignalsStore`) |
| WeatherParkFlagCard | 2 | `WeatherParkFlagCard.swift:7` | weather/park flags with inferred icons |
| Regression chrome (AccentRow, Stat, Pill, HeroTile, GroupLabel, SegmentedTabs, FlowLayout, color tokens) | 3 | `RegressionPrimitives.swift:7` | — |

#### Follow-ups (verified 2026-06-10)

- **Chat `appComponents` server vocabulary** (section 8) has no types for the new facets —
  MLB `betting_trends` (server currently emits it for NBA/NCAAB only), a regression-report
  pick, or F5 splits. Extending the WagerBot edge-function vocabulary is server work, out of
  scope of the iOS revamp.
- **#110-paywall**: regression report `useProAccess` gating deferred to the paywall wiring
  batch (`docs/wagerproof-migration/fidelity/b12-mlb.md`).
- ~~NBA/NCAAB game sheets still mount the legacy `BettingTrendsWidget`~~ — resolved
  2026-06-11: all three sports now mount `BettingTrendsInsightWidget` (§7b); the legacy
  widget was deleted.
- All DB views the revamp reads were verified to exist (`mv_mlb_f5_team_splits`,
  `mlb_model_breakdown_accuracy`, `mlb_graded_picks`, `mlb_game_signals`,
  `ncaab_todays_games_predictions_with_accuracy`) — no DB creation pending. NBA/NCAAB
  `*_today` trends/accuracy views are empty in the offseason by design.

---

## 2. Props (Props tab) — MLB + NFL player props

Two feeds behind one sport picker: MLB (game-log trends + alt-line ladder, via the
`get_mlb_player_props_l10` RPC) and NFL (consensus close + season trends, via the
`nfl_dryrun_props` ⨝ `nfl_dryrun_games` tables on the CFB/research Supabase — the "NFL
Week 12 2025 Dry Run" app data contract; one row per player × market with median
line/prices across books, point-in-time game logs, defense matchup index, P-flags, and
`headshot_url`). NBA/NCAAB show "coming soon"; there is no CFB segment (college player
props aren't offered).

### 2a. Props list — `Features/Props/PropsView.swift`

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **PropPlayerCard** (Prop Line Item) | 1 | `Props/Components/PropPlayerCard.swift:15` | `PlayerPropFeedItem` — i.e. **player id + headline market** |
| PlayerHeadshot | 3 | `Props/Components/PlayerHeadshot.swift:7` | MLB player id |
| RecentFormStrip (L10 mini bars) | 3 | `PropPlayerCard.swift:221` | `[(cleared, value)]` + line |
| O/U pill, info item, time pill, avatar+glow | 3 | `PropPlayerCard.swift:100–207` | formatted strings/colors |
| PropCardShimmer | 3 | `Props/Components/PropCardShimmer.swift:14` | — |

### 2b. Prop detail — `Features/Props/Detail/PlayerPropDetailView.swift`

The detail page is **one collapsing widget per market** — the market widget is the Tier-2
primitive ("markets within the prop"):

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **Market widget** (verdict + chart + tiles + odds footer) | 2 | `PlayerPropDetailView.swift:252` | `MLBPlayerPropRow` (**player id + market key**) + selected line |
| RecentPropBarChart | 2 | `Props/Detail/RecentPropBarChart.swift:18` | `[MLBPropChartBar]` + line |
| PropContextTiles (L10 / day-night / archetype splits) | 2 | `Props/Detail/PropContextTiles.swift:8` | row + `MLBPropComputedAtLine` |
| PropLineScrubber (line wheel + odds readout) | 2 | `Props/Detail/PropLineScrubber.swift:13` | `[MLBPlayerPropLineEntry]` + line binding |
| Collapsing hero + market segmented picker | 3 | `PlayerPropDetailView.swift:127,187` | `PlayerPropSelection`, markets |

Data hierarchy: `MLBPropMatchup` (game) → `PlayerPropSelection` (player, all markets) →
`MLBPlayerPropRow` (one market) → `MLBPlayerPropLineEntry` (alt lines) +
`MLBPropComputedAtLine` (derived at chosen line).

### 2c. NFL props (trend board) — list rows in `PropsView`, detail `Features/Props/Detail/NFLPropDetailView.swift`

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **NFLPropPlayerCard** (NFL Prop Line Item) | 1 | `Props/Components/NFLPropPlayerCard.swift:10` | `NFLPropFeedItem` — i.e. **player id + game id** (consensus O/U pills or TD yes-price + implied %, L10 trend strip, hit rate, P-flag badge) |
| NFLPlayerHeadshot (official NFL photo, ESPN + initials fallback) | 3 | `Props/Components/NFLPropPlayerCard.swift` | row `headshot_url` → ESPN numeric-id URL → initials |
| **NFL market widget** (trend board) | 2 | `Props/Detail/NFLPropDetailView.swift` | `NFLPropMarket` (**player id + market key**) — `NFLPropTrendChart` (game log vs close line, week x-labels) + stat tiles (LAST/L3/L5/SZN/MATCHUP) + open→close line movement + flag chips |
| Collapsing hero + market segmented picker | 3 | `NFLPropDetailView.swift` | `NFLPlayerPropSelection` |

Data hierarchy: `nfl_dryrun_props` rows (one per player × market, headshot + trends
inline) ⨝ `nfl_dryrun_games` (gameday + slot) → `NFLPropPlayer` (player × game) →
`NFLPropMarket` (consensus close line/prices + game log + flags). Models/helpers in
`WagerproofKit/Sources/WagerproofModels/NFLPlayerProp.swift` (incl. `NFLTeams` identity
map); team logos/abbrs from the `nfl_teams` reference table via `NFLTeamAssets`
(`WagerproofModels/NFLTeamAssets.swift`, hydrated by `WagerproofServices/NFLTeamsService.swift`);
service `WagerproofServices/NFLPlayerPropsService.swift`. NFL gets the same L10 hit-rate
sort as MLB. No Dummy Data Mode branch — props always fetch live. Harness slugs
`nflPropsLoaded` / `nflPropDetail` seed from `PropsFixtures.nflBoard` (screenshot parity
only), or run live via `-uiScreenshotMode mainTabs -tab props -propsSport nfl`
(`-tab games -gamesSport nfl` for the games slate).

---

## 3. Outliers (Outliers tab) — `Features/Outliers/OutliersView.swift`

> **Current hub (`outliers-trends-ios`):** `OutliersView` mounts `OutliersTrendsView(store: OutliersTrendsStore)` —
> a **"Parlay God" rail** on top (`ParlayGodRail` / `ParlayGodCard` in `Outliers/Components/ParlayGodCard.swift`,
> Pro-gated perfect-streak parlays from the shell-hoisted `ParlayGodStore` — see `.claude/docs/16_parlay_god.md`;
> the same rail renders in Search's empty state and, props-only as "Props Cheats", atop the Props tab), then
> pinned filter pills (sport / subject / matchup) over per-market section carousels of **`OutliersTrendCard`**
> (`Outliers/Components/OutliersTrendCard.swift`, width 300), grouped by `OutliersTrendsMarketSection`. Each card is a
> **fixed-height compact preview** (`compactCardHeight`, `compactRowCap` = 3 single-line trend rows). Its footer previews
> the hidden rows' strengths as colored **% chips** (`● 80% ● 73% …`, tinted by `trendColor`, capped at `footerPreviewCap`
> with "+N") next to a "More ›" CTA — or just a "View breakdown ›" CTA when nothing is hidden. Tapping the card presents
> **`OutliersTrendDetailSheet`** (`Outliers/Components/OutliersTrendDetailSheet.swift`),
> which renders the same card `.expanded` (every betting line + trend row) — so the card never grows vertically in the
> rail. The Search "Outliers" rail reuses the identical card → same sheet. The rails/cards below are the prior
> (2026-06-11) design and are no longer mounted by `OutliersView`.

The hub branch is **three primitive-typed rails** (2026-06-11 redesign): Betting Trends,
First-5, and Player Props — each a horizontal rail of the strongest cards across the slate,
ranked by `OutlierSections` (`Outliers/OutlierSections.swift`) off the same Kit insight
adapters the game-sheet widgets use. The rails read the shared hoisted stores
(`MLBBettingTrendsStore` / `MLBF5SplitsStore` / `PropsStore`) from the environment, so the hub
surfaces the real matchup/widget/prop primitives. A card opens that primitive's detail surface
(trends/F5 sheet, or `PlayerPropDetailView`); the rail header's "See all" pushes
`OutlierSectionListView` (full ranked list). The old merged `OutlierGameTile` feed +
`OutlierMatchupDetailView` are no longer mounted (files retained, unused).

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **OutlierInsightCard** (trends/F5 rail thumbnail) | 1 | `Outliers/Components/OutlierInsightCard.swift:14` | resolved matchup + `InsightVerdictBadge` + verdict (built by `OutlierCardBuilder` in `OutlierSections.swift` from `MLBGameTrends` / `MLBF5Game`) |
| **OutlierPropCard** (props rail thumbnail) | 1 | `Outliers/Components/OutlierPropCard.swift:10` | `PlayerPropFeedItem` (standout L10 streak) → `PlayerPropDetailView` |
| OutlierSectionListView ("See all" list) | 2 | `Outliers/OutlierSectionListView.swift:9` | `OutlierSections.Kind` + ranked arrays |
| **OutlierMatchupCardView** (square Spotify-style card) | 1 | `Outliers/Components/OutlierMatchupCard.swift:15` | teams + sport + pick label/value (used by Top Agent Picks feed) |
| **OutlierAlertCard** (value/fade alert) | 1 | `Outliers/Components/OutlierAlertCard.swift:12` | `OutlierValueAlert` / `OutlierFadeAlert` |
| ToolExplainerBannerView | 3 | `Outliers/Components/ToolExplainerBanner.swift:8` | static copy + examples |
| OutliersHowToBanner / OutliersLearnMoreSheet | 3 | `Outliers/Components/` | static |
| OutlierGameTile / OutlierMatchupDetailView (retained, unused) | — | `Outliers/Components/OutlierGameTile.swift`, `Outliers/OutlierMatchupDetailView.swift` | `OutlierFeedItem` (former merged feed) |

---

## 4. Picks (Editor's Picks tab) — `Features/Picks/PicksView.swift`

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **EditorPickCard** (full pick card) | 1 | `Picks/Components/EditorPickCard.swift:10` | `EditorPick` + `EditorPickGameData` — i.e. **pick id** |
| **CompactPickCard** (pick line item) | 1 | `Picks/Components/CompactPickCard.swift:14` | `EditorPick` + `EditorPickGameData` |
| LockedPickCard (pro gate) | 3 | `Picks/Components/LockedPickCard.swift:11` | sport string |
| PickCardErrorBoundary | 3 | `Picks/Components/PickCardErrorBoundary.swift:20` | wraps a pick card |
| EditorPicksStatsBanner | 3 | `EditorPicks/Components/EditorPicksStatsBanner.swift:11` | callbacks |

Sheets: `PickDetailBottomSheet` (detail), `EditorPickCreatorBottomSheet` (admin form).

---

## 5. Scoreboard — `Features/Scoreboard/ScoreboardView.swift`

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **LiveScoreCard** (grid line item) | 1 | `Scoreboard/Components/LiveScoreCard.swift:15` | `LiveGame` (+ optional `GamePredictions`) |
| **LiveScorePredictionCard** (expanded card) | 1 | `Scoreboard/Components/LiveScorePredictionCard.swift:11` | `LiveGame` |
| LiveScoreCardShimmer | 3 | `Scoreboard/Components/LiveScoreCardShimmer.swift:11` | — |

Sheet: `LiveScoreDetailModal`.

---

## 6. Agents (Agents tab) — `Features/Agents/AgentsView.swift`

### List / hub

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **AgentRowCard** (agent line item) | 1 | `Agents/Components/AgentRowCard.swift:22` | `AgentWithPerformance` — i.e. **agent id** |
| AgentIdCard (grid variant) | 1 | `Agents/Components/AgentIdCard.swift:15` | `AgentWithPerformance` |
| **LeaderboardRow** | 1 | `Agents/Components/AgentLeaderboard.swift` | `AgentLeaderboardEntry` + rank |
| TopAgentPicksFeed (sectioned feed; reuses OutlierMatchupCardView) | 1 | `Agents/Components/TopAgentPicksFeed.swift:23` | feed store entries |
| CompanyDashboardBanner / PixelOffice / FloatingOfficeWidget | 3 | `Agents/Components/` | `[AgentWithPerformance]` |
| PixelSpriteAvatar / AgentFormChart / GlowingCardWrapper / GlowAccentBar / AgentColorPalette | 3 | `Agents/Components/` | sprite index / performance / color hex |

### Agent detail (`AgentDetailView.swift`, `PublicAgentDetailView.swift`)

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| **AgentPickCard** / **AgentPickItem** (pick line item) | 1 | `Agents/Components/AgentPickCard.swift:12`, `AgentPickItem.swift:12` | `AgentPick` — i.e. **agent pick id** |
| AgentGlassHero + AgentPixelWaveBackground + AgentStatStrip | 3 | `Agents/Components/AgentDetailHero.swift:35,20,177` | `Agent` + `AgentPerformance` + progress |
| AgentPerformanceCharts | 2 | `Agents/Components/AgentPerformanceCharts.swift:13` | `[AgentPick]` history |
| AgentTimeline | 2 | `Agents/Components/AgentTimeline.swift:10` | agent + picks + run summary |
| AgentPickPayloadAuditWidget (debug trace) | 2 | `Agents/Components/AgentPickPayloadAuditWidget.swift:13` | `AgentPick` + `AgentPickAuditPayload` |
| ThinkingAnimation / PrinterSlipAnimation | 3 | `Agents/Components/` | variant / picks |
| AgentHRBottomSheet | 2 | `Agents/Sheets/AgentHRBottomSheet.swift:14` | `[AgentWithPerformance]` |

---

## 7. Search (Search tab) — `Features/Search/SearchView.swift`

The consumer of this index. Current primitives:

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| SearchToolCard (explore grid card) | 3 | `Search/Components/SearchToolCards.swift:11` | title + subtitle + graphic + action |
| AngledStatSheetGraphic / StackedStatCardsGraphic / RadarSweepGraphic | 3 | `SearchToolCards.swift` | row/item pools, timing |
| TrendBarsGraphic (Trends card graphic) | 3 | `Search/Components/SearchToolCards.swift` | looping height frames |
| SearchResultRow (generic result line item) | 1 | `Search/Components/SearchResultRow.swift:19` | icon + tint + two lines + trailing |
| SearchMatchupCard + InsightChip (MLB game result w/ teaser chips) | 1 | `Search/Components/SearchMatchupCard.swift:11,124` | `SearchResult.Game` + `[InsightTeaser]` |
| OutliersTrendCardShimmer | 3 | `SearchView.swift` | — (mirrors `OutliersTrendCard` for the loading rail) |

The **Explore** rail runs four `SearchToolCard`s. Props / Agents / Outliers switch the browse
scope; **Trends** instead opens a bottom-sheet sport picker (`trendsDrawer`, 260pt detent) holding
the real Games-page `ToolBannerCard` banners for NFL and MLB — gradient + `OptionCardIconChrome`
drifting symbols, read from `SportTool.tool(id:)` so the drawer and the Games page never drift
apart. Add CFB by extending `SearchView.trendsDrawerTools`. Because the sport gradients live in the
drawer, the Trends card itself stays in the rail's neutral token language (`TrendBarsGraphic`).
Picking a banner sets `pendingTrendsSport` and closes the sheet; the sheet's `onDismiss` then sets
`trendsDestination`, which pushes `HistoricalAnalysisView` — pushing while the sheet is still up
would land the destination behind it.

Section headers (both empty-state `Explore`/`Recent`/`Suggestions` and active-search
`Matchup`/`Props`/`Agents`/`Outliers`) use the shared `sectionHeader(title, icon:, count:)` —
icon + title share the `.secondary` label color. Recent searches render as an edge-to-edge chip
rail. **Loading scaffolding**: a card-shaped `searchLoadingScaffold` (a `GameCardShimmer` + the
`outliersShimmerRail`) shows during the debounce window; the **Outliers** section swaps in
`outliersShimmerRail` (4 × `OutliersTrendCardShimmer`) whenever `OutliersTrendsStore.isLoadingSearchIndex`
is true and no trend results are in yet — the one section that loads over the network.

**Every result renders its parent feed's exact card** (not a generic row): **Matchup** →
per-sport `NFLGameCard` / `CFBGameCard` / `NBAGameCard` / `NCAABGameCard` / `MLBGameCard`
(resolved from the bound `GamesStore` by `resolvedId`, tap = game-sheet handoff); **Props** →
`PropPlayerCard` / `NFLPropPlayerCard`; **Agents** → `AgentRowCard` (own agents use the real
`AgentWithPerformance`; public/leaderboard agents adapt via `AgentWithPerformance(leaderboard:)`,
which lacks personality so strategy chips are absent); **Outliers** → `OutliersTrendCard`. The
result structs (`SearchResult.Game/Agent/Trend`) carry the full underlying model so the view can
reconstruct each card. `SearchResultRow` / `SearchMatchupCard` are now only used by the empty-state
+ skeletons (and the dormant MLB insight-chip path).

Result scopes / sections are **Matchup** (`gameResults`), **Props** (`playerResults`),
**Agents** (`agentResults`), and **Outliers** (`trendResults`). The Outliers section searches
`OutliersTrendsStore.searchIndex` — a **cross-sport** index of `OutliersTrendsSearchEntry`
(card + sport + game, NFL + NCAAF + MLB) loaded once + cached via `loadSearchIndexIfNeeded()`,
independent of the Outliers tab's active sport. The store is shell-hoisted in `MainTabView`
(shared with the Outliers tab) and the index hydrates lazily on the first search query.
`SearchStore.bind(games:agents:trends:props:)` wires the upstream stores. The legacy value/fade
"Alerts" and "Live" scores scopes were removed (their `OutliersStore` / `LiveScoresStore` were
never injected into the shell).

---

## 7b. Matchup insight widgets (game detail sheets) — `Features/GameWidgets/`

One unified digest pattern for the three per-matchup insight datasets (situational trends,
player props, F5 splits): verdict line → ranked signal rows → expand footer, inside
`WidgetCollapsingSection` with a `.verdict` header accessory. Summary math lives in Kit
(`MatchupInsightCore.swift`, `TrendsInsight.swift`, `PropsInsight.swift`, `F5Insight.swift`)
so SearchStore teasers and the widgets share one source of truth.

| Primitive | Tier | File | Renders from |
|---|---|---|---|
| InsightWidgetSection (shell) | 3 | `GameWidgets/InsightWidgetPrimitives.swift:13` | title/icon/badge/expand + content |
| InsightVerdictLine | 3 | `InsightWidgetPrimitives.swift:41` | `[InsightVerdict]` + accent |
| SignalSplitBar (two-sided tug bar) | 3 | `InsightWidgetPrimitives.swift:107` | away/home values + numerals + tints |
| InsightSignalRow | 3 | `InsightWidgetPrimitives.swift:204` | title + badge + bar (+ amber subtext) |
| MiniHitStrip (L10 dots) | 3 | `InsightWidgetPrimitives.swift:250` | `[(cleared, value)]` |
| InsightExpandFooter / InsightWidgetSkeleton | 3 | `InsightWidgetPrimitives.swift:277,308` | label/action · rowCount |
| BettingTrendsInsightWidget | 2 | `Outliers/Components/BettingTrendsInsightWidget.swift:11` | `TrendsInsightSummary` |
| MLBMatchupPropsWidget + PropSignalRow | 2 | `MLB/Components/MLBMatchupPropsWidget.swift:12` | `PropsInsightSummary` via PropsStore |
| F5SplitsInsightWidget | 2 | `MLB/Components/F5SplitsInsightWidget.swift:10` | `F5InsightSummary` |
| MatchupPropsDetailSheet + MatchupPropsListBody | 2 | `MLB/Components/MatchupPropsDetailSheet.swift` | `MLBPropMatchup` |
| F5SplitsDetailSheet | 2 | `MLB/Components/F5SplitsDetailSheet.swift` | `MLBF5Matchup` |

Retired in the same change: the standalone tool list views (`MLBBettingTrendsView`,
`NBABettingTrendsView`, `NCAABBettingTrendsView`, `MLBPitcherMatchupsView`, `MLBF5SplitsView`),
the legacy `GameCards/Components/BettingTrendsWidget`, `TrendsMatrixView`'s `.compact` style,
and the `mlbTrends` / `nbaTrends` / `ncaabTrends` / `mlbF5Splits` / `mlbPitcherMatchups` tool
categories. `TrendsMatrixView` (card style), the `*TrendsMatrixAdapter`s, and
`BettingTrendsDetailSheet` survive as the expand surfaces.

---

## 8. WagerBot Chat — `Features/Chat/WagerBotChatView.swift`

Chat already defines a **compact, cross-surface component vocabulary** — the closest thing to a
canonical "primitive schema" in the app. `WagerBotAppComponentsView`
(`Chat/WagerBotAppComponentsView.swift:12`) dispatches 14 typed components, each a compact
mirror of a real app surface, each tappable with a `WagerBotChatNav` cross-tab callback:

| `appComponents` type | Mirrors | Minimal data key |
|---|---|---|
| `game` / `value` | GameRowCard / game detail | sport + game id |
| `prop` | PropPlayerCard | player id + market |
| `agent` | AgentRowCard | agent id |
| `agent_pick` | AgentPickItem | agent pick id |
| `editor_pick` | CompactPickCard | editor pick id |
| `tool` | ToolBannerCard | tool category |
| `model_projection` | Match Simulator / projection cards | game id |
| `polymarket` | PolymarketWidget | league + teams |
| `betting_trends` | BettingTrendsInsightWidget (game-sheet trends digest) | game id |
| `model_accuracy` | ModelAccuracyWidget | sport (+ game id) |
| `injury` | NBAInjuryReportWidget | game id |
| `weather` | WeatherDisplay / MLB weather card | game id |
| `public_betting` | PublicBettingBars | game id |
| *(unknown)* | forward-compatible fallback | title + analysis |

Other chat primitives: `WagerBotChatBubble` (`WagerBotChatBubble.swift:24`),
`WagerBotActionPreview` (widget block renderer, `WagerBotActionPreview.swift:16`),
`WagerBotSuggestedGamesCarousel` (`WagerBotSuggestedGamesCarousel.swift:15`),
`WagerBotToolCallsPill` + `WagerBotToolUseChip`, `WagerBotGameReferencesPill`,
`WagerBotThinkingIndicator`, `WagerBotUiTokens`, `ChatTeamLogo` / `ChatMatchupLogos`
(private, `WagerBotAppComponentsView.swift:222,269`).

---

## 9. Other surfaces (smaller)

| Surface | Entry | Notable primitives |
|---|---|---|
| Learn More | `LearnMore/LearnWagerProofView.swift` | LearnSlide, ComingSoonBanner, SlideProgressIndicator |
| Feature Requests | `FeatureRequests/FeatureRequestsView.swift` | FeatureRequestRow (`Components/FeatureRequestRow.swift`) |
| Roast (The Bookie) | `Roast/RoastView.swift` | RoastMessageBubble, RoastMicButtonView, BookieOrbView, RoastIntensitySelectorView |
| Navigation chrome | `Navigation/MainTabView.swift` | FloatingAssistantBubble, OfflineBanner |
| Settings | `Settings/SettingsView.swift` | IosWidgetView (home-screen widget walkthrough) |
| Voice | `Features/Voice/` | (empty at last scan — voice lives in Chat flow) |

---

## 10. Design system (WagerproofKit → `WagerproofDesign`)

Location: `wagerproof-ios-native/WagerproofKit/Sources/WagerproofDesign/`. Tier 3 — use these to
build any new primitive:

- **HoneydewOptionCard** (`Components/HoneydewOptionCard.swift`) + OptionCardIconChrome — the
  gradient tool-banner card with drifting symbols (basis of ToolBannerCard, OutliersHowToBanner).
- **Liquid Glass**: LiquidGlassBackground / LiquidGlassCapsule / LiquidGlassDisc
  (`Modifiers/`) — iOS 26 glass with material fallback; the disc merge-container clusters team
  avatars.
- **Shimmer system** (`Modifiers/Shimmer.swift`): `.shimmering()` + SkeletonBlock / SkeletonCircle /
  SkeletonCapsule — every list skeleton is built from these to mirror its parent card.
- **StaggeredAppear** (`Modifiers/StaggeredAppear.swift`): `.staggeredAppear(index:)` cascade-in
  for any list.
- **Motion vocabulary** (`Animations.swift`): appQuick / appStandard / appBouncy / appCarousel /
  appSlow / appLinear / appShimmer + standard transitions.
- Misc: ContinueCTAButton, OnboardingPageShell, OnboardingProgressBar, ScopeBanner,
  WagerBotIcon, LottieView, OfflineToolbarIcon.

Shared in-app (not in Kit yet): GameCardTeamAvatar, SportTeamColors, GameCardFormatting
(`GameCards/Components/`), TeamAuraBackground (aura glow used by game/prop detail heroes; the
agent detail heroes use the pixelwave `PixelWaveBackground` / `AgentPixelWaveBackground` instead).

Easter egg — avatar ripple: `PixelGlyphField` accepts an optional `GlyphRippleEmitter`
(`@Observable`, in `PixelGlyphField.swift`) so a foreground view can inject a tap-ripple. On
`AgentDetailView`, tapping the `AgentGlassHero` avatar disc reports its global center
(`onAvatarTap`) and the view calls `emitter.emit(at:)` (+ light haptic) — the screen-anchored
pixelwave field draws at global (0,0), so the global point maps 1:1 and the ripple blooms from
the avatar through the background pixels.

---

## 11. Search-surfacing shortlist (Tier-1 entities + data keys)

The entity types a search index needs, with the primitive to render and the key to fetch:

| Entity | Render with | Key | Home surface |
|---|---|---|---|
| Game (upcoming) | GameRowCard or chat `game` component | sport + game id | Games tab → sport carousel |
| Game facet (weather, injuries, public betting, polymarket, projection, trends, accuracy) | chat `appComponents` equivalent | game id + facet | game detail sheet widget (no scroll-to-widget anchor yet — deferred from the insight-widget pass) |
| Player prop (MLB) | PropPlayerCard or chat `prop` component (also a Search Players result) | player id (+ market) | Props tab → PlayerPropDetailView |
| Player prop (NFL) | NFLPropPlayerCard | player id + event id | Props tab (NFL) → NFLPropDetailView |
| Prop market | Market widget (MLB) / NFL market widget (book board) | player id + market key | prop detail (market picker) |
| Agent | AgentRowCard or chat `agent` component | agent id | Agents tab → AgentDetailView |
| Agent pick | AgentPickItem or chat `agent_pick` | agent pick id | agent detail picks list |
| Editor pick | CompactPickCard or chat `editor_pick` | editor pick id | Picks tab → PickDetailBottomSheet |
| Outlier trend | OutliersTrendCard (also a Search Outliers result via `trendResults`) | card id (subject + market + game) | tap → `OutliersTrendDetailSheet` bottom sheet (full card; same sheet from Outliers carousel + Search rail) |
| Live game | LiveScoreCard | live game id | Scoreboard |
| Tool | ToolBannerCard or chat `tool` | tool category (ToolRouter; survivors: mlbRegression, nbaAccuracy, ncaabAccuracy) | Games tab banners / Outliers hub |
| Game trends matrix (MLB/NBA/NCAAB) | BettingTrendsInsightWidget (digest) → BettingTrendsDetailSheet (via sport adapter) | sport + game id | game detail sheet widget → expand sheet |
| Regression-report pick (Perfect Storm) | PerfectStormPickCard | MLB game pk + pick | MLB Regression Report / MLB game sheet |
| F5 splits matchup | F5SplitsInsightWidget (digest) → F5SplitsDetailSheet (full F5GameCardView) | MLB game pk | MLB game detail sheet widget → expand sheet |

**Maintenance:** when you add a new list-row card, detail widget, or chat appComponent type,
add it here in the same commit (per the docs rule in `.claude/CLAUDE.md`).
