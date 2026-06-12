# Phase 2 implementer batches

22 parallelizable batches. Each batch is the smallest unit of work an implementer agent can execute end-to-end (RN → Swift port + parity screenshots + fidelity table + waivers + inventory flip).

> **Reading order for orchestrators**
> Run batches in `predecessors`-respecting order. Batches with no predecessors can run in parallel. The hard limit per the [REBUILD_PLAN](./REBUILD_PLAN.md#agent-fleet) is ≤ 2 implementer agents per feature directory at once.

## Batch index

| ID | Title | Predecessors | Phase | Scope (RN files) | Reference Honeydew screen |
|---|---|---|---|---|---|
| B01 | Auth foundation | — | 1 | 5 | LoginView |
| B02 | Onboarding wizard | B01 | 1 | 1 + 6 step components | OnboardingHardPaywallView |
| B03 | Tab shell + side menu + drawer | B01 | 1 | 5 | MainTabView |
| B04 | Games tab + NFL/CFB game cards & sheet | B03 | 1 | 7 | MainAllRecipesView |
| B05 | Picks tab (Editor's Picks) | B03 | 2 | 9 | MainFoldersView |
| B06 | Outliers tab | B03 | 2 | 6 | MainFeedsView |
| B07 | Scoreboard tab + live scores | B03 | 2 | 5 | MainMealPlanView |
| B08 | Settings tab + modals + RevenueCat paywall | B03 | 2 | 11 | SettingsView + UpgradeSettingsView |
| B09 | Feature Requests tab + Discord modal | B03 | 2 | 2 | (no direct Honeydew analogue) |
| B10 | NBA game card + sheet + trends sheet | B04 | 3 | 7 | RecipeDetailView |
| B11 | NCAAB game card + sheet + trends sheet | B04 | 3 | 7 | RecipeDetailView |
| B12 | MLB game card + sheet + trends sheet + regression banner | B04 | 3 | 9 | RecipeDetailView |
| B13 | Agents tab + agent card + leaderboard + ID card | B03 | 4 | 11 | MainAllRecipesView |
| B14 | Agent creation wizard (Screens 1-6) + inputs | B13 | 4 | 13 | OnboardingHardPaywallView (multi-step) |
| B15 | Agent detail + settings + public detail + HR sheet | B13 | 4 | 8 | RecipeDetailView |
| B16 | Top agent picks feed + leaderboard widget + dashboard | B13 | 4 | 4 | MainFeedsView |
| B17 | WagerBot chat (text + suggestion bubble + bottom sheet) | B03 | 5 | 11 | StreamingAssistantView |
| B18 | WagerBot voice + voice settings sheet + audio-route module | B03 | 5 | 5 | RoastChefView |
| B19 | Roast tab | B03 | 5 | 4 | RoastChefView |
| B20 | Analytics tab screens (6 dashboards) | B10, B11, B12 | 6 | 6 + banners + widgets | (custom) |
| B21 | LearnMore + ToolExplainer + Pro gating | B03 | 7 | 6 | LearnAndDiscoverView |
| B22 | Hardening + assets + chrome polish + dev tools | All B01–B21 | 8 | rest | — |

Total RN file coverage: 374 files spread across 22 batches. The "scope (RN files)" column counts only the *primary* files per batch — sub-components and hooks travel with the batch they're consumed by.

---

## Batch briefs

Each brief is the prompt-ready scope for the implementer agent. The agent receives:

1. This batch brief (verbatim).
2. The full [REBUILD_PLAN.md](./REBUILD_PLAN.md).
3. The relevant section of [08-screen-native-spec.md](./08-screen-native-spec.md).
4. A pointer to the Honeydew screens to mirror stylistically.
5. The path to [navigation-map.md](./navigation-map.md) and [inventory.csv](./inventory.csv).

### B01 — Auth foundation

**RN files:**
- `app/(auth)/_layout.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/email-login.tsx`
- `app/(auth)/signup.tsx`
- `app/(auth)/forgot-password.tsx`
- `contexts/AuthContext.tsx` (stores → `AuthStore`)

**Swift targets:**
- `Features/Auth/AuthRouter.swift` (NavigationStack root)
- `Features/Auth/LoginView.swift`
- `Features/Auth/EmailLoginView.swift`
- `Features/Auth/SignupView.swift`
- `Features/Auth/ForgotPasswordView.swift`
- `Features/Auth/Components/SocialSignInButton.swift`
- `Features/Auth/Components/OnboardingSlide.swift` (the auto-rotating carousel slide)
- Extend `WagerproofStores/AuthStore.swift` with `signInWithGoogle()` (GoogleSignIn wrapper) + `signInWithApple(result:)` (AppleSignIn callback handler).

**Honeydew reference:** `Honeydew/Features/Auth/LoginView.swift`, `CreateAccountView.swift`. Mirror `SignInWithAppleButton` + the social-auth button stacking.

**Acceptance:** A new tester can sign in with email/password (and Google/Apple if the dev team is wired), land on the splash, and the splash transitions to the placeholder MainTabView via `RootRouter.phase = .ready`.

### B02 — Onboarding wizard

**RN files:**
- `app/(onboarding)/_layout.tsx`
- `app/(onboarding)/index.tsx`
- `contexts/OnboardingContext.tsx`
- `components/OnboardingGuard.tsx` (becomes part of `RootRouter`)
- `components/onboarding/*.tsx` (all onboarding-specific subcomponents)
- `components/PostOnboardingPaywall.tsx`

**Swift targets:**
- `Features/Onboarding/OnboardingView.swift`
- `Features/Onboarding/OnboardingStep.swift` (enum)
- `Features/Onboarding/Components/*.swift` (one Swift file per RN component)
- Reuse `WagerproofStores/OnboardingStore.swift`.

**Honeydew reference:** `Honeydew/Features/Onboarding/OnboardingHardPaywallView.swift` + `OnboardingStepView`. Use `TabView(selection:).tabViewStyle(.page)` for the step carousel.

**Acceptance:** New user signs in → onboarding wizard plays → markComplete fires → RootRouter resolves to `.ready`.

### B03 — Tab shell + side menu

**RN files:**
- `app/_layout.tsx` (root providers — already largely scaffolded; this batch refines)
- `app/(drawer)/_layout.tsx` (drawer host)
- `app/(drawer)/(tabs)/_layout.tsx` (tab bar + floating WagerBot button)
- `components/SideMenu.tsx`
- `components/navigation/*.tsx`
- `components/FloatingAssistantBubble.tsx`

**Swift targets:**
- `Features/Navigation/MainTabView.swift` (`TabView` with 4-5 visible tabs: Games, Picks, Outliers, Scoreboard, Settings)
- `Features/Navigation/SideMenuSheet.swift` (`.sheet` triggered from the toolbar hamburger button)
- `Features/Navigation/FloatingAssistantBubble.swift` (overlay on every tab root)
- Wire `RootRouter.handle(deepLink:)` to drive `MainTabView` selection.

**Honeydew reference:** `Honeydew/Features/MainTabView.swift`.

**Acceptance:** Each tab renders the corresponding placeholder feature view. Deep links `wagerproof://picks` etc. route to the right tab.

### B04 — Games tab + NFL & CFB game cards/sheets

**RN files:**
- `app/(drawer)/(tabs)/index.tsx` (1,749 lines — central hub)
- `components/NFLGameCard.tsx`
- `components/NFLGameBottomSheet.tsx`
- `components/CFBGameCard.tsx`
- `components/CFBGameBottomSheet.tsx`
- `components/CFBPredictionCard.tsx`
- `components/cfb/LineMovementSection.tsx`
- `components/cfb/PublicBettingBars.tsx`
- `components/GameCardShimmer.tsx`
- `components/SportFilter.tsx`
- `components/SportsbookButtons.tsx`
- `components/WeatherDisplay.tsx`
- `components/BettingSplitsCard.tsx`
- `components/H2HModal.tsx`
- `components/LineMovementModal.tsx`
- `components/PolymarketWidget.tsx`
- `contexts/NFLGameSheetContext.tsx`, `CFBGameSheetContext.tsx`
- `services/polymarketService.ts`, `theOddsApi.ts` (note: actually `services/theOddsApi.ts` doesn't exist on mobile — verify)

**Swift targets:**
- `Features/Games/GamesView.swift` (the home tab)
- `Features/Games/Components/SportPickerBar.swift`
- `Features/GameCards/Components/GameCardShimmer.swift`
- `Features/GameCards/Components/WeatherDisplay.swift`
- `Features/GameCards/Components/SportsbookButtons.swift`
- `Features/NFL/Components/NFLGameCard.swift`
- `Features/NFL/Sheets/NFLGameBottomSheet.swift`
- `Features/CFB/Components/CFBGameCard.swift`
- `Features/CFB/Components/CFBPredictionCard.swift`
- `Features/CFB/Components/LineMovementSection.swift`
- `Features/CFB/Components/PublicBettingBars.swift`
- `Features/CFB/Sheets/CFBGameBottomSheet.swift`
- `Features/GameCards/Sheets/H2HModal.swift`
- `Features/GameCards/Sheets/LineMovementModal.swift`
- `Features/Components/Polymarket/PolymarketWidget.swift`
- `WagerproofStores/GamesStore.swift` (driving the home dashboard)
- `WagerproofStores/NFLGameSheetStore.swift`, `CFBGameSheetStore.swift`
- `WagerproofServices/PolymarketService.swift`
- `WagerproofModels/NFLPrediction.swift`, `CFBPrediction.swift`

**Honeydew reference:** `MainAllRecipesView` + `RecipeDetailView` for the game-card-grid + sheet pattern.

**Acceptance:** Open the Games tab, see today's NFL + CFB predictions populated from real CFB Supabase data; tap a card, see the bottom sheet with predictions, lines, public betting, weather. Tap a sportsbook button → outbound `Linking.openURL` works.

### B05 — Picks tab (Editor's Picks)

**RN files:**
- `app/(drawer)/(tabs)/picks.tsx` (1,469 lines)
- `components/EditorPickCard.tsx`
- `components/EditorPicksStatsBanner.tsx`
- `components/CompactPickCard.tsx`
- `components/LockedPickCard.tsx`
- `components/PickDetailBottomSheet.tsx`
- `components/EditorPickCreatorBottomSheet.tsx`
- `components/PickCardErrorBoundary.tsx`
- `contexts/EditorPickSheetContext.tsx`
- `contexts/PickDetailSheetContext.tsx`

**Swift targets:**
- `Features/Picks/PicksView.swift`
- `Features/Picks/Components/EditorPickCard.swift`
- `Features/Picks/Components/CompactPickCard.swift`
- `Features/Picks/Components/LockedPickCard.swift`
- `Features/Picks/Components/PickCardErrorBoundary.swift`
- `Features/Picks/Sheets/PickDetailBottomSheet.swift`
- `Features/EditorPicks/Sheets/EditorPickCreatorBottomSheet.swift`
- `Features/EditorPicks/Components/EditorPicksStatsBanner.swift`
- `Features/EditorPicks/EditorPicksStatsView.swift`
- `WagerproofStores/EditorPicksStore.swift`
- `WagerproofStores/PickDetailSheetStore.swift`

**Honeydew reference:** `MainFoldersView` for SectionList-style grouped lists.

### B06 — Outliers tab

**RN files:**
- `app/(drawer)/(tabs)/outliers.tsx` (2,570 lines — biggest screen)
- `components/OutlierMatchupCard.tsx`
- `components/OutliersHeroHeader.tsx`
- `components/OutlierCardShimmer.tsx`
- `components/ToolExplainerBanner.tsx`
- `services/outliersService.ts`
- `hooks/useTopAgentPicksFeed.ts` (cross-batch — also touched by B16)

**Swift targets:**
- `Features/Outliers/OutliersView.swift`
- `Features/Outliers/Components/OutlierMatchupCard.swift`
- `Features/Outliers/Components/OutliersHeroHeader.swift`
- `Features/Outliers/Components/OutlierCardShimmer.swift`
- `Features/Outliers/OutliersDetailView.swift` (per-category detail when user taps a section header)
- `WagerproofStores/OutliersStore.swift`
- `WagerproofServices/OutliersService.swift`

### B07 — Scoreboard tab + live scores

**RN files:**
- `app/(drawer)/(tabs)/scoreboard.tsx`
- `components/LiveScoreCard.tsx`
- `components/LiveScoreCardShimmer.tsx`
- `components/LiveScoreDetailModal.tsx`
- `components/LiveScorePredictionCard.tsx`
- `services/liveScoresService.ts`
- `hooks/useLiveScores.ts`

**Swift targets:**
- `Features/Scoreboard/ScoreboardView.swift`
- `Features/Scoreboard/Components/LiveScoreCard.swift`
- `Features/Scoreboard/Components/LiveScoreCardShimmer.swift`
- `Features/Scoreboard/Components/LiveScorePredictionCard.swift`
- `Features/Scoreboard/Sheets/LiveScoreDetailModal.swift`
- `WagerproofStores/LiveScoresStore.swift` (polls ESPN/Sports API every N seconds)
- `WagerproofServices/LiveScoresService.swift`

### B08 — Settings + modals + paywall

**RN files:**
- `app/(drawer)/(tabs)/settings.tsx` (930 lines)
- `app/(drawer)/settings.tsx` (1-line re-export)
- `app/(modals)/_layout.tsx`
- `app/(modals)/delete-account.tsx`
- `app/(modals)/discord.tsx`
- `app/(modals)/ios-widget.tsx`
- `app/(modals)/secret-settings.tsx`
- `components/DeleteAccountBottomSheet.tsx`
- `components/ReviewRequestModal.tsx`
- `components/RevenueCatPaywall.tsx`
- `components/CustomerCenter.tsx`
- `components/ProContentSection.tsx`
- `components/ProFeatureGate.tsx`
- `components/LockedGameCard.tsx`
- `components/LockedOverlay.tsx`
- `contexts/SettingsContext.tsx`
- `contexts/RevenueCatContext.tsx`
- `contexts/AdminModeContext.tsx`
- `services/revenuecat.ts`
- `services/notificationService.ts` (push registration UI lives in settings)
- `hooks/useProAccess.ts`
- `hooks/useIsAdmin.ts`

**Swift targets:**
- `Features/Settings/SettingsView.swift`
- `Features/Settings/DeleteAccountView.swift`
- `Features/Settings/Sheets/DeleteAccountBottomSheet.swift`
- `Features/Settings/Sheets/ReviewRequestModal.swift`
- `Features/Settings/DiscordView.swift`
- `Features/Settings/IosWidgetView.swift`
- `Features/Settings/SecretSettingsView.swift`
- `Features/Paywall/RevenueCatPaywallView.swift`
- `Features/Paywall/CustomerCenterView.swift`
- `Features/Paywall/ProContentSection.swift`
- `Features/Paywall/ProFeatureGate.swift`
- `Features/Paywall/LockedGameCard.swift`
- `Features/Paywall/LockedOverlay.swift`
- `WagerproofStores/SettingsStore.swift`
- `WagerproofStores/RevenueCatStore.swift`
- `WagerproofStores/AdminModeStore.swift`
- `WagerproofStores/ProAccessStore.swift`
- `WagerproofServices/RevenueCatService.swift`
- `WagerproofServices/NotificationService.swift`

### B09 — Feature Requests + Discord

**RN files:**
- `app/(drawer)/(tabs)/feature-requests.tsx`
- (Discord covered in B08)

**Swift targets:**
- `Features/FeatureRequests/FeatureRequestsView.swift`
- `WagerproofStores/FeatureRequestsStore.swift`

### B10 — NBA game card + bottom sheet + trends

**RN files:**
- `components/NBAGameCard.tsx`
- `components/NBAGameBottomSheet.tsx`
- `components/NBABettingTrendsBottomSheet.tsx`
- `components/nba/*.tsx` (BettingTrendsBanner, ModelAccuracyBanner, etc.)
- `contexts/NBAGameSheetContext.tsx`, `NBABettingTrendsSheetContext.tsx`
- `hooks/useNBABettingTrends.ts`, `useNBAMatchupOverview.ts`, `useNBAModelAccuracy.ts`

**Swift targets:**
- `Features/NBA/Components/NBAGameCard.swift`
- `Features/NBA/Sheets/NBAGameBottomSheet.swift`
- ~~`Features/NBA/Sheets/NBABettingTrendsBottomSheet.swift`~~ (superseded 2026-06-10: all sports share `Features/Outliers/Components/BettingTrendsDetailSheet.swift` + `TrendsMatrixView.swift`; per-sport trends bottom sheets were deleted)
- `Features/NBA/Components/BettingTrendsBanner.swift`
- `Features/NBA/Components/ModelAccuracyBanner.swift`
- `WagerproofStores/NBAGameSheetStore.swift`
- `WagerproofStores/NBABettingTrendsStore.swift`
- `WagerproofStores/NBAModelAccuracyStore.swift`

### B11 — NCAAB game card + bottom sheet + trends

Mirror of B10 for NCAAB.

### B12 — MLB game card + bottom sheet + trends + regression

**RN files:**
- `components/MLBGameCard.tsx`
- `components/MLBGameBottomSheet.tsx`
- `components/MLBBettingTrendsBottomSheet.tsx`
- `components/mlb/*.tsx`
- `contexts/MLBGameSheetContext.tsx`, `MLBBettingTrendsSheetContext.tsx`
- `hooks/useMLBBettingTrends.ts`, `useMLBBucketAccuracy.ts`, `useMLBRegressionReport.ts`
- `app/(drawer)/(tabs)/mlb-regression-report.tsx`

**Swift targets:**
- Per pattern.

### B13 — Agents tab + agent card + leaderboard + ID card

**RN files:**
- `app/(drawer)/(tabs)/agents/index.tsx`
- `app/(drawer)/(tabs)/agents/_layout.tsx`
- `components/agents/AgentCard.tsx`
- `components/agents/AgentIdCard.tsx`
- `components/agents/AgentLeaderboard.tsx`
- `components/agents/AgentOverlapFooter.tsx`
- `components/agents/GlowAccentBar.tsx`
- `components/agents/GlowingCardWrapper.tsx`
- `components/agents/index.ts` (re-exports)
- `contexts/AgentHRSheetContext.tsx`
- `services/agentService.ts`, `agentPicksService.ts`, `agentPerformanceService.ts`, `agentPerformanceMetrics.ts`
- `hooks/useAgents.ts`, `useFollowedAgents.ts`, `useLeaderboard.ts`, `useAgentEntitlements.ts`

**Swift targets:**
- `Features/Agents/AgentsView.swift`
- `Features/Agents/AgentsRouter.swift`
- `Features/Agents/Components/AgentCard.swift`
- `Features/Agents/Components/AgentIdCard.swift`
- `Features/Agents/Components/AgentLeaderboard.swift`
- `Features/Agents/Components/AgentOverlapFooter.swift`
- `WagerproofStores/AgentsStore.swift`
- `WagerproofStores/FollowedAgentsStore.swift`
- `WagerproofStores/LeaderboardStore.swift`
- `WagerproofServices/AgentService.swift`
- `WagerproofServices/AgentPicksService.swift`
- `WagerproofServices/AgentPerformanceService.swift`

### B14 — Agent creation wizard (6 screens)

**RN files:**
- `app/(drawer)/(tabs)/agents/create.tsx`
- `components/agents/creation/Screen1_SportArchetype.tsx`
- `components/agents/creation/Screen2_Identity.tsx`
- `components/agents/creation/Screen3_Personality.tsx`
- `components/agents/creation/Screen4_DataAndConditions.tsx`
- `components/agents/creation/Screen5_CustomInsights.tsx`
- `components/agents/creation/Screen6_Review.tsx`
- `components/agents/creation/AgentBornCreationCelebration.tsx`
- `components/agents/creation/AgentCreationGenerationIntro.tsx`
- `components/agents/inputs/ArchetypeCard.tsx`
- `components/agents/inputs/OddsInput.tsx`
- `components/agents/inputs/SliderInput.tsx`
- `components/agents/inputs/SwipeableEmojiPicker.tsx`
- `components/agents/inputs/TimePickerModal.tsx`
- `components/agents/inputs/TimezonePickerModal.tsx`
- `components/agents/inputs/ToggleInput.tsx`
- `components/DeferredAgentCreator.tsx`
- `hooks/usePresetArchetypes.ts`

**Swift targets:** mirror, each `Screen<N>` becomes a `Step<N>View.swift` inside `Features/Agents/Creation/`.

### B15 — Agent detail + settings + public detail + HR sheet

**RN files:**
- `app/(drawer)/(tabs)/agents/[id]/index.tsx`
- `app/(drawer)/(tabs)/agents/[id]/settings.tsx`
- `app/(drawer)/(tabs)/agents/public/[id].tsx`
- `components/agents/AgentChatRoom.tsx`
- `components/agents/AgentHRBottomSheet.tsx`
- `components/agents/AgentPerformanceCharts.tsx`
- `components/agents/AgentPickCard.tsx`
- `components/agents/AgentPickItem.tsx`
- `components/agents/AgentPickPayloadAuditWidget.tsx`
- `components/agents/AgentPickRationaleWidget.tsx`
- `components/agents/AgentTimeline.tsx`
- `components/agents/CompanyDashboardBanner.tsx`
- `components/agents/PixelOffice.tsx`
- `components/agents/PixelEmojiInline.tsx`
- `components/agents/PrinterSlipAnimation.tsx`
- `components/agents/ThinkingAnimation.tsx`
- `contexts/AgentPickAuditContext.tsx`
- `services/agentAuthorizedActions.ts`
- `services/agentV2Flags.ts`, `agentV2DebugSettings.ts`
- `hooks/useAgentPicks.ts`, `useAgentV2Flags.ts`, `useAgentV2DebugSettings.ts`

**Swift targets:** mirror.

### B16 — Top agent picks feed + leaderboard widget

**RN files:**
- `components/agents/TopAgentPicksFeed.tsx`
- `services/topAgentsWidgetService.ts`
- `hooks/useTopAgentPicksFeed.ts`, `useTopAgentsWidgetSync.ts`, `useWidgetDataSync.ts`
- `modules/widget-data-bridge/*` (native module — port wrapper, native code itself stays)

**Swift targets:**
- `Features/Agents/Components/TopAgentPicksFeed.swift`
- `WagerproofServices/TopAgentsWidgetService.swift`
- `Wagerproof/Modules/WidgetDataBridge.swift`

### B17 — WagerBot chat

**RN files:**
- `app/(drawer)/(tabs)/chat.tsx`
- `app/(drawer)/wagerbot-chat.tsx`
- `components/WagerBotChat.tsx`
- `components/WagerBotChatScreen.tsx`
- `components/WagerBotChatBottomSheet.tsx`
- `components/WagerBotInsightPill.tsx`
- `components/WagerBotSuggestionBubble.tsx`
- `components/FloatingAssistantBubble.tsx`
- `components/chat/AssistantActionRow.tsx`
- `components/chat/ChatGameCard.tsx`
- `components/chat/ChatGameCardList.tsx`
- `components/chat/FollowUpPills.tsx`
- `components/chat/MessageBubble.tsx`
- `components/chat/ShimmerText.tsx`
- `components/chat/StreamingText.tsx`
- `contexts/WagerBotChatSheetContext.tsx`
- `contexts/WagerBotSuggestionContext.tsx`
- `services/wagerBotChatService.ts`
- `services/wagerBotSuggestionService.ts`
- `services/chatThreadService.ts`
- `utils/chatSessionManager.ts`

**Swift targets:** mirror. SSE streaming via `URLSession.bytes(for:)`.

### B18 — WagerBot voice + audio-route module

**RN files:**
- `app/(drawer)/(tabs)/voice-chat.tsx`
- `app/(drawer)/wagerbot-voice.tsx`
- `components/VoiceSettingsSheet.tsx`
- `hooks/useWagerBotVoice.ts`
- `services/wagerBotVoiceService.ts`
- `services/geminiLiveService.ts`
- `modules/audio-route/*` (native module — keep)

**Swift targets:** mirror. The native iOS code in `modules/audio-route/ios/*.swift` lifts directly into `Wagerproof/Modules/AudioRoute*.swift`.

### B19 — Roast tab

**RN files:**
- `app/(drawer)/(tabs)/roast.tsx`
- `components/roast/*.tsx`
- `hooks/useRoastSession.ts`

**Swift targets:** mirror.

### B20 — Analytics dashboards

**RN files:**
- `app/(drawer)/(tabs)/mlb-betting-trends.tsx`
- `app/(drawer)/(tabs)/nba-betting-trends.tsx`
- `app/(drawer)/(tabs)/nba-model-accuracy.tsx`
- `app/(drawer)/(tabs)/ncaab-betting-trends.tsx`
- `app/(drawer)/(tabs)/ncaab-model-accuracy.tsx`
- `components/BettingTrendsWidget.tsx`
- `components/BettingTrendsMatchupCardShimmer.tsx`
- `components/ModelAccuracyWidget.tsx`
- `components/ModelAccuracyCardShimmer.tsx`
- `components/AccuracyBadge.tsx`
- `components/charts/*.tsx`

**Swift targets:** mirror.

> **2026-06-11 note:** the betting-trends list screens (`mlb/nba/ncaab-betting-trends`) were
> later RETIRED on iOS — those datasets now render as per-matchup `BettingTrendsInsightWidget`
> on the game detail sheets plus Search insight chips (see
> `.claude/docs/14_ios_primitives_index.md` §7b). The model-accuracy dashboards remain routed
> tool surfaces.

### B21 — LearnMore + ToolExplainer + Pro gating

**RN files:**
- `components/learn-wagerproof/*.tsx`
- `contexts/LearnWagerProofContext.tsx`
- `components/ToolExplainerBanner.tsx`
- `components/ComingSoonBanner.tsx`
- `components/PostOnboardingPaywall.tsx`

**Swift targets:** mirror.

### B22 — Hardening + asset rebundle + chrome polish

**RN files:**
- `assets/` (icon, splash, brand)
- `app/asset-library.tsx`, `app/pixel-office-debug.tsx` (dev tools)
- `components/AndroidBlurView.tsx` → replace with `.background(.ultraThinMaterial)` on iOS
- `components/AnimatedSplash.tsx` (already replaced by `SplashView` in scaffold)
- `components/GlobalErrorBoundary.tsx`
- `components/OfflineBanner.tsx`
- `components/SwipeToDeleteSlider.tsx` → replace with `.swipeActions`
- `components/TeamAvatar.tsx`, `components/TeamCircle.tsx`
- `components/NoGamesTerminal.tsx`
- `components/MetaTestBottomSheet.tsx` (devtool)
- `components/FadeAlertTooltip.tsx`
- Final `inventory.csv` + `inventory.overrides.csv` audit; any file still `missing` becomes a waiver ticket.

---

## Predecessors graph (text)

```
B01 ──┬─► B02
      └─► B03 ──┬─► B04 ──┬─► B10 ──► B20
                │         ├─► B11 ──► B20
                │         └─► B12 ──► B20
                ├─► B05
                ├─► B06
                ├─► B07
                ├─► B08
                ├─► B09
                ├─► B13 ──┬─► B14
                │         ├─► B15
                │         └─► B16
                ├─► B17
                ├─► B18
                ├─► B19
                └─► B21
                ─► B22 (after all)
```

The shortest critical path is **B01 → B03 → B04 → B10/B11/B12 → B20 → B22**. With 4-6 implementer agents working in parallel, the orchestrator can hit Phase 4 (Agents) by week 2 and analytics by week 3.

---

## Per-batch implementer brief template

Each implementer agent receives a brief built from this template:

```markdown
You are the implementer for batch <BNN> — <title>.

## Scope (RN files — read ALL end-to-end before writing any Swift)
<paste from "RN files" section above>

## Target Swift files
<paste from "Swift targets" section above>

## Honeydew reference screens to mirror
<paste from Honeydew reference row>

## Required reads
- /Users/chrishabib/Documents/new-wagerproof/docs/wagerproof-migration/REBUILD_PLAN.md (the contract)
- /Users/chrishabib/Documents/new-wagerproof/docs/wagerproof-migration/08-screen-native-spec.md (your screen's section)
- /Users/chrishabib/Documents/new-wagerproof/docs/wagerproof-migration/navigation-map.md (relevant routes/sheets)
- /Users/chrishabib/Documents/honeydew/docs/swift-migration/07-native-interactions.md (sections matching your primitives)
- /Users/chrishabib/Documents/honeydew/docs/swift-migration/09-motion-and-haptics.md (haptic + animation tokens)

## Deliverables
1. Swift source files at the target paths.
2. Fidelity table at docs/wagerproof-migration/fidelity/<bnn>-<slug>.md.
3. Parity screenshots in docs/wagerproof-migration/parity/<slug>/{empty,loaded,error}.png.
4. xcodebuild Debug succeeds for Wagerproof scheme on iPhone 16 Pro sim.
5. inventory.overrides.csv rows flipping each RN file from `missing` → `candidate`.
6. Any unshippable behavior filed as docs/wagerproof-migration/tickets/NNN-*.md with matching `// FIDELITY-WAIVER #NNN` comment in code.

## Non-negotiable rules
- Backend untouched (endpoints, payloads, JSON shapes byte-identical).
- No @State fakes, no stub data, no lazy ports.
- Wire to a real Observable store in WagerproofKit; views never call SDKs directly.
- Prefer native primitives; never hand-roll when SwiftUI has one.
- Match Honeydew's visual language with Wagerproof brand tokens.
- Capture all three parity screenshots; reviewer rejects work without them.

When done, return a one-line confirmation: "B<NN> implementer: X files written, Y fidelity rows, Z waivers."
```
