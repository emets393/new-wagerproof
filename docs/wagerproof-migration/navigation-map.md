# 02 — Navigation, sheets, deep links, push handlers, API surface

This is the authoritative map of every navigation edge in the Wagerproof RN app and what each becomes in the Swift port. Use it together with [inventory.csv](./inventory.csv) when scoping any batch.

Source of truth: walk performed 2026-05-20 against `swift` branch HEAD.

---

## 1. Route tree (Expo Router)

The RN app uses [expo-router](https://expo.github.io/router/) with file-based routing under `wagerproof-mobile/app/`. The four top-level groups are:

- `(auth)` — unauthenticated screens
- `(onboarding)` — onboarding wizard
- `(drawer)` — authenticated app
- `(modals)` — full-screen modal flows pushed over the drawer
- Plus loose `app/asset-library.tsx` and `app/pixel-office-debug.tsx` dev screens

### 1.1 Auth group

| Route | RN file | Swift target |
|---|---|---|
| `/login` | `app/(auth)/login.tsx` | `Features/Auth/LoginView.swift` |
| `/email-login` | `app/(auth)/email-login.tsx` | `Features/Auth/EmailLoginView.swift` |
| `/signup` | `app/(auth)/signup.tsx` | `Features/Auth/SignupView.swift` |
| `/forgot-password` | `app/(auth)/forgot-password.tsx` | `Features/Auth/ForgotPasswordView.swift` |

`(auth)/_layout.tsx` is a stack with no chrome. Mirror in Swift via `AuthRouter` (`NavigationStack(path:)` rooted in `LoginView`).

### 1.2 Onboarding group

| Route | RN file | Swift target |
|---|---|---|
| `/(onboarding)` | `app/(onboarding)/index.tsx` | `Features/Onboarding/OnboardingView.swift` |

Onboarding flow uses an internal step state machine inside one screen (see `OnboardingContext`). Port as a single SwiftUI view driven by an `OnboardingStore.step` enum + `TabView(selection:).tabViewStyle(.page(indexDisplayMode: .never))` to preserve the swipe-style page transitions used in the RN version.

### 1.3 Drawer + Tabs

`(drawer)/_layout.tsx` is the drawer host. Inside the drawer there is a tab bar `(drawer)/(tabs)/_layout.tsx`.

Drawer side menu (`components/SideMenu.tsx`) exposes:
- Picks tab (push)
- Agents tab (push)
- Outliers tab (push)
- Games tab (root)
- Feature Requests
- Discord link (push)
- Secret Settings (admin only)
- Privacy / Terms links (out via `Linking.openURL`)

Tab routes:

| Tab | Route | RN file | Swift target |
|---|---|---|---|
| Games (home) | `/` | `app/(drawer)/(tabs)/index.tsx` | `Features/Games/GamesView.swift` |
| Picks | `/picks` | `app/(drawer)/(tabs)/picks.tsx` | `Features/Picks/PicksView.swift` |
| Agents | `/agents` | `app/(drawer)/(tabs)/agents/index.tsx` | `Features/Agents/AgentsView.swift` |
| Outliers | `/outliers` | `app/(drawer)/(tabs)/outliers.tsx` | `Features/Outliers/OutliersView.swift` |
| Scoreboard | `/scoreboard` | `app/(drawer)/(tabs)/scoreboard.tsx` | `Features/Scoreboard/ScoreboardView.swift` |
| Chat (WagerBot) | `/chat` | `app/(drawer)/(tabs)/chat.tsx` | `Features/Chat/ChatView.swift` |
| Voice Chat | `/voice-chat` | `app/(drawer)/(tabs)/voice-chat.tsx` | `Features/Chat/VoiceChatView.swift` |
| Roast | `/roast` | `app/(drawer)/(tabs)/roast.tsx` | `Features/Roast/RoastView.swift` |
| Settings | `/settings` | `app/(drawer)/(tabs)/settings.tsx` | `Features/Settings/SettingsView.swift` |
| Feature Requests | `/feature-requests` | `app/(drawer)/(tabs)/feature-requests.tsx` | `Features/FeatureRequests/FeatureRequestsView.swift` |
| MLB Betting Trends | `/mlb-betting-trends` | `app/(drawer)/(tabs)/mlb-betting-trends.tsx` | `Features/Analytics/MlbBettingTrendsView.swift` |
| MLB Regression | `/mlb-regression-report` | `app/(drawer)/(tabs)/mlb-regression-report.tsx` | `Features/Analytics/MlbRegressionReportView.swift` |
| NBA Betting Trends | `/nba-betting-trends` | `app/(drawer)/(tabs)/nba-betting-trends.tsx` | `Features/Analytics/NbaBettingTrendsView.swift` |
| NBA Model Accuracy | `/nba-model-accuracy` | `app/(drawer)/(tabs)/nba-model-accuracy.tsx` | `Features/Analytics/NbaModelAccuracyView.swift` |
| NCAAB Betting Trends | `/ncaab-betting-trends` | `app/(drawer)/(tabs)/ncaab-betting-trends.tsx` | `Features/Analytics/NcaabBettingTrendsView.swift` |
| NCAAB Model Accuracy | `/ncaab-model-accuracy` | `app/(drawer)/(tabs)/ncaab-model-accuracy.tsx` | `Features/Analytics/NcaabModelAccuracyView.swift` |

`(tabs)/_layout.tsx` also surfaces a floating WagerBot launcher that does `router.push('/wagerbot-chat')`. Mirror with a `.toolbar` button on every tab's `NavigationStack` root, scoped via shared `WagerBotLauncherStore`.

Drawer-level (non-tab) routes:

| Route | RN file | Swift target |
|---|---|---|
| `/(drawer)/settings` | `app/(drawer)/settings.tsx` (re-export of tabs/settings) | shares `Features/Settings/SettingsView.swift` |
| `/editor-picks-stats` | `app/(drawer)/editor-picks-stats.tsx` | `Features/EditorPicks/EditorPicksStatsView.swift` |
| `/wagerbot-chat` | `app/(drawer)/wagerbot-chat.tsx` | `Features/Chat/WagerbotChatView.swift` |
| `/wagerbot-voice` | `app/(drawer)/wagerbot-voice.tsx` | `Features/Voice/WagerbotVoiceView.swift` |

Agents subtree (file-based routes under `agents/`):

| Route | RN file | Swift target |
|---|---|---|
| `/agents` | `agents/index.tsx` | `Features/Agents/AgentsView.swift` |
| `/agents/create` | `agents/create.tsx` | `Features/Agents/AgentCreateView.swift` |
| `/agents/[id]` | `agents/[id]/index.tsx` | `Features/Agents/AgentDetailView.swift` |
| `/agents/[id]/settings` | `agents/[id]/settings.tsx` | `Features/Agents/AgentDetailSettingsView.swift` |
| `/agents/public/[id]` | `agents/public/[id].tsx` | `Features/Agents/PublicDetailView.swift` |

In Swift, model these as a `NavigationStack(path: $agentsRouter.path)` with a `Hashable` `AgentsRoute` enum (`.list`, `.create`, `.detail(id)`, `.settings(id)`, `.publicDetail(id)`).

### 1.4 Modal group

`(modals)/_layout.tsx` declares `presentation: 'modal'`. In Swift these become `.sheet` or `.fullScreenCover` presentations from `RootRouter`.

| Route | RN file | Presentation | Swift target |
|---|---|---|---|
| `/delete-account` | `app/(modals)/delete-account.tsx` | `.sheet` | `Features/Settings/DeleteAccountView.swift` |
| `/discord` | `app/(modals)/discord.tsx` | `.sheet` | `Features/Settings/DiscordView.swift` |
| `/ios-widget` | `app/(modals)/ios-widget.tsx` | `.sheet` | `Features/Settings/IosWidgetView.swift` |
| `/secret-settings` | `app/(modals)/secret-settings.tsx` | `.fullScreenCover` (devtools) | `Features/Settings/SecretSettingsView.swift` |

### 1.5 Loose dev screens

| Route | RN file | Swift target |
|---|---|---|
| `/asset-library` | `app/asset-library.tsx` | `Features/DevTools/AssetLibraryView.swift` |
| `/pixel-office-debug` | `app/pixel-office-debug.tsx` | `Features/DevTools/PixelOfficeDebugView.swift` |

### 1.6 Root entry & auth-gated redirects

`app/_layout.tsx` registers:
- AuthProvider, ThemeProvider, RevenueCatProvider, AnalyticsProvider, AdminModeProvider, OnboardingProvider, multiple SheetProviders, etc.
- A `RootNavigator` that watches `useAuth().user` + `useSegments()` and routes:
  - No user → `/(auth)/login`
  - User, no onboarding complete → `/(onboarding)`
  - Authed + onboarded → `/(drawer)/(tabs)` (Games)
- `OnboardingGuard` further enforces the same constraint on every child render.

Swift equivalent: a `RootRouter` driving `Group { switch authState { ... } }` with three branches: `LoginView`, `OnboardingView`, `MainTabView`. Mirror the auth listener via Supabase's `onAuthStateChange` bridged to an `AsyncStream` consumed by `AuthStore`.

---

## 2. Bottom sheets and modals (in-app, not native modal routes)

Wagerproof uses `@gorhom/bottom-sheet` heavily. Each sheet is a singleton owned by a Context, opened via `openSheet(payload)` from anywhere in the tree. In Swift, port each to `.sheet(item: $store.activeSheet)` driven by an `@Observable` store, with `presentationDetents` matching the RN snap points.

| Context | Sheet component | Opened via | Swift target |
|---|---|---|---|
| `NFLGameSheetContext` | `NFLGameBottomSheet.tsx` | `openGameSheet(NFLPrediction)` | `Features/NFL/Sheets/NFLGameBottomSheet.swift` |
| `CFBGameSheetContext` | `CFBGameBottomSheet.tsx` | `openGameSheet(CFBPrediction)` | `Features/CFB/Sheets/CFBGameBottomSheet.swift` |
| `NBAGameSheetContext` | `NBAGameBottomSheet.tsx` | `openGameSheet(NBAGame)` | `Features/NBA/Sheets/NBAGameBottomSheet.swift` |
| `NCAABGameSheetContext` | `NCAABGameBottomSheet.tsx` | `openGameSheet(NCAABGame)` | `Features/NCAAB/Sheets/NCAABGameBottomSheet.swift` |
| `MLBGameSheetContext` | `MLBGameBottomSheet.tsx` | `openGameSheet(MLBGame)` | `Features/MLB/Sheets/MLBGameBottomSheet.swift` |
| `NBABettingTrendsSheetContext` | `NBABettingTrendsBottomSheet.tsx` | `openTrendsSheet(NBAGameTrendsData)` | `Features/NBA/Sheets/NBABettingTrendsBottomSheet.swift` |
| `NCAABBettingTrendsSheetContext` | `NCAABBettingTrendsBottomSheet.tsx` | `openTrendsSheet(...)` | `Features/NCAAB/Sheets/NCAABBettingTrendsBottomSheet.swift` |
| `MLBBettingTrendsSheetContext` | `MLBBettingTrendsBottomSheet.tsx` | `openTrendsSheet(...)` | `Features/MLB/Sheets/MLBBettingTrendsBottomSheet.swift` |
| `EditorPickSheetContext` | `EditorPickCreatorBottomSheet.tsx` | `openCreateSheet()` / `openEditSheet(pick)` | `Features/EditorPicks/Sheets/EditorPickCreatorBottomSheet.swift` |
| `PickDetailSheetContext` | `PickDetailBottomSheet.tsx` | `openPickDetail(pick)` | `Features/Picks/Sheets/PickDetailBottomSheet.swift` |
| `LearnWagerProofContext` | `LearnWagerProofBottomSheet.tsx` (under `components/learn-wagerproof/`) | `openLearnSheet()` | `Features/LearnMore/Sheets/LearnWagerProofBottomSheet.swift` |
| `AgentHRSheetContext` | `AgentHRBottomSheet.tsx` | `openSheet(agents)` | `Features/Agents/Sheets/AgentHRBottomSheet.swift` |
| `MetaTestSheetContext` | `MetaTestBottomSheet.tsx` | `openSheet()` | `Features/DevTools/Sheets/MetaTestBottomSheet.swift` |
| `WagerBotChatSheetContext` | `WagerBotChatBottomSheet.tsx` | `openSheet()` | `Features/Chat/Sheets/WagerBotChatBottomSheet.swift` |

Non-context-driven full-screen modals:
- `H2HModal.tsx` — opened locally from a game sheet (`Modal` component)
- `LineMovementModal.tsx` — same
- `LiveScoreDetailModal.tsx` — opened from scoreboard tap
- `RevenueCatPaywall.tsx` — driven by RevenueCat presentation imperative
- `CustomerCenter.tsx` — RevenueCat-driven
- `ReviewRequestModal.tsx` — driven by `StoreReview.requestReview()` triggers + in-app modal
- `DeleteAccountBottomSheet.tsx` — standalone sheet component (not used in flows? confirm)
- `SportsbookButtons.tsx` — action sheet style (actually a `Modal`-rendered bottom sheet)
- `VoiceSettingsSheet.tsx` — opened from voice screen

Swift port: every modal goes through `.sheet(item:)`, with the sheet identity being a `Hashable` enum. Local sheets (non-cross-cutting) live in the screen's own store.

---

## 3. Deep links (URL scheme: `wagerproof://`)

App.json:
```json
"scheme": ["wagerproof", "rc-ff2fe0e0af"]
```

`(drawer)/_layout.tsx` registers `Linking.addEventListener('url', handleDeepLink)` + checks `Linking.getInitialURL()` on mount. Handler:

| URL | Target route |
|---|---|
| `wagerproof://picks` | `/(drawer)/(tabs)/picks` |
| `wagerproof://agents` | `/(drawer)/(tabs)/agents` |
| `wagerproof://outliers` | `/(drawer)/(tabs)/outliers` |
| `wagerproof://feed` | `/(drawer)/(tabs)` (Games) |
| `wagerproof://<anything else>` | `/(drawer)/(tabs)` (default) |

Also `wagerproof://reset-password` is used as Supabase Auth `redirectTo` for password resets (see `contexts/AuthContext.tsx`).

`rc-ff2fe0e0af` is the RevenueCat deep-link scheme used for paywall flows.

Swift port: wire `.onOpenURL { url in router.handle(url) }` on the root view. Mirror exact URL → route mapping.

### 3.1 URL scheme registration (Info.plist)

In Swift, register URL types in Info.plist:
- CFBundleURLSchemes: `wagerproof`, `rc-ff2fe0e0af`, plus Google Sign-In's reverse-client-ID (`com.googleusercontent.apps.142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq`).

---

## 4. Push notifications

Wired in `services/notificationService.ts` + `app/_layout.tsx`. Uses `expo-notifications`, registers for push, persists token in `user_push_tokens` table, handles foreground/background/cold-start.

Route map (`getRouteFromNotificationResponse`):

| Payload `data.type` | Route |
|---|---|
| `auto_pick_ready` (requires `data.agent_id`) | `/(drawer)/(tabs)/agents/<agent_id>` |

Cold-start tap: persisted in `AsyncStorage` key `LAST_NOTIFICATION_ROUTE` (read by `getLastNotificationRoute()`), replayed via `setTimeout(... 500ms)` after first auth.

Swift port:
- Use `UNUserNotificationCenter.delegate` + APNs registration.
- Replicate the route map in `PushRouter.swift`.
- Persist cold-start route in App Group `UserDefaults` (key `last_notification_route`) so widget/extension paths align.
- Token storage: keep writing to Supabase `user_push_tokens` table with `provider: "apns"` and device id.

---

## 5. External outbound links

Calls to `Linking.openURL(...)` (out of app):

| Source | URL pattern | Notes |
|---|---|---|
| Settings | `https://wagerproof.bet/privacy-policy` | Privacy link |
| Settings | `https://wagerproof.bet/terms-and-conditions` | Terms link |
| Games tab + side menu | `https://discord.gg/gwy9y7XSDV` | Public Discord invite |
| Settings → review | App Store URL (`itms-apps://`) with fallback | Review prompt |
| SideMenu / Settings | App Store / store URLs | Privacy + Terms |
| Discord modal | `${DISCORD_LINK_URL}?user_id=${user.id}` | Server-side bind |
| `SportsbookButtons.tsx` | Sportsbook URLs (DraftKings, FanDuel, etc.) from `theOddsApi` | Per-book betslip deep-links |

Swift port: use `Link("Label", destination: URL(string:))` for static links; for dynamic sportsbook deep-links use `@Environment(\.openURL)` from a button action. Don't introduce a custom in-app browser.

---

## 6. Share + system intents

| Where | API | Use |
|---|---|---|
| `components/chat/AssistantActionRow.tsx` | `Share.share({ message })` | Share assistant reply text |
| (no other intentional `Share` calls) | — | — |

Swift port: use `ShareLink(item:)` everywhere RN uses `Share.share`. No custom share sheet wrappers.

Reviews: `react-native-store-review` (or Expo equivalent) gates by counters in `SettingsContext`. Port via `StoreKit`'s `requestReview(in: scene)` from `SKStoreReviewController` (UIKit bridge) inside `ReviewRequestModal`-equivalent.

---

## 7. Backend surface — Supabase

Two Supabase projects, both exposed via JS clients:

| Client | URL anchor | Purpose |
|---|---|---|
| `services/supabase.ts` (main) | `gnjrklxotmbvnxbnnqgq.supabase.co` | Auth, user profiles, agents, editor picks, AI/chat threads, polymarket cache |
| `services/collegeFootballClient.ts` (CFB) | `jpxnjuwglavsjbgbasnl.supabase.co` | ALL sports predictions data: NFL, CFB, NBA, NCAAB, MLB |

### 7.1 Tables (sample — full list in `inventory.csv`'s `backend_calls` column)

Main Supabase reads/writes:
- `profiles` (user + role + push tokens)
- `user_push_tokens`
- `avatar_profiles` (agents)
- `avatar_picks` (agent generated picks)
- `avatar_performance_cache`
- `user_avatar_follows`
- `editors_picks`
- `chat_threads`, `chat_messages`
- `polymarket_markets` (cached)
- `feature_requests`, `feature_request_votes`
- `user_settings`
- `agent_system_prompts`
- `ai_completions`

CFB Supabase reads (predictions):
- NFL: `v_input_values_with_epa`, `nfl_predictions_epa`, `nfl_betting_lines`, `nfl_line_movement`, `nfl_historical_games`
- CFB: `cfb_live_weekly_inputs`, `cfb_api_predictions`, `cfb_team_mapping`
- NBA: `nba_input_values_view`, `nba_predictions`, `nba_todays_games_predictions_with_accuracy`, `nba_injury_report`, `nba_game_situational_trends(_today)`, `nba_betting_lines`
- NCAAB: `v_cbb_input_values`, `ncaab_predictions`, `ncaab_team_mapping`, `ncaab_edge_accuracy_by_bucket`, `ncaab_game_situational_trends(_today)`
- MLB: `mlb_games_today`, `mlb_game_signals`, `mlb_predictions_current`, `mlb_team_mapping`, `mlb_situational_trends(_today)`, `mlb_model_bucket_accuracy`, `mlb_regression_report`
- Shared: `production_weather`

### 7.2 RPCs (Postgres functions)

| RPC | Source | Use |
|---|---|---|
| `get_top_agent_picks_feed_v2` | `services/agentPicksService.ts` | Public agent picks feed |
| `get_agent_pick_overlap_batch` | `services/agentPicksService.ts` | Pick overlap analysis |
| `get_leaderboard_v2` | `services/agentPerformanceService.ts` | Public leaderboard |
| `touch_owner_activity_if_stale` / `update_owner_last_active_at` | `services/activityService.ts` | Heartbeat |
| `has_role` | `hooks/useIsAdmin.ts` | Admin gate |

### 7.3 Edge functions (`supabase.functions.invoke`)

| Function | Source | Use |
|---|---|---|
| `agent-authorized-action-v1` | `services/agentAuthorizedActions.ts` | Server-side guarded agent mutations |
| `get-gemini-key` | `services/geminiLiveService.ts` | Ephemeral Gemini key fetch for voice |
| `polymarket-proxy` | `services/polymarketService.ts` | Polymarket API proxy (3 distinct call sites) |
| `wagerbot-chat-…` (TBD names) | `services/wagerBotChatService.ts` | Streaming agentic chat (SSE) |
| `wagerbot-voice-…` (TBD names) | `services/wagerBotVoiceService.ts` | Voice session bootstrap |

Swift port (per the goal): the existing JS API client is mirrored 1:1 by a `WagerproofAPIClient` `actor` using `URLSession`, with two `SupabaseClient` instances (main + CFB) wrapped in their own actors. Endpoints, headers, JSON shapes stay byte-identical. SSE streams arrive via `URLSession.bytes(for:)` and are decoded line-by-line.

### 7.4 Non-Supabase third-party endpoints

| Provider | Use | RN client |
|---|---|---|
| `gamma-api.polymarket.com` | Live fallback when local cache misses | `services/polymarketService.ts` |
| `exp.host/--/api/v2/push/send` (admin-only) | Push notification testing from secret settings | `app/(modals)/secret-settings.tsx` |
| Sportsbook deep-link URLs (DK, FanDuel, BetMGM, Caesars, etc.) | Outbound `Linking.openURL` | `components/SportsbookButtons.tsx` |
| OpenAI Realtime (via Supabase edge) | Voice chat | `services/wagerBotVoiceService.ts` |
| `127.0.0.1:7243/ingest/<uuid>` | Local dev only (login.tsx) | dev-only — exclude from prod build |

---

## 8. Async storage keys

Found via grep on `AsyncStorage`, `SecureStore`, `MMKV`:

| Key (approx.) | Source | Use |
|---|---|---|
| `LAST_NOTIFICATION_ROUTE` | `services/notificationService.ts` | Cold-start push route |
| `agent_v2_flags_*` | `services/agentV2Flags.ts` | Local flag overrides |
| `agent_v2_debug_*` | `services/agentV2DebugSettings.ts` | Debug toggles |
| `wb_voice_settings` | `components/VoiceSettingsSheet.tsx` | Voice preferences |
| `onboarding_complete` / similar | `contexts/OnboardingContext.tsx` | Onboarding completion |
| `wb_chat_session_*` | `utils/chatSessionManager.ts` | Per-thread cache |
| `theme_pref` | `contexts/ThemeContext.tsx` | Theme preference |
| `admin_mode_enabled` | `contexts/AdminModeContext.tsx` | Devtool gate |

Swift port: read once into the corresponding `@Observable` store on launch via `UserDefaults` (in App Group `group.com.wagerproof.mobile` for keys shared with widget/extension). Secrets (Supabase JWT) go through Keychain via a dedicated `KeychainStore`.

---

## 9. Native modules

`wagerproof-mobile/modules/`:

| Module | Native bridge | Swift target |
|---|---|---|
| `audio-route` | iOS `AudioRouteModule.swift` + Objective-C bridge | Reuse the existing Swift source (it's already native; lift into the SwiftUI target's `AudioRoute.swift`) |
| `widget-data-bridge` | Talks to iOS App Group `UserDefaults` | Reuse — wrap as `WidgetDataBridge.swift` in the Swift target. The widget itself already exists at `wagerproof-mobile/targets/` (assuming widget extension) and stays untouched. |

---

## 10. Push handler + auth state coupling

The auth lifecycle is the single most important nav graph edge. RN flow:

```
app launches
  ↓
RootLayout mounts AuthProvider
  ↓
AuthProvider subscribes to supabase.auth.onAuthStateChange
  ↓
RootNavigator sees user state change
  ↓
useEffect routes to (auth) | (onboarding) | (drawer)/(tabs)
  ↓
OnboardingGuard double-checks at child render
```

Swift port:
```swift
@MainActor
@Observable final class RootRouter {
    enum Phase { case launching, unauthenticated, onboarding, ready }
    private(set) var phase: Phase = .launching
    // listens to AuthStore.authState (AsyncStream from Supabase)
}

struct RootView: View {
    @State var router = RootRouter()
    var body: some View {
        switch router.phase {
        case .launching: SplashView()
        case .unauthenticated: AuthRouter()
        case .onboarding: OnboardingView()
        case .ready: MainTabView()
        }
        .onOpenURL { url in router.handle(deepLink: url) }
    }
}
```

This single state machine subsumes RN's `RootNavigator` + `OnboardingGuard` double-check.

---

## 11. Open questions logged for Phase 2

Anything ambiguous after this sweep is captured here; implementer agents should resolve in their batch. None block scaffolding.

- **WagerBot edge function names**: `wagerBotChatService` and `wagerBotVoiceService` exact `functions.invoke` arg strings must be re-grepped during the Chat batch. The streaming surface (SSE format) needs a single Swift `AsyncThrowingStream<ChatChunk, Error>` parser owned by `WagerBotAPI`.
- **Sportsbook deep-link map**: confirm full set of supported sportsbooks during the GameCards batch by reading `services/theOddsApi.ts` end-to-end.
- **`SettingsContext` shape**: full enumeration of persisted keys + their on-disk schema during the Settings batch.
- **Onboarding step graph**: enumerate every `OnboardingContext.setStep` call site so the SwiftUI `TabView` carousel preserves order + branching.
