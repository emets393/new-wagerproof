# 08 — App Shell, Misc Features, Widgets & Project Config

Parity-contract inventory for the Android port. Covers: the app entry point + root phases, tab shell/navigation chrome, deep links, environment (store) injection graph, and the Auth, Settings, Paywall, Search, FeatureRequests, Roast, LearnMore, Analytics feature folders, both Home Screen widgets, and all project config (bundle IDs, schemes, keys, entitlements).

Source root: `wagerproof-ios-native/`. Stores referenced live in `WagerproofKit/Sources/WagerproofStores/`; services in `WagerproofKit/Sources/WagerproofServices/`.

---

## 1. App shell (`Wagerproof/App/` — 5 files)

### 1.1 `WagerproofApp.swift` (@main, 205 lines)
SwiftUI `App`. **Exact launch sequence:**

1. `init()` (process launch, before any UI):
   - `GoogleSignInCoordinator.configureIfNeeded()` — GIDSignIn config with iOS client ID.
   - `MetaAnalyticsService.shared.initialize()` — boots FBSDK (`ApplicationDelegate.application(didFinishLaunching:)`), sets `isAutoLogAppEventsEnabled = false` (RevenueCat server-side Meta CAPI handles auto events; explicit events only).
   - Builds `RevenueCatStore`, `AdminModeStore`, `SettingsStore`, and `ProAccessStore(revenueCat:adminMode:)` **up front so the ProAccessStore facade wraps the SAME instances injected into the environment** (critical invariant).
   - NOTE: a comment says "Phase 2: bootstrap analytics with the real Mixpanel token from Secrets.swift" but **no Mixpanel bootstrap call actually exists** (see §7 Surprises).
2. `body` → `WindowGroup`:
   - `#if DEBUG && ScreenshotHarness.isActive` → `ScreenshotHarnessView()` (see 1.5), else `productionRoot`.
3. `productionRoot = RootView()` with **11 environment injections** (see §1.6 graph), plus:
   - `.preferredColorScheme(themeStore.mode.colorScheme)` AND `.onChange(of: themeStore.mode, initial: true)` → `applyInterfaceStyle(mode)` which loops **every `UIWindow` in every connected scene** and sets `overrideUserInterfaceStyle` — this is the dark-mode forcing mechanism (repaints sheets/covers in their own presentation contexts too). ThemeStore's init **coerces any stored preference to `.dark`** — the app ships dark-only (persisted to App Group key `theme_pref`).
   - `.task`: `authStore.start()` (Supabase session restore + auth listener) then `revenueCatStore.bootstrap()` (auth-agnostic, idempotent).
   - `.onChange(of: authStore.phase)`:
     - `.authenticated(userId)` → **synchronously** `onboardingStore.attachUser(userId)` (must load the per-user App Group cache BEFORE the router resolves, or OnboardingView flashes for a frame), else `.unauthenticated` → `detachUser()`.
     - `rootRouter.resolve(authPhase:onboardingComplete:)`.
     - async `handleAuthPhaseChange`: authenticated → `revenueCat.attachUser(userId)` + `adminMode.checkRole(for:)` + `WidgetSyncCoordinator.syncAll(userId:)`; unauthenticated → `revenueCat.detachUser()` + `adminMode.reset()`.
   - `.onChange(of: onboardingStore.isComplete)` → re-`resolve`.
   - `.onOpenURL` priority chain: (1) `MetaAnalyticsService.handleAppDelegate(url:)` (FB attribution callbacks get first look), (2) `GIDSignIn.sharedInstance.handle(url)` (Google OAuth), (3) `rootRouter.handle(deepLink:)`.
4. Scene-phase watcher: on `.active` while authenticated → `WidgetSyncCoordinator.syncAll(userId:)` (re-sync both widgets on every foreground).

### 1.2 `RootView.swift` (220 lines)
Top-level **phase switch** on `RootRouter.phase`:

| Phase | View |
|---|---|
| `.launching` | `SplashView` (private, in this file) |
| `.unauthenticated` | `AuthRouter()` |
| `.onboarding` | `OnboardingView()` |
| `.ready` | `MainTabView()` + `.fullScreenCover` `PostOnboardingPaywall` |

- `.animation(.appStandard, value: router.phase)` on the phase switch.
- **Post-onboarding paywall gating** (`shouldPresentPaywall`): only in `.ready`; held false until `revenueCat.hasResolvedActiveUserEntitlement` AND `!proAccess.isLoading` (covers RC stale-cache window AND admin-role-resolution lag — admin users would otherwise see a paywall flash); suppressed by `paywallDismissed` @State; forced true by `router.testPaywallOverride` (Secret Settings "Reset Onboarding"). Predicate: `!proAccess.isPro`.
- `paywallDismissed` lives HERE (not in the paywall child) so the cover binding can dismiss cleanly; reset on sign-out (`onChange(of: auth.phase)`) and when `testPaywallOverride` re-activates. Cover **re-injects** auth/onboarding/revenueCat/proAccess environments (fullScreenCover doesn't reliably propagate `@Observable` env).
- `SplashView`: solid `#0F1117` background, "Wager"(white)+"Proof"(brand green `Color.appPrimary`) wordmark 20pt heavy, tracking −0.5, above a 120×4 `SplashProgressBar` (capsule, gradient appPrimary → `#00B050` → `#BEEB67` over 10% white track). Progress heuristic: starts 10%, climbs to ~36% over 2.6s on a 250ms tick, +30% when auth resolves, +18% when RC entitlement resolved, +18% when RC not loading, caps 92/96%, → 100% when `isReady && elapsed ≥ 1.6s`. Launch screen color asset: `SplashBackground` (Info.plist `UILaunchScreen`).

### 1.3 `WidgetSyncCoordinator.swift` (26 lines)
App-target-only wrapper (WidgetCenter calls deliberately NOT in the shared package). `syncAll(userId:)` runs `TopAgentsWidgetService.sync(userId:)` and `OutliersWidgetService.sync()` concurrently (failures swallowed → widget keeps last-known-good payload), then `WidgetCenter.shared.reloadTimelines(ofKind:)` for `"AgentMonitorWidget"` and `"TopOutliersWidget"`. Called from: app foreground (scenePhase), sign-in (auth phase change).

### 1.4 `ScaffoldPlaceholder.swift` (27 lines)
Generic `ContentUnavailableView` stub ("hammer.fill") for not-yet-ported nav slots. Every appearance = TODO. Android: a `TodoScreen` composable.

### 1.5 `ScreenshotHarness.swift` (1521 lines, `#if DEBUG` only)
Parity-screenshot harness. Launch arg `-uiScreenshotMode <slug>` swaps RootView for `ScreenshotHarnessView`, which mounts any feature view against in-memory stores (via `debugSet(...)` methods on stores) — no network/auth. Supporting args: `-tab <games|outliers|scoreboard|settings|props>`, `-showSideMenu`, `-propsSport <sport>`, `-gamesSport <sport>`, plus per-target fixture flags. Auth is staged via `authStore.debugSet(phase:profile:)` with `SettingsFixtures.sampleUserId/Email`. Not required for Android parity (port only if you build an equivalent screenshot pipeline).

### 1.6 Environment injection graph

Created in `WagerproofApp` (`@State`, live for the app scene), injected into `RootView` subtree:
`AuthStore`, `RootRouter`, `OnboardingStore`, `ThemeStore`, `LearnWagerProofStore`, `RevenueCatStore`, `AdminModeStore`, `SettingsStore`, `ProAccessStore` (facade wrapping the same RC+Admin instances), `AgentPickAuditStore`, `DebugDataModeStore` (DEBUG only).

Created in `MainTabView` (`@State`, live while signed-in shell exists), injected into all tabs:
`MainTabStore` (built in init; harness can pre-select tab / open side menu), `GamesStore`, `PropsStore`, `MLBBettingTrendsStore`, `MLBF5SplitsStore`, `OutliersTrendsStore`, and 5 per-sport game-sheet stores: `NFLGameSheetStore`, `CFBGameSheetStore`, `NBAGameSheetStore`, `NCAABGameSheetStore`, `MLBGameSheetStore`. Rationale: cross-tab surfaces (Search, Outliers) resolve a gameId → typed game → open the same detail sheet as the Games tab; PropsStore shared between Props tab + MLB game-detail widget (one fetch, 5-min cache).

Created per-feature (`@State` in the view): `SearchStore` (SearchView), `FeatureRequestsStore` (FeatureRequestsView), `RoastSessionStore` (RoastView), `AgentV3SettingsStore` + `PlatformStatsStore` (SecretSettingsView), 5 MLB regression stores (MlbRegressionReportView).

Special cases: `fullScreenCover`/pushed Settings destinations **explicitly re-inject** stores (SwiftUI env doesn't reliably cross presentation hosts / `configurePreferredTransition` evaluates destinations early). SearchView reads shell stores as **optional** env (`@Environment(GamesStore.self) ... : GamesStore?`) and degrades gracefully. Android: single DI graph (Hilt) makes all of this trivial — scope the shell stores to the activity/nav-graph, feature VMs to their destinations.

---

## 2. Root routing & deep links

### 2.1 `RootRouter` (WagerproofStores/RootRouter.swift)
- `Phase`: `launching / unauthenticated / onboarding / ready`.
- `resolve(authPhase:onboardingComplete:)`: launching→launching; unauthenticated→unauthenticated (also clears test flags); authenticated→ `.ready` if `onboardingComplete || bypass` else `.onboarding`.
- **`temporarilyDisableOnboarding = true` (static, hard bypass)** — the onboarding wizard is currently disabled for all users (added 2026-05-29). `forceOnboardingForTesting` (set by Secret Settings "Reset Onboarding" via `forceOnboardingForTestingNow()`, which also sets `testPaywallOverride = true` and flips phase to `.onboarding`) is the only way to re-enter it; in-memory only.
- `handle(deepLink:)`: parses to `DeepLinkRoute` and **always buffers** into `pendingDeepLinkRoute` (both ready & pre-ready branches buffer — consumption is pull-based). `consumePendingDeepLink()` = read + clear.

### 2.2 Deep-link routing table (`wagerproof://` scheme)

`DeepLinkRoute.init?(url:)`: requires `scheme == "wagerproof"`; host (or first path component) switch:

| URL | Route | Effect (via `MainTabStore.apply(deepLink:)` in MainTabView once phase == .ready) |
|---|---|---|
| `wagerproof://agents` | `.agents` | select Agents tab |
| `wagerproof://outliers` | `.outliers` | select Outliers tab |
| `wagerproof://feed` | `.feed` | select Games tab |
| `wagerproof://reset-password` | `.resetPassword` | `apply()` returns nil — "auth router handles it" — **but no consumer exists anywhere** (see Surprises). Used as Supabase `redirectTo` in `AuthStore.sendPasswordReset` |
| any other host | `.feed` (RN-parity default) | Games tab |

Widgets use `.widgetURL(...)`: TopOutliers → `wagerproof://outliers`, AgentMonitor → `wagerproof://agents`.
MainTabView consumes on `.onChange(of: rootRouter.phase, initial: true)` (guard `.ready`) AND `.onChange(of: rootRouter.pendingDeepLinkRoute)` — covers both "link before launch finished" and "link while running".

Other URL handling: Meta SDK first, then Google Sign-In callback (`com.googleusercontent.apps.…` scheme), then the router. Associated domain `applinks:wagerproof.bet` is declared (universal links) but no in-code path parses https URLs — the `onOpenURL` router only matches the custom scheme.

### 2.3 `MainTabStore` (WagerproofStores/MainTabStore.swift)
`Tab` enum: `games, props, agents, outliers, scoreboard, settings, search` (scoreboard/settings retained for side-menu rows; not in the bar). State flags the shell observes: `isSideMenuPresented`, `isFeatureRequestsPresented` (sheet), `isRoastPresented` (fullScreenCover), `isSettingsPresented` (per-tab push), `isChatPresented` (per-tab push), `pendingAgentRoute: {agentId, isPublic}` (Search→Agents handoff), `scrollToTopTrigger: UUID` (bumped when re-tapping the active tab → tab roots scroll to top).

---

## 3. Navigation feature (`Features/Navigation/` — 5 files)

### 3.1 `MainTabView.swift` — the signed-in tab shell
**Tab bar structure (iOS 18 `Tab` builder API):**

| Order | Tab | Icon (SF) | Content |
|---|---|---|---|
| 1 | Games | `trophy.fill` | `GamesView` + `OfflineBanner` overlay |
| 2 | Props | `figure.basketball` | `PropsView` + banner |
| 3 | Agents | `brain.head.profile` | `AgentsView` + banner |
| 4 | Outliers | `bell.badge.fill` | `OutliersView` + banner |
| — | Search | system search role (`Tab(role: .search)`) — detached pill on iOS 26, 5th cell on 18.x | `SearchView` |

- No badges on tabs. Tint = brand green `#00E676`. `tabBarMinimizeBehavior(.onScrollDown)` on iOS 26+ (collapse-on-scroll). `.sensoryFeedback(.selection)` on tab change. Search is deliberately NOT auto-activated on selection (browsable launchpad).
- Scoreboard tab was removed (code parked in `Features/Scoreboard/`); Settings removed from the bar (now a pushed page).
- Games↔Props tab switches sync their sport pickers both directions (`onChange(of: tabStore.selected)`).
- Shell-level modal hosts (single source of truth — chained sheets inside a sheet orphan on iOS): `.sheet` SideMenuSheet (`.large` detent + drag indicator), `.sheet` FeatureRequestsView, `.fullScreenCover` RoastView, `.sheet(item: learnStore.activeTopic)` LearnWagerProofBottomSheet.
- Deep link consumption (see §2.2). `.task`: `syncDryRunPreviewEnabled()` (mirrors `adminMode.dryRunPreviewEnabled` into GamesStore+PropsStore) then eager `gamesStore.refreshAll()`. `onChange` of `adminMode.adminModeEnabled` / `adminMode.isAdmin` → force refresh games (+ NFL props); DEBUG: `debugDataMode.enabled` flips force a reload.

### 3.2 `MainTabToolbar.swift` — shared per-tab chrome
- `WagerProofWordmark`: passive brand mark, top-leading on every main tab. "Wager" at `appTextPrimary` 55% + "Proof" at `#00E676` 55% with a **looping shimmer sweep** (white gradient stripe masked to the glyphs, 1.6s linear repeatForever, `scaleEffect(3)` trick because GeometryReader is unreliable in toolbar items). 15pt heavy, `.fixedSize()`, −8 leading inset. `WagerProofLeadingToolbarItem` hides the iOS 26 glass capsule via `.sharedBackgroundVisibility(.hidden)`.
- `WagerBotToolbarButton` (WagerBot glyph, 22pt) → `tabStore.isChatPresented = true`.
- `SettingsToolbarButton` (`gearshape`, rightmost trailing icon on every tab) → `tabStore.isSettingsPresented = true`.
- `View.wagerProofSettingsDestination(tabStore:tab:auth:settingsStore:revenueCat:adminMode:proAccess:)`: `navigationDestination(isPresented:)` binding gated on `isSettingsPresented && selected == tab` (**the guard prevents all 4 hidden tab stacks from pushing Settings simultaneously**); pushes `SettingsView` with 5 stores explicitly re-injected.
- `View.wagerProofChatDestination(tabStore:tab:)`: same pattern pushing `WagerBotChatView`.
- Android: Settings/Chat become normal NavHost destinations; the "selected == tab" dance disappears with a single back stack (or per-tab stacks in Navigation3).

### 3.3 `SideMenuSheet.swift` — the "drawer"
iOS renders RN's drawer as a **large-detent modal sheet** (nav title "Settings", Done button). Sections:
1. **Account** (auth-gated): person icon + email + "Account" caption.
2. **Navigate**: tab rows Games/Agents/Outliers/**Scoreboard** (`sportscourt.fill`; note Scoreboard is reachable ONLY here) — checkmark on active tab, tap = `tabStore.select` + dismiss.
3. **More**: Settings, Feature Requests (`lightbulb.fill`), Roast Mode (`flame.fill`), Learn WagerProof (`graduationcap.fill`) — each uses the **dismiss-then-flip pattern**: `dismiss()` then `DispatchQueue.main.asyncAfter(+0.35s)` flips the MainTabStore flag / `learnStore.openSheet(.createAgent)` (iOS can't chain sheets).
4. **Preferences**: Appearance `Picker` System/Light/Dark bound to `ThemeStore.mode` (note: ThemeStore coerces to dark on relaunch; this picker still works within a session).
5. **Support**: Discord invite `https://discord.gg/gwy9y7XSDV` (openURL), Contact Us `mailto:admin@wagerproof.bet?subject=Contact Us — Wagerproof iOS`.
6. **Legal**: `https://wagerproof.bet/privacy-policy`, `https://wagerproof.bet/terms-and-conditions`; footer "Wagerproof v3.5.5".
7. **Sign Out** (destructive, auth-gated) → `auth.signOut()` + dismiss.

NOTE: the hamburger entry point is vestigial — MainTabView still hosts the sheet via `isSideMenuPresented` but no toolbar hamburger button was found in the shell chrome (harness can force it open). Verify entry point when porting; Android can use a real ModalNavigationDrawer or bottom sheet.

### 3.4 `OfflineBanner.swift`
`NWPathMonitor` on a background queue → red (`#B91C1C`) top banner "No internet connection — showing cached data" with dismiss X (session-sticky until reconnect resets it). Overlaid at top of each tab's ZStack. Android: `ConnectivityManager.NetworkCallback` + Snackbar/top banner composable.

### 3.5 `FloatingAssistantBubble.swift`
56pt circular gradient (#00E676→#16A34A) FAB with `bubble.left.and.text.bubble.right.fill`, double shadow, `onTap` callback (launcher-only; the draggable/typewriter bubble was a chat-batch item). Currently not mounted by MainTabView (chat opens from the toolbar); keep as a component.

---

## 4. Feature folders

### 4.1 Auth (`Features/Auth/` — 8 files)

All auth screens: forced dark (`preferredColorScheme(.dark)`), hidden nav bar, shared `AuthGateBackground` = `PixelWaveBackground(accentColor: .appPrimary)` (animated pixel-glyph wave from WagerproofDesign).

- **`AuthRouter.swift`**: `NavigationStack(path: [AuthRoute])`, enum routes `emailLogin / signup / forgotPassword`, root = LoginView, white tint.
- **`LoginView.swift`** (welcome gate): centered left-aligned 40pt logo + "Welcome to WagerProof" / "The new way to bet with data"; bottom-pinned pills: **Continue with Apple** (light pill, programmatic `ASAuthorizationController` w/ SHA256 nonce → `authStore.signInWithApple(idToken:nonce:)`), **Continue with Google** (dark pill, "G" text glyph → `authStore.signInWithGoogle()`), **Continue with Email** (NavigationLink → emailLogin); legal 2-line copy; inline `AuthErrorBanner` on failure; loading states disable+dim the other buttons; Apple cancel error is swallowed. `.sensoryFeedback(.error)` on error.
- **`EmailLoginView.swift`**: email + password `AuthFieldRow`s (liquid-glass rounded-16 rows, icon + optional trailing eye toggle 44pt hit area), "Forgot Password?" link, `LiquidGlassPillButton` "Sign In" (enabled only when both non-empty), footer "Don't have an account? Sign Up". Validation: email non-empty + contains "@", password non-empty. Error classification (verbatim RN): "Invalid login credentials"→"Invalid email or password"; "Email not confirmed"→"Please verify your email before signing in"; else raw. Haptics: selection on focus/visibility, light impact on tap, success on `authStore.lastSuccessAt`, error on message. Also defines shared `AuthFieldRow`, `AuthErrorBanner`.
- **`SignupView.swift`**: top bar = back + "Already have an account? Sign In"; email/password/confirm rows (`.newPassword` content type), 18+ analytics-only disclaimer, "Create Account" glass CTA, "or continue with" divider, Apple+Google pills. Validation: email @, password ≥8, match. Classify: "already registered"→"An account with this email already exists". Post-signup: if session created (auto-confirm) → success banner "Setting up your profile..." and auth listener routes; else "check your email" banner, fields cleared, auto-`dismiss()` after 3s. Defines `AuthSuccessBanner`.
- **`ForgotPasswordView.swift`**: email row + "Send Reset Link" → `authStore.sendPasswordReset(email:)` (Supabase `resetPasswordForEmail` with `redirectTo: wagerproof://reset-password`). Success swaps the whole form for a confirmation view (bouncing `envelope.badge` in green disc, "Check your email", highlighted address, spam note, "Back to Login").
- **`Components/AuthButtons.swift`**: `AuthPillLabel` (50pt, radius 28, light=white/black dark=black/white + hairline rim), `PillPressStyle` (0.98 scale / 0.85 opacity press), `LiquidGlassPillButton` (52pt white-tint interactive glass capsule + specular sheen + gradient stroke), `AppleNonce` (SecRandom charset nonce + SHA256 hex), `AppleSignInCoordinator` (NSObject delegate bridging ASAuthorization to a Result closure; must be retained by the view).
- **`Components/AuthGateBackground.swift`**: 17-line wrapper (above).
- **`Components/OnboardingSlide.swift`**: LoginView carousel slide definitions (RN `ONBOARDING_SCREENS` parity): 6 kinds (proData, createBots, aiModels, publicBetting, discord, getStarted) with title/subtitle/auto-advance duration (10s for createBots, else 5s) + `hasVideoBackground` (proData, getStarted). Hand-built SwiftUI visuals: `StatsCard` (bar chart), `LineMovementCard` (+sparkline `ChartScribble` paths), `AIModelCard` ("NFL Predictor v2.1", 68.4% win rate, +12.8% ROI, curve), `DiscordCard` (#sharp-plays mock chat), `CreateBotsPlaceholder` (emoji bot trio — FIDELITY-WAIVER #001, RN's PixelOffice 3D scene not ported). NOTE: LoginView as currently written doesn't render the carousel — the slide file is retained componentry.

Android: Credential Manager (Sign in with Google) + Sign in with Apple via web flow OR drop Apple on Android; Supabase auth calls identical.

### 4.2 Settings (`Features/Settings/` — 9 files)

- **`SettingsView.swift`** (645 lines) — pushed page (no own NavigationStack, hides tab bar, system back pops = clears `isSettingsPresented`). Layout: hand-rolled flat "profile list" (ScrollView, NOT Form): 2 hero `HoneydewOptionCard` banners (animated gradient + drifting SF-symbol chrome + glass action pill; component in WagerproofDesign) — **Pro banner** (pumpkin→gold; title/action varies: "Verifying access/Hold" while `proAccess.isLoading`, "You are Pro/Manage" → CustomerCenter (after `refreshCustomerInfo`), "Go Pro Today/Upgrade" → paywall) and **Discord banner** (blurple; opens Discord modal). Sections (ProfileSectionHeader + ProfileRow primitives, monochrome 20pt outline icons, 0.5pt inset dividers, `chevron.right` = in-app / `arrow.up.right` = external):
  - Preferences: Push Notifications row (bespoke: subtitle "On — agent picks & alerts"/"Off"/"Checking permission…", spinner while polling, `Toggle` → `settings.enableNotifications(userId:)` — `.denied` result raises an "Open Settings" alert via `UIApplication.openSettingsURLString`; permission re-polled in `.task` and on every appear); iOS Home Screen Widget → widget modal. (Theme row intentionally hidden — dark-only.)
  - Support: Discord Channel (modal), Contact Us (`mailto:admin@wagerproof.bet?...` external).
  - Legal: Privacy Policy / Terms of Use (external, same URLs as side menu).
  - Account (auth-gated): Email display row; **User ID row** — tap copies UUID to pasteboard, glyph flips `doc.on.doc`→checkmark + "Copied" for 1.6s, success haptic on rising edge only.
  - More: Sign out (confirmation alert; while signing out shows spinner + "Logging out…"; flow = `NotificationService.deactivatePushTokens` → `revenueCat.detachUser()` → `adminMode.reset()` → `auth.signOut()`).
  - Danger Zone: Delete Account (red) → modal.
  - Footer: version string `CFBundleShortVersionString (CFBundleVersion)` + "Developed by nerds from Ohio." — **double-tap within 500ms opens Secret Settings** (tap counter + reset task).
  - Modal plumbing: single `SettingsModal` enum drives ONE `.sheet(item:)` for discord/iosWidget/deleteAccount; `.secretSettings` is **filtered out of the sheet binding** and presented via `.fullScreenCover` instead (declaring both unfiltered makes SwiftUI mount an empty sheet — documented trap). Plus bool-driven sheets for paywall + customer center.
- **`SecretSettingsView.swift`** — fullScreenCover, own NavigationStack, "Developer" large title, back chevron. Sections:
  - Testing Toggles: Simulate Freemium (`revenueCat.forceFreemiumMode`), Admin Mode (only if `adminMode.canEnableAdminMode`), Dummy Data Mode (DEBUG; serves captured fixture slates offseason, forces Games reload), WagerBot Voice row (opens `WagerBotVoiceView` cover; subtitle reflects `@AppStorage("wagerbot.personality")` friendly/spicy).
  - UI Previews (DEBUG): Generation Card Preview → `GenerationPreviewView` cover.
  - Platform Analytics: "Agents Platform Stats" → cover with `AgentStatsView(store: PlatformStatsStore)` (win-rate distribution across all agents; hidden admin surface).
  - Agent V3 Engine: Dry Run toggle + Model picker (`AgentV3SettingsStore`, UserDefaults-backed, read by AgentDetailStore.generatePicks; client is V3-only).
  - Diagnostics: Push Diagnostics (platform/model/permission/token prefix/user id alert), Register & Test Push (request permission → `NotificationService.initialize()` + `registerPushToken` → schedules a **local** test notification in 3s with `userInfo {type: auto_pick_ready, agent_id: test, run_id: test}`), Sync Offerings (`revenueCat.syncPurchases()`), Check Offerings (`refreshOffering()` → alert with identifier + package count), Test Paywall, **Reset Onboarding** (writes `profiles.onboarding_completed=false` via Supabase, `onboarding.reset()` wipes App Group key, `router.forceOnboardingForTestingNow()`; alert dismissOnAck pops the cover). Info: User ID. Waivers noted in-file: #053 WagerBot admin rows deferred, #055 Meta SDK event test rows not surfaced.
- **`DeleteAccountView.swift`** — sheet w/ own stack, "Danger Zone" inline title, X close. Warning triangle in red disc, copy, red info box, destructive "Delete Account" button → confirmation `.alert` → `performDelete()`. **FIDELITY-WAIVER #054: no server-side cascade delete RPC — currently just `auth.signOut()` + dismiss.**
- **`DiscordView.swift`** — sheet. Non-Pro: locked card ("PRO FEATURE" amber pill, "Unlock with Pro" gradient CTA → paywall). Pro: two step-cards — Step 1 Link Discord (`https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/discord-callback?user_id=<uuid>` opened in Safari; linked-state read from `profiles.discord_user_id` on `.task`), Step 2 Join `https://discord.gg/gwy9y7XSDV`. Benefits list ×3. Link check failure ⇒ treated as not-linked.
- **`IosWidgetView.swift`** — sheet; walkthrough for the two native widgets. Segmented pills Outliers/Agents drive a hardcoded dark widget mock preview; 5 numbered how-to-add steps; note "sync on app open + ~60min background refresh". Android port: rewrite copy for launcher widgets.
- **`GenerationPreviewView.swift`** (DEBUG) — harness for `AgentGenerationCard` + `ToolActivityStack`: toggle polling, steppers for toolCalls/picks, auto-play (deals a fake tool label every 0.7s ×8), accent swatches; builds fake `TriggerV3RunStatus` via JSON round-trip.
- **`SettingsFixtures.swift`** (DEBUG) — factory helpers `makeAdminMode/makeRevenueCat/makeSettings/makeProAccess` with `debugSet` seeding for screenshots.
- **`Sheets/DeleteAccountBottomSheet.swift`** — `DeleteAccountView` + `.presentationDetents([.medium, .large])` variant.
- **`Sheets/ReviewRequestModal.swift`** — 420pt-detent sheet: icon disc, "Would you leave us some early feedback?", "Yes, I'd love to!" → `@Environment(\.requestReview)` (StoreKit; OS rate-limits) + dismiss; "Not now" dismisses. Android: Play In-App Review API.

### 4.3 Paywall (`Features/Paywall/` — 6 files)

- **`RevenueCatPaywallView.swift`** — sheet-hosted NavigationStack titled "Upgrade to WagerProof Pro" + X. Load flow: `revenueCat.fetchOffering(forPlacement: placementId)` → fallback `revenueCat.offering` → states loading (spinner) / failed (retry) / empty (retry) / ready → **native `RevenueCatUI.PaywallView(offering:displayCloseButton: true)`** with `onPurchaseCompleted`/`onRestoreCompleted` → `refreshCustomerInfo()` + dismiss, `onRequestedDismissal` → dismiss. Placement used everywhere: `RevenueCatService.Placement.genericFeature`. FIDELITY-WAIVER #052: Mixpanel paywall events not fired.
- **`CustomerCenterView.swift`** — wraps `RevenueCatUI.CustomerCenterView()` in a stack ("Subscription Management", X); `.task` refreshes customer info so plan changes propagate.
- **`ProFeatureGate.swift`** — 3 render modes: pro→content; non-pro w/ fallback→fallback; non-pro + `showUpgradePrompt`→inline crown card w/ "Upgrade to Pro" → paywall sheet; loading→thin "Loading…" row; else EmptyView.
- **`ProContentSection.swift`** — pro or loading → content; else content at 0.3 opacity under `.ultraThinMaterial` + lock capsule ("Pro Feature"/custom title + "Tap to unlock") → paywall.
- **`LockedGameCard.swift`** — game-card wrapper: content 0.4 opacity + blur + `lock.fill` amber (#F59E0B dark / #D97706 light) "Pro" pill; whole card tap → paywall.
- **`LockedOverlay.swift`** — generic blur + lock disc + message ("Unlock with Pro" default); optional custom `action` instead of paywall; configurable `placementId`.
- (Related but in `Features/Onboarding/`: `PostOnboardingPaywall` — fires Meta `trackPurchase`/`trackSubscribe` + `flush()` on conversion.)

Android: RevenueCat Purchases + `com.revenuecat.purchases:purchases-ui` (Paywall + CustomerCenter composables map 1:1); Android API key needed (iOS key is `appl_…`, Android will be `goog_…` — not in this repo).

### 4.4 Search (`Features/Search/` — 4 files)

- **`SearchView.swift`** (1042 lines) — owns its NavigationStack (search tab role provides none). `.searchable` in nav drawer, prompt "Search games, players, agents…"; `.searchScopes(activation: .onTextEntry)`: All / Matchup / Props / Agents / Outliers (`SearchStore.SearchScope`); attached **unconditionally** (conditional attachment drops keyboard focus — documented trap). `onSubmit(of: .search)` flushes 200ms debounce + commits to recents.
  - **Empty state**: "Explore" rail — 3 animated `SearchToolCard`s (Props/`AngledStatSheetGraphic` typewriter stat sheet; Agents/`StackedStatCardsGraphic`; Outliers/`RadarSweepGraphic`), 158pt wide, view-aligned snapping, edge-to-edge `scrollClipDisabled`; "Recent" chip rail (last 5 queries, UserDefaults, Clear button); "Suggestions" — sport chips (NFL/CFB/NBA/NCAAB/MLB; tap pre-seeds the query with the label) + browse rows (Trending agents → Agents tab, Top outliers → Outliers tab).
  - **Browse mode** (Explore card tapped, no query): full category list with that feed's own rows/shimmers, `browseHeader` w/ Clear → exit browse; per-category empty states.
  - **Active search**: 200ms debounce → shimmer scaffold; scope-aware `ContentUnavailableView.search`; sections Matchup (renders the **exact per-sport game card** from the Games feed, resolved from GamesStore by id), Props (`PropPlayerCard`/`NFLPropPlayerCard` with `.navigationTransition(.zoom)` into prop detail), Agents (`AgentRowCard`), Outliers (horizontal `OutliersTrendCard` rail, 300pt cards; loading = shimmer rail).
  - **Navigation handoff**: game tap → `tabStore.select(.games)` + `<sport>SheetStore.openGameSheet(g)`; agent tap → `select(.agents)` + `tabStore.pendingAgentRoute`; trend tap → local `.sheet` `OutliersTrendDetailSheet` (stays in search). MLB insight chips (Trends/F5/Props teasers from `MLBBettingTrendsStore`/`MLBF5SplitsStore`/`PropsStore` adapters) push **locally** via `navigationDestination(item: $insightDestination)` → `BettingTrendsDetailSheet` / `F5SplitsDetailSheet` / props list; single hot prop (≥70% L10) goes straight to detail. Insight slates hydrate lazily on first non-empty query (TTL-guarded).
- **`Components/SearchResultRow.swift`** — generic list row: 36pt tinted rounded-square icon, 16pt semibold primary, 13pt secondary, optional monospaced trailing detail, chevron; imperative onTap.
- **`Components/SearchMatchupCard.swift`** — rich MLB result card: ultraThinMaterial radius-26 container, header (logo discs via `MLBTeams.info` AsyncImage or initial-letter circle, "AWY @ HOM", sport · pretty time) + `InsightChip` rail (TRENDS/FIRST 5/PROPS: 9pt tracked caption, signal-tinted headline green/red/neutral, small-sample amber dot, min height 52, always tappable; loading = `SkeletonCapsule` shimmer).
- **`Components/SearchToolCards.swift`** — explore card chrome (graphic bleeds, 104pt tall, selected = 2pt appPrimary border) + the three looping graphics (typewriter rewrite w/ symbol morph, honors `accessibilityReduceMotion`).

### 4.5 FeatureRequests (`Features/FeatureRequests/` — 4 files)

- **`FeatureRequestsView.swift`** — sheet from shell. NavigationStack, large title "Feature Requests", X (leading) + green circular `plus` (trailing) → submit sheet (`.medium/.large` detents; falls back to "Sign in required" if signed out mid-flow). `List(.insetGrouped)`, sections: **Community Voting** (approved requests; votable), **Planned** (`clock`, blue), **In Progress** (`paperplane.circle.fill`, purple), **Completed** (`checkmark.circle.fill`, #22C55E) — roadmap rows read-only, headers show count chips. `.refreshable` + first-load `.task` → `store.refresh(userId:)`. Row context menu: Copy (title+description to pasteboard) / ShareLink. States: skeleton list (`FeatureRequestRowSkeleton`, shimmer, disabled), error card w/ Retry, empty `ContentUnavailableView` w/ submit CTA. Haptics: success on `store.justSubmittedAt`, selection on votes.
- **`Components/FeatureRequestRow.swift`** — status visuals map (approved→"Community" green `lightbulb.fill`; planned/inProgress/completed/nil-roadmap per above, `symbolEffect(.bounce)` on status change); title + badge; description; footer "By <name> · <medium date>" (ISO-8601 parsed, raw fallback) + vote cluster: thumbs up/down 32pt buttons (`.borderless` so the row's contextMenu still works; active = tinted 18% bg) around a net-votes badge with `.contentTransition(.numericText())`; roadmap variant = "N votes" pill.
- **`Sheets/SubmitFeatureRequestSheet.swift`** — Form: Title field (submit→next), Description (`axis: .vertical`, `lineLimit(4...10)`, submit=send), footer hint, inline error section from `store.lastError` (+warning haptic); toolbar Cancel / Submit (spinner while submitting; disabled until both fields trimmed-non-empty). Success = dismiss (haptic on parent).
- **`FeatureRequestsFixtures.swift`** (DEBUG) — 5 sample requests (2 approved incl. one pre-upvoted, 3 roadmap states).

### 4.6 Roast (`Features/Roast/` — 6 files)

Voice "roast me about my bets" screen, fullScreenCover from shell (`isRoastPresented`), NOT a tab. Store: `RoastSessionStore` (states idle/recording/processing/responding; intensity savage/medium/light; messages; live user/AI transcripts; haptic counters; audio driver currently nil → `connect()` is a near-no-op).

- **`RoastView.swift`** — dark gradient bg (#0A0A0A→#111827→#0A0A0A), custom header (arrow.left dismiss / "Roast Mode" / arrow.clockwise → clear-conversation `confirmationDialog`), `RoastIntensitySelectorView`, status banners (connecting/error, animated), conversation `ScrollViewReader` list (`RoastMessageBubble` per message w/ Copy/Share context menu; live user + live assistant interim bubbles; scroll-tail anchor with 100ms-delayed auto-scroll on message/transcript/state change), empty state `ContentUnavailableView` "Ready to get roasted?" (`mic.fill`), bottom section = `BookieOrbView` + status text (green recording / amber responding / 50% white idle) + `RoastMicButtonView` → `store.toggleRecording()`. Haptics: heavy impact mic toggle, selection intensity, success connection, error errors. `.task` connect / `onDisappear` disconnect.
- **`Components/BookieOrbView.swift`** — 96pt pulsing 3-layer green orb (glow blur + mid ring + dark disc w/ mic glyph), 1.6s ease loop, static under Reduce Motion. (Lottie `ChattingRobot.json` replacement — lottie-ios deliberately not added.)
- **`Components/RoastIntensitySelectorView.swift`** — 3 pills ordered Savage 🔥 / Medium 😏 / Light 😄; active = green 20% bg + green border/text; async onChange.
- **`Components/RoastMessageBubble.swift`** — user: green-20% bg right-aligned, bottom-right corner pinched to 4pt (`UnevenRoundedRectangle`); assistant: white-8% left-aligned, bottom-left pinch, "THE BOOKIE" 11pt bold green caption; live variants dimmed w/ dashed green border (user); max width 320.
- **`Components/RoastMicButtonView.swift`** — 80pt button: idle dark gray, recording green (black icon) + expanding radar ring (1.2s scale 1→2, fade 0.6→0) + 0.8s autoreversing pulse glow + `.symbolEffect(.pulse)`; processing/responding = muted gray `ellipsis`, disabled while processing; frame 2.5× for the ring.
- **`RoastFixtures.swift`** (DEBUG) — 4-turn sample conversation + live transcript.

Android: needs mic permission flow + (future) Gemini Live audio driver; UI is a straight Compose port.

### 4.7 LearnMore (`Features/LearnMore/` — 11 files)

Store: `LearnWagerProofStore` (`activeTopic` optional drives the global sheet; topics createAgent/gameCards/gameDetails/wagerBot/outliers/moreFeatures map to slide indices 0-5; `currentSlide`, `isLastSlide`, `nextSlide()`, `goToSlide()`, `markAsSeen()`, `totalSlides = 6`).

- **`LearnWagerProofView.swift`** — "Learn & Discover" hub page (extra entry point beyond RN): intro line + 6 full-color topic cards (180pt tinted hero w/ 80pt SF symbol + title/subtitle block, radius 22, shadow) each → `learnStore.openSheet(topic)`. Accents: appPrimary / appAccentBlue / appAccentPurple / appAccentAmber / #10B981 / #5865F2.
- **`Sheets/LearnWagerProofBottomSheet.swift`** — the canonical walkthrough, mounted globally by MainTabView via `.sheet(item: activeTopic)`. `.large` detent, drag indicator, `.regularMaterial` background. Header: X (markAsSeen+dismiss) / `SlideProgressIndicator` (6 tappable dots, active 8pt green vs 6pt 30%-white) / "Next"→"Done" on last slide. Carousel: `TabView(.page, indexDisplayMode: .never)` bound to `store.currentSlide`, 0.25s easeInOut.
- **`Components/LearnSlide.swift`** — per-slide scaffold: glass title card (36pt gradient-green icon badge + title + description), custom mockup content, optional "WHY THIS MATTERS" green-tinted glass value card.
- Slide visuals (all hardcoded marketing mockups): `Slide1_Create247Agent` (pulsing robot hero — waiver #063 Lottie replacement — + 3 bullets: build multiple agents / 24-7 research / global leaderboard), `Slide1_GameCards` (two mini game cards LAL@BOS NBA + KC@BUF NFL w/ pick pills + confidence badges + legend), `Slide2_GameDetails` (mini game-detail sheet mock: Lakers/Celtics gradient header, model-vs-vegas block, 62/38 public split bar, "tap any game card" callout), `Slide3_WagerBot` (Dynamic-Island-style bubble w/ countdown ring + typewriter suggestion + 4 feature rows), `Slide5_Outliers` (VALUE + FADE alert cards w/ pro-lock badges + legend), `Slide6_MoreFeatures` (2×2 gradient grid: Discord/Trends/Live Scoreboard/Bet Slip Grader).
- **`Components/SlideProgressIndicator.swift`**, **`Components/ComingSoonBanner.swift`** (MLB-only "COMING SOON"/"PREVIEW" pill banner, green-tinted, used atop pre-launch sport pages).

### 4.8 Analytics (`Features/Analytics/` — 13 files)

**`MlbRegressionReportView.swift`** — "MLB Daily Regression Report" page (pushed; inline title). 5 independent stores hydrated in parallel (`refreshIfStale` on `.task`, full `refresh()` via pull-to-refresh + toolbar arrow.clockwise): `MLBRegressionReportStore` (the report row), `MLBBucketAccuracyStore`, `MLBModelBreakdownStore`, `MLBPerfectStormRecordsStore`, `MLBSeriesSignalsStore`. Toolbar `list.bullet` **jump-to-section Menu** (targets mirror rendered sections; `ScrollViewReader.scrollTo(id, anchor: .top)`). `LazyVStack(pinnedViews: [.sectionHeaders])` — section headers are **pinned liquid-glass capsule pills** (24pt tinted icon chip + 15pt bold title + optional count capsule). Feed order (each section gated on data presence, `staggeredAppear(index:)` animation):
1. AI Analysis Summary — `RegressionNarrativeCard`: full block-level markdown via shared `WagerBotMarkdownText`, purple blockquote accent.
2. Model Accuracy — `RegressionAccuracySection`: 2×2 overall tally grid per bet type + `RegressionSegmentedTabs` → bucket drill-down table (≥3 graded games, sorted by win%).
3. Day-of-Week & Team Breakdown — `RegressionModelBreakdownSection`: segmented bet-type tabs over BY DAY and BY TEAM (ROI-sorted, logos) tables from `mlb_model_breakdown_accuracy`.
4. Yesterday's Results — `RegressionRecapSection`: hero tiles (yesterday record + ALL-TIME from Perfect-Storm tier records, NOT legacy cumulative_record) + graded pick rows.
5. Regression Report Suggested Picks — `PerfectStormTierRecordsGrid` (2×2 season records per tier) + `PerfectStormPickCard`s. Tier display map (keep in lockstep with web/RN): hammer="PERFECT STORM HAMMER"/purple #A78BFA, ps="PERFECT STORM"/green, lean="STRONG LEAN"/blue, watch="WATCH"/amber; unknown→watch. Empty: "No Perfect Storm picks today…" italic.
6. Starting Pitcher Regression — group labels "DUE FOR NEGATIVE REGRESSION" (red, "ERA too low vs xFIP — been lucky") / positive (green) over `PitcherRegressionCard`s (severity-colored accent rows: name+team, vs opponent, ERA/xFIP/etc. stats).
7. Team Batting Regression — "DUE TO HEAT UP" (green, low BABIP) / "DUE TO COOL DOWN" (red) `BattingRegressionCard`s (wOBA etc., severity pill).
8. Bullpen Fatigue & Trends — `BullpenFatigueCard`: OVERWORKED (red) vs DECLINING (amber); IP L3d ≥13 / L5d ≥22 highlighted red.
9. L/R Pitcher Splits — `LRSplitsSection`: NOTABLE MATCHUPS (indigo) first, then ALL OTHER SPLITS.
10. Series-Position Signals — `SeriesSignalCard`: ★ BACK (green) before ⚠ FADE (red), message in tinted box (live `mlb_game_signals`, category "series").
11. Weather & Park Impact — `WeatherParkFlagCard`: cyan icon chip (icon inferred from flag text), matchup + venue, wrapping flag chips (`RegressionFlowLayout`).

States: rich skeleton (date lines, hero tiles, tier grid, accent rows — all `.shimmering()`), error card (red), no-report card ("Reports generate at 9 AM, 11 AM, and 4 PM ET"). Date formatted in America/New_York ("EEEE, MMMM d, yyyy") + "Updated <ago>".

**`Components/RegressionPrimitives.swift`** — shared vocabulary: color tokens (winGreen #22C55E, lossRed #EF4444, warnAmber #F59E0B, accentBlue/Purple/Indigo/Cyan/Yellow/Orange, hammerPurple #A78BFA), `winPctColor` thresholds (≥65 green, ≥55 yellow, ≥50 orange, else red), `severityColor`, `betTypes` list, `timeAgo`, and primitives `RegressionAccentRow` (elevated card w/ colored left accent), `RegressionPill`, `RegressionStat`, `RegressionGroupLabel`, `RegressionSegmentedTabs`, `RegressionFlowLayout`. Port these as one Kotlin file to keep every card in lockstep.

`PerfectStormPickCard` (306 lines) is the richest card: tier badge, matchup, pick line, per-pick model-alignment context computed from breakdown rows.

---

## 5. Widget extension (`WagerProofWidgetExtension/` — 8 Swift files)

Bundle: `WagerProofWidgetBundle` (@main) = **two independently-addable static widgets** (no configuration intent):

| Kind | Display name | Description | Families | widgetURL |
|---|---|---|---|---|
| `TopOutliersWidget` | "Top Outliers" | The day's highest-confidence value and fade alerts. | small / medium / large | `wagerproof://outliers` |
| `AgentMonitorWidget` | "Agent Monitor" | Track your favorite AI agents' record, streak, and latest picks. | small / medium / large | `wagerproof://agents` |

Both: `contentMarginsDisabled()`, `containerBackground = WidgetPalette.background` (= dynamic `Color.appSurface` — widgets follow system light/dark, unlike the dark-forced app).

**Timeline policy** (both providers, identical): single entry, `.after(now + 60 min)`. **No in-extension network fetch** — providers only read the App Group payload written by the main app (deliberate: extension budget + no authed Supabase session in-process); empty cache renders "Open WagerProof to load…" placeholder. `context.isPreview` → `WidgetSampleData` fixtures (gallery).

**App Group payload contract** (`TopAgentsWidgetService` / `OutliersWidgetService`):
- Suite: `group.com.wagerproof.mobile`; key: **`widgetPayload`** (RN-era key, must not change; NOTE `AppGroupKey.widgetPayload = "widget_payload_v1"` exists in SharedKit but the widget services use the literal `"widgetPayload"`). Value = one JSON string blob `WidgetDataPayload`:
  - `lastUpdated: String` (ISO-8601, fractional or not)
  - `topAgentPicks: [TopAgentWidgetData]` — `{agentId, agentName, agentEmoji, agentColor (hex string "#22c55e"), isFavorite, netUnits: Double, winRate: Double?, currentStreak: Int (negative = losing streak), record "W-L[-P]", picks: [{id, sport, matchup, pickSelection, odds, result?, gameDate?}]}`
  - `topOutliers: [OutlierAlertForWidget]` — `{id, kind: value|fade, sport, awayTeam, homeTeam, marketType (Spread|Total|Moneyline), side, confidence: Int}`
  - (legacy RN fields — editor picks / polymarket — round-tripped, not rendered)
- Sync logic (main app): top agents = active `avatar_profiles` for user, favorites (`is_widget_favorite`) first then by netUnits→winRate→streak, max 3 agents × 2 picks (prefer today's, 3-day lookback, dedupe); perf from `avatar_performance_cache`; pick/perf fetch failures degrade gracefully. Payload writes **merge** into the existing blob.

**Widget UI:**
- TopOutliers — small: first alert (sport badge + kind icon, matchup, display label, confidence); medium: header row ("Top Outliers" + "WagerProof") + 2 rows; large: 5 rows. Display rules: fade alerts store the model's FAVORED side → recommendation displays the OPPOSITE ("Fade to X"; totals flip Over/Under); value = "X value". Confidence: value & NFL-fade = `NN%`, other fades = `NNpt`. Sport badge colors (`WidgetSportBadge`): nfl #013369, nba #1D428A, cfb #8B0000, ncaab #FF6600, mlb #002D72, default #6366F1.
- AgentMonitor — small: top agent (emoji+name, big record, ±N.Nu green/red, W/L streak) over a vertical gradient from the agent's color at 22%; medium: header + 2 agent rows (emoji disc, name, record, net units); large: 3 rows + first pick line "matchup — selection". `Color(widgetHexString:)` parses `#RRGGBB` DB strings.
- `WidgetPalette` maps design tokens; `WidgetSampleData` = 5 sample alerts + 3 sample agents.

Refresh triggers: cron-driven backend + app foreground/sign-in `WidgetSyncCoordinator.syncAll` → `reloadTimelines(ofKind:)`; plus the 60-min timeline `.after` policy.

---

## 6. Project config

### 6.1 `project.yml` (XcodeGen — the .xcodeproj is generated/gitignored)
- App target **Wagerproof**: iOS 18.0 deployment, Swift 5.10, `TARGETED_DEVICE_FAMILY "1,2"` (iPhone+iPad), bundle `com.wagerproof.mobile`, team `88DXY6L653`, entitlements `Wagerproof/Wagerproof.entitlements`, embeds the widget extension. Sim builds strip entitlements via a postCompile script (iOS 26 sim signing workaround).
- Widget target **WagerProofWidgetExtension**: bundle `com.wagerproof.mobile.widget`, own Info.plist/entitlements, links only Models/Services/Design products.
- SwiftPM: local `WagerproofKit` (products: WagerproofModels, WagerproofServices, WagerproofStores, WagerproofDesign, WagerproofSharedKit), `supabase-swift ≥2.0`, `purchases-ios ≥5.78.0` (RevenueCat + RevenueCatUI), `GoogleSignIn-iOS ≥7.0`, `mixpanel-swift ≥4.3`. WagerproofKit's own Package.swift additionally pulls `facebook-ios-sdk ≥17.0` (FacebookCore).

### 6.2 `Wagerproof/Info.plist`
- Display name **WagerProof**; version **3.5.5 (40)** (also in both xcconfigs as MARKETING_VERSION/CURRENT_PROJECT_VERSION).
- **Portrait-only on iPhone** (`UISupportedInterfaceOrientations` = Portrait); iPad allows all 4. `UIRequiresFullScreen` false; multiple scenes supported.
- `UILaunchScreen.UIColorName = SplashBackground`.
- **URL schemes** (`CFBundleURLTypes`, name `com.wagerproof.mobile`): `wagerproof`, `rc-ff2fe0e0af` (RevenueCat web-purchase redemption), `com.googleusercontent.apps.142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq` (Google OAuth callback).
- `UIBackgroundModes = [remote-notification]`.
- Usage strings: Tracking ("deliver more relevant content…"), Camera + Photo Library (agent profile photo), Microphone (WagerBot voice chat), Speech Recognition (transcribe WagerBot questions).
- Facebook: `FacebookAppID = $(FACEBOOK_APP_ID)`, `FacebookClientToken = $(FACEBOOK_CLIENT_TOKEN)`, display name WagerProof, `LSApplicationQueriesSchemes` fbapi/fb-messenger-share-api/fbauth2/fbshareextension. **The two build settings are not defined anywhere in the repo** (not in xcconfigs/project.yml) — values are injected outside source control; obtain from the Meta dashboard for Android.
- `ITSAppUsesNonExemptEncryption = false`.

### 6.3 Entitlements
- App: App Group `group.com.wagerproof.mobile`; `aps-environment = development` (hardcoded in the file; xcconfigs define APS_ENVIRONMENT=development/production but the plist doesn't reference the variable — distribution signing rewrites it); Sign in with Apple; associated domains `applinks:wagerproof.bet`.
- Widget: App Group only.

### 6.4 xcconfigs (`Wagerproof/Configuration/`)
Debug: DEBUG conditions, -Onone, singlefile, testability, APS dev. Release: -O wholemodule, dSYM, assertions off, APS production. Both: version 3.5.5 (40).

### 6.5 Third-party keys — actual values & where they live

| Service | Value | Location |
|---|---|---|
| Supabase MAIN | `https://gnjrklxotmbvnxbnnqgq.supabase.co` + anon key `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ` | `WagerproofServices/SupabaseConfig.swift` (deliberately in code, RLS-gated) |
| Supabase CFB | `https://jpxnjuwglavsjbgbasnl.supabase.co` + anon key `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo` | same file |
| RevenueCat iOS | `appl_TFQYZRtHkCBrnaILkniTjsulyHK` (project suffix ff2fe0e0af per the `rc-` scheme) | `WagerproofServices/RevenueCatService.swift` (Android needs a `goog_` key) |
| Google Sign-In iOS client | `142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq.apps.googleusercontent.com` | `WagerproofServices/GoogleSignInCoordinator.swift` (Android needs its own + the web/server client id for Supabase id-token flow) |
| Facebook App ID / client token | `$(FACEBOOK_APP_ID)` / `$(FACEBOOK_CLIENT_TOKEN)` — **not committed** | Info.plist placeholders only |
| Mixpanel token | **not present** — `AnalyticsService.bootstrap(token:)` exists but is never called; a "Secrets.swift generated by scripts/generate-secrets.sh" is referenced in comments but neither exists in the repo | — |
| Discord | invite `https://discord.gg/gwy9y7XSDV`; link function `…supabase.co/functions/v1/discord-callback?user_id=` | SideMenuSheet / DiscordView |
| Support email | `admin@wagerproof.bet` | SideMenuSheet / SettingsView |

### 6.6 App Group keys (`WagerproofSharedKit/AppGroup.swift`)
Suite `group.com.wagerproof.mobile`; keys: `last_notification_route`, `theme_pref`, `admin_mode_enabled`, `widget_payload_v1` (declared; widget services actually use `widgetPayload`), `dummy_data_mode_debug`, `pro_entitlement_granted_v1` + `pro_subscription_type_v1` (RC entitlement mirror for widgets/cold-launch), `wagerbot_chat_model_debug`, `onboarding_complete/{userId}` (per-user). Fallback to `.standard` when the suite is unavailable (tests).

### 6.7 Notifications
`NotificationService` (services): permission via UNUserNotificationCenter; on grant → `registerForRemoteNotifications()`; token upserted to `user_push_tokens` (cols user_id, expo_push_token — APNs hex reuses the column, waiver #051 —, platform, device_name, is_active, last_used_at) + ensure `user_notification_preferences` row (`auto_pick_ready = true`); deactivate on sign-out. Local notifications: 3s test (Secret Settings) and pick-generation-finished (only when app not foreground-active). **Gap: `setDeviceToken` has no caller** — there is no `UIApplicationDelegateAdaptor`, so the APNs token never reaches the registrar (remote push registration is effectively a silent no-op; see Surprises). `SettingsStore` caches permission state for the toggle.

---

## 7. Surprises / gotchas found while reading

1. **Onboarding is hard-bypassed**: `RootRouter.temporarilyDisableOnboarding = true` — all authenticated users skip the wizard; only Secret Settings "Reset Onboarding" can re-enter it. Port the flag.
2. **`wagerproof://reset-password` has no consumer**: parsed into `DeepLinkRoute.resetPassword`, `MainTabStore.apply` punts to "auth router", but AuthRouter has no reset-password route/screen. The Supabase reset email deep-links into the app and… nothing happens. Android should implement the missing set-new-password screen (or replicate the gap knowingly).
3. **Remote push registration is dead code**: no AppDelegate adaptor calls `NotificationService.setDeviceToken`, so `registerPushToken` always early-returns (`cachedDeviceToken == nil`). Local notifications work; server pushes can't target this build. On Android, FCM token retrieval is explicit — don't copy the gap.
4. **Mixpanel is linked but never initialized** (package + `AnalyticsService.bootstrap(token:)` exist; no call, no token). Meta/FBSDK IS live (init + registration/purchase/subscribe events).
5. **FACEBOOK_APP_ID / FACEBOOK_CLIENT_TOKEN build settings are undefined in the repo** — injected out-of-band.
6. **Widget payload key mismatch**: SharedKit declares `widget_payload_v1` but the shipping key is the RN-era literal `widgetPayload` (must keep for installed-widget compatibility on iOS; Android is free to pick one key).
7. Dark-mode forcing is two-layered: `ThemeStore.init` coerces to `.dark` AND `overrideUserInterfaceStyle` is pushed onto every window (sheets included) — yet the side menu still shows a working System/Light/Dark picker (session-only; reverts to dark on relaunch).
8. **Both widget providers read `TopAgentsWidgetService.readPayload()`** — TopOutliersProvider too (outliers live in the same blob; `OutliersWidgetService.sync()` writes `topOutliers` into it).
9. Delete Account doesn't delete (waiver #054): sign-out only, no server RPC.
10. Fade-alert display inverts the stored side (model's favored side is stored; widget/UI shows the opposite as the bet) and confidence unit differs by sport (NFL % vs others pt).
11. The `.sheet(item:)`+`.fullScreenCover` filter trick in SettingsView (secretSettings must be excluded from the sheet binding or SwiftUI mounts a blank sheet) — Compose has no equivalent trap, but preserve the "only one modal at a time" behavior.
12. Scoreboard exists only via the side menu (`MainTabStore.Tab.scoreboard` retained), and the side menu itself appears to have lost its toolbar entry point (flag + sheet still wired).

---

## 8. Android porting notes

**Single-Activity mapping.** One `MainActivity` + Compose. Root phase switch = a `RootRouter` (StateFlow) rendered in `setContent`: `Launching` → splash composable (replicate the fake-progress heuristic or use SplashScreen API + branded exit), `Unauthenticated` → auth NavHost (login/emailLogin/signup/forgotPassword), `Onboarding` → onboarding graph (behind the same bypass flag), `Ready` → `MainTabScaffold`. Post-onboarding paywall = full-screen dialog destination gated by the same `hasResolvedActiveUserEntitlement && !isLoading && !isPro` predicate — port the admin-lag comment, it's a real race.

**Tab shell.** `Scaffold` + `NavigationBar` with 4 items (Games/Props/Agents/Outliers) + a search affordance (either a 5th item or a `SearchBar`/`TopAppBar` action — Android has no system "search tab role"). Per-tab back stacks via Navigation-Compose `saveState/restoreState`, re-tap = scroll-to-top signal (port `scrollToTopTrigger`). Settings & WagerBot chat = ordinary destinations pushed on the current stack (drop the `selected == tab` guard). Side menu = `ModalBottomSheet` (keep sheet semantics) or `ModalNavigationDrawer`; the dismiss-then-flip 350ms dance is unnecessary — just navigate. Roast = full-screen destination; Feature Requests + Learn walkthrough = bottom-sheet destinations; Learn carousel = `HorizontalPager`.

**Dark forcing**: theme = dark `MaterialTheme` always (skip `overrideUserInterfaceStyle` gymnastics); keep the hidden picker writing a preference for future re-enable. Widgets follow system theme (GlanceTheme day/night), matching iOS.

**Intent filters** (AndroidManifest, `MainActivity`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="wagerproof"/>   <!-- hosts: agents, outliers, feed, reset-password; unknown → feed -->
</intent-filter>
<!-- App Links parity with applinks:wagerproof.bet (needs assetlinks.json) -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="https" android:host="wagerproof.bet"/>
</intent-filter>
```
Handle in `onCreate` + `onNewIntent` (launchMode singleTask); buffer the route in the router until phase == Ready (same pull-based consume). Google/Facebook SDK callbacks are handled by their own activities on Android — no scheme-priority chain needed. RevenueCat web-purchase redemption (`rc-ff2fe0e0af`) → `Purchases.parseAsWebPurchaseRedemption` if web purchases are used.

**Glance widgets.** Two `GlanceAppWidget`s + receivers (`TopOutliersWidget`, `AgentMonitorWidget`), `sizeMode = Responsive` with three buckets ≈ small(2×2)/medium(4×2)/large(4×4) mirroring the row counts (1 hero / 2 rows / 5 rows outliers; 1 hero / 2 / 3+picks agents). Data: replace App Group UserDefaults with DataStore (`widget_payload.json`) written by the same sync functions (WorkManager periodic ~60 min ≙ the timeline policy, plus on-foreground + post-sign-in one-shots ≙ `WidgetSyncCoordinator`) then `GlanceAppWidget.updateAll`. Whole-widget `actionStartActivity` with the deep-link URI (`wagerproof://outliers` / `wagerproof://agents`). Keep the JSON payload schema identical (§5) so backend/cron logic stays shared. Empty payload → "Open WagerProof to load…" state; `WidgetPreview`/previewLayout with the sample fixtures.

**Notifications.** FCM instead of APNs: store the FCM token in `user_push_tokens.expo_push_token` with `platform='android'` (edge function already dispatches by token shape per the iOS comments). Runtime `POST_NOTIFICATIONS` permission (API 33+) behind the Settings toggle; "denied" → deep-link to app notification settings (`Settings.ACTION_APP_NOTIFICATION_SETTINGS`). Local "test push" + generation-finished = NotificationManager channels.

**Other libs**: RevenueCat Purchases-Android + purchases-ui (Paywall/CustomerCenter composables), Supabase-kt (two clients: MAIN + CFB), Credential Manager for Google (needs web client id), Facebook Android SDK (disable auto events, same 3 explicit events), Play In-App Review, `ConnectivityManager` for the offline banner, `NWPathMonitor`→NetworkCallback.

### File → Kotlin equivalent checklist

App shell / navigation:
- [ ] `Wagerproof/App/WagerproofApp.swift` → `WagerProofApp.kt` (Application: SDK inits) + `MainActivity.kt` (intent handling, theme) + `AppRoot.kt` (phase switch + DI wiring + auth-phase side effects)
- [ ] `Wagerproof/App/RootView.swift` → `AppRoot.kt` + `SplashScreen.kt` (progress bar heuristic) + post-onboarding paywall gate
- [ ] `Wagerproof/App/WidgetSyncCoordinator.swift` → `WidgetSyncWorker.kt` (WorkManager + updateAll)
- [ ] `Wagerproof/App/ScaffoldPlaceholder.swift` → `TodoScreen.kt`
- [ ] `Wagerproof/App/ScreenshotHarness.swift` → optional `ScreenshotActivity`/Paparazzi setup (skip initially)
- [ ] `WagerproofKit/.../RootRouter.swift` → `RootRouter.kt` (phases + DeepLinkRoute parser + pending buffer)
- [ ] `WagerproofKit/.../MainTabStore.swift` → `MainTabState.kt` (selected tab, modal flags, pendingAgentRoute, scrollToTop signal)
- [ ] `Features/Navigation/MainTabView.swift` → `MainTabScaffold.kt` (NavigationBar + per-tab NavHosts + shell store scoping + deep-link consumer + dry-run sync)
- [ ] `Features/Navigation/MainTabToolbar.swift` → `WagerProofTopBar.kt` (wordmark w/ shimmer, WagerBot + Settings actions)
- [ ] `Features/Navigation/SideMenuSheet.swift` → `SideMenuSheet.kt`
- [ ] `Features/Navigation/OfflineBanner.swift` → `OfflineBanner.kt` + `ConnectivityObserver.kt`
- [ ] `Features/Navigation/FloatingAssistantBubble.swift` → `AssistantFab.kt` (parked)

Auth:
- [ ] `AuthRouter.swift` → `authNavGraph()` in NavHost
- [ ] `LoginView.swift` → `LoginScreen.kt` (Google credential flow; Apple = web OAuth or omit)
- [ ] `EmailLoginView.swift` → `EmailLoginScreen.kt` (+ `AuthFieldRow`, `AuthErrorBanner` composables, error classification strings)
- [ ] `SignupView.swift` → `SignupScreen.kt` (+ success banner + 3s bounce-back)
- [ ] `ForgotPasswordView.swift` → `ForgotPasswordScreen.kt` (+ NEW `ResetPasswordScreen.kt` — fills the iOS gap)
- [ ] `Components/AuthButtons.swift` → `AuthButtons.kt` (pill label, press style, glass CTA)
- [ ] `Components/AuthGateBackground.swift` → `AuthGateBackground.kt` (pixel wave)
- [ ] `Components/OnboardingSlide.swift` → `OnboardingSlides.kt` (only if the login carousel returns)

Settings:
- [ ] `SettingsView.swift` → `SettingsScreen.kt` (hero cards, profile rows, version double-tap, modal routing)
- [ ] `SecretSettingsView.swift` → `DeveloperSettingsScreen.kt`
- [ ] `DeleteAccountView.swift` + `Sheets/DeleteAccountBottomSheet.swift` → `DeleteAccountScreen.kt` (+ implement the real delete RPC?)
- [ ] `DiscordView.swift` → `DiscordScreen.kt`
- [ ] `IosWidgetView.swift` → `WidgetHelpScreen.kt` (rewrite copy for launcher widgets)
- [ ] `GenerationPreviewView.swift` → debug-only `GenerationPreviewScreen.kt` (optional)
- [ ] `SettingsFixtures.swift` → preview fixtures (optional)
- [ ] `Sheets/ReviewRequestModal.swift` → `ReviewRequestSheet.kt` (Play In-App Review)

Paywall:
- [ ] `RevenueCatPaywallView.swift` → `PaywallSheet.kt` (RC `Paywall` composable + placement fetch + load states)
- [ ] `CustomerCenterView.swift` → `CustomerCenterSheet.kt` (RC `CustomerCenter` composable)
- [ ] `ProFeatureGate.swift` → `ProFeatureGate.kt`
- [ ] `ProContentSection.swift` → `ProContentSection.kt`
- [ ] `LockedGameCard.swift` → `LockedGameCard.kt`
- [ ] `LockedOverlay.swift` → `LockedOverlay.kt`

Search:
- [ ] `SearchView.swift` → `SearchScreen.kt` (SearchBar + scope chips + explore/browse/results + cross-tab handoff via MainTabState)
- [ ] `Components/SearchResultRow.swift` → `SearchResultRow.kt`
- [ ] `Components/SearchMatchupCard.swift` → `SearchMatchupCard.kt` (+ InsightChip)
- [ ] `Components/SearchToolCards.swift` → `SearchToolCards.kt` (animated graphics; honor reduce-motion)

FeatureRequests:
- [ ] `FeatureRequestsView.swift` → `FeatureRequestsScreen.kt`
- [ ] `Components/FeatureRequestRow.swift` → `FeatureRequestRow.kt`
- [ ] `Sheets/SubmitFeatureRequestSheet.swift` → `SubmitFeatureRequestSheet.kt`
- [ ] `FeatureRequestsFixtures.swift` → preview fixtures

Roast:
- [ ] `RoastView.swift` → `RoastScreen.kt`
- [ ] `Components/BookieOrbView.swift` → `BookieOrb.kt`
- [ ] `Components/RoastIntensitySelectorView.swift` → `RoastIntensitySelector.kt`
- [ ] `Components/RoastMessageBubble.swift` → `RoastMessageBubble.kt`
- [ ] `Components/RoastMicButtonView.swift` → `RoastMicButton.kt`
- [ ] `RoastFixtures.swift` → preview fixtures

LearnMore:
- [ ] `LearnWagerProofView.swift` → `LearnHubScreen.kt`
- [ ] `Sheets/LearnWagerProofBottomSheet.swift` → `LearnWalkthroughSheet.kt` (ModalBottomSheet + HorizontalPager)
- [ ] `Components/LearnSlide.swift` → `LearnSlide.kt`
- [ ] `Components/SlideProgressIndicator.swift` → `SlideDots.kt`
- [ ] `Components/ComingSoonBanner.swift` → `ComingSoonBanner.kt`
- [ ] `Components/Slide1_Create247Agent|Slide1_GameCards|Slide2_GameDetails|Slide3_WagerBot|Slide5_Outliers|Slide6_MoreFeatures.swift` → `slides/*.kt` (6 files)

Analytics:
- [ ] `MlbRegressionReportView.swift` → `MlbRegressionReportScreen.kt` (LazyColumn + `stickyHeader` pills + jump menu)
- [ ] `Components/RegressionPrimitives.swift` → `RegressionPrimitives.kt` (tokens + AccentRow/Pill/Stat/GroupLabel/SegmentedTabs/FlowRow)
- [ ] `Components/RegressionNarrativeCard.swift` → markdown card (shared markdown renderer)
- [ ] `Components/RegressionAccuracySection.swift` → `RegressionAccuracySection.kt`
- [ ] `Components/RegressionModelBreakdownSection.swift` → `RegressionModelBreakdownSection.kt`
- [ ] `Components/RegressionRecapSection.swift` → `RegressionRecapSection.kt`
- [ ] `Components/PerfectStormPickCard.swift` → `PerfectStormPickCard.kt` (+ tier display map)
- [ ] `Components/PitcherRegressionCard.swift` / `BattingRegressionCard.swift` / `BullpenFatigueCard.swift` / `LRSplitsSection.swift` / `SeriesSignalCard.swift` / `WeatherParkFlagCard.swift` → matching `*.kt` cards

Widgets:
- [ ] `WagerProofWidgetBundle.swift` → two receivers in AndroidManifest + `GlanceAppWidget` classes
- [ ] `TopOutliersWidget.swift` → `TopOutliersWidget.kt` (Glance + Worker refresh)
- [ ] `AgentMonitorWidget.swift` → `AgentMonitorWidget.kt`
- [ ] `Views/TopOutliersWidgetView.swift` → `TopOutliersWidgetContent.kt` (small/medium/large buckets + fade-side inversion + confidence unit rules)
- [ ] `Views/AgentMonitorWidgetView.swift` → `AgentMonitorWidgetContent.kt`
- [ ] `Support/WidgetPalette.swift` / `WidgetStyle.swift` / `WidgetSampleData.swift` → `WidgetTheme.kt` / `WidgetSportBadge.kt` / `WidgetSampleData.kt`
- [ ] `WagerproofKit/.../TopAgentsWidgetService.swift` + `OutliersWidgetService.swift` → `WidgetPayloadRepository.kt` (DataStore JSON, same schema) + sync functions

Config:
- [ ] `project.yml` / Info.plist / entitlements / xcconfigs → `build.gradle.kts` (applicationId `com.wagerproof.mobile`? confirm Play package), AndroidManifest (intent filters, portrait `screenOrientation="portrait"` on the activity, POST_NOTIFICATIONS + RECORD_AUDIO + CAMERA permissions, FB meta-data), `assetlinks.json` for wagerproof.bet, version 3.5.5 (40)
- [ ] `WagerproofKit/.../SupabaseConfig.swift` → `SupabaseConfig.kt` (same URLs/anon keys)
- [ ] `WagerproofKit/.../RevenueCatService.swift` → RC init with a **new `goog_` key**
- [ ] `WagerproofKit/.../GoogleSignInCoordinator.swift` → Credential Manager setup (new Android client id + web client id)
- [ ] `WagerproofKit/.../MetaAnalyticsService.swift` → `MetaAnalytics.kt` (FB SDK, auto-events off, 3 explicit events)
- [ ] `WagerproofKit/.../NotificationService.swift` → `PushService.kt` (FCM token → `user_push_tokens`, channels, local notifs)
- [ ] `WagerproofKit/.../AppGroup.swift` → `Prefs.kt` (DataStore keys incl. per-user onboarding key)
