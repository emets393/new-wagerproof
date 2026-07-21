#if DEBUG
import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// DEBUG-only entry point used by parity-screenshot capture. When the app is
/// launched with `-uiScreenshotMode <slug>` the WagerproofApp scene swaps the
/// real `RootView` for this harness, which mounts the requested feature view
/// directly against an in-memory store stack — no Supabase round-trip required.
///
/// Why this exists: the harness can't sign in a real user to capture every
/// authed-only screen, and faking auth state from inside production code
/// would violate the "no `@State` fakes" rule. Containing the mock wiring
/// in a DEBUG-only file keeps prod code honest while still letting QA / batch
/// reviewers verify the screen visually.
///
/// Pair with `-tab <slug>` (one of `games | outliers | scoreboard |
/// settings`) to land on a specific tab inside `mainTabs`. The harness
/// applies this on first appear via the shared `RootRouter` deep-link buffer
/// so `MainTabView` can consume it through its existing onChange handler —
/// no parallel "harness-only" code path. `-tab props` additionally honors
/// `-propsSport <mlb|nfl|nba|ncaab>` to land on a specific sport segment
/// (see MainTabView.init).
struct ScreenshotHarnessView: View {
    @State private var authStore = AuthStore()
    @State private var router = RootRouter()
    @State private var onboardingStore = OnboardingStore()
    @State private var themeStore = ThemeStore()
    // MainTabView (the `.mainTabs` target) reads these via @Environment; inject
    // them so the harness doesn't trip the missing-environment precondition.
    @State private var debugDataModeStore = DebugDataModeStore()
    @State private var learnStore = LearnWagerProofStore()
    // B08 subscription/settings stores — tab screens (Games/Props/etc.) read
    // these for the pushed Settings destination + pro gating, so `mainTabs`
    // crashes without them. Built once in init so ProAccessStore wraps the
    // SAME instances injected below (mirrors WagerproofApp.init).
    @State private var revenueCatStore: RevenueCatStore
    @State private var adminModeStore: AdminModeStore
    @State private var settingsStore = SettingsStore()
    @State private var proAccessStore: ProAccessStore
    @State private var agentPickAuditStore = AgentPickAuditStore()

    init() {
        let rc = RevenueCatStore()
        let admin = AdminModeStore()
        _revenueCatStore = State(initialValue: rc)
        _adminModeStore = State(initialValue: admin)
        _proAccessStore = State(initialValue: ProAccessStore(revenueCat: rc, adminMode: admin))
    }

    var body: some View {
        // Split into helper @ViewBuilder properties because SwiftUI's
        // ViewBuilder caps a single switch at ~10 cases before type
        // inference collapses (`TupleView<...>` generic-depth limit). Each
        // helper owns a contiguous slice of targets so the outer switch
        // stays under the cap. New harness clusters should add their own
        // helper rather than extending the outer body.
        // The outer switch is split across `primaryClusters` /
        // `secondaryClusters`: SwiftUI's ViewBuilder caps a single switch at
        // ~10 cases before generic-depth inference collapses, and the target
        // set has outgrown that. The first helper falls through (`default`) to
        // the second so each switch stays under the cap.
        Group {
            primaryClusters
        }
        .environment(authStore)
        .environment(router)
        .environment(onboardingStore)
        .environment(themeStore)
        .environment(debugDataModeStore)
        .environment(learnStore)
        .environment(revenueCatStore)
        .environment(adminModeStore)
        .environment(settingsStore)
        .environment(proAccessStore)
        .environment(agentPickAuditStore)
        .preferredColorScheme(themeStore.mode.colorScheme)
        .onAppear {
            // B08 — Settings / paywall / delete-account harness targets all
            // expect an authenticated session so `.authenticated`-gated rows
            // render. Stage AuthStore once on appear (no real Supabase call).
            if ScreenshotHarness.isSettingsClusterTarget {
                authStore.debugSet(
                    phase: .authenticated(userId: SettingsFixtures.sampleUserId),
                    profile: Profile(
                        id: SettingsFixtures.sampleUserId,
                        email: SettingsFixtures.sampleEmail,
                        displayName: nil,
                        username: nil,
                        avatarUrl: nil,
                        isAdmin: false,
                        createdAt: nil
                    )
                )
                // The harness short-circuits `WagerproofApp.productionRoot`
                // (which normally calls `revenueCatStore.bootstrap()` inside
                // `.task`), so the RC SDK is unconfigured here. Paywall +
                // CustomerCenter views call `Purchases.shared.*` directly,
                // which fatalErrors when unconfigured. Bootstrap up-front so
                // those targets can render their loading/error states.
                RevenueCatService.shared.bootstrap()
            }
        }
    }

    // MARK: - Per-cluster ViewBuilders
    //
    // Each computed property handles one logical group of harness targets.
    // The outer switch dispatches by group; these inner switches re-read
    // `ScreenshotHarness.target` and ignore non-matching cases via the
    // `default: EmptyView()` fallthrough.

    // MARK: - Outer cluster dispatch (split to stay under the ViewBuilder cap)

    /// First half of the target clusters; anything not matched here falls
    /// through to `secondaryClusters`.
    @ViewBuilder
    private var primaryClusters: some View {
        switch ScreenshotHarness.target {
        case .mainTabs, .login, .emailLogin, .signup, .forgotPassword:
            authAndShellTargets
        case .scoreboardEmpty, .scoreboardLoaded, .scoreboardError:
            scoreboardTargets
        case .featureRequestsEmpty, .featureRequestsLoaded, .featureRequestsError:
            featureRequestsTargets
        case .roastEmpty, .roastLoaded, .roastError:
            roastTargets
        case .outliersEmpty, .outliersLoaded, .outliersError:
            outliersTargets
        default:
            secondaryClusters
        }
    }

    /// Second half of the target clusters (onboarding → settings).
    @ViewBuilder
    private var secondaryClusters: some View {
        switch ScreenshotHarness.target {
        case .onboardingIntro, .onboardingSports, .onboardingAgentBorn, .onboardingPage:
            onboardingTargets
        case .learnEmpty, .learnLoaded, .learnError:
            learnTargets
        case .gamesEmpty, .gamesLoadedNFL, .gamesLoadedCFB, .gamesError,
             .nflGameSheet, .cfbGameSheet, .h2hModal, .lineMovementModal,
             .propsLoaded, .propDetail, .propDetailHighLine,
             .nflPropsLoaded, .nflPropDetail:
            gamesTargets
        case .agentsLoaded, .topAgentPicks, .agentHeaderShowcase, .agentStats:
            agentsTargets
        case .mlbInsightWidgets, .searchInsights:
            toolTargets
        case .settings, .settingsLoaded, .settingsError,
             .deleteAccount, .deleteAccountError,
             .discord, .iosWidget:
            settingsTargetsA
        case .secretSettings, .paywall, .customPaywall, .paywallError, .customerCenter:
            settingsTargetsB
        default:
            EmptyView()
        }
    }

    /// Analytics tool + matchup-insight targets. `mlbInsightWidgets` mounts
    /// the MLB game sheet against fixture-fed trends/F5/props stores so all
    /// three insight widgets render deterministically; `searchInsights` mounts
    /// SearchView with the same fixture slates + a pre-seeded "Yankees" query
    /// so the matchup card's insight chips + a Players row render.
    @ViewBuilder
    private var toolTargets: some View {
        switch ScreenshotHarness.target {
        case .mlbInsightWidgets:
            makeInsightWidgets()
        case .searchInsights:
            makeSearchInsights()
        default:
            EmptyView()
        }
    }

    /// MLB game sheet with every insight widget fed from fixtures.
    @MainActor
    private func makeInsightWidgets() -> some View {
        let rc = RevenueCatStore()
        rc.debugSet(status: .granted, subscriptionType: "monthly", isLoading: false)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: false)
        return NavigationStack {
            MLBGameBottomSheet(
                game: InsightWidgetFixtures.game,
                trendsStore: InsightWidgetFixtures.trendsStore(),
                f5Store: InsightWidgetFixtures.f5Store()
            )
        }
        .environment(InsightWidgetFixtures.propsStore())
        .environment(rc)
        .environment(admin)
        .environment(ProAccessStore(revenueCat: rc, adminMode: admin))
        .environment(AgentPickAuditStore())
    }

    /// SearchView pre-seeded with "Yankees" (override via `-searchQuery <q>`,
    /// e.g. "judge" to capture the Players results) over the fixture slates.
    @MainActor
    private func makeSearchInsights() -> some View {
        let games = GamesStore()
        games.debugSet(mlb: [InsightWidgetFixtures.game], sport: .mlb, state: .loaded)
        let args = ProcessInfo.processInfo.arguments
        let query: String = {
            guard let idx = args.firstIndex(of: "-searchQuery"), idx + 1 < args.count else { return "Yankees" }
            return args[idx + 1]
        }()
        return SearchView(initialQuery: query)
            .environment(MainTabStore())
            .environment(games)
            .environment(InsightWidgetFixtures.propsStore())
            .environment(InsightWidgetFixtures.trendsStore())
            .environment(InsightWidgetFixtures.f5Store())
            .environment(MLBGameSheetStore())
            // OutliersTrendsStore drives the "Outliers" results section; it hydrates its
            // cross-sport index live on first query (no fixture seed available).
            .environment(OutliersTrendsStore())
    }

    @ViewBuilder
    private var authAndShellTargets: some View {
        switch ScreenshotHarness.target {
        case .mainTabs:
            MainTabView(
                initialTab: ScreenshotHarness.initialTab,
                openSideMenu: ScreenshotHarness.openSideMenu
            )
        case .login:
            AuthRouter()
        case .emailLogin:
            NavigationStack { EmailLoginView() }
                .preferredColorScheme(.dark)
        case .signup:
            NavigationStack { SignupView() }
                .preferredColorScheme(.dark)
        case .forgotPassword:
            NavigationStack { ForgotPasswordView() }
                .preferredColorScheme(.dark)
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var scoreboardTargets: some View {
        switch ScreenshotHarness.target {
        case .scoreboardEmpty:
            makeScoreboard(state: .loaded, games: [])
        case .scoreboardLoaded:
            makeScoreboard(state: .loaded, games: ScoreboardFixtures.sampleGames)
        case .scoreboardError:
            makeScoreboard(state: .failed("Network error: could not reach live_scores"), games: [])
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var featureRequestsTargets: some View {
        switch ScreenshotHarness.target {
        case .featureRequestsEmpty:
            makeFeatureRequests(state: .loaded, requests: [], votes: [])
        case .featureRequestsLoaded:
            makeFeatureRequests(
                state: .loaded,
                requests: FeatureRequestsFixtures.sampleRequests,
                votes: FeatureRequestsFixtures.sampleUserVotes
            )
        case .featureRequestsError:
            makeFeatureRequests(
                state: .failed("Couldn't reach feature_requests table"),
                requests: [],
                votes: []
            )
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var roastTargets: some View {
        switch ScreenshotHarness.target {
        case .roastEmpty:
            makeRoast(state: .idle, intensity: .medium, messages: [])
        case .roastLoaded:
            makeRoast(
                state: .idle,
                intensity: .savage,
                messages: RoastFixtures.sampleConversation
            )
        case .roastError:
            makeRoast(
                state: .idle,
                intensity: .medium,
                messages: [],
                error: "Network error: could not reach The Bookie"
            )
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var outliersTargets: some View {
        switch ScreenshotHarness.target {
        case .outliersEmpty:
            makeOutliers(state: .loaded, values: [], fades: [])
        case .outliersLoaded:
            makeOutliers(
                state: .loaded,
                values: OutliersFixtures.valueAlerts,
                fades: OutliersFixtures.fadeAlerts
            )
        case .outliersError:
            makeOutliers(
                state: .failed("Network error: outliers fetch failed"),
                values: [],
                fades: []
            )
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var onboardingTargets: some View {
        switch ScreenshotHarness.target {
        case .onboardingIntro:
            // v2 flow starts at Terms — the welcome interstitial is gone.
            makeOnboarding(step: .terms)
        case .onboardingSports:
            // .sportsSelection was removed (redundant with the agent
            // builder's own sports page) — this slug now captures the
            // remaining "sports" screen in the flow.
            makeOnboarding(step: .builderSports)
        case .onboardingAgentBorn:
            // v2 reveal — renders from the seeded draft (no genesis model).
            makeOnboarding(step: .reveal, agentDraft: OnboardingFixtures.born)
        case .onboardingPage:
            makeOnboarding(
                step: ScreenshotHarness.onboardingStepArg,
                agentDraft: OnboardingFixtures.born,
                survey: OnboardingFixtures.survey(bettor: ScreenshotHarness.onboardingBettorArg)
            )
        default:
            EmptyView()
        }
    }

    /// B21 — Learn WagerProof parity screenshots. The hub view is fed the
    /// shared `LearnWagerProofStore` so we can preview both the closed-sheet
    /// (empty) state and the open-sheet (loaded/error) state without spinning
    /// up a full tab shell.
    @ViewBuilder
    private var learnTargets: some View {
        switch ScreenshotHarness.target {
        case .learnEmpty:
            makeLearn(openedAt: nil)
        case .learnLoaded:
            makeLearn(openedAt: 0)
        case .learnError:
            // "Error" is a stylistic third state — last slide ("More Features"
            // has no value-prop card) so we capture that layout variant too.
            makeLearn(openedAt: LearnWagerProofStore.totalSlides - 1)
        default:
            EmptyView()
        }
    }

    /// Construct a `LearnWagerProofView` (the hub) plus an optional pre-opened
    /// bottom sheet, all wired to a single in-memory `LearnWagerProofStore`.
    @MainActor
    private func makeLearn(openedAt index: Int?) -> some View {
        let store = LearnWagerProofStore()
        if let index {
            store.currentSlide = index
            store.activeTopic = LearnWagerProofStore.Topic.allCases.first { $0.slideIndex == index }
        }
        return NavigationStack {
            LearnWagerProofView()
        }
        .environment(store)
        .sheet(item: Bindable(store).activeTopic) { _ in
            LearnWagerProofBottomSheet(store: store)
        }
    }

    /// Construct a `ScoreboardView` against an in-memory `LiveScoresStore`
    /// pre-loaded with the requested state. Polling stays disabled so the
    /// screenshot captures the exact state requested.
    @MainActor
    private func makeScoreboard(state: LiveScoresStore.LoadState, games: [LiveGame]) -> some View {
        let store = LiveScoresStore()
        store.debugSet(games: games, state: state)
        return ScoreboardView(store: store)
    }

    /// Construct a `FeatureRequestsView` against an in-memory
    /// `FeatureRequestsStore` pre-loaded with the requested state. No live
    /// Supabase round-trip — the harness needs deterministic visuals.
    @MainActor
    private func makeFeatureRequests(
        state: FeatureRequestsStore.LoadState,
        requests: [FeatureRequest],
        votes: [FeatureRequestVote]
    ) -> some View {
        let store = FeatureRequestsStore()
        store.debugSet(requests: requests, userVotes: votes, state: state)
        return FeatureRequestsView(store: store)
    }

    /// Construct a `RoastView` against an in-memory `RoastSessionStore`
    /// pre-loaded with the requested state. No live Gemini Live driver —
    /// the harness needs deterministic visuals. Production callers attach
    /// a real driver via `store.attach(driver:)`.
    @MainActor
    private func makeRoast(
        state: RoastSessionStore.SessionState,
        intensity: RoastSessionStore.Intensity,
        messages: [RoastSessionStore.Message],
        liveTranscript: String = "",
        aiTranscript: String = "",
        error: String? = nil,
        isConnected: Bool = true,
        isConnecting: Bool = false
    ) -> some View {
        let store = RoastSessionStore()
        store.debugSet(
            state: state,
            intensity: intensity,
            messages: messages,
            liveTranscript: liveTranscript,
            aiTranscript: aiTranscript,
            error: error,
            isConnected: isConnected,
            isConnecting: isConnecting
        )
        return RoastView(store: store)
    }

    /// Construct an `OutliersView` against an in-memory `OutliersStore`
    /// pre-loaded with the requested state. Refresh is gated on `.idle`
    /// inside the view, so seeding `.loaded` keeps the fixture stable.
    @MainActor
    private func makeOutliers(
        state: OutliersStore.LoadState,
        values: [OutlierValueAlert],
        fades: [OutlierFadeAlert]
    ) -> some View {
        let store = OutliersStore()
        store.debugSet(weekGames: [], valueAlerts: values, fadeAlerts: fades, state: state)
        // OutliersView reads ProAccessStore / MainTabStore / GamesStore + the
        // five per-sport sheet stores via @Environment. Inject them all (same
        // store set as makeGames) so the target renders instead of tripping the
        // missing-environment precondition.
        let rc = RevenueCatStore()
        rc.debugSet(status: .granted, subscriptionType: "monthly", isLoading: false)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: false)
        return OutliersView()
            .environment(OutliersTrendsStore())
            .environment(ProAccessStore(revenueCat: rc, adminMode: admin))
            .environment(MainTabStore())
            // The hub's primitive rails read these from the env (hoisted to
            // MainTabView in the live app); seed them with the same NYY@BOS
            // fixture the insight-widget targets use so the rails populate.
            .environment(InsightWidgetFixtures.trendsStore())
            .environment(InsightWidgetFixtures.f5Store())
            .environment(InsightWidgetFixtures.propsStore())
            // OutliersView reads these for its pushed Settings destination.
            .environment(SettingsStore())
            .environment(rc)
            .environment(admin)
    }

    /// Construct an `OnboardingView` against an in-memory `OnboardingStore`
    /// pre-positioned at a specific step. AgentBorn / cinematic targets seed
    /// an `AgentDraft` so the reveal card has data to render.
    /// One store per PROCESS, not per body evaluation. Building + mutating a
    /// fresh store inside `body` re-invalidates the harness view, which then
    /// hands OnboardingView a brand-new environment store — resetting live
    /// flows (the generation→reveal handoff would advance a store that was
    /// immediately replaced by a fresh one still pinned at .generation).
    @MainActor private static var onboardingHarnessStore: OnboardingStore?

    @MainActor
    private func makeOnboarding(
        step: OnboardingStore.Step,
        agentDraft: OnboardingStore.AgentDraft? = nil,
        survey: OnboardingStore.SurveyAnswers? = nil
    ) -> some View {
        let store: OnboardingStore
        if let cached = Self.onboardingHarnessStore {
            store = cached
        } else {
            store = OnboardingStore()
            store.debugSet(step: step)
            if let agentDraft {
                store.debugSet(agentDraft: agentDraft)
            }
            if let survey {
                store.debugSet(survey: survey)
            }
            Self.onboardingHarnessStore = store
        }
        return OnboardingView()
            .environment(store)
    }

    /// B04 — Games tab + per-sport game sheet parity targets.
    @ViewBuilder
    private var gamesTargets: some View {
        switch ScreenshotHarness.target {
        case .gamesEmpty:
            makeGames(nfl: [], cfb: [], sport: .nfl)
        case .gamesLoadedNFL:
            makeGames(nfl: GamesFixtures.sampleNFL, cfb: [], sport: .nfl)
        case .gamesLoadedCFB:
            makeGames(nfl: [], cfb: GamesFixtures.sampleCFB, sport: .cfb)
        case .gamesError:
            makeGames(nfl: [], cfb: [], sport: .nfl, state: .failed("Network error: could not reach v_input_values_with_epa"))
        case .nflGameSheet:
            if let game = GamesFixtures.sampleNFL.first {
                // NFLGameBottomSheet reads `ProAccessStore` (via
                // `ProContentSection`) and `AgentPickAuditStore` (via the
                // inline rationale widget). Inject both so the harness target
                // doesn't crash on `@Environment` lookups.
                NflGameSheetHarnessHost(game: game)
            } else {
                EmptyView()
            }
        case .cfbGameSheet:
            if let game = GamesFixtures.sampleCFB.first {
                CFBGameBottomSheet(game: game)
            } else {
                EmptyView()
            }
        case .propsLoaded:
            // PropsStore is now shell-hoisted (shared with the MLB game-detail
            // Player Props widget); inject one here for the standalone harness.
            makeProps(store: PropsStore())
        case .propDetail:
            // Detail page from a fixture selection — wrapped in a
            // NavigationStack since it's normally a pushed destination.
            NavigationStack {
                PlayerPropDetailView(selection: PropsFixtures.sampleSelection)
            }
        case .propDetailHighLine:
            // Same fixture pinned to the 2.5 line — proves the chart
            // threshold, hit-rate, odds, and tiles all track the line.
            NavigationStack {
                PlayerPropDetailView(selection: PropsFixtures.sampleSelection, initialLine: 2.5)
            }
        case .nflPropsLoaded:
            makeProps(store: Self.seededNFLPropsStore())
        case .nflPropDetail:
            NavigationStack {
                if let selection = Self.sampleNFLSelection() {
                    NFLPropDetailView(selection: selection)
                }
            }
        case .h2hModal:
            H2HModal(awayTeam: "Dallas Cowboys", homeTeam: "Philadelphia Eagles")
        case .lineMovementModal:
            LineMovementModal(title: "Line Movement") {
                if let game = GamesFixtures.sampleCFB.first {
                    CFBLineMovementSection(game: game)
                }
            }
        default:
            EmptyView()
        }
    }

    /// PropsView reads Settings/RevenueCat/AdminMode/ProAccess via
    /// @Environment (for the pushed Settings destination + pro gating) —
    /// inject the full stack so the props targets don't trip the
    /// missing-environment precondition.
    private func makeProps(store: PropsStore) -> some View {
        let rc = RevenueCatStore()
        rc.debugSet(status: .granted, subscriptionType: "monthly", isLoading: false)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: false)
        return PropsView()
            .environment(MainTabStore())
            .environment(store)
            .environment(SettingsStore())
            .environment(rc)
            .environment(admin)
            .environment(ProAccessStore(revenueCat: rc, adminMode: admin))
    }

    /// PropsStore pre-seeded with the NFL fixture odds board and landed on the
    /// NFL segment — drives `.nflPropsLoaded` without a network fetch.
    private static func seededNFLPropsStore() -> PropsStore {
        let store = PropsStore()
        store.selectedSport = .nfl
        store.debugSet(nflPlayers: PropsFixtures.nflBoard)
        return store
    }

    /// First feed item from the same fixture board — drives `.nflPropDetail`.
    private static func sampleNFLSelection() -> NFLPlayerPropSelection? {
        NFLPropFeed.items(from: PropsFixtures.nflBoard).first?.selection
    }

    /// Agents hub parity target — mounts the real `AgentsView` against an
    /// in-memory `AgentsStore` seeded with fixtures so the full-width
    /// `AgentRowCard` list + animated `PixelOffice` render without Supabase.
    @ViewBuilder
    private var agentsTargets: some View {
        switch ScreenshotHarness.target {
        case .agentsLoaded:
            makeAgents()
        case .topAgentPicks:
            makeTopAgentPicks()
        case .agentHeaderShowcase:
            AgentHeaderShowcase(agent: AgentsFixtures.sample[0].agent)
        case .agentStats:
            makeAgentStats()
        default:
            EmptyView()
        }
    }

    /// Agents "Platform Statistics" parity target. Seeds a `PlatformStatsStore`
    /// with a synthetic ~90-agent population (means/spreads mirroring the real
    /// MLB/NBA/NCAAB curves) so the histogram, fitted bell curve, per-sport small
    /// multiples, the NFL "Est." card, and the overlay all render offline.
    @MainActor
    private func makeAgentStats() -> some View {
        let store = PlatformStatsStore()
        store.debugSet(data: AgentStatsFixtures.sample, state: .loaded)
        return NavigationStack {
            AgentStatsView(store: store)
        }
    }

    /// Top Agent Picks feed parity target. Seeds a `TopAgentPicksFeedStore`
    /// with MLB fixture rows (full team names so `OutlierMatchupCardView`'s
    /// internal logo resolver fills the discs) and mounts the real feed — the
    /// square matchup cards are the subject of the concentric-corner +
    /// liquid-glass-merge refresh.
    @MainActor
    private func makeTopAgentPicks() -> some View {
        let store = TopAgentPicksFeedStore()
        store.debugSet(items: TopAgentPicksFixtures.sample, state: .loaded)
        return NavigationStack {
            TopAgentPicksFeed(
                store: store,
                showsFilters: true,
                onAgentTap: { _ in },
                onPickTap: { _ in }
            )
        }
        .environment(FavoriteAgentsStore())
    }

    /// Build an `AgentsView` wired to a debug-populated `AgentsStore` plus the
    /// three environment stores it reads (auth / pro access / tab shell).
    /// `debugSet(.loaded)` keeps the `.task` refresh from firing a live fetch.
    @MainActor
    private func makeAgents() -> some View {
        // Pre-bind to the same userId the view derives from AuthStore so
        // AgentsView's `.task` bind is a no-op (bind resets agents when the
        // userId changes), letting the debug roster survive + skip the fetch.
        let userId = SettingsFixtures.sampleUserId
        let store = AgentsStore()
        store.bind(userId: userId.uuidString.lowercased())
        store.debugSet(agents: AgentsFixtures.sample)
        let auth = AuthStore()
        auth.debugSet(phase: .authenticated(userId: userId))
        let rc = RevenueCatStore()
        rc.debugSet(status: .granted, subscriptionType: "monthly", isLoading: false)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: false)
        return AgentsView(store: store)
            .environment(auth)
            .environment(ProAccessStore(revenueCat: rc, adminMode: admin))
            .environment(MainTabStore())
    }

    /// B08 — first slice of settings/paywall cluster targets. Split across
    /// two helpers to stay under SwiftUI's ~10-case ViewBuilder cap.
    @ViewBuilder
    private var settingsTargetsA: some View {
        switch ScreenshotHarness.target {
        case .settings:
            makeSettings(status: .denied, notification: .undetermined)
        case .settingsLoaded:
            makeSettings(status: .granted, subscriptionType: "monthly", notification: .granted)
        case .settingsError:
            // "Error" approximation: entitlement resolution stuck in
            // `.unknown` so the hero card shows the "VERIFYING ACCESS" copy.
            makeSettings(status: .unknown, isLoading: true, notification: .undetermined)
        case .deleteAccount:
            makeSettingsModal { DeleteAccountView() }
        case .deleteAccountError:
            // Approximation: render the same view but with the destructive
            // alert pre-armed via wrapper state. The static screenshot
            // captures the resting state — true error parity requires the
            // failed RPC path which isn't wired yet (see ticket #054).
            makeSettingsModal { DeleteAccountView() }
        case .discord:
            makeSettingsModal { DiscordView() }
        case .iosWidget:
            makeSettingsModal { IosWidgetView() }
        default:
            EmptyView()
        }
    }

    /// B08 — second slice of settings/paywall cluster targets.
    @ViewBuilder
    private var settingsTargetsB: some View {
        switch ScreenshotHarness.target {
        case .secretSettings:
            makeSettingsModal { SecretSettingsView() }
        case .paywall:
            makeSettingsModal {
                RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
            }
        case .customPaywall:
            PostOnboardingPaywall(onUserDismissed: {})
        case .paywallError:
            // RevenueCatPaywallView fails closed to a `ContentUnavailableView`
            // when no offering is reachable. The harness shares the same
            // builder — the RC SDK in the simulator returns `.empty` so the
            // error state renders naturally.
            makeSettingsModal {
                RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
            }
        case .customerCenter:
            makeSettingsModal { CustomerCenterView() }
        default:
            EmptyView()
        }
    }

    /// Build a `SettingsView` wired to the four B08 stores. The same
    /// `RevenueCatStore + AdminModeStore` instances are wrapped by the
    /// `ProAccessStore` facade so reads stay consistent — mirrors the
    /// production wiring in `WagerproofApp.init()`.
    @MainActor
    private func makeSettings(
        status: RevenueCatStore.EntitlementStatus,
        subscriptionType: String? = nil,
        isLoading: Bool = false,
        notification: SettingsStore.NotificationPermission = .undetermined,
        isAdmin: Bool = false
    ) -> some View {
        let rc = RevenueCatStore()
        rc.debugSet(status: status, subscriptionType: subscriptionType, isLoading: isLoading)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: isAdmin)
        let settings = SettingsStore()
        settings.debugSet(notificationPermission: notification)
        let proAccess = ProAccessStore(revenueCat: rc, adminMode: admin)
        // SettingsView no longer owns a NavigationStack (in the app it's pushed
        // onto the active tab's stack), so wrap it here to keep the nav title
        // bar in screenshot grids.
        return NavigationStack {
            SettingsView()
        }
        .environment(rc)
        .environment(admin)
        .environment(settings)
        .environment(proAccess)
    }

    /// Wrap a settings-cluster modal in the same four-store environment so
    /// it renders identically to the production presentation.
    @MainActor
    private func makeSettingsModal<Content: View>(
        proStatus: RevenueCatStore.EntitlementStatus = .granted,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let rc = RevenueCatStore()
        rc.debugSet(status: proStatus, subscriptionType: "monthly", isLoading: false)
        let admin = AdminModeStore()
        admin.debugSet(isAdmin: false)
        let settings = SettingsStore()
        settings.debugSet(notificationPermission: .granted)
        let proAccess = ProAccessStore(revenueCat: rc, adminMode: admin)
        return content()
            .environment(rc)
            .environment(admin)
            .environment(settings)
            .environment(proAccess)
    }

    /// Construct a `GamesView` against an in-memory `GamesStore` pre-loaded
    /// with sample fixtures. Mirrors the other `make*` helpers.
    @MainActor
    private func makeGames(
        nfl: [NFLPrediction],
        cfb: [CFBPrediction],
        sport: GamesStore.Sport = .nfl,
        state: GamesStore.LoadState = .loaded
    ) -> some View {
        let store = GamesStore()
        store.debugSet(nfl: nfl, cfb: cfb, sport: sport, state: state)
        return GamesView()
            .environment(store)
            .environment(NFLGameSheetStore())
            .environment(CFBGameSheetStore())
            .environment(NBAGameSheetStore())
            .environment(NCAABGameSheetStore())
            .environment(MLBGameSheetStore())
    }
}

/// Tiny helper that hosts the NFL game bottom sheet for the harness — gives
/// the `RevenueCatStore.debugSet` imperative call a real init context so we
/// don't trip Swift 6's stricter `@ViewBuilder` rejection of `Void` exprs.
private struct NflGameSheetHarnessHost: View {
    let game: NFLPrediction
    @State private var rc: RevenueCatStore
    @State private var admin = AdminModeStore()

    init(game: NFLPrediction) {
        self.game = game
        let store = RevenueCatStore()
        store.debugSet(status: .granted, subscriptionType: "monthly", isLoading: false)
        _rc = State(initialValue: store)
    }

    var body: some View {
        NFLGameBottomSheet(game: game)
            .environment(rc)
            .environment(admin)
            .environment(ProAccessStore(revenueCat: rc, adminMode: admin))
            .environment(AgentPickAuditStore())
    }
}

/// DEBUG-only seed data for onboarding parity screenshots.
enum OnboardingFixtures {
    /// Agent draft used for the AgentBorn cinematic screenshot — populated
    /// so the reveal card renders with a name + emoji + sport badges instead
    /// of the empty-state defaults.
    static let born: OnboardingStore.AgentDraft = {
        var d = OnboardingStore.AgentDraft()
        d.name = "Sharp Edge"
        d.avatarEmoji = "🦅"
        d.avatarColor = "#3B82F6"
        d.preferredSports = [.nfl, .nba]
        d.archetype = "balanced"
        return d
    }()

    /// Survey answers for the `onboardingPage` QA target — populated enough
    /// that every page renders its answered state (sports chips selected,
    /// bettor type driving the theme, research-time arc fed, builder
    /// pre-seeding fed).
    static func survey(bettor: OnboardingStore.BettorType) -> OnboardingStore.SurveyAnswers {
        var s = OnboardingStore.SurveyAnswers()
        s.favoriteSports = ["NFL", "NBA"]
        s.bettorType = bettor
        s.mainGoal = "Find profitable edges faster"
        s.researchTimeBucket = "h2to3"
        s.weeklyStakesBucket = "h150to400"
        return s
    }
}

/// DEBUG-only seed agents for the Agents-hub parity screenshot. A spread of
/// sports / colors / records + one inactive (OFF) and one with picks already
/// generated today (PICKS READY → walks to a rest spot) so the office shows a
/// mix of walking/working/resting states.
enum AgentsFixtures {
    private static let createdAt = "2026-01-01T00:00:00Z"
    /// ISO timestamp for "now" so one agent derives the `done` office state.
    private static let todayISO = ISO8601DateFormatter().string(from: Date())

    private static func agent(
        id: String, name: String, emoji: String, color: String,
        sports: [AgentSport], archetype: AgentArchetype? = nil,
        params: AgentPersonalityParams = .default,
        isActive: Bool = true, lastGeneratedAt: String? = nil
    ) -> Agent {
        Agent(
            id: id, userId: "debug-user", name: name, avatarEmoji: emoji,
            avatarColor: color, preferredSports: sports, archetype: archetype,
            personalityParams: params,
            isActive: isActive, createdAt: createdAt, updatedAt: createdAt,
            lastGeneratedAt: lastGeneratedAt
        )
    }

    /// Build personality params with just the knobs that drive strategy tags.
    private static func params(
        risk: Int = 3, bet: String = "any", dog: Int = 3,
        chaseValue: Bool = false, fadePublic: Bool? = nil
    ) -> AgentPersonalityParams {
        AgentPersonalityParams(
            riskTolerance: risk, underdogLean: dog, chaseValue: chaseValue,
            preferredBetType: bet, fadePublic: fadePublic
        )
    }

    private static func perf(
        id: String, total: Int, wins: Int, losses: Int, pushes: Int,
        net: Double, streak: Int, best: Int, worst: Int
    ) -> AgentPerformance {
        AgentPerformance(
            avatarId: id, totalPicks: total, wins: wins, losses: losses,
            pushes: pushes, netUnits: net, currentStreak: streak,
            bestStreak: best, worstStreak: worst
        )
    }

    static let sample: [AgentWithPerformance] = [
        AgentWithPerformance(
            agent: agent(id: "a1", name: "Line Hawk", emoji: "🦅", color: "gradient:#3B82F6,#06B6D4",
                         sports: [.nfl, .nba, .mlb, .cfb], archetype: .theAnalyst,
                         params: params(risk: 4, bet: "spread", dog: 2, chaseValue: true)),
            performance: perf(id: "a1", total: 42, wins: 24, losses: 16, pushes: 2, net: 12.4, streak: 5, best: 7, worst: -3)
        ),
        AgentWithPerformance(
            agent: agent(id: "a2", name: "Sharp Edge", emoji: "🎯", color: "#EF4444",
                         sports: [.mlb], archetype: .plusMoneyHunter,
                         params: params(risk: 5, bet: "moneyline", dog: 5), lastGeneratedAt: todayISO),
            performance: perf(id: "a2", total: 25, wins: 11, losses: 14, pushes: 0, net: -3.2, streak: -2, best: 4, worst: -4)
        ),
        AgentWithPerformance(
            agent: agent(id: "a3", name: "Model Maven", emoji: "📊", color: "gradient:#8B5CF6,#EC4899",
                         sports: [.nba, .ncaab], archetype: .modelTruther,
                         params: params(risk: 2, bet: "total")),
            performance: perf(id: "a3", total: 31, wins: 18, losses: 12, pushes: 1, net: 5.1, streak: 3, best: 5, worst: -2)
        ),
        AgentWithPerformance(
            agent: agent(id: "a4", name: "Value Hunter", emoji: "💎", color: "#10B981",
                         sports: [.nfl, .cfb, .nba, .ncaab, .mlb],
                         params: params(risk: 3, bet: "any", chaseValue: true, fadePublic: true), isActive: false),
            performance: perf(id: "a4", total: 8, wins: 4, losses: 4, pushes: 0, net: 0.4, streak: 1, best: 2, worst: -1)
        ),
        AgentWithPerformance(
            agent: agent(id: "a5", name: "Trend Spotter", emoji: "📈", color: "gradient:#F97316,#FACC15",
                         sports: [.nfl, .cfb, .mlb], archetype: .momentumRider,
                         params: params(risk: 4, bet: "spread", dog: 4)),
            performance: perf(id: "a5", total: 56, wins: 33, losses: 21, pushes: 2, net: 8.7, streak: 4, best: 8, worst: -3)
        ),
    ]
}

/// DEBUG-only synthetic agent population for the Platform Stats parity target.
/// Deterministic (no RNG) so the screenshot is stable across runs. Per-sport
/// means/spreads echo the real distribution (MLB ~49.7%, NBA ~53.1%, NCAAB
/// ~55.5%) plus a few tiny-sample 0%/100% agents so the min-picks threshold has
/// something to collapse as it rises.
enum AgentStatsFixtures {
    static let sample: [AgentStatDatum] = build()

    private static func build() -> [AgentStatDatum] {
        var rows: [AgentStatDatum] = []
        let specs: [(key: String, mean: Double, spread: Double, count: Int)] = [
            ("mlb", 0.497, 0.060, 40),
            ("nba", 0.531, 0.075, 30),
            ("ncaab", 0.555, 0.085, 20),
        ]
        for spec in specs {
            for i in 0..<spec.count {
                let t = Double(i) / Double(max(spec.count - 1, 1))   // 0…1 across cohort
                let jitter = (sin(Double(i) * 2.399) * 0.6 + (t - 0.5) * 1.4) * spec.spread
                let wr = min(0.95, max(0.15, spec.mean + jitter))
                let decided = 22 + (i * 7) % 210                     // 22…~230 settled
                let wins = Int((wr * Double(decided)).rounded())
                let losses = decided - wins
                let pushes = i % 6
                let net = (wr - 0.5) * Double(decided) * 1.4 + sin(Double(i) * 1.3) * 3
                rows.append(AgentStatDatum(
                    avatarId: "fixture-\(spec.key)-\(i)",
                    isPublic: i % 5 != 0,        // ~80% public
                    wins: wins, losses: losses, pushes: pushes,
                    winRate: Double(wins) / Double(max(wins + losses, 1)),
                    netUnits: net,
                    statsBySport: [spec.key: .init(wins: wins, losses: losses, pushes: pushes, total: decided + pushes)],
                    lastCalculatedAt: "2026-06-30T12:00:00Z"
                ))
            }
        }
        // Tiny-sample spikes at 0% / 100% — visible only at a low threshold.
        for i in 0..<6 {
            let win = i % 2 == 0
            rows.append(AgentStatDatum(
                avatarId: "fixture-spike-\(i)",
                isPublic: true,
                wins: win ? 2 : 0, losses: win ? 0 : 2,
                winRate: win ? 1.0 : 0.0,
                netUnits: win ? 1.8 : -2.0,
                statsBySport: ["mlb": .init(wins: win ? 2 : 0, losses: win ? 0 : 2, pushes: 0, total: 2)],
                lastCalculatedAt: "2026-06-30T12:00:00Z"
            ))
        }
        return rows
    }
}

/// DEBUG-only seed rows for the Top Agent Picks feed parity screenshot. Two
/// agents, each with a strip of MLB picks. Matchups use full team names so
/// `OutlierMatchupCardView`'s internal resolver fills the logo discs from the
/// shared `MLBTeams` table (no explicit logo URLs passed). `TopAgentPickFeedRow`
/// is decode-only (custom `init(from:)`), so we hydrate from JSON.
enum TopAgentPicksFixtures {
    static let sample: [TopAgentPickFeedRow] = {
        let json = """
        [
          {"id":"p1","avatar_id":"a1","game_id":"g1","sport":"mlb","matchup":"New York Yankees @ Boston Red Sox","game_date":"2026-06-09","bet_type":"moneyline","pick_selection":"Yankees ML","odds":"-130","units":1.0,"confidence":4,"reasoning_text":"","result":"pending","created_at":"2026-06-09T15:00:00Z","agent_name":"Sharp Edge","agent_avatar_emoji":"🎯","agent_avatar_color":"#EF4444","agent_wins":24,"agent_losses":16,"agent_pushes":2,"agent_net_units":12.4,"agent_rank":1,"agent_current_streak":5,"archived_personality":{"risk_tolerance":4,"preferred_bet_type":"moneyline","chase_value":true}},
          {"id":"p2","avatar_id":"a1","game_id":"g2","sport":"mlb","matchup":"Los Angeles Dodgers @ San Francisco Giants","game_date":"2026-06-09","bet_type":"total","pick_selection":"Over 8.5","odds":"-110","units":1.0,"confidence":3,"reasoning_text":"","result":"pending","created_at":"2026-06-09T15:01:00Z","agent_name":"Sharp Edge","agent_avatar_emoji":"🎯","agent_avatar_color":"#EF4444","agent_wins":24,"agent_losses":16,"agent_pushes":2,"agent_net_units":12.4,"agent_rank":1,"agent_current_streak":5,"archived_personality":{"risk_tolerance":4,"preferred_bet_type":"moneyline","chase_value":true}},
          {"id":"p3","avatar_id":"a1","game_id":"g3","sport":"mlb","matchup":"Houston Astros @ Seattle Mariners","game_date":"2026-06-09","bet_type":"spread","pick_selection":"Astros -1.5","odds":"+120","units":1.0,"confidence":3,"reasoning_text":"","result":"pending","created_at":"2026-06-09T15:02:00Z","agent_name":"Sharp Edge","agent_avatar_emoji":"🎯","agent_avatar_color":"#EF4444","agent_wins":24,"agent_losses":16,"agent_pushes":2,"agent_net_units":12.4,"agent_rank":1,"agent_current_streak":5,"archived_personality":{"risk_tolerance":4,"preferred_bet_type":"moneyline","chase_value":true}},
          {"id":"p4","avatar_id":"a2","game_id":"g4","sport":"mlb","matchup":"Chicago Cubs @ Atlanta Braves","game_date":"2026-06-09","bet_type":"moneyline","pick_selection":"Braves ML","odds":"-145","units":1.0,"confidence":4,"reasoning_text":"","result":"pending","created_at":"2026-06-09T15:03:00Z","agent_name":"Diamond Bot","agent_avatar_emoji":"💎","agent_avatar_color":"#10B981","agent_wins":33,"agent_losses":21,"agent_pushes":2,"agent_net_units":8.7,"agent_rank":2,"agent_current_streak":-2,"archived_personality":{"risk_tolerance":2,"preferred_bet_type":"total"}},
          {"id":"p5","avatar_id":"a2","game_id":"g1","sport":"mlb","matchup":"New York Yankees @ Boston Red Sox","game_date":"2026-06-09","bet_type":"total","pick_selection":"Under 9","odds":"-105","units":1.0,"confidence":2,"reasoning_text":"","result":"pending","created_at":"2026-06-09T15:04:00Z","agent_name":"Diamond Bot","agent_avatar_emoji":"💎","agent_avatar_color":"#10B981","agent_wins":33,"agent_losses":21,"agent_pushes":2,"agent_net_units":8.7,"agent_rank":2,"agent_current_streak":-2,"archived_personality":{"risk_tolerance":2,"preferred_bet_type":"total"}}
        ]
        """
        return (try? JSONDecoder().decode([TopAgentPickFeedRow].self, from: Data(json.utf8))) ?? []
    }()
}

/// DEBUG-only fixtures for the matchup-insight harness targets: one NYY @ BOS
/// game with a known 26-pt After-a-Loss trends gap, a one-sided F5 split (BOS
/// side thin-sample), and a props matchup whose slot algorithm yields starters
/// + a 9/10 hot bat + a 1/10 cold bat (the spec's acceptance shapes).
enum InsightWidgetFixtures {
    static let gamePk = 999_001

    static let game = MLBGame(
        id: "999001",
        gamePk: gamePk,
        officialDate: "2026-06-11",
        gameTimeEt: "2026-06-11T19:05:00-04:00",
        awayTeamName: "New York Yankees",
        homeTeamName: "Boston Red Sox",
        awayAbbr: "NYY",
        homeAbbr: "BOS",
        awayLogoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png",
        homeLogoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png",
        awayMl: -130,
        homeMl: 110,
        awaySpread: -1.5,
        homeSpread: 1.5,
        totalLine: 8.5,
        mlHomeWinProb: 0.44,
        mlAwayWinProb: 0.56,
        homeImpliedProb: 0.48,
        awayImpliedProb: 0.57,
        homeMlEdgePct: -4.0,
        awayMlEdgePct: 3.2,
        ouEdge: 4.1,
        ouDirection: "OVER",
        ouFairTotal: 9.2,
        f5HomeMl: 120,
        f5AwayMl: -140,
        f5FairTotal: 5.1,
        f5TotalLine: 4.5,
        f5OuEdge: 5.0,
        f5HomeWinProb: 0.42,
        f5AwayWinProb: 0.58,
        homeSpName: "Garrett Crochet",
        awaySpName: "Gerrit Cole",
        homeSpConfirmed: true,
        awaySpConfirmed: true,
        isFinalPrediction: true,
        venueName: "Fenway Park"
    )

    // MARK: Trends

    @MainActor
    static func trendsStore() -> MLBBettingTrendsStore {
        let store = MLBBettingTrendsStore()
        store.debugSet(games: [trends])
        return store
    }

    static let trends = MLBGameTrends(
        gamePk: gamePk,
        gameDateEt: "2026-06-11",
        gameTimeEt: "2026-06-11T19:05:00-04:00",
        awayTeam: MLBSituationalTrendRow(
            gamePk: gamePk, gameDateEt: "2026-06-11", teamId: 147,
            teamName: "New York Yankees", teamSide: "away",
            lastGameSituation: "is_after_loss", homeAwaySituation: "is_away",
            favDogSituation: "is_fav", restBucket: "one_day_off",
            restComp: "equal_rest", leagueSituation: "league", divisionSituation: "non_division",
            winPctLastGame: 71, winPctHomeAway: 58, winPctFavDog: 60,
            winPctRestBucket: 55, winPctRestComp: 50, winPctLeague: 52, winPctDivision: 49,
            overPctLastGame: 67, overPctHomeAway: 52, overPctFavDog: 56,
            overPctRestBucket: 57, overPctRestComp: 48, overPctLeague: 50, overPctDivision: 53
        ),
        homeTeam: MLBSituationalTrendRow(
            gamePk: gamePk, gameDateEt: "2026-06-11", teamId: 111,
            teamName: "Boston Red Sox", teamSide: "home",
            lastGameSituation: "is_after_win", homeAwaySituation: "is_home",
            favDogSituation: "is_dog", restBucket: "one_day_off",
            restComp: "equal_rest", leagueSituation: "league", divisionSituation: "non_division",
            winPctLastGame: 45, winPctHomeAway: 47, winPctFavDog: 42,
            winPctRestBucket: 50, winPctRestComp: 52, winPctLeague: 48, winPctDivision: 51,
            overPctLastGame: 62, overPctHomeAway: 58, overPctFavDog: 57,
            overPctRestBucket: 56, overPctRestComp: 44, overPctLeague: 52, overPctDivision: 49
        )
    )

    // MARK: F5

    @MainActor
    static func f5Store() -> MLBF5SplitsStore {
        let store = MLBF5SplitsStore()
        store.debugSet(games: [f5Game], splits: f5Splits)
        return store
    }

    static let f5Game = MLBF5Game(
        gamePk: gamePk,
        officialDate: "2026-06-11",
        gameTimeEt: "2026-06-11T19:05:00-04:00",
        awayTeamName: "New York Yankees",
        homeTeamName: "Boston Red Sox",
        venueName: "Fenway Park",
        awayAbbr: "NYY",
        homeAbbr: "BOS",
        awaySpName: "Gerrit Cole",
        homeSpName: "Garrett Crochet",
        awaySpHand: .right,
        homeSpHand: .left,
        totalLine: 8.5,
        f5AwayMl: -140,
        f5HomeMl: 120,
        f5TotalLine: 4.5
    )

    /// `MLBF5SplitRow` is decode-only (mirrors PostgREST rows) — hydrate the
    /// two splits from JSON. NYY away vs LHP is the strong side; BOS home vs
    /// RHP is the thin-sample side (8 games → small-sample caution).
    static let f5Splits: [MLBF5SplitRow] = {
        let json = """
        [
          {"team_abbr":"NYY","season":2026,"home_away":"away","opp_sp_hand":"L","games":14,
           "f5_wins":9,"f5_losses":4,"f5_ties":1,"f5_record":"9-4-1","f5_win_pct":64.3,
           "f5_overs":9,"f5_unders":4,"f5_pushes":1,"f5_ou_record":"9-4-1","f5_over_pct":64.3,
           "avg_f5_rs":3.1,"avg_f5_total":5.6,"avg_f5_line":4.5,"f5_line_edge":1.1,
           "avg_f5_ra_when_own_rhp":2.1,"games_with_own_rhp":10,
           "avg_f5_ra_when_own_lhp":2.6,"games_with_own_lhp":4,
           "season_avg_f5_rs":2.4,"season_avg_f5_ra":2.5,"season_avg_f5_total":4.9,
           "rs_diff_vs_season":0.7,"total_diff_vs_season":0.7,
           "ra_diff_vs_season_when_own_rhp":-0.4,"ra_diff_vs_season_when_own_lhp":0.1,
           "last_refreshed_at":"2026-06-11T08:00:00Z"},
          {"team_abbr":"BOS","season":2026,"home_away":"home","opp_sp_hand":"R","games":8,
           "f5_wins":3,"f5_losses":5,"f5_ties":0,"f5_record":"3-5-0","f5_win_pct":37.5,
           "f5_overs":5,"f5_unders":3,"f5_pushes":0,"f5_ou_record":"5-3-0","f5_over_pct":62.5,
           "avg_f5_rs":2.2,"avg_f5_total":5.2,"avg_f5_line":4.5,"f5_line_edge":0.7,
           "avg_f5_ra_when_own_rhp":2.4,"games_with_own_rhp":5,
           "avg_f5_ra_when_own_lhp":3.2,"games_with_own_lhp":3,
           "season_avg_f5_rs":2.5,"season_avg_f5_ra":2.6,"season_avg_f5_total":5.1,
           "rs_diff_vs_season":-0.3,"total_diff_vs_season":0.1,
           "ra_diff_vs_season_when_own_rhp":-0.2,"ra_diff_vs_season_when_own_lhp":0.6,
           "last_refreshed_at":"2026-06-11T08:00:00Z"}
        ]
        """
        return (try? JSONDecoder().decode([MLBF5SplitRow].self, from: Data(json.utf8))) ?? []
    }()

    // MARK: Props

    @MainActor
    static func propsStore() -> PropsStore {
        let store = PropsStore()
        store.debugSet(matchups: [propMatchup])
        return store
    }

    private static func games(_ values: [Double]) -> [MLBPlayerPropGameEntry] {
        values.enumerated().map { idx, v in
            MLBPlayerPropGameEntry(v: v, d: idx % 3 == 0 ? 1 : 0, a: nil, dt: "2026-06-\(String(format: "%02d", 10 - min(idx, 9)))")
        }
    }

    private static func propRow(playerId: Int, name: String, isPitcher: Bool,
                                market: String, line: Double, values: [Double]) -> MLBPlayerPropRow {
        MLBPlayerPropRow(
            playerId: playerId, playerName: name, isPitcher: isPitcher, market: market,
            gameIsDay: false, oppArchetypeToday: nil,
            lines: [MLBPlayerPropLineEntry(line: line, over: -115, under: -105)],
            games: games(values)
        )
    }

    static let propMatchup = MLBPropMatchup(
        gamePk: gamePk,
        officialDate: "2026-06-11",
        gameTimeEt: "2026-06-11T19:05:00-04:00",
        awayTeamName: "New York Yankees",
        homeTeamName: "Boston Red Sox",
        awayAbbr: "NYY",
        homeAbbr: "BOS",
        awayLogoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png",
        homeLogoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png",
        awayStarter: MLBPropStarter(pitcherId: 543_037, name: "Gerrit Cole", teamLabel: "NYY", hand: "R", archetype: nil),
        homeStarter: MLBPropStarter(pitcherId: 676_979, name: "Garrett Crochet", teamLabel: "BOS", hand: "L", archetype: nil),
        awayLineup: [
            MLBLineupRow(gamePk: gamePk, teamId: 147, playerId: 592_450, playerName: "Aaron Judge",
                         battingOrder: 2, position: "RF", batSide: "R", isConfirmed: true),
            MLBLineupRow(gamePk: gamePk, teamId: 147, playerId: 624_413, playerName: "Cody Bellinger",
                         battingOrder: 3, position: "CF", batSide: "L", isConfirmed: true),
        ],
        homeLineup: [
            MLBLineupRow(gamePk: gamePk, teamId: 111, playerId: 690_144, playerName: "Roman Anthony",
                         battingOrder: 2, position: "LF", batSide: "L", isConfirmed: true),
            MLBLineupRow(gamePk: gamePk, teamId: 111, playerId: 608_324, playerName: "Alex Bregman",
                         battingOrder: 3, position: "3B", batSide: "R", isConfirmed: true),
        ],
        props: [
            // Starters' K ladders.
            propRow(playerId: 543_037, name: "Gerrit Cole", isPitcher: true,
                    market: "pitcher_strikeouts", line: 5.5,
                    values: [7, 5, 6, 8, 4, 6, 7, 5, 9, 6]),
            propRow(playerId: 676_979, name: "Garrett Crochet", isPitcher: true,
                    market: "pitcher_strikeouts", line: 6.5,
                    values: [7, 6, 8, 5, 6, 9, 4, 7, 5, 6]),
            // Hot bat — 9/10 over 1.5 TB (the spec's verdict shape).
            propRow(playerId: 592_450, name: "Aaron Judge", isPitcher: false,
                    market: "batter_total_bases", line: 1.5,
                    values: [2, 3, 2, 4, 2, 1, 2, 5, 2, 3]),
            // Second hot bat — 7/10 over 0.5 H.
            propRow(playerId: 624_413, name: "Cody Bellinger", isPitcher: false,
                    market: "batter_hits", line: 0.5,
                    values: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1]),
            // Cold bat — 1/10 over 1.5 TB.
            propRow(playerId: 690_144, name: "Roman Anthony", isPitcher: false,
                    market: "batter_total_bases", line: 1.5,
                    values: [1, 0, 2, 1, 0, 1, 0, 1, 1, 0]),
            // Thin-sample fill — 2/4 over 0.5 RBI (lowConfidence path).
            propRow(playerId: 608_324, name: "Alex Bregman", isPitcher: false,
                    market: "batter_rbis", line: 0.5,
                    values: [1, 0, 0, 1]),
        ]
    )
}

/// Static helper read once at scene-creation time so the WagerproofApp body
/// can branch before the environment is even installed.
enum ScreenshotHarness {
    enum Target: String {
        case mainTabs
        case login
        case emailLogin
        case signup
        case forgotPassword
        case scoreboardEmpty
        case scoreboardLoaded
        case scoreboardError
        case featureRequestsEmpty
        case featureRequestsLoaded
        case featureRequestsError
        case roastEmpty
        case roastLoaded
        case roastError
        case outliersEmpty
        case outliersLoaded
        case outliersError
        case onboardingIntro
        case onboardingSports
        case onboardingAgentBorn
        // v2 QA target: any onboarding step via `-onboardingStep <1...24>`
        // (+ optional `-onboardingBettor casual|serious|professional` to
        // exercise the bettor-type theming). Seeds a survey + agent
        // draft so every page renders populated.
        case onboardingPage
        // B21 — LearnMore parity screenshots.
        // `empty` shows the hub at first load (no sheet open).
        // `loaded` shows the hub with the carousel sheet open at slide 0.
        // `error` shows the same hub but with the carousel parked on the last
        //         slide so the "Done" button + no-value-prop layout is captured.
        case learnEmpty
        case learnLoaded
        case learnError
        // B04 — Games tab + NFL/CFB game sheet parity screenshots.
        case gamesEmpty
        case gamesLoadedNFL
        case gamesLoadedCFB
        case gamesError
        case nflGameSheet
        case cfbGameSheet
        case h2hModal
        case lineMovementModal
        // MLB player-props matchups feed. Props need no auth (CFB anon
        // project) so this mounts PropsView directly for a live fetch.
        case propsLoaded
        // Player-prop detail page (trend chart + line slider + widgets),
        // rendered from a fixture selection so it's deterministic.
        case propDetail
        // Same fixture detail pinned to the 2.5 line (adaptation proof).
        case propDetailHighLine
        // NFL props feed seeded from the DummyData odds-board rows (6 markets
        // × 4 books) — no fetch, deterministic.
        case nflPropsLoaded
        // NFL prop detail (cross-book price board) from the same fixture.
        case nflPropDetail
        // MLB game sheet with fixture-fed trends/F5/props insight widgets.
        case mlbInsightWidgets
        // SearchView with fixture slates + pre-seeded "Yankees" query (matchup
        // card insight chips + Players results).
        case searchInsights
        // Agents hub with a debug-populated AgentsStore — used to verify the
        // full-width AgentRowCard list + the animated PixelOffice loop without
        // a real Supabase round-trip.
        case agentsLoaded
        // Top Agent Picks feed — square matchup cards (concentric corners +
        // liquid-glass merged team discs). Seeded with MLB fixtures.
        case topAgentPicks
        // DEBUG-only showcase for the redesigned agent-detail header
        // (autopilot/generate action zone + pixel-glyph generation loader).
        case agentHeaderShowcase
        // Agents "Platform Statistics" screen — win-rate distribution histogram
        // + fitted bell curve, per-sport small multiples, and overlay. Seeded
        // with a synthetic ~90-agent population so the charts render offline.
        case agentStats
        // B08 — Settings / Paywall / modals parity screenshots.
        // `settings` is the default state (empty notification permission +
        // free tier). `settingsLoaded` swaps in a Pro entitlement so the
        // hero membership card flips to "YOU ARE PRO". `settingsError`
        // shows the resolving-state hero with `entitlementStatus = .unknown`.
        case settings
        case settingsLoaded
        case settingsError
        case deleteAccount
        case deleteAccountError
        case discord
        case iosWidget
        case secretSettings
        case paywall
        case customPaywall
        case paywallError
        case customerCenter
    }

    /// True when the requested target belongs to the B08 settings/paywall
    /// cluster — used by `ScreenshotHarnessView` to stage the AuthStore into
    /// `.authenticated` on appear so gated rows render in screenshots.
    static var isSettingsClusterTarget: Bool {
        switch target {
        case .settings, .settingsLoaded, .settingsError,
             .deleteAccount, .deleteAccountError,
             .discord, .iosWidget,
             .secretSettings, .paywall, .customPaywall, .paywallError, .customerCenter:
            return true
        default:
            return false
        }
    }

    static var isActive: Bool {
        ProcessInfo.processInfo.arguments.contains("-uiScreenshotMode")
    }

    /// Parses the value after `-uiScreenshotMode` (e.g. `… -uiScreenshotMode emailLogin`).
    /// Defaults to `.mainTabs` for backwards compatibility with the B03 harness.
    static var target: Target {
        let args = ProcessInfo.processInfo.arguments
        guard let flagIndex = args.firstIndex(of: "-uiScreenshotMode"),
              flagIndex + 1 < args.count,
              let parsed = Target(rawValue: args[flagIndex + 1])
        else {
            return .mainTabs
        }
        return parsed
    }

    /// Reads `-onboardingStep <1...24>` for the `onboardingPage` target.
    /// Falls back to `.terms` on missing/invalid values.
    static var onboardingStepArg: OnboardingStore.Step {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "-onboardingStep"),
              idx + 1 < args.count,
              let raw = Int(args[idx + 1]),
              let step = OnboardingStore.Step(rawValue: raw)
        else { return .terms }
        return step
    }

    /// Reads `-onboardingBettor <casual|serious|professional>` so
    /// bettor-type theming can be exercised per page. Default: casual.
    static var onboardingBettorArg: OnboardingStore.BettorType {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "-onboardingBettor"),
              idx + 1 < args.count,
              let parsed = OnboardingStore.BettorType(rawValue: args[idx + 1].lowercased())
        else { return .casual }
        return parsed
    }

    /// True when `-showSideMenu 1` (or any non-zero value) is present. The
    /// `mainTabs` harness path pre-opens the hamburger sheet for the parity
    /// screenshot.
    static var openSideMenu: Bool {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "-showSideMenu"),
              idx + 1 < args.count
        else { return false }
        return args[idx + 1] != "0"
    }

    /// Reads the `-tab <slug>` launch arg and maps it to a `MainTabStore.Tab`.
    /// Used by the `mainTabs` harness path to land on a specific tab. Falls
    /// back to `.games` for unknown / missing values.
    @MainActor
    static var initialTab: MainTabStore.Tab {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "-tab"),
              idx + 1 < args.count
        else { return .games }
        switch args[idx + 1].lowercased() {
        case "games", "feed": return .games
        case "props": return .props
        case "outliers": return .outliers
        case "scoreboard", "scores": return .scoreboard
        case "settings": return .settings
        case "search": return .search
        default: return .games
        }
    }
}

/// DEBUG showcase for the redesigned agent-detail picks section. Renders the
/// idle `AgentGeneratePrompt` (shimmer CTA + tucked autopilot chip) in both
/// autopilot states, and the live polling `AgentGenerationCard` (avatar shrunk to
/// the corner, orange 3×3 glyph, action verbs, pixel loading bar, stacked tool
/// skeletons), driven by a SIMULATED Trigger.dev run that steps through
/// phases/turns on a loop. Mounted via `-uiScreenshotMode agentHeaderShowcase` so
/// it can be verified without a live agent or network.
struct AgentHeaderShowcase: View {
    let agent: Agent
    @State private var run: TriggerV3RunStatus?

    private var accent: Color { AgentColorPalette.primary(for: agent.avatarColor) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                section("Idle · autopilot on") {
                    idlePrompt(auto: true).padding(14)
                }
                section("Idle · autopilot off") {
                    idlePrompt(auto: false).padding(14)
                }
                section("Generating (live sim)") {
                    AgentGenerationCard(
                        spriteIndex: agent.spriteIndex,
                        accent: accent,
                        state: run,
                        isGenerating: true,
                        canGenerate: true,
                        lockedLabel: "Daily limit reached",
                        onGenerate: {}
                    )
                    .padding(6)
                }
            }
            .padding(16)
        }
        .preferredColorScheme(.dark)
        .background(AgentPixelWaveBackground(avatarColor: agent.avatarColor).ignoresSafeArea())
        .task { await driveSimulation() }
    }

    @ViewBuilder
    private func idlePrompt(auto: Bool) -> some View {
        AgentGeneratePrompt(
            accent: accent,
            title: "You can generate your picks right now",
            subtitle: auto
                ? "Or wait — autopilot runs daily at 9:00 AM ET. 3 of 3 manual regenerations remaining today."
                : "3 of 3 manual regenerations remaining today.",
            autoGenerate: auto,
            onToggleAuto: { _ in },
            canGenerate: true,
            buttonLabel: "Generate Today's Picks",
            onGenerate: {}
        )
    }

    @ViewBuilder
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.appTextSecondary)
            content()
                .frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(0.03)))
        }
    }

    /// Loops a fake run through starting → collecting → reasoning → finalizing,
    /// stepping turn + toolCalls so the bar fills and the circles accumulate.
    private func driveSimulation() async {
        let tools = ["get_slate", "get_model_predictions", "get_market_odds", "get_polymarket",
                     "get_weather", "get_injuries", "get_recent_form", "get_line_movement",
                     "get_editor_picks", "submit_picks"]
        var loop = 0
        while !Task.isCancelled {
            loop += 1
            for i in 0...tools.count {
                if Task.isCancelled { return }
                let tool = i < tools.count ? tools[i] : nil
                let phase = i == 0 ? "starting" : (i < 4 ? "loading_slate" : (i < tools.count ? "analyzing" : "finalizing"))
                let picks = i >= tools.count ? 2 : (i >= 8 ? 1 : 0)
                run = Self.mockRun(id: "sim_\(loop)", phase: phase, tool: tool, turn: i + 1, toolCalls: i, picks: picks)
                try? await Task.sleep(nanoseconds: 850_000_000)
            }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
        }
    }

    static func mockRun(id: String, phase: String, tool: String?, turn: Int, toolCalls: Int, picks: Int) -> TriggerV3RunStatus? {
        let toolField = tool.map { "\"\($0)\"" } ?? "null"
        let json = """
        {"id":"\(id)","status":"EXECUTING","metadata":{"phase":"\(phase)","currentTool":\(toolField),"turn":\(turn),"maxTurns":12,"toolCalls":\(toolCalls),"picksAccepted":\(picks)}}
        """
        return try? JSONDecoder().decode(TriggerV3RunStatus.self, from: Data(json.utf8))
    }
}

#endif
