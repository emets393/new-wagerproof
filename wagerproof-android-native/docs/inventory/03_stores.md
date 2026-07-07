# 03 — Stores Inventory (WagerproofStores → com.wagerproof.core.stores)

Parity contract for porting every store in
`wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/` (**54 Swift files**, ~11,970 lines)
to Kotlin/Compose.

**Port mapping convention** (applies to every store below unless noted):

| iOS | Android |
|---|---|
| `@Observable @MainActor final class` | `@Stable class` with `var x by mutableStateOf(...)` |
| `public private(set) var` | `var x by mutableStateOf(...); private set` |
| `Task { ... }` stored in a `Task<Void, Never>?` | `scope.launch { ... }` stored in a `Job?` (store-owned `MainScope()` / `CoroutineScope(Dispatchers.Main + SupervisorJob())`) |
| `Task.sleep(nanoseconds:)` | `delay(ms)` |
| `for await x in stream` | `flow.collect { }` inside `scope.launch` |
| computed `var` | Kotlin `get()` property (Compose recomposes because it reads snapshot state) |
| `#if DEBUG debugSet(...)` | `@VisibleForTesting fun debugSet(...)` gated on `BuildConfig.DEBUG` |
| `UserDefaults` / App Group defaults | `SharedPreferences` (or DataStore) — keep KEY STRINGS byte-identical for future migration tooling |
| SwiftUI `.environment(store)` | CompositionLocal (e.g. `LocalAuthStore`) or constructor injection from the Activity-scoped graph |

**Creation/injection map (verified against the app target):**

- **App-root, environment-injected (singletons for the process):** `AuthStore`, `RootRouter`, `OnboardingStore`, `ThemeStore`, `LearnWagerProofStore`, `RevenueCatStore`, `AdminModeStore`, `SettingsStore`, `ProAccessStore(revenueCat:adminMode:)`, `AgentPickAuditStore`, `DebugDataModeStore` (DEBUG) — created as `@State` in `WagerproofApp` and pushed via `.environment(...)` in `RootView`.
- **Tab-shell (`MainTabView`) owned, environment-injected below it:** `MainTabStore`, `GamesStore`, `PropsStore`, `NFL/CFB/NBA/NCAAB/MLBGameSheetStore`, `MLBBettingTrendsStore`, `MLBF5SplitsStore`, `OutliersTrendsStore` (plus, per feature usage, `SearchStore` in `SearchView`).
- **Per-screen:** `AgentsStore`, `LeaderboardStore`, `TopAgentPicksFeedStore`, `FavoriteAgentsStore` (AgentsView); `AgentDetailStore(agentId:)` (detail/settings/public-detail screens); `WagerBotChatStore` (chat sheet); `LiveScoresStore` (ScoreboardView); `AgentChatStore(agentId:)`, `AgentCreationStore`, `NBAMatchupOverviewStore`, all remaining tool stores — created where the screen mounts.
- **Static/enum utilities (no instances):** `AgentPicksSeenStore`, `SportSeason`, `MLBBucketHelper`.

---

## 1. App phase & navigation

### 1.1 RootRouter (`RootRouter.swift`)

**Purpose:** Top-level router driving the root view's phase switch (launching / auth / onboarding / main app). Also queues deep links until auth resolves. Android: this is the state machine behind the root `when(phase)` composable switch.

**Created:** app root (`@State` in `WagerproofApp`), environment-injected.

**Nested types:**
- `enum Phase { launching, unauthenticated, onboarding, ready }`
- `static let temporarilyDisableOnboarding = true` — **TEMPORARY hard bypass** of the onboarding wizard (added 2026-05-29). Authenticated users land straight in `.ready`. Port this flag verbatim (a `const val`) — flipping it back re-enables the wizard.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `phase` | `Phase` | `.launching` | private(set) |
| `forceOnboardingForTesting` | `Bool` | `false` | private(set). In-memory only; set by Secret Settings "Reset Onboarding"; cleared when onboarding completes or on sign-out |
| `testPaywallOverride` | `Bool` | `false` | private(set). Survives into `.ready` so RootView can force the post-onboarding paywall for a Pro/admin tester; cleared via `clearTestPaywallOverride()` |
| `pendingDeepLinkRoute` | `DeepLinkRoute?` | `nil` | private(set). Deep link captured before auth resolved |

**Methods:**
- `resolve(authPhase: AuthStore.Phase, onboardingComplete: Bool)` — the ONLY phase mutator in normal flow. Logic:
  - auth `.launching` → `phase = .launching`
  - auth `.unauthenticated` → clears `forceOnboardingForTesting` + `testPaywallOverride`, `phase = .unauthenticated`
  - auth `.authenticated` → if `onboardingComplete` clear `forceOnboardingForTesting`; then `bypass = temporarilyDisableOnboarding && !forceOnboardingForTesting`; `phase = (onboardingComplete || bypass) ? .ready : .onboarding`
- `forceOnboardingForTestingNow()` — sets both test flags true, `phase = .onboarding`. Caller must reset `OnboardingStore` first.
- `clearTestPaywallOverride()`
- `handle(deepLink url: URL)` — parses `DeepLinkRoute(url:)`; stores into `pendingDeepLinkRoute` in ALL phases (queue-until-ready).
- `consumePendingDeepLink() -> DeepLinkRoute?` — read+clear (defer-nil). Called by root view's `onChange(of: phase)` when `.ready` is reached.

**`DeepLinkRoute` enum** (same file, top-level): `agents | outliers | feed | resetPassword`. `init?(url:)` requires scheme `wagerproof`; host (or first path component) maps `"agents"→.agents`, `"outliers"→.outliers`, `"feed"→.feed`, `"reset-password"→.resetPassword`, **anything else → `.feed`** (RN default). Android: parse from `Intent.data`.

**Dependencies:** consumes `AuthStore.Phase` + `OnboardingStore.isComplete` (caller wires them; the router holds no refs). **Persistence:** none.

### 1.2 MainTabStore (`MainTabStore.swift`)

**Purpose:** Bottom-tab selection + tab-shell-level sheet/navigation flags + cross-tab agent navigation handoff. Android: back this with the bottom-nav state + per-tab `NavHostController` stacks; the booleans become either dialog/sheet visibility state or nav events.

**Created:** in `MainTabView.init` (`MainTabStore()` → `@State`), environment-injected to all tabs.

**Nested types:**
- `enum Tab: String { games, props, agents, outliers, scoreboard, settings, search }` — visible bar order on iPhone: Games → Props → Agents → Outliers → Scoreboard. `search` is iOS 18's detached search-tab slot; `settings` is retained only for the SideMenuSheet's Settings row (Settings is no longer a tab — it is *pushed* onto the active tab's NavigationStack via `isSettingsPresented`).
- `struct PendingAgentRoute: Equatable { agentId: String, isPublic: Bool }` — `isPublic=true` → public read-only agent detail; `false` → own-agent detail.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `selected` | `Tab` | `.games` | mutable from views |
| `isSideMenuPresented` | `Bool` | `false` | hamburger side-menu sheet |
| `isFeatureRequestsPresented` | `Bool` | `false` | Feature Requests sheet presented by the TAB SHELL. The side menu (itself a sheet) dismisses FIRST, then flips this — chaining sheets inside the menu sheet orphans presentations. Replicate the two-step handoff on Android (dismiss bottom sheet, then show the next) |
| `isRoastPresented` | `Bool` | `false` | Roast full-screen cover; same chained-dismissal pattern |
| `isSettingsPresented` | `Bool` | `false` | Push Settings onto the ACTIVE tab's nav stack. Each tab consumes the flag guarded by `selected == tab` so only the on-screen tab pushes. Triggered by the WagerProof wordmark (top-leading), side-menu Settings row, and the WagerBot Pro upsell |
| `isChatPresented` | `Bool` | `false` | WagerBot chat sheet, mounted centrally on the tab shell so it works identically from every tab and dismisses even if the user pivots tabs |
| `pendingAgentRoute` | `PendingAgentRoute?` | `nil` | Set by global Search when the user taps an agent result; `AgentsView` observes, appends the matching route to ITS OWN NavigationPath, then clears. Cross-tab deep-navigation handoff — keep as a plain value type so the store stays decoupled from the Agents feature |
| `scrollToTopTrigger` | `UUID` | random | private(set). Bumped when the user RE-TAPS the active tab; tab roots observe and scroll-to-top/reset. Android: `var scrollToTopTrigger by mutableStateOf(UUID.randomUUID())` or a monotonic Long |

**Methods:**
- `select(_ tab: Tab)` — if `tab == selected` bump `scrollToTopTrigger` (new UUID); else set `selected`.
- `apply(deepLink route: DeepLinkRoute) -> Tab?` — `.agents → selected=.agents (returns .agents)`, `.outliers → .outliers`, `.feed → .games`, `.resetPassword → nil` (auth router's concern).

**Dependencies:** consumes `DeepLinkRoute` values from RootRouter. **Persistence:** none.

---

## 2. Auth & session

### 2.1 AuthStore (`AuthStore.swift`)

**Purpose:** Owns the auth lifecycle, active `Profile`, and sign-in/up/reset flows against Supabase Auth (mirrors RN AuthContext). Android: Supabase-kt `auth.sessionStatus` Flow replaces `authStateChanges`.

**Created:** app root, environment-injected.

**Nested type:** `enum Phase { launching, unauthenticated, authenticated(userId: UUID) }`.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `phase` | `Phase` | `.launching` | private(set) |
| `profile` | `Profile?` | `nil` | private(set); row from `profiles` table |
| `lastError` | `String?` | `nil` | private(set) |
| `lastSuccessAt` | `Date?` | `nil` | private(set); bumped after each successful auth mutation — views use it as a haptic/`sensoryFeedback` trigger |

Private: `listenerTask: Task<Void, Never>?` → Kotlin `Job?`.

**Methods:**
- `start()` — idempotent (`guard listenerTask == nil`). Spawns a task consuming `MainSupabase.shared.client.auth.authStateChanges` (async sequence); each `(event, session)` goes to `handle(event:session:)` on the main actor.
- `stop()` — cancel + nil the listener Job.
- `clearError()`
- `signIn(email:password:) async` — `auth.signIn`; on success clear error + set `lastSuccessAt`; on failure `lastError = localizedDescription`.
- `signUp(email:password:) async` — same, with `redirectTo: URL("wagerproof://")` (**preserve byte-for-byte**).
- `signOut() async` — `auth.signOut()`; then `phase = .unauthenticated`, `profile = nil`.
- `sendPasswordReset(email:) async` — `resetPasswordForEmail` with redirect `wagerproof://reset-password` (**byte-for-byte**).
- `signInWithApple(idToken:nonce:) async` — trades an Apple identity token via `signInWithIdToken(provider: .apple)`. Android: replace with Google-only or Credential Manager; keep the method seam.
- `signInWithGoogle() async` — presents GIDSignIn from the top UIViewController, trades tokens via `signInWithIdToken(provider: .google, idToken, accessToken)`. **User-cancelled errors are silently swallowed** (typed `GIDSignInError.canceled` check — replicate with the Google Identity SDK's cancellation code, not string matching).
- Private `handle(event:session:)` — `.signedIn/.tokenRefreshed/.userUpdated/.initialSession` with a user id → `phase = .authenticated(userId)` + `loadProfile(userId)`; with NO session and still `.launching` → `.unauthenticated`. `.signedOut` → `.unauthenticated` + `profile=nil`. `.passwordRecovery/.userDeleted/.mfaChallengeVerified` → no-op.
- Private `loadProfile(userId)` — `profiles.select().eq("id", userId).single()`. **Failure is swallowed** (profile may not exist for new sign-ups; onboarding creates it).
- DEBUG `debugSet(phase:profile:)`.

**Services:** `MainSupabase` client, GoogleSignIn SDK. **Persistence:** none directly (Supabase SDK persists the session itself).

---

## 3. Onboarding

### 3.1 OnboardingStore (`OnboardingStore.swift`)

**Purpose:** The onboarding wizard's entire state: local-first completion flag, 20-step pointer, survey answers, embedded agent-builder draft. Mutations are cache-first with fire-and-forget background sync to `profiles` — server failure NEVER blocks the user.

**Created:** app root, environment-injected.

**Nested types:**
- `enum Step: Int (1...20), Comparable` — `terms=1, sportsSelection=2, sportsShowcase=3, bettorType=4, personalizedValue=5, acquisitionSource=6, primaryGoal=7, agentValueIntro=8, agentValueProof=9, attPriming=10, builderSports=11, builderArchetype=12, builderMindset=13, builderBetStyle=14, builderDataTrust=15, builderSportRules=16, builderInsights=17, builderIdentity=18, generation=19, reveal=20`. Raw values MUST stay contiguous (±1 navigation arithmetic). Derived: `isCinematic` (`>= .generation`), `carouselIndex` (`rawValue-1`, nil for cinematic), `carouselPageCount = 18`, `progress` (`rawValue/18`, nil for cinematic).
- `enum BettorType: String { casual, serious, professional }`
- `struct SurveyAnswers: Codable` — `favoriteSports: [String] = []`, `age: Int?` (dormant, kept for Codable shape), `bettorType: BettorType?`, `mainGoal: String?`, `emailOptIn: Bool?`, `acquisitionSource: String?`, `termsAcceptedAt: String?` (ISO8601), `overEighteenAttested: Bool?`.
- `struct AgentDraft: Codable` — `preferredSports: [SportLeague] = []`, `archetype: String?`, `name = ""`, `avatarEmoji = "🤖"`, `avatarColor = "gradient:#6366f1,#ec4899"`, `spriteIndex: Int? = nil`, `personalityParams = .default`, `customInsights = .empty`, `autoGenerate = true`, `autoGenerateTime = "09:00"`, `autoGenerateTimezone = "America/New_York"`. **Tolerant decoder** — every field falls back to the default individually so older payloads decode.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `isComplete` | `Bool` | `false` | private(set) |
| `currentStep` | `Step` | `.terms` | private(set) |
| `survey` | `SurveyAnswers` | empty | private(set) |
| `agentDraft` | `AgentDraft` | defaults | private(set) |
| `advanceCount` | `Int` | `0` | private(set); haptic trigger, bumps on each advance |
| `isTransitioning` | `Bool` | `false` | private(set); 350ms double-tap lock |
| `hasScrolledTermsToBottom` | `Bool` | `false` | private(set); transient per-run UI state kept in the store because the pager unmounts pages |
| `hasCheckedTerms` | `Bool` | `false` | private(set) |
| `hasChosenArchetype` | `Bool` | `false` | private(set); tracked separately because the "from scratch" path leaves `archetype` nil |
| `agentPitchSlide` | `Int` | `0` | private(set); 0..2, `agentPitchSlideCount = 3` |

Private: `attachedUserId: String?`, `validationTask: Task?` → `Job?`.

**Methods:**
- `attachUser(userId: String)` — idempotent per userId. Step 1: SYNCHRONOUS cache read `AppGroup.defaults.bool(AppGroupKey.onboardingComplete(userId:))` → `isComplete` (no spinner between splash and next screen). Step 2: cancel + relaunch `validationTask` → `validateAgainstSupabase(userId)`.
- `detachUser()` — cancel task, nil userId, `isComplete=false`, `resetToStart()`. Per-user cache entry STAYS so re-sign-in is instant.
- Private `validateAgainstSupabase(userId) async` — reads `profiles.onboarding_completed` (single row keyed by `user_id`). Re-checks `attachedUserId == userId` after the await (auth may have flipped). If server true and local false → upgrade local + write cache. **Never downgrades true→false** (local completion may not have synced yet). Failures swallowed.
- `advance()` / `back()` — guarded by `isTransitioning`; move ±1 step; set `isTransitioning=true` then a 350ms sleep task resets it (matches carousel slide duration). `advance()` also bumps `advanceCount`.
- `resetToStart()` — step→`.terms`, wipe survey/draft/transient flags.
- `canAdvance(from step: Step) -> Bool` — the single CTA-gating surface: `.terms → hasCheckedTerms`; `.sportsSelection → !favoriteSports.isEmpty`; `.bettorType → bettorType != nil`; `.acquisitionSource → != nil`; `.primaryGoal → mainGoal != nil`; `.builderSports → !preferredSports.isEmpty`; `.builderArchetype → hasChosenArchetype`; `.builderIdentity → trimmed name non-empty && ≤50 chars`; all other steps → `true`.
- Survey mutators: `setFavoriteSports`, `toggleFavoriteSport`, `setBettorType`, `setMainGoal`, `setAcquisitionSource`, `setTermsScrolledToBottom`, `setTermsChecked(_:)`, `setTermsAccepted()` (stamps `termsAcceptedAt` ISO8601 now + `overEighteenAttested=true`).
- Agent-draft mutators: `setAgentSports`, `setAgentArchetype`, `setArchetypeChosen`, `setAgentPitchSlide` (clamped 0..2), `setAgentName`, `setAgentEmoji`, `setAgentColor`, `setAgentDraft(_:)` (whole-draft replace — used to project the embedded `AgentCreationStore` back in).
- `markComplete()` — order matters: (1) `isComplete = true` + cache write FIRST (never blocks, never re-shows onboarding on network failure); (2) `MetaAnalyticsService.shared.trackCompleteRegistration(method: "email")` (Meta SDK install→register funnel); (3) snapshot survey+draft and `Task.detached` → `syncToSupabase` (fire-and-forget `profiles.update({onboarding_data, onboarding_completed: true})` keyed by `user_id`; failure dropped — FIDELITY-WAIVER #027: no offline write queue).
- `reset()` — dev tool: `isComplete=false` + cache write false + `resetToStart()`.
- DEBUG: `debugSet(step:)`, `debugSet(survey:)`, `debugSet(agentDraft:)`.

**Sync payload shape** (must round-trip with RN's `CreateAgentFormState`): `onboarding_data = { favoriteSports, age?, bettorType?, mainGoal?, acquisitionSource?, termsAcceptedAt?, overEighteenAttested?, agentFormState: { preferred_sports: [String], archetype?, name, avatar_emoji, avatar_color, sprite_index?, personality_params, custom_insights, auto_generate, auto_generate_time, auto_generate_timezone } }` + `onboarding_completed: true`.

**Persistence:** per-user key `AppGroupKey.onboardingComplete(userId:)` in App Group defaults → SharedPreferences key with the same per-user shape.

---

## 4. Subscription / entitlements

### 4.1 RevenueCatStore (`RevenueCatStore.swift`)

**Purpose:** Bootstraps the Purchases SDK, aliases the Supabase user, subscribes to the customer-info stream, caches entitlement state. Carries the **trust-downgrade guard**: an untrusted (stream) update never flips granted→denied — only trusted refreshes can.

**Created:** app root, environment-injected. Android: RevenueCat Purchases Android SDK.

**Nested types:**
- `enum EntitlementStatus: String { unknown, granted, denied }`
- `enum CustomerInfoSource { login, loginRestore, refresh, purchase, restore, stream }` — `isTrusted` = everything except `.stream`.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `isInitialized` | `Bool` | `false` | private(set) |
| `isLoading` | `Bool` | `true` | private(set) |
| `hasResolvedActiveUserEntitlement` | `Bool` | `false` | private(set). True only after a LIVE fetch for the signed-in user succeeded. Gates the post-onboarding paywall so paying users don't see a one-frame paywall flash from the SDK's stale cached `.denied` on cold launch |
| `customerInfo` | `CustomerInfo?` | `nil` | private(set) |
| `offering` | `Offering?` | `nil` | private(set) |
| `entitlementStatus` | `EntitlementStatus` | `.unknown` | private(set) |
| `subscriptionType` | `String?` | `nil` | private(set) |
| `lastError` | `String?` | `nil` | private(set) |
| `forceFreemiumMode` | `Bool` | from defaults | PUBLIC var; `didSet` persists to key `"rc_force_freemium"`. Secret-settings "Simulate Freemium" |

Computed: `isPro` (`false` if forceFreemium, else `granted`), `isEntitlementResolved` (`!= .unknown`).
Private: `streamTask: Task?` → `Job?`, `currentUserId: UUID?`.

**Methods:**
- `init()` — reads `rc_force_freemium` from App Group defaults.
- `bootstrap()` — idempotent; `RevenueCatService.shared.bootstrap(userId: nil)`; `isInitialized = isConfigured`; `startCustomerInfoStream()` immediately (don't miss StoreKit/Play Billing lifecycle events).
- `attachUser(_ userId: UUID) async` — guard initialized. `isLoading=true`; `logIn(userId.uuidString)` → `apply(info, .login)` → `refreshOffering()` → `hasResolvedActiveUserEntitlement=true` (SUCCESS PATH ONLY). On failure: `lastError`; entitlement stays unchanged unless `.unknown` (then → `.denied`) — never downgrade paying users on a network blip. `isLoading=false`.
- `detachUser() async` — `logOut()`, clear info, `entitlementStatus=.denied`, `subscriptionType=nil`, `isLoading=false`, `hasResolvedActiveUserEntitlement=false`.
- `refreshCustomerInfo() async` — trusted; may downgrade. Also sets `hasResolvedActiveUserEntitlement=true` on success; `.unknown→.denied` on failure.
- `restorePurchases() async throws` — trusted `.restore`.
- `syncPurchases() async throws` — trusted `.refresh`.
- `refreshOffering() async` — `currentOffering()`; nil on failure.
- `fetchOffering(forPlacement:) async -> Offering?`.
- `clearError()`.
- Private `apply(_ info, source:)` — compute `hasEntitlement` / next status / next type. **Guard:** if currently `.granted`, next `.denied`, source untrusted → RETURN without applying. Otherwise set all three, then persist coarse snapshot to App Group: `AppGroupKey.proEntitlementGranted` (Bool) and `AppGroupKey.proSubscriptionType` (String, removed when nil) — widgets/cold-launch UI read them.
- Private `startCustomerInfoStream()` — one Job collecting `Purchases.shared.customerInfoStream`, applying each as `.stream`.
- DEBUG `debugSet(status:subscriptionType:isLoading:)`.

**Persistence keys:** `rc_force_freemium`, `AppGroupKey.proEntitlementGranted`, `AppGroupKey.proSubscriptionType`.

### 4.2 ProAccessStore (`ProAccessStore.swift`)

**Purpose:** Thin reactive facade combining `RevenueCatStore` + `AdminModeStore` into one "can the user see Pro features?" answer.

**Created:** app root: `ProAccessStore(revenueCat:adminMode:)` (constructor-injected deps — keep constructor injection on Android).

**No stored observable state** — all computed (reads transitively track the underlying stores; in Compose this works automatically because the getters read the dependencies' snapshot state):
- `isPro` — priority: `forceFreemiumMode → false`; `isAdmin → true`; else `entitlementStatus == .granted`.
- `isAdmin` — `adminMode.isAdmin`.
- `subscriptionType` — nil for role-flagged admins without a real subscription; else RC's value.
- `isLoading` — `!adminMode.roleResolved || (!isAdmin && !rc.isEntitlementResolved) || rc.isLoading`.
- `revenueCatStore` / `adminModeStore` accessors (views present paywall/customer center directly).

### 4.3 AgentEntitlementsStore (`AgentEntitlementsStore.swift`)

**Purpose:** Freemium/Pro gating for agent creation, pick visibility, leaderboard ranks. Backed by `ProAccessStore` (constructor-injected).

**Constants:** `freeAgentLimit=1`, `proMaxActiveAgents=10`, `proMaxTotalAgents=30`, `freeLeaderboardMinRank=6`, `freeLeaderboardMaxRank=10`, `maxConcurrentActiveAgents=8` (hard "8 desks" cap for any tier).

**All computed:** `isPro/isAdmin/isLoading` (delegate), `canViewAgentPicks = isPro||isAdmin`, `canCreatePublicAgent`, `canUseAutopilot` (same), `maxActiveAgents` (nil for admin; 10 pro / 1 free), `maxTotalAgents` (nil; 30 / 1).
**Methods:** `canCreateAnotherAgent(activeCount:totalCount:)` — admin always; pro gates on TOTAL < 30; free gates on ACTIVE < 1. `canViewLeaderboardRank(_ rank:)` — pro/admin all; free only ranks 6–10 (the tease window).

---

## 5. Games feed & game sheets

### 5.1 GamesStore (`GamesStore.swift` — 2,267 lines, the largest store)

**Purpose:** The Games tab's entire data layer: five per-sport caches, per-sport search/sort state, and the full fetch+merge pipelines against the CFB (sports-data) Supabase project. All queries are byte-identical to RN — do NOT change select strings/table names.

**Created:** `MainTabView` (`@State`), environment-injected to all tabs (Search binds to it too).

**Nested types:**
- `enum Sport: String, CaseIterable { mlb, nba, ncaab, nfl, cfb }` with `label` and `static displayOrder(on date:)` — **seasonal picker order**: football-first `[nfl, cfb, mlb, nba, ncaab]` from Sept 1 through Feb 15 (computed in ET); otherwise `[mlb, nfl, cfb, nba, ncaab]`.
- `enum SortMode: String { time, spread, ou }`
- `enum LoadState { idle, loading, loaded, refreshing, failed(String) }`
- `struct SportFeed { nfl: [NFLPrediction], cfb: [CFBPrediction], nba: [NBAGame], ncaab: [NCAABGame], mlb: [MLBGame] }` — all `[]`.
- ~15 private Decodable row structs (NFLViewRow, NFLPredictionRow, NFLBettingRow, WeatherRow, NFLDryrunGameRow, CFBInputRow, CFBAPIRow, CFBDryrunGameRow, CFBDryrunFlagRow, FlexibleString, NBAInputRow, NBAPredictionRow, NCAABInputRow, NCAABPredictionRow, NCAABMappingRow, MLBGamesTodayRow, MLBPredictionsCurrentRow, MLBSignalsRow, SignalPayloadItem) — port as Kotlin `@Serializable` DTOs with identical `SerialName`s. `FlexibleString` (string-or-number id) and the MLB signal decoding (jsonb array | text[] of JSON strings | JSON string, with case-variant keys `category/Category/type` etc.) need custom serializers.

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `games` | `SportFeed` | empty | private(set) |
| `loadState` | `[Sport: LoadState]` | all `.idle` | private(set) |
| `lastFetched` | `[Sport: Date]` | `[:]` | private(set) |
| `selectedSport` | `Sport` | `displayOrder().first ?? .mlb` | mutable |
| `sortModes` | `[Sport: SortMode]` | all `.time` | mutable |
| `searchTexts` | `[Sport: String]` | all `""` | mutable |
| `dryRunPreviewEnabled` | `Bool` | `false` | set by tab shell from `AdminModeStore.dryRunPreviewEnabled` |

Private: `cacheTTL = 5 * 60` seconds.

**Methods:**
- Accessors `nflGames()/cfbGames()/mlbGames()`, `isLoading(sport:)`, `errorMessage(sport:)`.
- `refresh(sport:force:) async` — DEBUG DummyDataMode branch first (serves captured slates for cfb/nba/ncaab; MLB + NFL stay live). TTL guard: skip if `!force && Date()-lastFetched < 5min`. Sets `.loading`, dispatches to the per-sport fetch, `.loaded`+timestamp on success, `.failed("Failed to fetch {label} games")` on error.
- `refreshAll(force:) async` — `withTaskGroup` parallel refresh of all five sports (Android: `coroutineScope { Sport.entries.map { async { refresh(it, force) } }.awaitAll() }`).
- Filtered+sorted accessors (search filter on team names, case-insensitive substring; MLB also matches abbrs):
  - `sortedNFL()` — time: epoch(gameDate) asc; spread/ou: confidence desc where `confidence(p) = max(p, 1-p)`.
  - `sortedCFB()` — ALL modes sort by conviction tier rank asc then kickoff asc (`sortCFBByConviction`).
  - `sortedNBA()` / `sortedNCAAB()` — time: gameTime string asc (fallback gameDate); spread: confidence(homeAwaySpreadCoverProb); ou: confidence(ouResultProb).
  - `sortedMLB()` — time: epoch(gameTimeEt ?? officialDate) asc; spread: max |ml edge| desc; ou: |ouEdge| desc.
  - `parseEpoch` helper: ISO8601 (with/without fractional seconds) then `"yyyy-MM-dd HH:mm:ss"` then `"yyyy-MM-dd"` (POSIX/UTC).
- **fetchNFL:** (1) try `fetchNFLDryrun` — warm `NFLTeamsService` cache, read ALL of `nfl_dryrun_games` ordered by kickoff, map to `NFLPrediction` (huge field mapping incl. fg/tt/h1 markets, conviction, weather; spreads home-relative; ML doubles rounded to Int; `runId = "nfl-dryrun-{season}-{week}"`; slot labels `thu_fri→Thu/Fri, sun_early→Sun Early, sun_late_sat→Sun Late, snf→SNF, monday→MNF`), sorted by `topConvictionRank` then kickoff. If non-empty → done. (2) Legacy path: 5 steps — `v_input_values_with_epa` (all rows; empty → return), `nfl_predictions_epa` (keep only rows with the lexicographically-largest `run_id`), `nfl_betting_lines` (explicit 23-column select; keep most-recent `as_of_ts` per `training_key`), `production_weather` (key by training_key), merge on `game.home_away_unique == prediction.training_key` (awaySpread = −homeSpread).
- **fetchCFB:** currently `fetchCFBDryrun()` ONLY (legacy `fetchCFBLegacy` kept but unreferenced). Dryrun: warm `CFBTeamsService`; parallel `cfb_dryrun_games` + `cfb_dryrun_flags` both `.eq("week", 7)` (**hardcoded week 7**) + `CFBSignalDefinitionsService.definitionsBySource()`; attach signal definitions to flags; group flags by gameId; per-game flags sorted active-first → conviction rank → stakeUnits desc; map to `CFBPrediction` (predicted score derived from home/away pts or `(total±margin)/2`; team refs/classification from `CFBTeamAssets`; `runId="cfb-dryrun-wk7-2025"`). Legacy: `cfb_live_weekly_inputs` + `cfb_api_predictions` matched by `id` with a long chain of `??` field fallbacks.
- **fetchNBA:** `nba_input_values_view` (all) + `nba_predictions` (explicit select; keep latest `as_of_ts_utc` per game_id). Client-side derivations: spreadCoverProb = `0.5 ± min(|modelFairHomeSpread − homeSpread| * 0.05, 0.35)` (+ if model fair < vegas), fallback homeWinProb; ouProb = `0.5 ± min(|fairTotal − line| * 0.02, 0.35)`. `calculateAwayML(homeML)` = `homeML > 0 ? -(homeML+100) : 100-homeML`.
- **fetchNCAAB:** `v_cbb_input_values` + `ncaab_predictions` (latest run: prefer newest `as_of_ts_utc` pair, fallback lexicographic max run_id) + `ncaab_team_mapping` (espn_team_id Int-or-String → logo URL `https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png`).
- **fetchMLB:** date window = today..today+2d formatted `yyyy-MM-dd` in ET. (1) `mlb_games_today` gte/lte `official_date`; (2) `mlb_predictions_current` `.in("game_pk", pks)`; (3) `mlb_team_mapping` (index by normalized name AND `mlb_api_id`; fallback to static `MLBTeams`; last-ditch `fallbackMLBAbbrev` = first letters of up to 3 words); (4) `mlb_game_signals` — combined per game in order game → home → away signals.
- DEBUG: `loadDummy(sport:)`, `debugSet(...)`.

**Services:** `CFBSupabase`, `NFLTeamsService`, `CFBTeamsService`, `CFBSignalDefinitionsService`, `DummyDataMode`/`DummyData` (DEBUG). **Persistence:** none (in-memory TTL cache only).

### 5.2 Game-sheet stores (5 files — trivial, identical shape)

`NFLGameSheetStore`, `CFBGameSheetStore`, `NBAGameSheetStore`, `NCAABGameSheetStore`, `MLBGameSheetStore`.

**Purpose:** Drive the per-sport game-detail bottom sheet via `.sheet(item:)`: `selectedGame != nil` presents; nil dismisses. Android: `var selectedGame by mutableStateOf<T?>(null)` driving a `ModalBottomSheet`.

- Properties: `selectedGame: {NFLPrediction|CFBPrediction|NBAGame|NCAABGame|MLBGame}?` (public var, `nil`).
- Methods: `openGameSheet(_ game)`, `closeGameSheet()`.
- `MLBGameSheetStore` additionally has vestigial `games: [MLBGame]` + `lastFetched: Date?` (private(set), only populated by DEBUG `debugSet(games:selected:)` — the real slate lives in `GamesStore`).
- Created in `MainTabView`, environment-injected (opened from feed lists AND from Search results).

### 5.3 PropsStore (`PropsStore.swift`)

**Purpose:** Props tab feed. MLB matchups (game logs + alt-line ladders) + NFL odds-board players; other sports render "coming soon" and never fetch.

**Created:** `MainTabView`, environment-injected (game sheets + Search read it too).

**Nested types:** `enum Sport: String { mlb, nfl, cfb, nba, ncaab }` (MLB first) with `hasProps` (`mlb||nfl`), and bridges `matching(gamesSport:)` / `gamesSport` to mirror the Games tab's selection. `enum LoadState { idle, loading, loaded, failed(String) }`.

**Observable properties:** `selectedSport: Sport = .mlb` (mutable); `matchups: [MLBPropMatchup] = []`, `nflPlayers: [NFLPropPlayer] = []` (private(set)); private `loadState: [Sport: LoadState]`, `lastFetched: [Sport: Date]`; `ttl = 300s`; `dryRunPreviewEnabled: Bool = false` (public var).

**Methods:** derived `isLoading` / `errorMessage` / `hasCachedMatchups` (selected-sport keyed); `matchup(for gamePk:)`; MLB-specific `isLoadingMLB/hasLoadedMLB` + `refreshMLB(force:)` and NFL-specific `isLoadingNFL/hasLoadedNFL` + `refreshNFL(force:)` (sheet/search hydrate paths that ignore `selectedSport`); `sortedMatchups()` (officialDate then gameTimeEt asc); `refresh(force:)` — TTL-guarded fetch of the selected sport via `MLBPlayerPropsService.fetchMatchups()` / `NFLPlayerPropsService.fetchPlayers()`. **Skeleton rule:** only set `.loading` when the cache is empty (silent background refresh over populated cache). On error keep cached data (`.loaded`) if any, else `.failed(friendlyError)` (`NSURLErrorDomain → "No connection. Pull to retry."`). Constructor takes both services (defaults `.shared`) — keep injectable. DEBUG `debugSet` overloads.

### 5.4 SportSeason (`SportSeason.swift`) — not a store; pure utility enum

Per-sport regular-season windows (ET): nfl 9/4–2/15, cfb 8/23–1/20, nba 10/21–6/22, ncaab 11/3–4/8, mlb 3/26–11/5. `isInSeason(sport, on:)` handles year-wrap via `month*100+day` ordinals; `nextSeasonStart`; `emptyCopy(for:itemsNoun:dataNoun:on:)` returns (title, message) — in-season "Refreshing {label} analysis…" vs offseason "{label} is out of season / The season begins {MMMM d}". Port as a Kotlin `object`.

---

## 6. Search

### 6.1 SearchStore (`SearchStore.swift` — 782 lines)

**Purpose:** Global cross-surface search (iOS 18 detached search tab). Does NOT duplicate fetches — it is **bound** to `GamesStore`/`AgentsStore`/`OutliersTrendsStore`/`PropsStore` (weak refs) and derives results via computed properties. Exception: public agents come from a lazily-fetched leaderboard cache.

**Created:** `SearchView` (`@State`), then `bind(...)`-ed by the tab shell.

**Nested types:**
- `enum SearchScope: String { all, games, players, agents, outliers }` — labels: All / Matchup / Props / Agents / Outliers.
- `SearchResult.Game { id, sport: GamesStoreSport, awayTeam, homeTeam, gameTime?, resolvedId, matchScore, matchedAbbr? }` — `resolvedId` = NFL/CFB `unique_id`/`training_key`, NBA/NCAAB/MLB stringified int id; the owning tab resolves the model.
- `SearchResult.Player { id, kind: .mlb(gamePk, playerId, isPitcher) | .nfl(playerKey, gameId), playerName, teamAbbr, matchScore, headlineRank }`.
- `SearchResult.Agent { id, model: AgentWithPerformance, isPublic }`.
- `SearchResult.Trend { id, card: OutliersTrendsCard, sport, game?, matchScore }`.
- `enum GamesStoreSport: String { nfl, cfb, nba, ncaab, mlb }` (local mirror to decouple result rows).

**Observable properties:**

| Property | Type | Initial | Notes |
|---|---|---|---|
| `query` | `String` | `""` | `didSet`: if non-empty clears `browseScope`; schedules 200ms debounce |
| `scope` | `SearchScope` | `.all` | |
| `browseScope` | `SearchScope?` | `nil` | Explore-card browse mode (full category list with empty query) |
| `debouncedQuery` | `String` | `""` | private(set); result accessors filter on THIS |
| `isDebouncing` | `Bool` | `false` | private(set); drives inline ProgressView |
| `recentQueries` | `[String]` | loaded | private(set); last 5 committed, newest first |
| `publicAgents` | `[AgentLeaderboardEntry]` | `[]` | private(set); session cache |
| `isLoadingPublicAgents` | `Bool` | `false` | private(set) |
| `isLoadingSearchIndex` | — | — | lives on OutliersTrendsStore, not here |

Private: weak `gamesRef/agentsRef/trendsRef/propsRef`; `debounceTask: Task?` → `Job?`; `recentQueriesKey = "search.recent.queries"`; limit 5; window 200ms; **`@ObservationIgnored` player-index caches** `mlbPlayerIndex` (+ key `Set<Int>` of gamePks) and `nflPlayerIndex` (+ key `Set<String>`) — rebuild only when the slate key changes, NOT per keystroke (Android: plain non-snapshot fields).

**Methods:**
- `bind(games:agents:trends:props:)` — wire upstream stores (overwrite-safe). On Android use nullable refs (no weak needed if lifecycles match; otherwise `WeakReference`).
- `loadPublicAgentsIfNeeded() async` — guard not loading + cache empty; `AgentPerformanceService.fetchLeaderboard(limit: 100, sport: nil, sortMode: .overall, excludeUnder10Picks: false, timeframe: .allTime, viewerUserId: nil)`; failures → empty (search falls back to own agents).
- `clearPublicAgentsCache()`.
- `applyRecent(_ value)` — set query + `flushDebounce()`.
- `clearRecentQueries()` (also removes the UserDefaults key), private `loadRecentQueries()`.
- `commitCurrentQueryToRecents()` — called by the view on RESULT TAP (records intent, not every pause). Case-insensitive de-dupe preserving original casing; insert at 0; cap 5; persist.
- `browse(_ scope)` — clear query, flush, set `scope` + `browseScope`. `exitBrowse()`.
- Private `scheduleDebounce()` — cancel previous Job, `isDebouncing=true`, launch `delay(200)` → publish `debouncedQuery = query`, `isDebouncing=false`. `flushDebounce()` — cancel + publish immediately.
- Result accessors (all computed): `totalResultCount`; `gameResults` — per-sport loops using `SearchTeamAliases.match` (rank table: exact abbr 100 → mascot/city 90 → prefix 70 → substring 40 → initials 30; best side wins, ties prefer away), sorted score desc with EXPLICIT insertion-order tiebreak (Swift `sorted` is not stable — Kotlin `sortedWith` IS stable, so a plain stable sort suffices); `playerResults` — min query 3 chars, cap 8, `playerScore` = last-name prefix 100 / "initial + lastname" 90 / first-name prefix 70 / full substring 50, ties by `headlineRank` desc (MLB L10 hit%, NFL headline-market L10 rate); `browsePlayerResults` (no query, headlineRank desc, cap 30); `agentResults` — own agents (name contains) first, then publicAgents excluding already-seen avatar ids; `browseAgentResults` (own + leaderboard, de-duped, cap 30); `trendResults` — min 2 chars, cap 12, `trendMatchScore` = subject prefix 100 / abbr exact 95 / subject contains 85 / matchup contains 70 / betType contains 50, ties by `trendValue` desc; `browseTrendResults` (trendValue desc, cap 30).
- DEBUG `debugSetRecent`, `debugSetPublicAgents`.

**Persistence:** `UserDefaults.standard` key `"search.recent.queries"` ([String]).

---

## 7. Live scores

### 7.1 LiveScoresStore (`LiveScoresStore.swift`)

**Purpose:** Scoreboard slate with a 120-second polling loop (mirrors RN `setInterval(fetch, 2*60*1000)`). Note: currently instantiated in `ScoreboardView` (per-screen), though the doc comment says tab-shell level — port where it lives today, sharing is a wiring choice.

**Constants:** `pollInterval: TimeInterval = 120`.

**Observable properties:** `games: [LiveGame] = []`, `loadState: LoadState = .idle` (idle/loading/loaded/failed), `lastRefreshedAt: Date?` — all private(set). Computed: `hasLiveGames`, `isLoading`, `lastError`. Private `pollingTask: Task?` → `Job?`.

**Methods:**
- `start()` — idempotent. Loop: immediate `refresh()`, then `while !cancelled { sleep(120s); refresh() }`. FIDELITY-WAIVER #011: no network-state gating yet. Kotlin: `pollJob = scope.launch { refresh(); while (isActive) { delay(120_000); refresh() } }`.
- `stop()` — cancel + nil.
- `refresh() async` — `LiveScoresService.shared.getLiveScores()`. **On failure keep stale games on screen** (error banner only, never blank the board).
- `byLeague(_ league)` — case-insensitive filter.
- `groupedByLeague()` — dictionary grouping sorted by canonical `leagueOrder`: NFL 1, NCAAF/CFB 2, NBA 3, NCAAB 4, NHL 5, MLB 6, MLS 7, EPL 8, unknown 999.
- DEBUG `debugSet(games:state:)` (does NOT start polling).

---

## 8. Agents stores

### 8.1 AgentsStore (`AgentsStore.swift`)

**Purpose:** Source of truth for the My Agents tab (ports RN's useUserAgents + useUpdateAgent + useDeleteAgent). Also lazily hosts the Top Agent Picks feed (FIDELITY-WAIVER #070).

**Created:** `AgentsView` (`@State`).

**Nested types:** `LoadState { idle, loading, loaded, failed(String) }`; `InnerTab: String { myAgents, leaderboard, topPicks }` with labels "My Agents"/"Leaderboard"/"Top Picks".

**Observable properties:** `agents: [AgentWithPerformance] = []`, `loadState = .idle`, `topPicks: [TopAgentPickFeedRow] = []`, `topPicksLoadState = .idle`, `lastRefreshedAt: Date?` (all private(set)); `activeTab: InnerTab = .myAgents` (public var); `userId: String?` (private(set)). Computed `isLoading`, `lastError`.

**Methods:**
- `bind(userId:)` — no-op if unchanged; resets agents/topPicks/states. The store no-ops all refreshes until a userId is bound (never make unscoped RLS queries).
- `refresh() async` — `AgentService.fetchUserAgents(userId)`; sort by `performance.netUnits` desc, missing performance sinks to bottom (−∞).
- `refreshTopPicks(forceRefresh:) async` — idempotent unless forced; `AgentPicksService.fetchTopAgentPicksFeed(filterMode: "top10", viewerUserId, limit: 50)`.
- Optimistic mutations, all `@discardableResult async -> Bool` with snapshot-rollback on failure: `delete(agentId:)` (`AgentService.delete`), `setActive(agentId:isActive:)`, `setAutoGenerate(agentId:autoGenerate:)`, `setPublic(agentId:isPublic:)`. Pattern: snapshot list → mutate locally → call service → on throw restore snapshot (delete also sets `.failed`).
- Derived: `totalCount`, `activeCount`, `hasAgents`.
- DEBUG `debugSet(agents:state:)`.

### 8.2 AgentDetailStore (`AgentDetailStore.swift` — 627 lines; the generation orchestrator)

**Purpose:** One agent's detail screen (owner OR public). Fetches the detail snapshot, pick/parlay history (preview + full), and orchestrates **V3 pick generation with two nested polling loops**.

**Created:** per-screen `AgentDetailStore(agentId:)` (`AgentDetailView`, `AgentSettingsView`, `PublicAgentDetailView` each construct their own).

**Constants:** `pickHistoryPreviewLimit = 7`. **Nested:** `LoadState`, `PickFilter: String { all, won, lost }` (labels All/Won/Lost), private `TriggerPollOutcome { succeeded, failed(String), timedOutWaiting }`.

**Observable properties:**

| Property | Type | Initial |
|---|---|---|
| `agentId` | `String` | ctor |
| `snapshot` | `AgentDetailSnapshot?` | nil |
| `snapshotLoadState` | `LoadState` | .idle |
| `pickHistory` | `[AgentPick]` | [] |
| `parlayHistory` | `[AgentParlay]` | [] |
| `historyLoadState` | `LoadState` | .idle |
| `performancePicks` | `[AgentPick]` | [] |
| `performanceParlays` | `[AgentParlay]` | [] |
| `performanceLoadState` | `LoadState` | .idle |
| `isGenerating` | `Bool` | false |
| `lastGenerationError` | `String?` | nil |
| `liveRunState` | `TriggerV3RunStatus?` | nil |
| `pickFilter` | `PickFilter` | `.all` (public var) |

**Derived (computed):** `agentWithPerformance`; `todaysPicks` (snapshot's `todaysPicks` if non-empty, else `performancePicks` filtered to local-today — free-tier owners load via direct reads because the snapshot only carries today's picks with server-granted Pro); `todaysParlays` (same shape via `displayDate`); `todaysBetItems` (picks+parlays interleaved, createdAt desc); `todaysGenerationRun`; `activeGenerationRun` (non-nil ⇒ show generating state + resume polling instead of offering a fresh trigger); `serverCanViewAgentPicks` (raw server flag — UI gates on the LOCAL entitlements store instead); `isFollowingFromSnapshot`; `filteredPickHistory` (local filter, no refetch); `fullPickHistory` (graded prior-date picks from performancePicks, fallback to preview, sorted gameDate desc then createdAt desc); `fullBetHistory` (graded picks + graded parlays interleaved); static `isPickHistoryEligible` / `isParlayHistoryEligible` (gameDate < today AND result ∈ {won,lost,push}); static `filterPickHistoryPreview`; `regenerationsRemaining(maxDaily: 3)` — 3/day, resets when `agent.lastGenerationDate != today`, else `max(0, 3 − dailyGenerationCount)`. `localDateString` = `%04d-%02d-%02d` from gregorian components (LOCAL timezone).

**Loaders:**
- `refreshSnapshot() async` — `AgentPicksService.fetchDetailSnapshot(agentId)` (edge fn `agent-authorized-action-v1 / detail_snapshot`).
- `loadHistory(isOwner:) async` — concurrent pick-preview + parlay-preview loads (`async let`); a parlay failure never blanks pick history. **Dual-path preference:** owner → direct table read first (`fetchGradedPickHistory` / `fetchGradedParlayHistory`), fall back to the authorized picks-page RPC; non-owner → RPC page first, fall back to direct read. Page fetches use `fetchPicksPage(agentId, filter:"all", pageSize:50, cursor, includeOverlap:false)`; `loadAllPicksViaAuthorizedPage` loops the cursor until `hasMore==false`. **Parlays ride the FIRST page only** (no cursor) — one uncursored fetch is the complete set.
- `loadPerformancePicks(isOwner:) async` — same dual-path for the FULL pick set + all parlays.

**Generation:**
- `generatePicks() async -> Bool` — guard `!isGenerating`; if `activeGenerationRun?.triggerRunId != nil` → join the live run via `resumeActiveGenerationIfNeeded()` instead of double-triggering. Else: set `isGenerating=true` (defer-reset both it and `liveRunState`); read a fresh `AgentV3SettingsStore()` for `dryRun`/`model` DEBUG knobs; capture `priorRunId = todaysGenerationRun?.id`; `AgentPicksService.requestTriggerV3Generation(agentId, dryRun, modelName)`; then:
  - **Poll loop 1 — `pollTriggerRunUntilComplete(runId, priorRunId)`:** up to **440 attempts × 1.5s (~11 min)**; each tick `TriggerRunStatusService.fetch(runId)` → publish `liveRunState` (drives the live progress card: turn/maxTurns/toolCalls/picksAccepted); terminal+successful → `.succeeded`; terminal+failed → `.failed(metadata.note ?? default message)`; fetch errors logged, loop continues; cancellation → `.timedOutWaiting`.
  - On `.succeeded`: **Poll loop 2 — `pollUntilGenerationCompletes(priorRunId)`:** up to **60 attempts × 4s (~4 min)**; silent `fetchDetailSnapshot` each tick (doesn't flip `snapshotLoadState` — no flicker under the spinner); done when `todaysGenerationRun.id != priorRunId` (the snapshot RPC only surfaces succeeded runs). Then reload history + performance (owner paths) + `notifyGenerationFinished(succeeded: true)` → return true.
  - On `.failed(reason)`: set `lastGenerationError`, reload both, notify failure, return false (skip loop 2 — a failed ledger row never flips to succeeded).
  - On `.timedOutWaiting`: one quiet snapshot check; reload both; if run id unchanged → `lastGenerationError = "This is taking longer than usual — check back in a few minutes for your picks."`, return false; else true. No notification (uncertain outcome).
- `resumeActiveGenerationIfNeeded() async` — call after snapshot load; if a run is live (`activeGenerationRun.triggerRunId`), flip into generating state and ride the EXISTING run through the same loop-1/loop-2 flow (priorRunId = last succeeded run's id), reload, notify on definite outcomes.
- Private `notifyGenerationFinished(succeeded:note:)` — `NotificationService.shared.postGenerationFinishedNotification(...)` (service itself gates on backgrounded app state so it never doubles the on-screen card).

**Mutations:** `setAutoGenerate(_:)` (service + snapshot refresh); `setAutoGenerateTime(_:timezone:)` → `saveSettings(payload: ["auto_generate_time", "auto_generate_timezone"])`; `saveSettings(payload: [String: AnyEncodable])` — `AgentAuthorizedActionsService.updateAgent` then snapshot refresh (errors land in `lastGenerationError`); `delete()`.

**Android note:** run `generatePicks` in a store-scoped Job the screen can keep alive across recompositions; consider a foreground-safe strategy since the poll is ~11 min worst case (iOS behavior: it just runs while the screen exists; notification covers backgrounding).

### 8.3 AgentCreationStore (`AgentCreationStore.swift`)

**Purpose:** The 6-step agent-creation wizard (`totalSteps = 6`). Also embedded inside onboarding's builder pages.

**Nested types:** `SubmitState { idle, submitting, succeeded(Agent), failed(String) }`; `ArchetypesLoadState { idle, loading, loaded, failed(String) }`; `struct Draft` — same defaults as `OnboardingStore.AgentDraft` but typed (`preferredSports: [AgentSport]`, `archetype: AgentArchetype?`).

**Observable properties (all public var):** `draft = Draft()`, `step = 0`, `archetypeRows: [PresetArchetypeRow] = []`, `archetypesLoadState = .idle`, `submitState = .idle`, `existingAgentNames: [String] = []` (set by the view after `AgentsStore.refresh()` for duplicate-name validation).

**Methods:**
- `loadArchetypesIfNeeded() async` — idempotent (skip if loaded/loading); `PresetArchetypeService.fetchAll()`.
- `applyArchetype(_ row)` — set archetype enum (nil if unknown id — never crash on server-side new ids), copy `recommendedSports`, `personalityParams = .applying(row.personalityParams)` (partial merge over defaults), `customInsights = row.customInsights`.
- `clearArchetype()` — nil archetype, params→default, insights→empty, KEEPS chosen sports.
- `toggleSport(_:)` — plain multi-select (MLB exclusivity retired).
- `canProceed(from stepIndex:)` — step 0: sports non-empty; step 1: trimmed name non-empty, ≤50, case-insensitive-unique vs `existingAgentNames`, emoji non-empty, color non-empty; steps 2–5: true; else false.
- `validationError(for:)` — user-facing strings mirroring the above ("Please select at least one sport", "Please enter a name…", "Name must be 50 characters or less", duplicate-name message, "Please select an emoji").
- `advance()` / `back()` — clamped 0..5.
- `submit(autoModeForcedOff:) async -> Agent?` — `shouldStartAuto = draft.autoGenerate && !autoModeForcedOff` (Pro auto-slot-full gate); build `CreateAgentInput`; `.submitting` → `AgentService.create` → `.succeeded(agent)` / `.failed(msg)`.

### 8.4 AgentChatStore (`AgentChatStore.swift`)

**Purpose:** Per-agent chat thread (NOT WagerBot). Optimistic user send: append temp message (`id = "temp-{uuid}"`), swap for the persisted row on success (canonical id), strip on failure; then request the assistant reply while `isAssistantTyping=true` (non-streaming — one awaited reply message).

**Created:** per-screen `AgentChatStore(agentId:userId:)`.

**Observable properties:** `agentId` (ctor), `userId: String?`, `messages: [AgentChatMessage] = []`, `loadState = .idle`, `isAssistantTyping = false`, `lastError: String?` (all private(set)); `draft: String = ""` (public var).

**Methods:** `bind(userId:)` (reset messages/state on change); `refresh()` — `AgentChatService.fetchThread(userId, agentId)`; `send()` — guard userId + non-blank draft; clear draft; optimistic append; `sendUserMessage` → swap temp by id; on catch remove temp + `lastError` + return; then `isAssistantTyping=true` (defer false) → `requestAssistantReply(agentId)` → append reply. Temp timestamps: ISO8601 with fractional seconds.

### 8.5 AgentEntitlementsStore — see §4.3.

### 8.6 AgentPickAuditStore (`AgentPickAuditStore.swift`)

**Purpose:** "Pick Audit" terminal-style sheet state + payload derivation from a pick's `ai_decision_trace` / `ai_audit_payload` JSONB (V2 + V3), with legacy fallbacks.

**Created:** app root (environment) — one instance app-wide.

**Observable properties:** `selectedPick: AgentPick?` (private(set)), `payload: AgentPickAuditPayload` (private(set), empty default), `isPresented: Bool = false` (public var).

**Methods:** `present(pick:)` — set pick, `payload = buildPayload(pick)`, present; `dismiss()` — hide but KEEP `selectedPick` (sheet fade-out; cleared on next present); `clear()` — full wipe (widgets gated on `selectedPick` stop rendering).
`buildPayload` details: leaned metrics from `trace.leaned_metrics[]` (`metric_key` or lenient `metric`; `personality_trait` fallback `"source: {source_tool_call_id}"`), fallback = `keyFactors` enumerated as `key_factor_{n}` with trait `fallback_from_key_factors`; rationale = `trace.rationale_summary` ?? reasoningText ?? "No rationale text available."; alignment fallback string; model panes: `model_input_game_payload` (V2) pretty-printed, personality = `model_input_personality_payload` ?? `steering` (V3), response payload; `isV3 = audit.generation_version == "v3"`; `payloadIsFormatted = isV3 || game payload present`; tool trace from `audit.tool_trace[]` (seq/name/ms/ok/result_excerpt|result_summary, sorted by seq; seq 0 = the slate shown to the model); `fullTraceJSON` = a composed JSON doc `{pick: {...14 fields...}, ai_decision_trace, ai_audit_payload}` for the Copy Full Trace button.

### 8.7 AgentPicksSeenStore (`AgentPicksSeenStore.swift`) — static enum, no instance

**Purpose:** Device-local "seen" ledger for unread badges + the auto-play print cinematic. Deliberately NOT server state.
- Key: `"agent_picks_last_seen_{agentId}"` in `UserDefaults.standard`; value = ISO8601 timestamp string.
- `lastSeen(agentId:) -> String?`; `markSeen(agentId:upTo:)` — **monotonic** (only writes if `ts > existing`, lexicographic compare — valid because PostgREST ISO8601 sorts as string); `hasUnread(agentId:latestActivity:)` — false if no activity; true if never seen; else `latest > seen`.
- Android: `object AgentPicksSeenStore` over SharedPreferences.

### 8.8 AgentV3SettingsStore (`AgentV3SettingsStore.swift`)

**Purpose:** DEBUG tuning for V3 generation (Secret Settings). UserDefaults-backed, no network. NOTE: `AgentDetailStore.generatePicks` constructs a fresh instance to read the persisted values — cheap because init is just two defaults reads.
- `static models = ["deepseek-v4-flash", "deepseek-v4-pro"]` (picker order; old reasoner/chat aliases retired).
- Properties (private(set)): `dryRun: Bool` (key `"agent_v3.dry_run"`), `model: String` (key `"agent_v3.model"`; stored retired ids snap back to `models[0]`).
- `setDryRun(_:)`, `setModel(_:)` (both persist), `snapshot: [String: String]`.

### 8.9 FavoriteAgentsStore (`FavoriteAgentsStore.swift`)

**Purpose:** Device-local favorites set for the Top Picks Favorites filter. (The RN union with server-side flags is handled by view-level combination with `FollowedAgentsStore` — this store is the local leg.)
- Storage: `UserDefaults` key `"topPicksFavoriteAgentIds"` — **keep spelling stable** — serialized as sorted `[String]` of lowercased UUIDs.
- `favoriteIds: Set<String> = []` (private(set), loaded in init). DEBUG init with `suiteName` for tests.
- `isFavorite(_:)`; `toggle(_:) -> Bool` (returns new state for haptics); `setFavorite(_:isFavorite:)`; `clear()`. All normalize ids (trim+lowercase) and persist synchronously.

### 8.10 FollowedAgentsStore (`FollowedAgentsStore.swift`)

**Purpose:** Read-path for the public agents the user follows (`user_avatar_follows` join on MAIN Supabase). Mutations live elsewhere.
- `struct FollowedAgent { avatarId, name, avatarEmoji, avatarColor, isFavorite }`.
- Properties (private(set)): `follows: [FollowedAgent] = []`, `loadState = .idle`, `userId: String?`.
- `bind(userId:)` (reset on change); `refresh()` — select `avatar_id, is_favorite, avatar_profiles(name, avatar_emoji, avatar_color)` eq user_id; defaults: name "Unknown", emoji 🤖, color `#6366f1`, isFavorite false.

### 8.11 LeaderboardStore (`LeaderboardStore.swift`)

**Purpose:** Public leaderboard list + its filter pills. **Every filter property has a `didSet` that fires `Task { await refresh() }`** — on Android use `var field by mutableStateOf(x); set(value) { if (field != value) { field = value; scope.launch { refresh() } } }` or explicit setter functions.
- Typealiases: `SortMode = AgentPerformanceService.LeaderboardSortMode` (incl. `.overall`, `.bottom100`), `Timeframe = ...LeaderboardTimeframe` (incl. `.allTime`).
- Properties: `entries: [AgentLeaderboardEntry] = []`, `loadState = .idle`, `lastRefreshedAt` (private(set)); auto-refreshing filters `sortMode = .overall`, `timeframe = .allTime`, `excludeUnder10Picks = false`, `sport: AgentSport? = nil`.
- `refresh()` — `fetchLeaderboard(limit: 100, sport, sortMode, excludeUnder10Picks, timeframe)`. `isBottomMode` = `sortMode == .bottom100` (win-rate color coding). DEBUG `debugSet`.

### 8.12 TopAgentPicksFeedStore (`TopAgentPicksFeedStore.swift`)

**Purpose:** Top Agent Picks feed: filter mode, server-side search, cursor pagination, per-agent sectioning.
- `enum FilterMode: String { top10, following, favorites }` — **raw values are the RPC `p_filter_mode` wire strings**; each has `label` + `emptyMessage` copy (port the exact strings).
- Properties: `items: [TopAgentPickFeedRow] = []`, `loadState = .idle`, `loadMoreState = .idle`, `cursor: String?`, `hasMore = false`, `lastRefreshedAt` (private(set)); `filterMode = .top10` (didSet → refresh Task); `searchText = ""` (public var; the VIEW debounces via `.task(id:)` ~250ms then calls `applySearchText` — debounce lives in the view, not the store); `appliedSearchText` (private(set)); `viewerUserId: String?` (private(set)); `localFavoriteIds: Set<String> = []` (public var, supplied from FavoriteAgentsStore).
- `bind(viewerUserId:)` (reset); `applySearchText(_:)` (no-op if unchanged, else refresh); `refresh()` — reset cursor/items, fetch page 1 (`pageSize=50`), `hasMore = !page.isEmpty && page.count >= 50`; `loadMore()` — re-entrancy guard on `loadMoreState == .loading`; **dedupe appended rows by id** (created_at cursor can overlap on identical timestamps); `nextCursor = page.last?.createdAt`.
- `filterLocally(_:)` — belt-and-suspenders: favorites mode with local ids falls back to server rows if the filter empties the list; non-empty `appliedSearchText` post-filters agentName/matchup/pickSelection contains.
- `sections: [AgentSection]` — consecutive-run grouping by `avatarId` (NOT a dictionary — preserves feed order; each section = one agent's up-to-4-pick rail).
- Service: `AgentPicksService.fetchTopAgentPicksFeed(filterMode:viewerUserId:searchText:limit:cursor:)`. DEBUG `debugSet`.

---

## 9. Chat (WagerBot)

### 9.1 WagerBotChatStore (`WagerBotChatStore.swift`)

**Purpose:** In-memory chat state for the WagerBot sheet: thread id/title, ContentBlock-based message list, **SSE streaming state**, thread history. History persistence is fully server-side (the edge function writes both roles to `chat_messages`) — the store never inserts.

**Created:** `WagerBotChatView` (`@State`); presented via `MainTabStore.isChatPresented`.

**Observable properties:**

| Property | Type | Initial |
|---|---|---|
| `messages` | `[WagerBotMessage]` | `[]` |
| `isStreaming` | `Bool` | `false` |
| `threadId` | `String?` | nil |
| `threadTitle` | `String?` | nil |
| `lastError` | `String?` | nil |
| `threads` | `[WagerBotThreadSummary]` | `[]` |
| `historyLoadState` | `HistoryLoadState` | `.idle` (idle/loading/loaded/failed) |
| `draft` | `String` | `""` (public var) |
| `boundUserId` | `String?` | nil (private(set), via `bind(userId:)`) |

Private: `streamTask: Task?` → `Job?`. Computed: `isWaitingForFirstBlock` — `isStreaming && last message is assistant && blocks.isEmpty` (drives the thinking indicator).

**Message model (parity-critical):** `WagerBotMessage { id, role, blocks: [ContentBlock] }` where blocks are `.text(id, text)`, `.thinking(id, text)`, `.toolUse(id, name, argumentsJSON, status: .running | .done(ms, ok, summary))`, `.chatWidgets(id, widgets)`, `.appComponents(id, summary, components)`, `.followUps(id, questions)`.

**Methods:**
- `bind(userId:)`.
- `send(text:)` — trim/guard; **cancel any previous streamTask**; append `WagerBotMessage.user(trimmed)` + `assistantPlaceholder()`; `isStreaming=true`; clear draft; pin `assistantId` + current `threadId`; launch Job: `for try await event in WagerBotChatService.shared.startRun(userMessage:threadId:)` → `apply(event, toMessageId: assistantId)` on main (break on cancel); transport `catch` → `applyTransportError`; finally `isStreaming=false`, `streamTask=nil`, then best-effort `refreshHistory(boundUserId)` so the drawer picks up the new/renamed thread.
- `cancel()` — cancel Job, `isStreaming=false`.
- `newConversation()` — cancel; wipe messages/threadId/threadTitle/draft/lastError. Server thread stays in history.
- `loadThread(_ summary) async` — cancel; wipe; set id+title; hydrate via `WagerBotThreadService.loadMessages(threadId)`.
- `refreshHistory(userId:) async` — `listThreads(userId)`.
- `deleteThread(_ id) async` — service delete; remove locally; if it was the active thread → `newConversation()`.
- `deleteAllThreads() async` — guard boundUserId; delete all; clear; new conversation.
- **`apply(event:toMessageId:)` — the SSE reducer** (indexed by message ID, not position, so a parallel `loadThread` swap can't smash the target):
  - `.thread(id, _)` → adopt id only if `threadId == nil`.
  - `.contentDelta(text)` → append to the LAST text block, or push a new `.text(id: "t_{uuid}")`.
  - `.thinkingDelta(text)` → same pattern into `.thinking(id: "th_{uuid}")`.
  - `.thinkingDone` → **remove all thinking blocks** (answer arrives as text deltas; never show CoT beside it).
  - `.toolStart(id, name, argsJSON)` → append `.toolUse(..., status: .running)`.
  - `.toolEnd(id, _, ms, ok, summary)` → find toolUse block by id, replace status with `.done(ms, ok, summary)`.
  - `.gameCards(cards)` → parsed but INTENTIONALLY DROPPED (legacy surface; keeps old threads loadable).
  - `.chatWidgets(widgets)` → append `.chatWidgets(id: "w_{uuid}")`.
  - `.appComponents(summary, components)` → append `.appComponents(id: "ac_{uuid}")` (V2 rich tappable components).
  - `.followUps(questions)` → REPLACE any existing followUps block, append fresh `.followUps(id: "f_{uuid}")`.
  - `.threadTitled(id, title)` → if `threadId == id` set `threadTitle`.
  - `.messagePersisted` / `.done` → no-op.
  - `.error(code, message)` → append error TEXT block `"Sorry, something went wrong ({code}): {message}"` + `lastError`.
- `applyTransportError` — only inject the friendly "couldn't reach the chat service" text block if the assistant hasn't streamed any visible text yet; always set `lastError`.
- `WagerBotAuthProvider` protocol (currentAccessToken/currentUserId) — declared, currently unused seam.

**Android:** the SSE stream becomes a cold `Flow<WagerBotStreamEvent>` (OkHttp SSE / Ktor); `streamJob = scope.launch { service.startRun(...).collect { apply(it, assistantId) } ... }`; cancellation via `streamJob?.cancel()`.

---

## 10. Outliers

### 10.1 OutliersStore (`OutliersStore.swift`)

**Purpose:** Outliers hub: week games + value alerts + fade alerts (RN React-Query trio).
- Nested: `LoadState`; `InnerTab { outliers, agentPicks, leaderboard }` (labels "Outliers"/"Top Agent Picks"/"Leaderboard"); `Category: String { value, fade, nbaAccuracy="nba-accuracy", ncaabAccuracy="ncaab-accuracy", mlbRegression="mlb-regression" }` with `displayName` (Prediction Market Alerts / Model Fade Alerts / NBA Model Accuracy / NCAAB Model Accuracy / MLB Regression Report).
- Properties: `weekGames: [OutlierGame]`, `valueAlerts: [OutlierValueAlert]`, `fadeAlerts: [OutlierFadeAlert]`, `loadState`, `lastRefreshedAt` (private(set)); public vars `activeTab = .outliers`, `valueAlertsSportFilter: SportLeague?`, `fadeAlertsSportFilter: SportLeague?`, `loadingGameId: String?`.
- `refresh()` — `OutliersService.shared.fetchWeekGames()` first, then FAN OUT value+fade concurrently (`async let`, both take weekGames). FIDELITY-WAIVER #062: WagerBot suggestion-store wiring pending.
- Selectors: `filteredValueAlerts` / `filteredFadeAlerts` (sport filter + `isUpcoming(gameTime)`); `valueAlertsCount(by:)` / `fadeAlertsCount(by:)` for "NFL (3)" pills. `isUpcoming`: nil time → keep; ISO parse (± fractional) → `> now`; unparseable bare date → keep.
- DEBUG `debugSet`.

### 10.2 OutliersTrendsStore (`OutliersTrendsStore.swift`)

**Purpose:** Team-trends Outliers surface (NFL/NCAAF precomputed cards; MLB client-built from a splits bundle) + a lazily-built **cross-sport search index** consumed by SearchStore.
- Constant: `sectionCardCap = 24`.
- Properties (private(set)): `loadState = .idle`, `precomputedCards: [OutliersTrendsCard]`, `mlbBundle: MLBTrendsSlateBundle?`, `lastRefreshedAt`, `slateGames: [OutliersTrendsGame]`, `isLoadingTrends = false`, `searchIndex: [OutliersTrendsSearchEntry]`, `isLoadingSearchIndex = false`. Public vars: `sport: OutliersTrendsSport = .nfl`, `matchupFilter = .allGames`, `subject = .all`.
- `isLoading` = loadState loading OR isLoadingTrends; `lastError`.
- `refresh()` — no-op `.loaded` for sports without trends data. Warm team services (NFL/NCAAF). MLB: `fetchMLBBundle()` → done. Others: `fetchSlateGames(sport)` (slate shows before cards), then `fetchPrecomputedCards(sport, season, week)` keyed off the first game. Errors: `.failed(msg)` if slate empty, else `.failed("Trends data: {msg}")` on top of a served slate.
- `marketSections` (computed) — MLB via `MLBTrendsEngine.buildCards`, others via `NFLTrendsEngine.filterPrecomputedCards` (unfiltered by market; bucketed into `OutliersTrendsMarketSection.sections(cap: 24)`).
- `loadSearchIndexIfNeeded() async` — once, guarded by empty+not-loading; loops NFL+NCAAF (slate → cards → flatten with `.allGames/.all` filters) then MLB bundle; per-sport failures skipped. Independent of tab view state.
- `onSportChanged()` — MLB forces `subject = .teams`; otherwise reset subject if not allowed; reset `matchupFilter = .allGames`.

### 10.3 PlatformStatsStore (`PlatformStatsStore.swift`)

**Purpose:** Whole-population agent distribution for Platform Statistics. Deliberately owns NO filter state (metric/sport/threshold/bin width are pure view state re-bucketing in memory).
- Properties (private(set)): `data: [AgentStatDatum]`, `loadState`, `lastRefreshedAt`. Computed `isLoading`, `lastError`, `lastCalculatedAt` (max parsed `last_calculated_at` ISO across rows — freshness label).
- `refresh()` — `PlatformStatsService.fetchAgentDistribution(minDecided: 1)` (interactive ≥N threshold applied client-side by the view). DEBUG `debugSet`.

---

## 11. MLB tool stores

### 11.1 MLBBettingTrendsStore (`MLBBettingTrendsStore.swift`)

Situational trends slate. Properties (private(set)): `games: [MLBGameTrends]`, `loading: Bool=false`, `errorMessage: String?`, `lastFetched: Date?`.
- `trends(for gamePk:)` per-game lookup; `refreshIfNeeded(maxAge: 600)` — skip while loading or fresh (carousel swipes must not refetch).
- `refresh()`: `mlb_situational_trends_today` (order game_date_et, game_pk asc) → fallback `mlb_situational_trends`; bucket rows by game_pk into away/home by `team_side` (require both, non-empty names); join `game_time_et` from `mlb_games_today` `.in(game_pk)` (flexible Int-or-String pk decode); compute `ouConsensusScore` + `mlDominanceScore`; sort `.time`.
- Static scoring (**byte-identical to RN**): `toPct` normalizes 0–1 fractions ×100; `minDiff = 10`; 7 win-pct pairs + 7 over-pct pairs (lastGame/homeAway/favDog/restBucket/restComp/league/division); `calculateOUConsensus` — both >55 add `a+h`; both <45 add `200−a−h`; `calculateMLDominance` — sum |a−h| where ≥10. `sortGames(mode: MLBTrendsSortMode {time|ouConsensus|mlDominance})`; time sort: parseDate(gameTimeEt) asc, some-before-none, fallback gameDateEt.

### 11.2 MLBBucketAccuracyStore (`MLBBucketAccuracyStore.swift`)

`mlb_model_bucket_accuracy` aggregation. `data: MLBBucketAccuracy?`, `loading`, `errorMessage`, `lastFetched`; stale window 5 min; `refreshIfStale(force:)` / `refresh()`. Static `aggregate(rows:)` — sums games/wins/units per bet type (`full_ml/full_ou/f5_ml/f5_ou/perfect_storm`), keeps per-bucket rows, `finalize` rounds win% to 1dp, units 2dp, roi 1dp.
Companion `enum MLBBucketHelper` (port as object): bucket threshold tables (ml `[(7,"7%+"),(4,"4-6.9%"),(2,"2-3.9%"),(0,"<2%")]`, ou `[(1.5,"1.5+"),(1.0,"1.0-1.49"),(0.5,"0.5-0.99"),(0,"<0.5")]`, f5_ml `[(20,...),(10,...),(5,...),(0,"<5%")]`, f5_ou 3 tiers); `bucketLabel(edge:betType:)` (± prefix); `lookup(...)` with side/favDog/direction matching and the **`games < 3` cutoff**.

### 11.3 MLBF5SplitsStore (`MLBF5SplitsStore.swift`)

First-Five splits slate. Properties: `games: [MLBF5Game]`, `splitLookup: [String: MLBF5SplitRow]`, `lastRefreshedAt: String?`, `loadState`, `lastFetched: Date?` (public private(set) — sheets use `isLoading && lastFetched == nil` as the first-hydrate skeleton rule); stale window **10 min** (empty off-day slates cached too).
- `refresh()`: `mlb_games_today` today..+2 (ET; ordered by date+time) → drop postponed → resolve team abbrs (mapping by normalized name, then id, then substring-contains scan, then static `MLBTeams`, then initials) → `MLBF5.toSplitTeamAbbr`; then `mv_mlb_f5_team_splits` `.in(team_abbr, slate abbrs)` → `MLBF5.buildSplitLookup`; `lastRefreshedAt` from first split row.
- `matchup(for gamePk:) -> MLBF5Matchup?` (game + away/home split via `MLBF5.findSplitRow(teamAbbr, homeAway, oppSpHand)`).
- `ScheduleRow` uses a **candidate-key flexible decoder** (`firstString/firstInt/firstDouble/firstBool` over key lists like `["game_pk","gamePk"]`, `["away_team_name","away_team","away_team_full_name"]`) — port with a JsonObject-based manual mapper.
- ET date helpers `todayET()` / `addDays(ymd, n)`.

### 11.4 MLBModelBreakdownStore (`MLBModelBreakdownStore.swift`)

`mlb_model_breakdown_accuracy` (per-team + day-of-week records). `rows: [MLBModelBreakdownRow]`, loading/error/lastFetched; stale window **15 min**; explicit 10-column select. `teamRows(betType:)` (roi desc); `dowRows(betType:)` (Mon..Sun fixed order).

### 11.5 MLBPerfectStormRecordsStore (`MLBPerfectStormRecordsStore.swift`)

Season-to-date W-L/ROI per Perfect Storm tier from `mlb_graded_picks` (`.in(perfect_storm_tier, ["hammer","ps","lean","watch"])`, select 3 cols; units_won decodes Double-or-String). `records: MLBPerfectStormRecords?`, loading/error/lastFetched; stale 10 min. Aggregation: count picks/wins/losses/pushes, sum units; win%/roi% = null when no graded (wins+losses==0), else 1dp rounding; units 2dp.

### 11.6 MLBPlayerPropPicksStore (`MLBPlayerPropPicksStore.swift`)

Best Picks Report: today's locked picks + graded archive. `todaysPicks: [MLBPlayerPropBestPick]`, `summary: [MLBPlayerPropGradeSummary]`, `history: [MLBPlayerPropGrade]`, `loadState`, `lastFetched`; TTL 5 min; ctor-injected `MLBPlayerPropPicksService`.
- Computed: `overall` (aggregate), `tierGroups` (grouped by tier in canonical order, markets sorted units desc), `batterPicks`/`pitcherPicks`, `recentHistory` (first 10).
- `refreshIfStale`, `refreshSummaryOnly(force:)` (banner path; failures silent), `refresh(force:)` — three concurrent fetches (`fetchTodaysPicks(reportDate: todayET)`, `fetchGradeSummary`, `fetchGradeHistory(limit:10)`); picks sorted tier rank asc then score desc.

### 11.7 MLBRegressionReportStore (`MLBRegressionReportStore.swift`)

Daily `mlb_regression_report` row keyed by ET date. `report: MLBRegressionReport?`, loading/error, `lastFetchedKey: String?` (the ET date); stale 5 min; **`inFlightRefresh: Task?` coalesces overlapping refresh calls** (`.task` + pull-to-refresh + toolbar) — Kotlin: hold the in-flight `Job`/`Deferred` and `join()` it. `refresh()` awaits the in-flight task if present, else creates one running `performRefresh` (select eq report_date, limit 1, first row = maybeSingle semantics; `Task.checkCancellation` before/after the fetch; CancellationError keeps cached state; other errors only set errorMessage when no cached report). `suggestedPicks(for gamePk:)` filter.

### 11.8 MLBSeriesSignalsStore (`MLBSeriesSignalsStore.swift`)

Series-position signals (G2/G3 carryover) from `mlb_game_signals` (5-column select). `signals: [MLBSeriesSignal]`, loading/error/lastFetched; stale 5 min. Parsing: each home/away signal is a JSON-ENCODED STRING; keep only parsed `category == "series"` with non-empty message; severity coerced to "positive"/"negative"; matchup label `"{away} @ {home}"`; malformed entries skipped silently.

---

## 12. NBA / NCAAB tool stores

### 12.1 NBABettingTrendsStore (`NBABettingTrendsStore.swift`)

NBA situational trends. `SortMode { time, ouConsensus, atsDominance }`; `LoadState { idle, loading, loaded, refreshing, failed }`. Properties: `games: [NBAGameTrendsData]`, `loadState`, `lastFetched` (private(set)). Thresholds: minGames 5, minPercentage 55, minATSDifference 10.
- `trends(for gameId:)`; `refreshIfNeeded(maxAge: 600)`.
- `refresh()`: DEBUG DummyDataMode branch; `nba_game_situational_trends_today` → fallback `nba_game_situational_trends` (both ordered game_date, game_id asc); pair by `team_side` per game_id; join tipoffs from `nba_input_values_view` (`game_id, tipoff_time_et`, `.in` ids); sort `.time`.
- Scores (byte-identical to RN): `ouConsensusStrength` — 5 O/U buckets (lastGame, favDog, sideFavDog, restBucket, restComp); both-over >55 or both-under >55 with both records ≥5 games → add `weightedAvgPct * min(games)`; `atsDominance` — 5 ATS buckets; |diff| > 10 with min(games) ≥ 5 → add `diff * minGames`. Record parsing via `parseNBARecord`. NOTE: scores are computed on demand during sort (NOT cached on the model, unlike NCAAB/MLB siblings).
- DEBUG `debugSet`.

### 12.2 NBAMatchupOverviewStore (`NBAMatchupOverviewStore.swift`)

Per-sheet store (owned by the NBA game bottom sheet; reset per game). Properties (private(set)): `awayInjuries/homeInjuries: [NBAInjuryReport]`, `trends: NBAGameTrends?`, `awayInjuryImpact/homeInjuryImpact: Double = 0`, `injuriesState/trendsState: LoadState = .idle`.
- `reset()`; `load(awayTeam:homeTeam:gameDate:) async` — guards trimmed-non-empty inputs else reset; DEBUG dummy branch; normalize date; PARALLEL task group: injuries (`nba_injury_report` select 6 cols, `.in(team_name, [away,home])`, eq `game_date_et`, eq `bucket = "current"`; split by case-insensitive name compare) + trends (single-row-ish select of 20 explicit columns from `nba_input_values_view` eq game_date/away_team/home_team; first row).
- `calculateInjuryImpact` = Σ(−PIE). `normalizeDateString` — strip at "T"/" " then regex `^\d{4}-\d{2}-\d{2}$`, else ISO-parse → ET yyyy-MM-dd.

### 12.3 NBAModelAccuracyStore (`NBAModelAccuracyStore.swift`)

`nba_todays_games_predictions_with_accuracy` view → `[Int: NBAModelAccuracyData]` keyed by game_id. `SortMode { time, spread, moneyline, ou }` (plain public var — sorting happens in the computed `games`). `accuracyById` (private(set)), `loadState`.
- `games` computed = sorted values; `accuracy(for gameId:)`.
- `refresh(force:)` — re-entrancy guard on `.loading`; skip when loaded+non-empty unless forced; DEBUG dummy branch; ordered by game_date + tipoff. Row derivations: `homeSpreadDiff = vegas − modelFair`; `overLineDiff = predTotal − vegasTotal`; `mlPickIsHome` from `model_ml_winner` ("home"/"away"); accuracy buckets only when both pct+games present. Abbrs from `initials(for:)` = uppercase LAST word (or first 3 chars).
- Sorts: time = date then tipoff; others = bucket accuracyPct desc (missing = −1).

### 12.4 NCAABBettingTrendsStore (`NCAABBettingTrendsStore.swift`)

NCAAB sibling of 12.1 with extras: joins **team logos** from `ncaab_team_mapping` (espn_team_id Int-or-String → ESPN ncaa/500 logo URL) into each side; tipoffs from `v_cbb_input_values` (`start_utc ?? tipoff_time_et`); **pre-computes** `ouConsensusScore`/`atsDominanceScore` onto the models (step 5) rather than computing during sort. Same thresholds/score math (via `parseNCAABRecord`). Tables: `ncaab_game_situational_trends_today` → fallback `ncaab_game_situational_trends`. DEBUG dummy branch. No debugSet.

### 12.5 NCAABModelAccuracyStore (`NCAABModelAccuracyStore.swift`)

`ncaab_todays_games_predictions_with_accuracy` view (same shape as NBA view). Differences vs 12.3: stores a sorted ARRAY `games: [NCAABModelAccuracyGame]`; `sortMode` has `didSet { games = sortGames(games, mode:) }` (re-sorts in place); `mlPickIsHome` falls back to comparing win probs when the view's winner is null; logos/abbrevs resolved best-effort via `v_cbb_input_values` (game_id → team ids) + `ncaab_team_mapping` (abbrev + espn logo), degrading to `initials(of:)` (first letters of first 2 words, or 3-char prefix); sorts tie-break by time. `accuracy(forGameId:)`.

### 12.6 NCAABTeamMappingStore (`NCAABTeamMappingStore.swift`)

Session cache of `ncaab_team_mapping` (4-column select). Indexes: `byName: [String: NCAABTeamMappingEntry]` (keyed by trimmed `teamranking_team_name` AND its lowercase alias) + `byApiTeamId: [Int: ...]`; `isLoaded`. **`inflight: Task?` dedupe** — concurrent `load()` callers await the same task (Kotlin: cache the `Job`, `join()` it). `lookup(teamName:)` — exact (original + lowercase) then length-gated (≥6 chars) substring/contains fallback over lowercase keys; `lookup(apiTeamId:)`.

---

## 13. Misc / app-level stores

### 13.1 AdminModeStore (`AdminModeStore.swift`)

- Properties: `isAdmin=false`, `isCheckingRole=false`, `lastError` (private(set)); `roleResolved=false` (private(set) — views avoid flashing dev rows mid-RPC); `adminModeEnabled` (PUBLIC var, `didSet` persists to `AppGroupKey.adminModeEnabled`, loaded in init).
- `checkRole(for userId: UUID) async` — RPC `has_role(_user_id, _role: "admin")`; decode the raw body string == "true"; errors → non-admin (non-fatal) + `roleResolved=true` either way; **if no longer admin, force `adminModeEnabled=false`**.
- `reset()` (sign-out): all false. `toggleAdminMode()` (guard isAdmin). `canEnableAdminMode`. `dryRunPreviewEnabled = isAdmin && adminModeEnabled` (gates NFL/CFB dry-run staging tables). DEBUG `debugSet`.

### 13.2 DebugDataModeStore (`DebugDataModeStore.swift`) — **entire file `#if DEBUG`**

Single `enabled: Bool` (public var) whose `didSet` writes through to the static `DummyDataMode.isEnabled` flag (App Group-backed) that data stores read before fetching; init reads it back. Android: debug-only class writing a static/companion flag.

### 13.3 ThemeStore (`ThemeStore.swift`)

`enum Mode: String { system, light, dark }` with `colorScheme` mapping. `mode: Mode` public var, `didSet` persists raw value to `AppGroupKey.themePreference`. **`init` FORCE-SETS `.dark`** — the app ships dark-only; any stored light/system preference is coerced. Port the coercion.

### 13.4 SettingsStore (`SettingsStore.swift`)

Notification-permission facade. `enum NotificationPermission { granted, denied, undetermined, provisional, ephemeral }` (+ `isEnabled` = granted|provisional|ephemeral). Properties (private(set)): `notificationPermission = .undetermined`, `isCheckingNotificationPermission = true`.
- `refreshNotificationPermission() async` (on settings appear — user may have changed the system setting).
- `enableNotifications(userId:) async -> NotificationPermission` — already granted-ish → register push token; undetermined → request then register if granted; denied → return `.denied` (view shows "open Settings" alert).
- `disableNotifications(userId:) async` — set `.denied` + `deactivatePushTokens(userId)`.
- Services: `NotificationService.shared`. Android: `POST_NOTIFICATIONS` runtime permission + FCM token registration.

### 13.5 LearnWagerProofStore (`LearnWagerProofStore.swift`)

Global walkthrough sheet. `enum Topic: String, Identifiable { createAgent, gameCards, gameDetails, wagerBot, outliers, moreFeatures }` with `slideIndex` 0..5; `totalSlides = 6`. Public vars: `activeTopic: Topic? = nil` (drives `.sheet(item:)`), `currentSlide = 0`.
- `openSheet(_ topic = .createAgent)` (seeds slide from topic), `closeSheet()`, `nextSlide()/prevSlide()/goToSlide(_:)` (clamped), `isLastSlide`.
- Persistence: seen flag under key **`"@wagerproof_has_seen_learn_sheet"`** (RN AsyncStorage key preserved verbatim) in App Group defaults — `markAsSeen()` / `hasBeenSeen()`. Note: auto-present on first launch is intentionally NOT implemented.

### 13.6 FeatureRequestsStore (`FeatureRequestsStore.swift`)

Feature-request list + voting on MAIN Supabase. Properties (private(set)): `requests: [FeatureRequest]`, `userVotes: [FeatureRequestVote]`, `loadState`, `lastError`, `justSubmittedAt: Date?` (success-haptic trigger), `isSubmitting = false`. Computed: `isLoading`, `hasRequests`, `approvedRequests`, `plannedRoadmapItems` / `inProgressRoadmapItems` / `completedRoadmapItems` (status `.roadmap` partitioned by `roadmapStatus`).
- `refresh(userId: UUID?) async` — `feature_requests` where status IN (approved, roadmap) order created_at desc; then votes for the user (failure → empty, non-fatal); nil user → empty votes.
- `vote(requestId:userId:voteType:) async` — three branches: no existing vote → INSERT `{feature_request_id, user_id, vote_type}`; same type → DELETE (un-vote); different type → UPDATE `vote_type`. Then FULL `refresh` (DB trigger recalculates upvote counters).
- `submit(title:description:userId:displayName:) async -> Bool` — both fields required ("Please fill in all fields"); insert with `status: "pending"` and `submitter_display_name` fallback `"Anonymous"`; sets `justSubmittedAt`, refreshes.
- `clearError()`. DEBUG `debugSet`.

### 13.7 RoastSessionStore (`RoastSessionStore.swift`)

Voice "Roast" session (Gemini Live). The AUDIO DRIVER is a protocol seam — the store owns lifecycle + a state machine, the driver owns SDKs. FIDELITY-WAIVER #061: no concrete driver yet on iOS (mic is a no-op until it lands).
- `enum Intensity: String { savage="max", medium="medium", light="light" }` — **raw values are the RN wire values**; labels Brutal/Medium/Mild; emoji 🔥😏😄.
- `enum SessionState { idle, recording, processing, responding }` with `statusText` exactly: "Tap the mic to talk" / "Listening..." / "Thinking..." / "Roasting...".
- `struct Message { id, role(user|assistant), text, timestamp }`.
- Observable (all private(set)): `state=.idle`, `intensity=.medium`, `messages=[]`, `liveTranscript=""`, `aiTranscript=""`, `error: String?`, `isConnected=false`, `isConnecting=false`, haptic counters `micToggleCount/intensityChangeCount/connectionEventCount/errorEventCount` (all 0, `&+= 1` bumps).
- Commands: `toggleRecording() async` — processing: ignore; recording: `driver.stopListening()` (no driver → `.idle`); idle/responding: cancel playback if responding + clear aiTranscript, clear error+liveTranscript, guard driver, `state=.recording`, `startListening()`. `setIntensity(_:) async` — no-op if same; bump counter; `connect()` (reconnect applies the new system prompt). `clearConversation() async` — wipe + reconnect. `connect() async` — no driver → `isConnecting=false` return; else `isConnecting=true`, `driver.connect(intensity:)`, success → `isConnected=true` + counter; failure → error + counter. `disconnect() async`.
- Driver event sinks (driver calls back in): `handleInterimUserTranscript`, `handleFinalUserTranscript` (trim; empty → idle; else append user message, `state=.processing`, forward `driver.send(text:history: last 10 messages)`), `handleAudioPlaybackStart` (→ `.responding`), `handleAudioPlaybackEnd(finalText:)` (append assistant message if text, clear aiTranscript, → idle), `handleInterimAssistantTranscript`, `handleError` (set error + counter; processing/responding → idle), `handleListeningEnded`.
- `protocol RoastSessionDriving { connect(intensity) throws; disconnect(); startListening(); stopListening(); send(text:history:); cancelPlayback() }` → Kotlin interface.
- DEBUG `debugSet(...)`.

### 13.8 CFBDryRunPicksStore (`CFBDryRunPicksStore.swift`)

Admin CFB dry-run picks screen. Properties (private(set)): `games: [CFBPrediction]`, `flags: [CFBDryRunFlag]`, `loadState`.
- Computed: `activeFlags` / `trackingFlags` (partition on `isActive`, sorted conviction rank asc → stakeUnits desc), `mammothGames`, `game(for id:)` (matches gameId OR id).
- `refresh()` — same trio as GamesStore's CFB dryrun path: `cfb_dryrun_games` + `cfb_dryrun_flags` both `.eq("week", 7)` + signal definitions, in parallel; attach definitions; group by game; map rows to `CFBPrediction` (own private GameRow/FlagRow/FlexibleString decoders — slightly smaller column set than GamesStore's). Predicted score = pts or `(total±margin)/2`.

---

## 14. Kotlin porting notes

### 14.1 Store skeleton

```kotlin
@Stable
class LiveScoresStore(
    private val service: LiveScoresService = LiveScoresService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var games by mutableStateOf<List<LiveGame>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var lastRefreshedAt by mutableStateOf<Instant?>(null); private set

    fun close() = scope.cancel()   // call from ViewModel.onCleared / DisposableEffect
}
```

- `@MainActor` ⇒ `Dispatchers.Main.immediate`; all state writes stay on main.
- Swift `LoadState` enums with associated values ⇒ Kotlin sealed interfaces: `sealed interface LoadState { data object Idle; data object Loading; data object Loaded; data class Failed(val message: String) }`.
- Computed Swift vars ⇒ Kotlin `val x get() = ...` (reads snapshot state → recomposes correctly).
- `[Sport: LoadState]` dictionaries ⇒ `mutableStateMapOf<Sport, LoadState>()`.

### 14.2 Polling loops (LiveScoresStore, AgentDetailStore)

```kotlin
private var pollJob: Job? = null

fun start() {                       // idempotent, like the Swift guard
    if (pollJob != null) return
    pollJob = scope.launch {
        refresh()                   // immediate first fetch
        while (isActive) {
            delay(120_000)
            refresh()
        }
    }
}
fun stop() { pollJob?.cancel(); pollJob = null }
```

Bounded polls (AgentDetailStore) are plain `repeat(maxAttempts) { if (!isActive) return outcome; ...; delay(intervalMs) }` inside the generation coroutine — no separate Job needed, cancellation flows from the caller. Budgets to preserve: trigger-run poll **440 × 1.5s**, snapshot poll **60 × 4s**.

### 14.3 Task cancellation (Job references)

Every Swift `xxxTask: Task<Void, Never>?` becomes a nullable `Job`:
- `AuthStore.listenerTask` — collect the Supabase-kt `sessionStatus` Flow.
- `RevenueCatStore.streamTask` — collect the customer-info listener as a `callbackFlow`.
- `WagerBotChatStore.streamTask` — the SSE collection; `send` MUST cancel the previous Job before launching a new one.
- `SearchStore.debounceTask` — cancel-and-relaunch per keystroke.
- `OnboardingStore.validationTask` — cancel on `attachUser` re-entry / `detachUser`.
- `MLBRegressionReportStore.inFlightRefresh` / `NCAABTeamMappingStore.inflight` — **coalescing** pattern: keep the in-flight `Job`, later callers `job.join()` instead of starting a second fetch.

### 14.4 Debounce

```kotlin
var query by mutableStateOf("")
    set(value) {
        if (field == value) return
        field = value
        if (value.isNotEmpty()) browseScope = null
        scheduleDebounce()
    }

private fun scheduleDebounce() {
    debounceJob?.cancel()
    isDebouncing = true
    debounceJob = scope.launch {
        delay(200)
        debouncedQuery = query
        isDebouncing = false
    }
}
```

Same pattern for the 350ms `isTransitioning` lock in OnboardingStore. `TopAgentPicksFeedStore` is the exception: its debounce lives in the VIEW (`LaunchedEffect(searchText) { delay(250); store.applySearchText(searchText) }`).

### 14.5 didSet-triggers-refresh (LeaderboardStore, NCAABModelAccuracyStore.sortMode)

Swift `didSet { Task { await refresh() } }` ⇒ explicit setter launching `scope.launch { refresh() }`, guarded on value change. Prefer setter FUNCTIONS (`fun setSortMode(m: SortMode)`) over property setters for clarity.

### 14.6 Async streams

- Supabase auth events, RevenueCat customer info, WagerBot SSE ⇒ `Flow` collections in store-scoped Jobs; every event handler hops to main (already implied by the scope's dispatcher).
- Swift `async let` pairs (AgentDetailStore history+parlays, OutliersStore value+fade, MLBPlayerPropPicksStore triple, CFB dryrun trio) ⇒ `coroutineScope { val a = async {...}; val b = async {...}; ... }` with per-branch `runCatching` where iOS uses `try?` (parlay failures must not blank pick history).
- `withTaskGroup` parallel refreshes (GamesStore.refreshAll, NBAMatchupOverviewStore.load) ⇒ `coroutineScope { listOf(async{}, async{}).awaitAll() }`.

### 14.7 Persistence keys (must stay byte-identical)

| Key | Store | Type |
|---|---|---|
| `onboardingComplete(userId)` (AppGroupKey, per-user) | OnboardingStore | Bool |
| `rc_force_freemium` | RevenueCatStore | Bool |
| `proEntitlementGranted` / `proSubscriptionType` (AppGroupKey) | RevenueCatStore | Bool / String |
| `adminModeEnabled` (AppGroupKey) | AdminModeStore | Bool |
| `themePreference` (AppGroupKey) | ThemeStore | String (coerced to dark) |
| `@wagerproof_has_seen_learn_sheet` | LearnWagerProofStore | Bool |
| `search.recent.queries` | SearchStore | [String], cap 5 |
| `topPicksFavoriteAgentIds` | FavoriteAgentsStore | [String] sorted, lowercased |
| `agent_picks_last_seen_{agentId}` | AgentPicksSeenStore | String (ISO8601, monotonic) |
| `agent_v3.dry_run` / `agent_v3.model` | AgentV3SettingsStore | Bool / String |

App Group defaults exist on iOS for widget sharing — on Android a single `SharedPreferences` file (`wagerproof_prefs`) is fine; if Glance widgets need the pro flags, mirror them into the widget's DataStore.

### 14.8 Gotchas

- **Sort stability:** Swift `sorted(by:)` is NOT stable; several stores add explicit tiebreaks (SearchStore insertion-order offsets). Kotlin `sortedWith` IS stable — keep the explicit tiebreaks anyway for parity of intent.
- **Query byte-parity:** every `.select("...")` string, table name, filter and ordering above is a contract with RN/web — copy verbatim into the Kotlin Supabase client calls.
- **Flexible decoders:** FlexibleString (Int/Double/String ids), MLB signal payload variants, MLBF5 candidate-key rows, espn_team_id Int-or-String — write custom kotlinx-serialization serializers or decode via `JsonObject`.
- **Never-blank rules:** LiveScores keeps stale games on error; PropsStore keeps cached data (`.loaded`) on refresh error; MLBRegressionReport keeps a cached report; WagerBot only injects the transport-error bubble if nothing visible streamed. Preserve all four.
- **Trust-downgrade guard** (RevenueCatStore) and **never-downgrade-onboarding** (OnboardingStore server validation) are correctness rules, not style.

### 14.9 File checklist — Swift → Kotlin (`com.wagerproof.core.stores`)

| # | Swift file | Kotlin file | Notes |
|---|---|---|---|
| 1 | AdminModeStore.swift | AdminModeStore.kt | RPC `has_role`; prefs `adminModeEnabled` |
| 2 | AgentChatStore.swift | AgentChatStore.kt | optimistic temp-message swap |
| 3 | AgentCreationStore.swift | AgentCreationStore.kt | 6-step wizard; duplicate-name validation |
| 4 | AgentDetailStore.swift | AgentDetailStore.kt | dual polling loops; dual-path loaders |
| 5 | AgentEntitlementsStore.swift | AgentEntitlementsStore.kt | pure computed limits |
| 6 | AgentPickAuditStore.swift | AgentPickAuditStore.kt | JSONB trace derivation |
| 7 | AgentPicksSeenStore.swift | AgentPicksSeenStore.kt | `object`; monotonic prefs ledger |
| 8 | AgentV3SettingsStore.swift | AgentV3SettingsStore.kt | prefs-backed debug knobs |
| 9 | AgentsStore.swift | AgentsStore.kt | optimistic mutations + rollback |
| 10 | AuthStore.swift | AuthStore.kt | auth Flow listener Job |
| 11 | CFBDryRunPicksStore.swift | CFBDryRunPicksStore.kt | week-7 dryrun trio |
| 12 | CFBGameSheetStore.swift | CFBGameSheetStore.kt | trivial sheet holder |
| 13 | DebugDataModeStore.swift | DebugDataModeStore.kt | debug-only |
| 14 | FavoriteAgentsStore.swift | FavoriteAgentsStore.kt | prefs set |
| 15 | FeatureRequestsStore.swift | FeatureRequestsStore.kt | 3-branch vote toggle |
| 16 | FollowedAgentsStore.swift | FollowedAgentsStore.kt | join-select read path |
| 17 | GamesStore.swift | GamesStore.kt | LARGEST — 5 fetch pipelines; split DTOs into GamesStoreRows.kt |
| 18 | LeaderboardStore.swift | LeaderboardStore.kt | filter-didSet auto-refresh |
| 19 | LearnWagerProofStore.swift | LearnWagerProofStore.kt | sheet + slide index |
| 20 | LiveScoresStore.swift | LiveScoresStore.kt | 120s poll loop |
| 21 | MLBBettingTrendsStore.swift | MLBBettingTrendsStore.kt | consensus/dominance scoring |
| 22 | MLBBucketAccuracyStore.swift | MLBBucketAccuracyStore.kt | + MLBBucketHelper object |
| 23 | MLBF5SplitsStore.swift | MLBF5SplitsStore.kt | flexible-key row decoder |
| 24 | MLBGameSheetStore.swift | MLBGameSheetStore.kt | sheet holder + vestigial cache |
| 25 | MLBModelBreakdownStore.swift | MLBModelBreakdownStore.kt | 15-min stale |
| 26 | MLBPerfectStormRecordsStore.swift | MLBPerfectStormRecordsStore.kt | client aggregation |
| 27 | MLBPlayerPropPicksStore.swift | MLBPlayerPropPicksStore.kt | 3 concurrent fetches |
| 28 | MLBRegressionReportStore.swift | MLBRegressionReportStore.kt | in-flight Job coalescing |
| 29 | MLBSeriesSignalsStore.swift | MLBSeriesSignalsStore.kt | JSON-string signal parsing |
| 30 | MainTabStore.swift | MainTabStore.kt | tabs + sheet flags + pendingAgentRoute |
| 31 | NBABettingTrendsStore.swift | NBABettingTrendsStore.kt | scores computed at sort time |
| 32 | NBAGameSheetStore.swift | NBAGameSheetStore.kt | trivial |
| 33 | NBAMatchupOverviewStore.swift | NBAMatchupOverviewStore.kt | per-sheet; parallel injuries+trends |
| 34 | NBAModelAccuracyStore.swift | NBAModelAccuracyStore.kt | map keyed by game_id |
| 35 | NCAABBettingTrendsStore.swift | NCAABBettingTrendsStore.kt | + logos join; precomputed scores |
| 36 | NCAABGameSheetStore.swift | NCAABGameSheetStore.kt | trivial |
| 37 | NCAABModelAccuracyStore.swift | NCAABModelAccuracyStore.kt | sortMode didSet re-sort |
| 38 | NCAABTeamMappingStore.swift | NCAABTeamMappingStore.kt | inflight-Job dedupe |
| 39 | NFLGameSheetStore.swift | NFLGameSheetStore.kt | trivial |
| 40 | OnboardingStore.swift | OnboardingStore.kt | 20-step machine; cache-first sync |
| 41 | OutliersStore.swift | OutliersStore.kt | fan-out alerts |
| 42 | OutliersTrendsStore.swift | OutliersTrendsStore.kt | + cross-sport search index |
| 43 | PlatformStatsStore.swift | PlatformStatsStore.kt | no filter state |
| 44 | ProAccessStore.swift | ProAccessStore.kt | pure computed facade |
| 45 | PropsStore.swift | PropsStore.kt | MLB+NFL props; skeleton rule |
| 46 | RevenueCatStore.swift | RevenueCatStore.kt | trust-downgrade guard |
| 47 | RoastSessionStore.swift | RoastSessionStore.kt | + RoastSessionDriving interface |
| 48 | RootRouter.swift | RootRouter.kt | phase machine + DeepLinkRoute |
| 49 | SearchStore.swift | SearchStore.kt | debounce; non-snapshot player indexes |
| 50 | SettingsStore.swift | SettingsStore.kt | notification permission |
| 51 | SportSeason.swift | SportSeason.kt | `object` utility |
| 52 | ThemeStore.swift | ThemeStore.kt | forced dark |
| 53 | TopAgentPicksFeedStore.swift | TopAgentPicksFeedStore.kt | cursor pagination + dedupe |
| 54 | WagerBotChatStore.swift | WagerBotChatStore.kt | SSE reducer; ContentBlock model |
