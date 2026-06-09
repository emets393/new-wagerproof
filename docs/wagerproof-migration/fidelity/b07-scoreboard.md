# Fidelity table — B07 Scoreboard tab + live scores

Source: `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx` (449 lines) + `LiveScoreCard.tsx`, `LiveScoreCardShimmer.tsx`, `LiveScorePredictionCard.tsx`, `LiveScoreDetailModal.tsx`, `services/liveScoresService.ts`, `hooks/useLiveScores.ts`, `types/liveScores.ts`.

Target: `wagerproof_ios_native/Wagerproof/Features/Scoreboard/*` + `WagerproofKit/Sources/WagerproofModels/LiveScore.swift` + `WagerproofKit/Sources/WagerproofServices/LiveScoresService.swift` + `WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift`.

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `View` container (scoreboard.tsx:120) | `NavigationStack { ScrollView { … } }` in `ScoreboardView` | ✅ matches |
| `Animated.View` collapsing header (scoreboard.tsx:122–161) | iOS-native `NavigationStack` large title + system collapsing on scroll | 🔧 fixed — RN hand-rolled the blur+translate; SwiftUI gives this for free via large nav title |
| `Animated.ScrollView` with `bounces=false` (scoreboard.tsx:164) | `ScrollView` (default bounce — HIG-correct) | 🔧 fixed — iOS bounces by default; suppressing it is the RN tic, not the Apple one |
| Page header VStack with title + subtitle + expand button (scoreboard.tsx:187–211) | Toolbar trailing `Button` for expand/compact + subtitle row inline | 🔧 fixed — nav-bar large title replaces the hand-rolled "Live Scoreboard" headline; subtitle moves to a row below |
| Loading shimmer grid (scoreboard.tsx:213–228) | `LazyVGrid` of 8 `LiveScoreCardShimmer` | ✅ matches |
| Empty state `<NoGamesTerminal>` (scoreboard.tsx:231) | `ContentUnavailableView("No live games right now", …)` | ⚠️ #007 |
| League sections w/ headers + grid/list (scoreboard.tsx:234–280) | `LazyVStack(pinnedViews: [.sectionHeaders])` with sticky `leagueHeader` per section, `LazyVGrid(columns: 2)` compact / `LazyVStack` expanded | ✅ matches |
| Modal overlay `<LiveScoreDetailModal>` (scoreboard.tsx:285) | `.sheet(item: $selectedGame)` presenting `LiveScoreDetailModal` | 🔧 fixed — native sheet with detents + drag indicator |
| LiveScoreCard layout (LiveScoreCard.tsx) | `Features/Scoreboard/Components/LiveScoreCard.swift` | ✅ matches |
| LiveScoreCardShimmer (LiveScoreCardShimmer.tsx) | `LiveScoreCardShimmer.swift` | ✅ matches |
| LiveScorePredictionCard layout (LiveScorePredictionCard.tsx) | `LiveScorePredictionCard.swift` | ✅ matches |
| LiveScoreDetailModal layout (LiveScoreDetailModal.tsx) | `LiveScoreDetailModal.swift` | ✅ matches |
| Team gradient circle (LiveScorePredictionCard.tsx:51–75) | `TeamCircleView` with brand-green gradient fallback | ⚠️ #008 |

## Tokens

| RN value | Swift token | Match |
|---|---|---|
| Hit color `#22D35F` (LiveScoreCard.tsx:88) | `Color(hex: 0x22D35F)` | ✅ matches |
| Miss color `#EF4444` (LiveScoreCard.tsx:93) | `Color(hex: 0xEF4444)` | ✅ matches |
| Hit bg `rgba(34,211,95,0.1)` (LiveScoreDetailModal.tsx:104) | `Color(hex: 0x22D35F, opacity: 0.1)` | ✅ matches |
| Miss bg `rgba(239,68,68,0.1)` (LiveScoreDetailModal.tsx:104) | `Color(hex: 0xEF4444, opacity: 0.1)` | ✅ matches |
| Hit border `rgba(34,211,95,0.3)` | `Color(hex: 0x22D35F, opacity: 0.3)` | ✅ matches |
| Miss border `rgba(239,68,68,0.3)` | `Color(hex: 0xEF4444, opacity: 0.3)` | ✅ matches |
| Card border-radius 8 (LiveScoreCard.tsx:225) | `RoundedRectangle(cornerRadius: 8)` | ✅ matches |
| Modal border-radius 20 top corners (LiveScoreDetailModal.tsx:275) | Native sheet rounded corners (system default ≈ 16; iOS HIG) | 🔧 fixed — system sheet shape replaces hand-rolled corners |
| Team abbr font 11pt 700 weight (LiveScoreCard.tsx:251) | `.font(.system(size: 11, weight: .bold))` | ✅ matches |
| Score font 14pt 700 + tabular-nums (LiveScoreCard.tsx:255) | `.font(.system(size: 14, weight: .bold)).monospacedDigit()` | ✅ matches |
| Prediction font 10pt 600 (LiveScoreCard.tsx:271) | `.font(.system(size: 10, weight: .semibold))` | ✅ matches |
| League title 18pt bold (scoreboard.tsx:411) | `.font(.system(size: 18, weight: .bold))` | ✅ matches |
| Badge font 11pt 600 (scoreboard.tsx:425) | `.font(.system(size: 11, weight: .semibold))` | ✅ matches |
| Indicator dot 8×8 (LiveScoreCard.tsx:240) | `Circle().frame(width: 8, height: 8)` | ✅ matches |
| Pulse shadow opacity 0.4→0.9 (LiveScoreCard.tsx:74) | shadow modulated 0.4→0.9 in `LiveScoreCard.swift` | ✅ matches |
| Pulse shadow radius 6→14 (LiveScoreCard.tsx:79) | shadow radius 6→14 | ✅ matches |
| Border width 1 vs 1.5 (hitting) (LiveScoreCard.tsx:88) | conditional `borderWidth: 1.5 / 1` | ✅ matches |

## Gestures

| RN handler | Swift wiring | Match |
|---|---|---|
| `Pressable onPress` on compact card → `handleGamePress` (scoreboard.tsx:273) | `Button { onPress?() }` on `LiveScoreCard` sets `selectedGame` | ✅ matches |
| `RefreshControl onRefresh` (scoreboard.tsx:178) | `.refreshable { await store.refresh() }` | ✅ matches |
| Expand/compact toggle `Button onPress` (scoreboard.tsx:199) | Toolbar `Button` toggles `isExpanded` | ✅ matches |
| Modal `TouchableOpacity backdrop` → `onClose` (LiveScoreDetailModal.tsx:151) | Native `.sheet` drag-to-dismiss + close button | 🔧 fixed — native sheet ergonomics replace hand-rolled backdrop tap |
| Modal "View Full Scoreboard" button (LiveScoreDetailModal.tsx:248) | Footer `Button` calls `onViewFullScoreboard` then `dismiss()` | ✅ matches |
| `useEffect onPageChange('scoreboard')` for WagerBot (scoreboard.tsx:51) | Not yet wired — store will broadcast via shared `WagerBotSuggestionStore` | ⚠️ #009 — deferred until B17 (Chat) ports `WagerBotSuggestionStore`; see `tickets/009-wagerbot-page-change-binding.md` |

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| `router.push('/(drawer)/settings')` from settings cog (scoreboard.tsx:139) | Replaced by side menu sheet at `MainTabView` level (B03 owns the cog button) | 🔧 fixed — header cog removed from scoreboard; lives on the tab shell |
| Tab visibility | Native `TabView` selection includes scoreboard tag in `MainTabView` (B03) | ✅ matches |
| Modal open/close | `.sheet(item: $selectedGame)` | ✅ matches |
| Manual menu open via floating bubble (scoreboard.tsx:153) | Lives on `MainTabView`'s overlay; ScoreboardView doesn't own it | ✅ matches (responsibility moved to the tab shell) |

## Analytics

No analytics events are fired from the scoreboard screen in RN (verified via grep on `mixpanel`/`logEvent` within scoreboard.tsx and LiveScore* components). Nothing to port. ✅ matches.

## State reads/writes

| RN call | Swift counterpart | Match |
|---|---|---|
| `useLiveScores()` hook → `{games, hasLiveGames, isLoading, refetch}` | `LiveScoresStore.{games, hasLiveGames, isLoading, refresh()}` | ✅ matches |
| `useAuth()` user check for chat button (scoreboard.tsx:37) | Header cog/chat buttons live on tab shell; scoreboard no longer needs auth | 🔧 fixed |
| `useThemeContext().isDark` (scoreboard.tsx:38) | Native dark mode via `Color(light:dark:)` in design tokens | 🔧 fixed |
| `useScroll()` for headerTranslate (scoreboard.tsx:39) | Replaced by native large-title collapse | 🔧 fixed |
| `useWagerBotSuggestion().setScoreboardData(games)` (scoreboard.tsx:48) | Not yet wired — pending B17 | ⚠️ #010 — deferred to B17; see `tickets/010-scoreboard-wagerbot-sync.md` |
| `useState<LiveGame[]>` for games | `@Observable LiveScoresStore` holds `games` | ✅ matches |
| `useState selectedGame` | `@State var selectedGame: LiveGame?` | ✅ matches |
| `useState isExpanded` | `@State var isExpanded: Bool` | ✅ matches |
| `useState refreshing` | Built into `.refreshable` — no manual state needed | 🔧 fixed |
| `supabase.from('live_scores').select().eq('is_live', true).order(...)` (liveScoresService.ts:587) | `LiveScoresService.fetchLiveScores()` uses same chain | ✅ matches |
| `collegeFootballSupabase.from('nfl_predictions_epa').select('run_id')…` (liveScoresService.ts:226) | `LiveScoresService.fetchNFLPredictions()` mirrors the exact query | ✅ matches |
| `collegeFootballSupabase.from('nfl_betting_lines').select(…)` | Same | ✅ matches |
| `collegeFootballSupabase.from('cfb_live_weekly_inputs').select()` | Same | ✅ matches |
| `collegeFootballSupabase.from('cfb_api_predictions').select()` | Same | ✅ matches |
| `collegeFootballSupabase.from('nba_predictions').select(…).order('as_of_ts_utc')` | Same | ✅ matches |
| `collegeFootballSupabase.from('nba_input_values_view').select(…)` | Same | ✅ matches |
| `collegeFootballSupabase.from('ncaab_predictions').select(…)` | Same | ✅ matches |

## Async actions

| RN action | Swift counterpart | Match |
|---|---|---|
| Initial fetch on hook mount (useLiveScores.ts:31) | `LiveScoresStore.start()` fires immediate refresh in `.task` modifier | ✅ matches |
| `setInterval(fetchGames, 2 * 60 * 1000)` poll (useLiveScores.ts:34) | `LiveScoresStore.start()` runs a 120s loop using `Task.sleep` | ✅ matches |
| `useNetworkState` gating fetches (useLiveScores.ts:11) | Not yet wired — `OfflineBanner` covers UI; offline retries pause naturally | ⚠️ #011 — deferred to B22 hardening; `URLSession` retries are cheap so no UX impact. See `tickets/011-livescores-network-gating.md` |
| `Promise.all([nflPreds, cfbPreds, nbaPreds, ncaabPreds])` (liveScoresService.ts:484) | `async let nfl/cfb/nba/ncaab` fan-out concurrent fetches | ✅ matches |
| `calculatePredictionStatus` ML/spread/OU math (liveScoresService.ts:67) | `LiveScoresService.computePredictions(game:prediction:)` — direct port | ✅ matches |
| `gamesMatch` fuzzy team-name match (utils/teamMatching) | `gamesMatch(_:_:_:)` in `LiveScoresService` reimplements the loose-match heuristic | ✅ matches |
| NBA/NCAAB numeric `game_id` extraction (liveScoresService.ts:529) | `matchNBA(game:predictions:)` and `matchNCAAB(…)` strip prefix + try numeric match, fall back to name | ✅ matches |

## Empty / loading / error states

| State | RN trigger | Swift trigger | Match |
|---|---|---|---|
| Loading (no cached games) | `isLoading && !hasLiveGames` (scoreboard.tsx:213) | `store.isLoading && !store.hasLiveGames` (ScoreboardView.swift) | ✅ matches |
| Loading copy | "Simulate League Header" + 8 shimmer cards | 8 shimmer cards in `LazyVGrid` + header skeleton bar | ✅ matches |
| Empty (no games) | `<NoGamesTerminal context="scoreboard" />` | `ContentUnavailableView("No live games right now", systemImage: "sportscourt.fill", description: …)` | ⚠️ #007 |
| Empty copy | Terminal-themed ASCII art | "No live games right now" / "Check back during gameday for live scores, predictions, and hitting badges." | ⚠️ #007 |
| Error | RN swallows errors silently (`setError` then stale games stay) | Inline banner with retry button when `lastError != nil && !hasLiveGames` | 🔧 fixed — RN's silent-fail behaviour was a bug; iOS shows a recoverable banner |
| Error copy | (RN has no UI for this — error stored but not shown) | "Couldn't load live games" + `error.localizedDescription` + Retry button | 🔧 fixed |

## Edge cases preserved

- League ordering NFL→NCAAF→NBA→NCAAB→NHL→MLB→MLS→EPL, unknowns → 999. ✅ matches (`LiveScoresStore.leagueOrder`)
- `CFB` aliases to `NCAAF` (treated as same league). ✅ matches
- Hitting badge only when `predictions.hasAnyHitting === true`. ✅ matches (`leagueHeader` reads `predictions?.hasAnyHitting`)
- Grid is 50% per card in compact, 100% in expanded. ✅ matches (`LazyVGrid` 2-col vs `LazyVStack`)
- Game-id numeric extraction with `NBA-`/`NCAAB-` prefix. ✅ matches
- Predictions display formats:
  - Spread sign-flip when picked Away (`getSpreadDisplay`). ✅ matches
  - O/U prefix "O" or "U" + numeric line. ✅ matches
  - Probability rendered as integer percent + " Conf." suffix. ✅ matches
- "View Full Scoreboard" button toggles expanded + dismisses modal. ✅ matches

## Diff summary (every 🔧/⚠️/❌ row)

- 🔧 Collapsing header → native `NavigationStack` large title.
- 🔧 ScrollView `bounces=false` → default native bounce (HIG-correct).
- 🔧 RN page header layout → toolbar + subtitle row.
- 🔧 Modal `Modal` overlay → native `.sheet(item:)` with detents + drag indicator.
- 🔧 RN's silent error swallowing → recoverable error banner with retry.
- 🔧 Header cog (settings) and chat button moved to tab shell (B03 owns them).
- 🔧 `useNetworkState` removed for now (banner covers UI cue; URLSession retries are cheap). Deferred ticket if it becomes a real issue.
- ⚠️ #007 — NoGamesTerminal placeholder swapped for `ContentUnavailableView` (terminal port lands in B18).
- ⚠️ #008 — TeamCircleView uses brand-green gradient instead of per-team colors (`teamColors.ts` ports with sport-specific batches B09–B12).
- ⚠️ #009 — `onPageChange('scoreboard')` for WagerBot suggestion store — deferred to B17 when `WagerBotSuggestionStore` ports.
- ⚠️ #010 — `setScoreboardData(games)` for WagerBot suggestion store — deferred to B17 when `WagerBotSuggestionStore` ports.
- ⚠️ #011 — `useNetworkState` gating on polling — deferred to B22 hardening pass.

## Build / parity proof

- Build: `xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build` → **BUILD SUCCEEDED** (no warnings, no errors)
- Parity screenshots:
  - `docs/wagerproof-migration/parity/scoreboard/empty.png`
  - `docs/wagerproof-migration/parity/scoreboard/loaded.png`
  - `docs/wagerproof-migration/parity/scoreboard/error.png`
- Capture method: temporarily extended the existing `ScreenshotHarness` (DEBUG-only, file already in repo) with three new targets (`scoreboardEmpty`/`scoreboardLoaded`/`scoreboardError`) backed by `ScoreboardFixtures.swift` (also DEBUG-only). No production code path was modified to capture screenshots.

## Tap-target audit

- LiveScoreCard tap surface ≈ 175 × 50 pt (compact, 2-col grid on iPhone 16 Pro 393pt screen with 16pt outer padding + 4pt grid gap). Well above 44×44 HIG minimum.
- Expand toggle (toolbar): system-toolbar button, native 44pt hit zone.
- Sheet close (toolbar): system-toolbar button, native 44pt hit zone.
- Footer "View Full Scoreboard" button: full-width 14pt vertical padding → ≈ 343 × 50 pt.
