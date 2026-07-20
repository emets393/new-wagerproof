import SwiftUI
import WagerproofDesign
import WagerproofStores

/// The signed-in app's tab shell. Four visible content tabs plus a detached
/// Search role (iOS 18+ — renders as a separate pill outside the bar on
/// iOS 26, as a fifth tab cell on iOS 18.x):
///
///     Games · Props · Agents · Outliers       🔍 (detached)
///
/// Props sits second so the player-props surface is one tap from launch.
/// The live Scoreboard tab was removed (the code stays in `Features/Scoreboard/`
/// for a possible future return).
///
/// Settings was removed from the bar; it now opens as a PUSHED PAGE on the
/// active tab's own `NavigationStack` (tap the WagerProof wordmark in the
/// top-leading slot), driven by `MainTabStore.isSettingsPresented` and the
/// per-tab `.wagerProofSettingsDestination`. Picks, Roast, Feature Requests,
/// and the Learn walkthrough still present as sheets from this same shell —
/// chained sheets inside a child view orphan presentations on iOS, so the
/// shell is the single source of truth for those modals.
///
/// Why the new `Tab(...)` builder API (iOS 18+) instead of `.tabItem`:
///   The detached-search-icon pattern the user asked for requires
///   `Tab(role: .search)`. That role isn't expressible on `.tabItem`. The
///   project's deployment target was bumped to iOS 18.0 in `project.yml` /
///   `Package.swift` to unlock it.
struct MainTabView: View {
    @Environment(RootRouter.self) private var rootRouter
    @Environment(AuthStore.self) private var auth
    // B21 — the Learn WagerProof walkthrough is presented globally from this
    // shell so any screen can call `learnStore.openSheet(...)` and the sheet
    // mounts in one well-known place.
    @Environment(LearnWagerProofStore.self) private var learnStore
    @Environment(AdminModeStore.self) private var adminMode
    #if DEBUG
    @Environment(DebugDataModeStore.self) private var debugDataMode
    #endif
    @State private var tabStore: MainTabStore
    // Per-sport game-detail stores live at the tab shell so every surface
    // (GamesView grid, OutliersView matchup cards, SearchView results) can
    // open the same detail page via the same store. GamesView's
    // NavigationStack observes these and pushes the detail screen when
    // `selectedGame` flips non-nil.
    @State private var nflSheetStore = NFLGameSheetStore()
    @State private var cfbSheetStore = CFBGameSheetStore()
    @State private var nbaSheetStore = NBAGameSheetStore()
    @State private var ncaabSheetStore = NCAABGameSheetStore()
    @State private var mlbSheetStore = MLBGameSheetStore()
    // GamesStore also lives at the tab shell so OutliersView / SearchView
    // can look up the actual typed game model from an alert's gameId
    // before asking the corresponding sport sheet store to open it.
    @State private var gamesStore = GamesStore()
    // PropsStore is hoisted to the shell so BOTH the Props tab and the MLB
    // game-detail "Player Props" widget read the same player-prop slate (one
    // fetch, shared 5-min cache) and link to the same detail pages.
    @State private var propsStore = PropsStore()
    // MLB trends + F5 slates live at the shell so the game-detail widgets and
    // SearchView's insight chips share one fetch. NOT eagerly hydrated —
    // sheets/carousel/search hydrate lazily via TTL-guarded calls.
    @State private var mlbTrendsStore = MLBBettingTrendsStore()
    @State private var mlbF5Store = MLBF5SplitsStore()
    // Outliers trend slate is shell-hoisted so the Outliers tab AND SearchView's
    // "Outliers" results section read the same fetch. Lazily hydrated by whichever
    // surface is used first (the tab's `.task` or search's first query).
    @State private var outliersTrendsStore = OutliersTrendsStore()
    // Parlay God tickets feed four surfaces (Outliers rail, Search rail,
    // Props Cheats, matchup widgets) — one fetch + one leg pool at the shell.
    @State private var parlayGodStore = ParlayGodStore()

    /// Production callers use the default initializer. The screenshot harness
    /// can pass a starting tab + an optional pre-opened side menu so reviewer
    /// parity grids cover all five slots plus the hamburger sheet.
    init(initialTab: MainTabStore.Tab = .games, openSideMenu: Bool = false) {
        let store = MainTabStore()
        store.select(initialTab)
        if openSideMenu { store.isSideMenuPresented = true }
        _tabStore = State(initialValue: store)
        #if DEBUG
        // Harness hooks: `-propsSport nfl` / `-gamesSport nfl` land the Props
        // and Games tabs on a specific sport segment (same family as `-tab` /
        // `-showSideMenu`) — there's no tap automation in the screenshot
        // pipeline to switch segments post-launch.
        let args = ProcessInfo.processInfo.arguments
        if let idx = args.firstIndex(of: "-propsSport"), idx + 1 < args.count,
           let sport = PropsStore.Sport(rawValue: args[idx + 1].lowercased()) {
            propsStore.selectedSport = sport
        }
        if let idx = args.firstIndex(of: "-gamesSport"), idx + 1 < args.count,
           let sport = GamesStore.Sport(rawValue: args[idx + 1].lowercased()) {
            gamesStore.selectedSport = sport
        }
        #endif
    }

    var body: some View {
        @Bindable var binding = tabStore
        TabView(selection: $binding.selected) {
            Tab("Games", systemImage: "trophy.fill", value: MainTabStore.Tab.games) {
                gamesTab
            }

            Tab("Props", systemImage: "figure.basketball", value: MainTabStore.Tab.props) {
                propsTab
            }

            Tab("Agents", systemImage: "brain.head.profile", value: MainTabStore.Tab.agents) {
                agentsTab
            }

            Tab("Outliers", systemImage: "bell.badge.fill", value: MainTabStore.Tab.outliers) {
                outliersTab
            }

            // Detached search role (iOS 18+). On iOS 26 this renders as a
            // standalone pill outside the bar; on 18.x it falls back to a
            // fifth tab cell. On iOS 27 this tab gets the detached
            // trailing-edge "prominent" circle, but ONLY in combination with
            // `.tabViewSearchActivation(.searchTabSelection)` below — see
            // UITabBarController.prominentTabIdentifier header docs: the
            // search tab is prominent-by-default only when selecting it
            // auto-activates search. Don't use `role: .prominent` here: it
            // drops the search semantics (no field-morph transition).
            // Needs a `value:` because `TabView(selection:)` requires every
            // `Tab` to share a value type. SearchView owns its own
            // NavigationStack and calls back into the tab shell via the
            // env-injected `MainTabStore` to switch tabs / open detail
            // sheets on result tap.
            Tab(value: MainTabStore.Tab.search, role: .search) {
                SearchView()
            }
        }
        // Brand green tint replaces the system blue accent. Matches RN's
        // hardcoded `#00E676` active tab color in the FloatingTabBar.
        .tint(Color(hex: 0x00E676))
        // Collapse the tab bar into a compact pill as the user scrolls down
        // a tab's content, expanding again on scroll up (iOS 26 Liquid Glass
        // behavior). No-op on earlier OSes.
        .tabBarMinimizeOnScroll()
        // NOTE: we deliberately do NOT auto-activate search on tab selection.
        // SearchView is a browsable launchpad (Explore cards, recents, sport
        // chips) meant to be used without the keyboard — auto-focusing the
        // field on every tab tap fought that. `role: .search` still gives the
        // detached prominent search button on iOS 26; the user taps the field
        // to start typing.
        .environment(tabStore)
        .environment(gamesStore)
        .environment(propsStore)
        .environment(mlbTrendsStore)
        .environment(mlbF5Store)
        .environment(outliersTrendsStore)
        .environment(parlayGodStore)
        .environment(nflSheetStore)
        .environment(cfbSheetStore)
        .environment(nbaSheetStore)
        .environment(ncaabSheetStore)
        .environment(mlbSheetStore)
        // Settings is NOT presented from the shell anymore — each tab pushes it
        // onto its own NavigationStack via `.wagerProofSettingsDestination`
        // (tapping the WagerProof wordmark). That makes it a real page (slides
        // in from the right, keeps the app's nav feel) instead of a modal cover
        // that read as a bottom sheet. `MainTabStore.isSettingsPresented` is
        // still the single flag the wordmark, side menu, and WagerBot upsell
        // flip; the per-tab destination consumes it for the on-screen tab.
        //
        // WagerBot chat is now a real PAGE pushed onto each tab's own
        // NavigationStack via `.wagerProofChatDestination` (same treatment as
        // Settings), not a bottom sheet. The sparkles toolbar icon flips
        // `isChatPresented`; the active tab's destination consumes it. The tab
        // shell's `.environment(...)` values (below) propagate into the pushed
        // page automatically, so no re-injection is needed.
        .sheet(isPresented: $binding.isSideMenuPresented) {
            SideMenuSheet()
                .environment(tabStore)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        // Feature Requests (B09) lives outside the visible tab bar. We
        // present it from the tab shell as a sheet so the side menu can
        // dismiss itself first and then flip the flag — sheets can't be
        // chained inside another sheet without flicker.
        .sheet(isPresented: $binding.isFeatureRequestsPresented) {
            FeatureRequestsView()
                .environment(tabStore)
        }
        // Roast (B19) — same side-menu-then-cover pattern as Feature
        // Requests, but presented as a full-screen cover so the immersive
        // gradient + bottom mic CTA fill the screen.
        .fullScreenCover(isPresented: $binding.isRoastPresented) {
            RoastView()
                .environment(tabStore)
        }
        // B21 — global Learn WagerProof walkthrough sheet.
        .sheet(item: Bindable(learnStore).activeTopic) { _ in
            LearnWagerProofBottomSheet(store: learnStore)
        }
        // Consume any deep link that arrived before `.ready` (or while we
        // were already there). RootRouter buffers the route into
        // pendingDeepLinkRoute on `handle(deepLink:)`; we read+clear here.
        .onChange(of: rootRouter.phase, initial: true) { _, newPhase in
            guard newPhase == .ready else { return }
            if let route = rootRouter.consumePendingDeepLink() {
                tabStore.apply(deepLink: route)
            }
        }
        .onChange(of: rootRouter.pendingDeepLinkRoute) { _, route in
            guard rootRouter.phase == .ready, route != nil else { return }
            if let consumed = rootRouter.consumePendingDeepLink() {
                tabStore.apply(deepLink: consumed)
            }
        }
        .sensoryFeedback(.selection, trigger: tabStore.selected)
        .onChange(of: tabStore.selected) { _, newTab in
            // Games ↔ Props sport pickers stay in sync when switching tabs.
            switch newTab {
            case .props:
                propsStore.selectedSport = PropsStore.Sport.matching(gamesSport: gamesStore.selectedSport)
            case .games:
                gamesStore.selectedSport = propsStore.selectedSport.gamesSport
            default:
                break
            }
        }
        .task {
            syncDryRunPreviewEnabled()
            // Eagerly hydrate GamesStore at the shell so cross-tab surfaces
            // (Outliers matchup taps, SearchView results) can resolve a
            // gameId to a typed game on first interaction — not only after
            // the user has visited the Games tab.
            await gamesStore.refreshAll()
        }
        .onChange(of: adminMode.adminModeEnabled) { _, _ in
            syncDryRunPreviewEnabled()
            Task { await gamesStore.refreshAll(force: true) }
        }
        .onChange(of: adminMode.isAdmin) { _, _ in
            syncDryRunPreviewEnabled()
            Task {
                await gamesStore.refreshAll(force: true)
                await propsStore.refreshNFL(force: true)
            }
        }
        #if DEBUG
        // Flipping Dummy Data Mode (Secret Settings) force-reloads the slate so
        // the Games tab swaps between live + fixtures without a relaunch.
        .onChange(of: debugDataMode.enabled) { _, _ in
            Task { await gamesStore.refreshAll(force: true) }
        }
        #endif
    }

    /// Keep dry-run preview flags in sync with Secret Settings admin mode.
    private func syncDryRunPreviewEnabled() {
        let enabled = adminMode.dryRunPreviewEnabled
        gamesStore.dryRunPreviewEnabled = enabled
        propsStore.dryRunPreviewEnabled = enabled
    }

    // MARK: - Tab content

    /// Real Games tab content (B04). `GamesView` owns its own
    /// `NavigationStack`; this wrapper just adds the offline banner.
    @ViewBuilder
    private var gamesTab: some View {
        ZStack(alignment: .top) {
            GamesView()
            OfflineBanner()
        }
    }

    /// Real Agents tab content (B13). `AgentsView` owns its own
    /// `NavigationStack`.
    @ViewBuilder
    private var agentsTab: some View {
        ZStack(alignment: .top) {
            AgentsView()
            OfflineBanner()
        }
    }

    /// Real Outliers tab content (B06). `OutliersView` owns its own
    /// `NavigationStack`.
    @ViewBuilder
    private var outliersTab: some View {
        ZStack(alignment: .top) {
            OutliersView()
            OfflineBanner()
        }
    }

    /// Props tab content — MLB player-prop matchups feed. `PropsView` owns
    /// its own `NavigationStack` + `PropsStore`, and pushes the player-prop
    /// detail page (trend chart + line slider) from each list-item card.
    @ViewBuilder
    private var propsTab: some View {
        ZStack(alignment: .top) {
            PropsView()
            OfflineBanner()
        }
    }
}

private extension View {
    /// Apply iOS 26's `tabBarMinimizeBehavior(.onScrollDown)` when the SDK
    /// supports it; otherwise leave the view untouched so we stay buildable
    /// against the iOS 18 deployment floor.
    @ViewBuilder
    func tabBarMinimizeOnScroll() -> some View {
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }
}
